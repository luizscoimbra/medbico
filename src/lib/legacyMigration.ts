import { del, get, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toJson } from "@/lib/db";
import { getAllMeasurements } from "@/lib/measurementStorage";
import { SETTINGS_KEYS, getSetting, setSetting } from "@/lib/settingsStorage";
import { getAllCalculosCalda, saveCalculoCalda, type CalculoCaldaRecord } from "@/lib/caldaStorage";
import { saveAfericao, type AfericaoVazaoRecord } from "@/lib/vazaoStorage";
import { saveArea, type AreaCadastro } from "@/lib/areaStorage";
import { saveTipoAplicacao, type TipoAplicacao } from "@/lib/applicationTypeStorage";
import { saveCliente, type Cliente } from "@/lib/clienteStorage";
import { saveComponente, type ComponenteCatalogo } from "@/lib/componenteStorage";
import { saveEquipment, type Equipment } from "@/lib/equipmentStorage";
import { saveFornecedor, type Fornecedor } from "@/lib/fornecedorStorage";
import { saveOperador, type Operador } from "@/lib/operatorStorage";
import { saveOS, type OrdemServico } from "@/lib/osStorage";
import { salvarTituloPagar, type TituloPagar } from "@/lib/contasPagarStorage";
import { salvarTituloReceber, type TituloReceber } from "@/lib/financeiroStorage";
import { saveWaterTruck, getAllWaterTrucks, type WaterTruck } from "@/lib/waterTruckStorage";

/**
 * Migração única dos dados que ainda estavam no navegador.
 *
 * Antes desta etapa, OS, Clientes, Financeiro, Aferições e parte do cadastro
 * viviam no IndexedDB do usuário. Limpar o histórico do navegador ou trocar de
 * máquina significava perder ordens de serviço e títulos financeiros — o risco
 * classificado como Crítico no relatório de auditoria.
 *
 * Este módulo lê o que sobrou no navegador e grava tudo no PostgreSQL,
 * preservando os identificadores originais para não quebrar as referências
 * cruzadas (OS ← abastecimento, item de estoque ← componente, etc.).
 *
 * A execução é idempotente: os identificadores são preservados e as gravações
 * usam upsert, então rodar de novo apenas sobrescreve com o mesmo conteúdo.
 */

const MARKER_KEY = "herbilog_legacy_migration_v2";
const LEGACY_DATE = "1970-01-01T00:00:00.000Z";

export interface LegacyMigrationResult {
  executada: boolean;
 jaConcluida: boolean;
  migrados: Record<string, number>;
  avisos: string[];
}

/** Chaves do app que interestam ao backup — nunca inclui a sessão do Supabase. */
const LOCALSTORAGE_KEYS = ["measurements", "historico_calda", "waterTrucks", "customFormulations"] as const;

const PREFIXOS_IDB = [
  "os-",
  "area-",
  "tipo-aplicacao-",
  "afericao-vazao-",
  "calculo-calda-",
  "titulo-receber-",
  "titulo-pagar-",
  "fornecedor-",
] as const;

const CHAVES_IDB_EXATAS: readonly string[] = [
  "medbico_clientes",
  "medbico_operadores",
  "medbico_equipamentos",
  "medbico_componentes_catalogo",
  "medbico_fornecedores",
] as const;

/**
 * A chave pertence ao HerbiLog?
 *
 * O IndexedDB do navegador é compartilhado com o cache de bibliotecas e com
 * outros aplicativos do mesmo domínio. Só as chaves que o app gravava podem ser
 * lidas ou apagadas  as demais pertencem a outra coisa e precisam sobreviver.
 */
function isLegacyIdbKey(chave: string): boolean {
  return PREFIXOS_IDB.some((p) => chave.startsWith(p)) || CHAVES_IDB_EXATAS.includes(chave);
}

async function lerLocalStorage(chave: string): Promise<unknown> {
  try {
    const raw = localStorage.getItem(chave);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Lê o IndexedDB legacy apenas com as chaves conhecidas do app. */
async function lerIndexedDB(): Promise<Record<string, unknown>> {
  const todas = await keys().catch(() => [] as IDBValidKey[]);
  const out: Record<string, unknown> = {};
  for (const chave of todas) {
    if (typeof chave !== "string" || !isLegacyIdbKey(chave)) continue;
    const valor = await get(chave).catch(() => undefined);
    if (valor !== undefined) out[chave] = valor;
  }
  return out;
}

function comoArray<T>(valor: unknown): T[] {
  return Array.isArray(valor) ? (valor as T[]) : [];
}

/** `historico_calda` (localStorage) e `calculo-calda-*` (IndexedDB) → spray_mix_recipes. */
function normalizarCalda(record: Record<string, unknown>): CalculoCaldaRecord {
  return {
    id: String(record.id ?? `calda-${Date.now()}`),
    data: String(record.data ?? LEGACY_DATE),
    talhao: String(record.talhao ?? ""),
    areaTalhao: Number(record.areaTalhao ?? record.area_talhao ?? 0),
    vazaoTrabalho: Number(record.vazaoTrabalho ?? record.vazao_trabalho ?? 0),
    capacidadeTanque: Number(record.capacidadeTanque ?? record.capacidade_tanque ?? 0),
    produtos: comoArray(record.produtos),
    volumeTotalCalda: Number(record.volumeTotal ?? record.volume_total_calda ?? 0),
    tanquesCheios: Number(record.tanquesCheios ?? record.tanques_cheios ?? 0),
    volumeRestante: Number(record.volumeRestante ?? record.volume_restante ?? 0),
    tanquesNecessarios: Number(record.tanquesNecessarios ?? record.tanques_necessarios ?? 0),
    frota: record.frota ? String(record.frota) : undefined,
    trator: record.trator ? String(record.trator) : undefined,
    modo: record.modo ? String(record.modo) : undefined,
    createdAt: String(record.createdAt ?? record.data ?? LEGACY_DATE),
  };
}

async function migrarHistoricoCalda(
  idb: Record<string, unknown>,
  avisos: string[]
): Promise<number> {
  const existentes = await getAllCalculosCalda().catch(() => [] as CalculoCaldaRecord[]);
  const jaMigrados = new Set(existentes.map((c) => c.id));

  const candidatos = new Map<string, unknown>();
  for (const [chave, valor] of Object.entries(idb)) {
    if (chave.startsWith("calculo-calda-")) candidatos.set(chave.replace("calculo-calda-", ""), valor);
  }
  for (const item of comoArray<Record<string, unknown>>(await lerLocalStorage("historico_calda"))) {
    if (item?.id) candidatos.set(String(item.id), item);
  }

  let migrados = 0;
  for (const [id, valor] of candidatos) {
    if (jaMigrados.has(id)) continue;
    try {
      await saveCalculoCalda(normalizarCalda({ ...(valor as object), id }));
      migrados++;
    } catch (e) {
      avisos.push(`Calda ${id}: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }
  return migrados;
}

async function migrarHistoricoMedicoes(avisos: string[]): Promise<number> {
  const legadas = comoArray<Record<string, unknown>>(await lerLocalStorage("measurements"));
  if (legadas.length === 0) return 0;

  const existentes = await getAllMeasurements().catch(() => []);
  const jaMigrados = new Set(existentes.map((m) => m.id));

  let migrados = 0;
  for (const item of legadas) {
    const id = item.id ? String(item.id) : `med-${Date.now()}-${migrados}`;
    if (jaMigrados.has(id)) continue;
    try {
      // O cliente do Supabase resolve a promessa mesmo quando a gravação falha:
      // sem inspecionar `error`, a medição era contada como migrada, a lista de
      // avisos ficava vazia e a migração era marcada como concluída — o
      // registro sumia sem ninguém perceber.
      const { error } = await supabase.from("nozzle_measurements").upsert(
        { id, payload: toJson(item) },
        { onConflict: "id" }
      );
      if (error) throw error;
      migrados++;
    } catch (e) {
      avisos.push(`Medição ${id}: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }
  return migrados;
}

async function migrarPreferencias(avisos: string[]): Promise<number> {
  let migrados = 0;

  // Caminhões pipa: a migration 20261009120400 já copiou o JSON de
  // app_settings para a tabela; aqui pegamos o que ainda estiver só no
  // navegador e gravamos direto em water_trucks.
  const trucksLegados = comoArray<WaterTruck>(await lerLocalStorage("waterTrucks"));
  if (trucksLegados.length > 0) {
    try {
      const existentes = new Set((await getAllWaterTrucks().catch(() => [])).map((t) => t.id));
      for (const truck of trucksLegados) {
        if (!truck?.id || existentes.has(truck.id)) continue;
        await saveWaterTruck({
          id: truck.id,
          fleet_number: String(truck.fleet_number ?? ""),
          model: String(truck.model ?? ""),
          capacity: Number(truck.capacity) || 0,
        });
        migrados++;
      }
    } catch (e) {
      avisos.push(`Caminhão pipa: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }

  const custom = await lerLocalStorage("customFormulations");
  if (custom != null) {
    try {
      const atual = await getSetting<unknown>(SETTINGS_KEYS.customFormulations, null);
      if (atual == null) {
        await setSetting(SETTINGS_KEYS.customFormulations, custom);
        migrados++;
      }
    } catch (e) {
      avisos.push(`Preferência customFormulations: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }
  return migrados;
}

/**
 * Executa a migração uma única vez. Seguro para chamar em todo boot do app:
 * retorna imediatamente quando a versão já foi concluída neste navegador.
 */
export async function runLegacyMigration(): Promise<LegacyMigrationResult> {
  const vazio: LegacyMigrationResult = {
    executada: false,
    jaConcluida: false,
    migrados: {},
    avisos: [],
  };

  try {
    if (localStorage.getItem(MARKER_KEY)) return { ...vazio, jaConcluida: true };

    const idb = await lerIndexedDB().catch(() => ({}) as Record<string, unknown>);
    const avisos: string[] = [];
    const migrados: Record<string, number> = {};

    // ── Ordens de serviço ────────────────────────────────────────────────
    const ordens: OrdemServico[] = [];
    for (const [chave, valor] of Object.entries(idb)) {
      if (!chave.startsWith("os-") || chave.startsWith("os-counter-")) continue;
      ordens.push(valor as OrdemServico);
    }
    let n = 0;
    for (const os of ordens) {
      try {
        if (os?.id) {
          await saveOS(os);
          n++;
        }
      } catch (e) {
        avisos.push(`OS ${os?.id ?? "?"}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.orders_of_service = n;

    // ── Clientes ─────────────────────────────────────────────────────────
    n = 0;
    for (const cliente of comoArray<Cliente>(idb.medbico_clientes)) {
      try {
        if (cliente?.id) {
          await saveCliente(cliente);
          n++;
        }
      } catch (e) {
        avisos.push(`Cliente ${cliente?.id ?? "?"}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.clients = n;

    // ── Operadores ───────────────────────────────────────────────────────
    n = 0;
    for (const op of comoArray<Operador>(idb.medbico_operadores)) {
      try {
        if (op?.id) {
          await saveOperador(op);
          n++;
        }
      } catch (e) {
        avisos.push(`Operador ${op?.id ?? "?"}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.operators = n;

    // ── Equipamentos ─────────────────────────────────────────────────────
    n = 0;
    for (const eq of comoArray<Equipment>(idb.medbico_equipamentos)) {
      try {
        if (eq?.id) {
          await saveEquipment(eq);
          n++;
        }
      } catch (e) {
        avisos.push(`Equipamento ${eq?.id ?? "?"}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.equipment = n;

    // ── Componentes de drone ─────────────────────────────────────────────
    n = 0;
    for (const comp of comoArray<ComponenteCatalogo>(idb.medbico_componentes_catalogo)) {
      try {
        if (comp?.id) {
          await saveComponente(comp);
          n++;
        }
      } catch (e) {
        avisos.push(`Componente ${comp?.id ?? "?"}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.component_catalog = n;

    // ── Fornecedores ─────────────────────────────────────────────────────
    n = 0;
    const fornecedores = new Map<string, Fornecedor>();
    for (const f of comoArray<Fornecedor>(idb.medbico_fornecedores)) if (f?.nome) fornecedores.set(String(f.id ?? f.nome), f);
    for (const [chave, valor] of Object.entries(idb)) {
      if (chave.startsWith("fornecedor-") && (valor as Fornecedor)?.nome) {
        fornecedores.set(chave.replace("fornecedor-", ""), valor as Fornecedor);
      }
    }
    for (const f of fornecedores.values()) {
      try {
        await saveFornecedor(f);
        n++;
      } catch (e) {
        avisos.push(`Fornecedor ${f.nome}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.suppliers = n;

    // ── Áreas ────────────────────────────────────────────────────────────
    n = 0;
    for (const [chave, valor] of Object.entries(idb)) {
      if (!chave.startsWith("area-")) continue;
      try {
        await saveArea(valor as AreaCadastro);
        n++;
      } catch (e) {
        avisos.push(`Área ${chave}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.service_areas = n;

    // ── Tipos de aplicação ───────────────────────────────────────────────
    n = 0;
    for (const [chave, valor] of Object.entries(idb)) {
      if (!chave.startsWith("tipo-aplicacao-")) continue;
      try {
        await saveTipoAplicacao(valor as TipoAplicacao);
        n++;
      } catch (e) {
        avisos.push(`Tipo ${chave}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.application_types = n;

    // ── Aferições de vazão ───────────────────────────────────────────────
    n = 0;
    for (const [chave, valor] of Object.entries(idb)) {
      if (!chave.startsWith("afericao-vazao-")) continue;
      try {
        await saveAfericao(valor as AfericaoVazaoRecord);
        n++;
      } catch (e) {
        avisos.push(`Aferição ${chave}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.spray_calibrations = n;

    // ── Caldas ───────────────────────────────────────────────────────────
    migrados.spray_mix_recipes = await migrarHistoricoCalda(idb, avisos);

    // ── Títulos a receber ────────────────────────────────────────────────
    n = 0;
    for (const [chave, valor] of Object.entries(idb)) {
      if (!chave.startsWith("titulo-receber-") || chave === "titulo-receber-counter") continue;
      try {
        await salvarTituloReceber(valor as TituloReceber);
        n++;
      } catch (e) {
        avisos.push(`Título a receber ${chave}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.financial_receivables = n;

    // ── Títulos a pagar ──────────────────────────────────────────────────
    n = 0;
    for (const [chave, valor] of Object.entries(idb)) {
      if (!chave.startsWith("titulo-pagar-") || chave === "titulo-pagar-counter") continue;
      try {
        await salvarTituloPagar(valor as TituloPagar);
        n++;
      } catch (e) {
        avisos.push(`Título a pagar ${chave}: ${e instanceof Error ? e.message : "erro"}`);
      }
    }
    migrados.financial_payables = n;

    // ── Medições e preferências ──────────────────────────────────────────
    migrados.nozzle_measurements = await migrarHistoricoMedicoes(avisos);
    migrados.app_settings = await migrarPreferencias(avisos);

    // Só marca como concluída se não houve erro. Havendo falhas, a migração
    // roda de novo no próximo acesso e tenta de novo apenas o que falta
    // (as gravações são upsert, então repetir é seguro).
    if (avisos.length === 0) localStorage.setItem(MARKER_KEY, new Date().toISOString());

    return { executada: true, jaConcluida: false, migrados, avisos };
  } catch (e) {
    return {
      ...vazio,
      avisos: [e instanceof Error ? e.message : "Falha inesperada na migração."],
    };
  }
}

/** Limpa o marcador para forçar nova execução (uso administrativo). */
export function resetLegacyMigration(): void {
  localStorage.removeItem(MARKER_KEY);
}

/** Remove os dados legados do navegador depois de uma migração bem-sucedida. */
export async function purgeLegacyLocalData(): Promise<void> {
  const chaves = await keys().catch(() => [] as IDBValidKey[]);
  for (const chave of chaves) {
    // Só remove chaves do app; qualquer outra entrada do IndexedDB pertence a
    // outra biblioteca do mesmo domínio e precisa sobreviver. O marcador de
    // migração vive no localStorage, então nunca aparece aqui.
    if (typeof chave === "string" && isLegacyIdbKey(chave)) {
      await del(chave).catch(() => undefined);
    }
  }
  for (const chave of LOCALSTORAGE_KEYS) localStorage.removeItem(chave);
}

/** Dispara a migração e informa o usuário. Silencioso quando não há o que fazer. */
export async function runLegacyMigrationWithFeedback(): Promise<void> {
  const r = await runLegacyMigration();
  if (!r.executada || r.jaConcluida) return;

  const total = Object.values(r.migrados).reduce((s, v) => s + v, 0);
  if (total === 0) {
    localStorage.setItem(MARKER_KEY, new Date().toISOString());
    return;
  }

  if (r.avisos.length === 0) {
    toast.success(
      `${total} registro(s) do armazenamento local do navegador foram migrados para a nuvem.`,
      { duration: 8000 }
    );
  } else {
    toast.warning(
      `${total} registro(s) migrados, mas ${r.avisos.length} falharam. Rode o backup antes de limpar o navegador.`,
      { duration: 10000 }
    );
  }
}