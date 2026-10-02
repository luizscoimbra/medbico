import { supabase } from "@/integrations/supabase/client";

// ============================================
// TYPES
// ============================================

export const TIPOS_COMBUSTIVEL = [
  "Diesel S10",
  "Diesel S500",
  "Gasolina",
  "Álcool",
  "GNV",
  "Outro",
] as const;

export type TipoCombustivel = (typeof TIPOS_COMBUSTIVEL)[number];

export interface Abastecimento {
  id: string;
  equipment_id: string;
  fleet_number: string;
  data: string;
  horimetro: number;
  litros: number;
  tipo_combustivel: string;
  valor_total: number;
  posto_fornecedor: string;
  observacao: string;
  /** Ordem de Serviço vinculada (opcional). */
  os_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AbastecimentoInput = Omit<Abastecimento, "id" | "created_at" | "updated_at">;

// ============================================
// CRUD (Supabase)
// ============================================

export async function getAllAbastecimentos(equipmentId?: string): Promise<Abastecimento[]> {
  let query = supabase.from("equipment_fuel_refuelings").select("*");
  if (equipmentId) query = query.eq("equipment_id", equipmentId);
  const { data, error } = await query.order("data", { ascending: false });
  if (error) throw error;
  return (data || []) as Abastecimento[];
}

export async function createAbastecimento(rec: AbastecimentoInput): Promise<Abastecimento> {
  const { data, error } = await supabase
    .from("equipment_fuel_refuelings")
    .insert(rec)
    .select()
    .single();
  if (error) throw error;
  return data as Abastecimento;
}

export async function updateAbastecimento(
  id: string,
  updates: Partial<AbastecimentoInput>
): Promise<void> {
  const { error } = await supabase
    .from("equipment_fuel_refuelings")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAbastecimento(id: string): Promise<void> {
  const { error } = await supabase.from("equipment_fuel_refuelings").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// CÁLCULOS (puros)
// ============================================

/** Ordena do mais antigo para o mais recente (data, depois horímetro). */
export function ordenarCrescente(abastecimentos: Abastecimento[]): Abastecimento[] {
  return [...abastecimentos].sort((a, b) =>
    a.data === b.data ? a.horimetro - b.horimetro : a.data.localeCompare(b.data)
  );
}

/** Último abastecimento (mais recente) da lista. */
export function ultimoAbastecimento(abastecimentos: Abastecimento[]): Abastecimento | null {
  const asc = ordenarCrescente(abastecimentos);
  return asc.length ? asc[asc.length - 1] : null;
}

export interface PreviewLancamento {
  /** Registro imediatamente anterior ao lançamento (base de horas). */
  baseline: Abastecimento | null;
  /** Horas trabalhadas desde o último abastecimento (null se não há base). */
  horasDesdeUltimo: number | null;
  /** Gasto por hora = litros ÷ horas desde o último abastecimento. */
  consumoLph: number | null;
  /** true quando o horímetro informado não avança além da base. */
  erroHorimetro: boolean;
}

/**
 * Prévia instantânea do lançamento: ao digitar o horímetro atual, calcula
 * as horas trabalhadas desde o último abastecimento do equipamento,
 * os litros informados e o gasto por hora (L/h).
 */
export function previewLancamento(params: {
  abastecimentos: Abastecimento[];
  equipmentId: string;
  data: string;
  horimetro: number;
  litros: number;
  excluirId?: string;
}): PreviewLancamento {
  const outros = params.abastecimentos.filter(
    (a) => a.equipment_id === params.equipmentId && a.id !== params.excluirId
  );
  const asc = ordenarCrescente(outros);
  const anteriores = asc.filter((a) =>
    a.data < params.data || (a.data === params.data && a.horimetro < params.horimetro)
  );
  const baseline = anteriores.length ? anteriores[anteriores.length - 1] : null;

  if (!baseline) {
    return { baseline: null, horasDesdeUltimo: null, consumoLph: null, erroHorimetro: false };
  }

  const horas = Math.round((params.horimetro - baseline.horimetro) * 10) / 10;
  if (horas <= 0) {
    return { baseline, horasDesdeUltimo: null, consumoLph: null, erroHorimetro: true };
  }

  const consumo = params.litros > 0 ? Math.round((params.litros / horas) * 100) / 100 : null;
  return { baseline, horasDesdeUltimo: horas, consumoLph: consumo, erroHorimetro: false };
}

export interface LinhaHistorico extends Abastecimento {
  /** Horas desde o abastecimento anterior (null se é o primeiro). */
  horasDesdeUltimo: number | null;
  /** Litros ÷ horas desde o abastecimento anterior (null sem base ou horas=0). */
  consumoLph: number | null;
}

/** Histórico com horas desde o anterior e L/h linha a linha (apresentação desc). */
export function calcularHistorico(abastecimentos: Abastecimento[]): LinhaHistorico[] {
  const asc = ordenarCrescente(abastecimentos);
  const porId = new Map<string, LinhaHistorico>();
  asc.forEach((a, i) => {
    const anterior = i > 0 ? asc[i - 1] : null;
    const horas = anterior ? Math.round((a.horimetro - anterior.horimetro) * 10) / 10 : null;
    const consumo = horas && horas > 0 ? Math.round((a.litros / horas) * 100) / 100 : null;
    porId.set(a.id, {
      ...a,
      horasDesdeUltimo: horas !== null && horas > 0 ? horas : null,
      consumoLph: consumo,
    });
  });
  return asc.map((a) => porId.get(a.id)!).reverse();
}

export interface ConsumoEquipamento {
  equipment_id: string;
  fleet_number: string;
  modelo: string;
  qtd: number;
  litros: number;
  /** Soma das horas entre o abastecimento anterior (inclusive fora do período) e o do período. */
  horas: number;
  /** Registros do período sem abastecimento anterior (horas não contabilizadas). */
  semBaseline: number;
  /** Litros ÷ horas no período (null se horas = 0). */
  mediaLph: number | null;
  valorTotal: number;
}

export interface ConsumoPeriodo {
  equipamentos: ConsumoEquipamento[];
  totais: {
    qtd: number;
    litros: number;
    horas: number;
    mediaLph: number | null;
    valorTotal: number;
  };
}

/**
 * Consumo por equipamento em um período informado.
 * Regra consistente com a prévia do lançamento: cada abastecimento do
 * período conta com as horas entre ele e o abastecimento imediatamente
 * anterior (a base pode estar fora do período). O primeiro registro do
 * equipamento não tem base — entra nos litros, mas não gera horas.
 */
export function calcularConsumoPeriodo(
  abastecimentos: Abastecimento[],
  inicio: string,
  fim: string,
  equipamentos: Array<{ id: string; fleet_number: string; equipment_model: string; tractor_model: string }>
): ConsumoPeriodo {
  const modeloPorId = new Map(equipamentos.map((e) => [e.id, e]));

  const porEquipamento = new Map<string, Abastecimento[]>();
  for (const a of abastecimentos) {
    const lista = porEquipamento.get(a.equipment_id) || [];
    lista.push(a);
    porEquipamento.set(a.equipment_id, lista);
  }

  const linhas: ConsumoEquipamento[] = [];

  for (const [equipmentId, lista] of porEquipamento) {
    const asc = ordenarCrescente(lista);
    const noPeriodo = asc.filter((a) => a.data >= inicio && a.data <= fim);
    if (!noPeriodo.length) continue;

    const eq = modeloPorId.get(equipmentId);
    let litros = 0;
    let horas = 0;
    let semBaseline = 0;
    let valorTotal = 0;

    for (const a of noPeriodo) {
      litros += a.litros;
      valorTotal += a.valor_total || 0;
      const idx = asc.indexOf(a);
      const anterior = idx > 0 ? asc[idx - 1] : null;
      if (!anterior) {
        semBaseline += 1;
        continue;
      }
      const delta = a.horimetro - anterior.horimetro;
      if (delta > 0) horas += delta;
    }

    horas = Math.round(horas * 10) / 10;
    linhas.push({
      equipment_id: equipmentId,
      fleet_number: a0Fleet(noPeriodo, eq),
      modelo: eq ? `${eq.equipment_model || eq.tractor_model}`.trim() || "—" : "Equipamento removido",
      qtd: noPeriodo.length,
      litros: Math.round(litros * 100) / 100,
      horas,
      semBaseline,
      mediaLph: horas > 0 ? Math.round((litros / horas) * 100) / 100 : null,
      valorTotal: Math.round(valorTotal * 100) / 100,
    });
  }

  linhas.sort((a, b) => b.litros - a.litros);

  const totais = linhas.reduce(
    (acc, l) => ({
      qtd: acc.qtd + l.qtd,
      litros: acc.litros + l.litros,
      horas: acc.horas + l.horas,
      valorTotal: acc.valorTotal + l.valorTotal,
    }),
    { qtd: 0, litros: 0, horas: 0, valorTotal: 0 }
  );

  return {
    equipamentos: linhas,
    totais: {
      ...totais,
      litros: Math.round(totais.litros * 100) / 100,
      horas: Math.round(totais.horas * 10) / 10,
      valorTotal: Math.round(totais.valorTotal * 100) / 100,
      mediaLph: totais.horas > 0 ? Math.round((totais.litros / totais.horas) * 100) / 100 : null,
    },
  };
}

function a0Fleet(noPeriodo: Abastecimento[], eq?: { fleet_number: string }): string {
  return noPeriodo[noPeriodo.length - 1]?.fleet_number || eq?.fleet_number || "—";
}

/** Soma do valor total dos abastecimentos (custo agregado à OS). */
export function totalAbastecimento(abastecimentos: Abastecimento[]): number {
  const total = abastecimentos.reduce((s, a) => s + (a.valor_total || 0), 0);
  return Math.round(total * 100) / 100;
}

/** Abastecimentos vinculados a uma Ordem de Serviço. */
export function abastecimentosDaOS(
  abastecimentos: Abastecimento[],
  osId: string
): Abastecimento[] {
  return abastecimentos
    .filter((a) => a.os_id === osId)
    .sort((a, b) => (a.data === b.data ? b.horimetro - a.horimetro : b.data.localeCompare(a.data)));
}
