import { supabase } from "@/integrations/supabase/client";
import { requireUserId, tabelaDynamic, toJson } from "@/lib/db";

/**
 * Backup e restauração do sistema em arquivo único.
 *
 * A auditoria classificou como Crítica a perda de dados: parte das entidades
 * vivia no navegador, e limpar o histórico apagava ordens de serviço, títulos
 * financeiros e cadastros sem forma de recuperação. Este módulo garante que
 * exista, a qualquer momento, uma cópia completa e portátil de tudo.
 *
 * O arquivo `.json` contém metadados (versão do esquema, tenant, data) e uma
 * seção `dados` com todas as linhas por tabela, mais `resumo` com as
 * contagens para conferência rápida antes de restaurar.
 */

export const BACKUP_FORMAT_VERSION = 2;

/** Tabelas cobertas pelo backup, na ordem de restauração (dependências primeiro). */
export const BACKUP_TABLES = [
  "companies",
  "branches",
  "user_branches",
  "clients",
  "operators",
  "suppliers",
  "component_catalog",
  "service_areas",
  "application_types",
  "equipment",
  "water_trucks",
  "orders_of_service",
  "spray_calibrations",
  "spray_mix_recipes",
  "financial_receivables",
  "financial_payables",
  "nozzle_measurements",
  "app_settings",
  "stock_entries",
  "stock_settings",
  "products",
  "registered_products",
  "services",
  "drones",
  "drone_components",
  "flight_logs",
  "battery_cycles",
  "maintenance_schedules",
  "maintenance_records",
  "document_alerts",
  "pilots",
  "equipment_maintenance_items",
  "equipment_maintenance_schedules",
  "equipment_maintenance_records",
  "equipment_fuel_refuelings",
  "profiles",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Colunas da chave primária por tabela.
 *
 * A maioria das tabelas tem `id`, mas duas usam chave composta. Desde que o
 * saldo mínimo passou a ser por filial, a chave de `stock_settings` é
 * `(tenant_key, branch_key, item_key)`  usar a chave antiga faria o `upsert`
 * falhar com "não existe uma restrição única" e a tabela inteira cairia no
 * relatório de falha da restauração.
 */
const CHAVE_PRIMARIA: Record<string, string> = {
  app_settings: "tenant_key,key",
  stock_settings: "tenant_key,branch_key,item_key",
  user_branches: "user_id,branch_id",
};

/** Tabelas sem coluna `user_id` — o restore não pode injetá-la. */
const SEM_USER_ID = new Set(["companies", "branches"]);

export interface BackupFile {
  formato: "herbilog-backup";
  versao: number;
  gerado_em: string;
  empresa: string;
  usuario: string;
  resumo: Record<string, number>;
  dados: Partial<Record<BackupTable, Record<string, unknown>[]>>;
}

export interface RestoreResult {
  tabela: string;
  inserted: number;
  falha?: string;
}

export interface RestoreReport {
  resultados: RestoreResult[];
  totalInserido: number;
  totalFalha: number;
}

interface Perfil {
  id: string;
  full_name: string;
  company: string;
}

/**
 * Coleta todas as linhas visíveis ao usuário autenticado.
 *
 * As políticas de RLS já restringem o resultado à empresa do usuário, então a
 * exportação nunca vaza dados de outra empresa.
 */
export async function exportBackup(
  onProgress?: (tabela: string,done: number, total: number) => void
): Promise<BackupFile> {
  const { data: usuario } = await supabase.auth.getUser();
  const userId = usuario?.user?.id ?? "";

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, full_name, company")
    .eq("id", userId)
    .maybeSingle<Perfil>();

  const dados: Partial<Record<BackupTable, Record<string, unknown>[]>> = {};
  const resumo: Record<string, number> = {};

  let done = 0;
  for (const tabela of BACKUP_TABLES) {
    const { data, error } = await tabelaDynamic(tabela).select("*");
    if (error) {
      // Uma tabela indisponível não pode invalidar o backup inteiro.
      dados[tabela] = [];
      resumo[tabela] = -1;
    } else {
      dados[tabela] = (data ?? []) as Record<string, unknown>[];
      resumo[tabela] = dados[tabela]!.length;
    }
    done++;
    onProgress?.(tabela, done, BACKUP_TABLES.length);
  }

  return {
    formato: "herbilog-backup",
    versao: BACKUP_FORMAT_VERSION,
    gerado_em: new Date().toISOString(),
    empresa: perfil?.company ?? "",
    usuario: perfil?.full_name ?? usuario?.user?.email ?? "",
    resumo,
    dados,
  };
}

/** Baixa o backup como arquivo `herbilog-backup-AAAA-MM-DD-HHmm.json`. */
export function downloadBackup(backup: BackupFile): string {
  const agora = new Date();
  const carimbo = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, "0"),
    String(agora.getDate()).padStart(2, "0"),
    "-",
    String(agora.getHours()).padStart(2, "0"),
    String(agora.getMinutes()).padStart(2, "0"),
  ].join("");

  const nome = `herbilog-backup-${carimbo}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return nome;
}

function validarArquivo(objeto: unknown): BackupFile {
  const b = objeto as Partial<BackupFile> | null;
  if (!b || b.formato !== "herbilog-backup" || !b.dados) {
    throw new Error("Arquivo inválido: não parece um backup do HerbiLog.");
  }
  if (typeof b.versao !== "number" || b.versao > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Backup na versão ${b.versao} é mais recente que este sistema (${BACKUP_FORMAT_VERSION}). Atualize o aplicativo antes de restaurar.`
    );
  }
  return b as BackupFile;
}

export function parseBackup(texto: string): BackupFile {
  let objeto: unknown;
  try {
    objeto = JSON.parse(texto);
  } catch {
    throw new Error("Não foi possível ler o arquivo: JSON inválido.");
  }
  return validarArquivo(objeto);
}

/**
 * Restaura um backup.
 *
 * Por padrão apenas insere registros ausentes (`ignoreDuplicates`), o que torna
 * a restauração segura para repetir e não sobrescreve trabalho mais recente
 * feito na aplicação. Passe `modo="sobrescrever"` para substituir os dados
 * atuais pelos do arquivo.
 */
export async function restoreBackup(
  backup: BackupFile,
  opts: { modo?: "inserir" | "sobrescrever"; onProgress?: (tabela: string, done: number, total: number) => void } = {}
): Promise<RestoreReport> {
  const modo = opts.modo ?? "inserir";
  const userId = await requireUserId();

  // `profiles` é exceção: o id do usuário autenticado nunca pode ser trocado.
  const tabelas = BACKUP_TABLES.filter((t) => t !== "profiles");

  const resultados: RestoreResult[] = [];
  let done = 0;

  for (const tabela of tabelas) {
    const linhas = backup.dados[tabela];
    if (!Array.isArray(linhas) || linhas.length === 0) {
      done++;
      opts.onProgress?.(tabela, done, tabelas.length);
      continue;
    }

    try {
      // Tabelas de estrutura (empresa, filial, vínculo usuário↔filial) não têm
      // `user_id` ou não podem ter o dono alterado — injetá-lo quebraria o
      // vínculo de terceiros. Nos demais, `user_id` só entra quando a linha não
      // trouxe um (backup antigo); o dono original do arquivo é preservado.
      const valores = linhas.map((linha) =>
        toJson(SEM_USER_ID.has(tabela) || "user_id" in linha ? linha : { ...linha, user_id: userId }) as Record<string, unknown>
      );
      const conflito = CHAVE_PRIMARIA[tabela] ?? "id";

      if (modo === "sobrescrever" && !SEM_USER_ID.has(tabela)) {
        // Limpa a tabela antes de reinserir, para remover linhas que não
        // existem mais no arquivo de backup. Usa a primeira coluna da chave
        // (id, ou tenant_key nas tabelas de empresa) — a RLS já restringe a
        // remoção ao tenant do usuário, então nenhuma outra empresa é tocada.
        const coluna = conflito.split(",")[0];
        const { error: erroDelete } = await tabelaDynamic(tabela).delete().neq(coluna, "");
        if (erroDelete) throw new Error(erroDelete.message);

        const { error } = await tabelaDynamic(tabela).upsert(valores, { onConflict: conflito });
        if (error) throw error;
      } else {
        const { error } = await tabelaDynamic(tabela).upsert(valores, {
          onConflict: conflito,
          ignoreDuplicates: true,
        });
        if (error) throw error;
      }

      resultados.push({ tabela, inserted: linhas.length });
    } catch (e) {
      resultados.push({
        tabela,
        inserted: 0,
        falha: e instanceof Error ? e.message : "erro desconhecido",
      });
    }

    done++;
    opts.onProgress?.(tabela, done, tabelas.length);
  }

  return {
    resultados,
    totalInserido: resultados.reduce((s, r) => s + r.inserted, 0),
    totalFalha: resultados.filter((r) => r.falha).length,
  };
}

export interface BackupPreview {
  valido: boolean;
  versao?: number;
  geradoEm?: string;
  empresa?: string;
  usuario?: string;
  resumo?: Record<string, number>;
  erro?: string;
}

/** Lê e valida o arquivo sem gravar nada — usado para a confirmação. */
export function previewBackup(texto: string): BackupPreview {
  try {
    const b = parseBackup(texto);
    return {
      valido: true,
      versao: b.versao,
      geradoEm: b.gerado_em,
      empresa: b.empresa,
      usuario: b.usuario,
      resumo: b.resumo,
    };
  } catch (e) {
    return { valido: false, erro: e instanceof Error ? e.message : "arquivo inválido" };
  }
}

export function totalRegistros(resumo: Record<string, number> | undefined): number {
  if (!resumo) return 0;
  return Object.values(resumo).reduce((s, v) => s + Math.max(v, 0), 0);
}