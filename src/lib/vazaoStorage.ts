import { supabase } from "@/integrations/supabase/client";
import { asArray, asJsonArray, num, orNull, requireScope, storageError } from "@/lib/db";

export interface AfericaoVazaoRecord {
  id: string;
  dataHora: string;
  modeloTrator: string;
  frota: string;
  tipoImplemento: string;
  numeroBicos: number;
  localColeta: string;
  operador: string;
  turno: string;
  taxaDesejada: number;
  velocidade: number;
  espacamento: number;
  vazaoTeorica: number;
  mediaReal: number;
  desvioPercent: number;
  statusGeral: "calibrado" | "ajustar" | "trocar";
  coletas: {
    nozzleNumber: number;
    value: number;
  }[];
  // ── Aferição por Drone (opcional — registros sem `modo` são terrestres) ──
  modo?: "terrestre" | "drone";
  material?: "liquido" | "solido";
  metodo?: "volumetrico" | "sensor" | "bancada" | "app";
  faixaUtil?: number;          // W — largura de trabalho / espalhamento (m)
  tempoColeta?: number;        // s (30 ou 60)
  massaColetada?: number;      // kg — ensaio de bancada (sólidos)
  vazaoMaxSistema?: number;    // kg/min a 100% de comporta (app do drone)
  comportaAtual?: number;      // % de abertura atual
  comportaIdeal?: number;      // % de abertura ideal calculada
}

interface AfericaoRow {
  id: string;
  data_hora: string;
  modelo_trator: string | null;
  frota: string | null;
  tipo_implemento: string | null;
  numero_bicos: number;
  local_coleta: string | null;
  operador: string | null;
  turno: string | null;
  taxa_desejada: number | string;
  velocidade: number | string;
  espacamento: number | string;
  vazao_teorica: number | string;
  media_real: number | string;
  desvio_percent: number | string;
  status_geral: string;
  coletas: unknown;
  modo: string | null;
  material: string | null;
  metodo: string | null;
  faixa_util: number | string | null;
  tempo_coleta: number | string | null;
  massa_coletada: number | string | null;
  vazao_max_sistema: number | string | null;
  comporta_atual: number | string | null;
  comporta_ideal: number | string | null;
}

const fromRow = (row: AfericaoRow): AfericaoVazaoRecord => ({
  id: row.id,
  dataHora: row.data_hora,
  modeloTrator: row.modelo_trator ?? "",
  frota: row.frota ?? "",
  tipoImplemento: row.tipo_implemento ?? "",
  numeroBicos: row.numero_bicos,
  localColeta: row.local_coleta ?? "",
  operador: row.operador ?? "",
  turno: row.turno ?? "",
  taxaDesejada: num(row.taxa_desejada),
  velocidade: num(row.velocidade),
  espacamento: num(row.espacamento),
  vazaoTeorica: num(row.vazao_teorica),
  mediaReal: num(row.media_real),
  desvioPercent: num(row.desvio_percent),
  statusGeral: (row.status_geral as AfericaoVazaoRecord["statusGeral"]) ?? "calibrado",
  coletas: asArray(row.coletas),
  modo: (row.modo as AfericaoVazaoRecord["modo"]) ?? undefined,
  material: (row.material as AfericaoVazaoRecord["material"]) ?? undefined,
  metodo: (row.metodo as AfericaoVazaoRecord["metodo"]) ?? undefined,
  faixaUtil: row.faixa_util == null ? undefined : num(row.faixa_util),
  tempoColeta: row.tempo_coleta == null ? undefined : num(row.tempo_coleta),
  massaColetada: row.massa_coletada == null ? undefined : num(row.massa_coletada),
  vazaoMaxSistema: row.vazao_max_sistema == null ? undefined : num(row.vazao_max_sistema),
  comportaAtual: row.comporta_atual == null ? undefined : num(row.comporta_atual),
  comportaIdeal: row.comporta_ideal == null ? undefined : num(row.comporta_ideal),
});

export async function saveAfericao(record: AfericaoVazaoRecord): Promise<void> {
  const { userId, branchId } = await requireScope();
  const { error } = await supabase.from("spray_calibrations").upsert(
    {
      id: record.id,
      user_id: userId,
      branch_id: branchId,
      data_hora: record.dataHora,
      modelo_trator: orNull(record.modeloTrator),
      frota: orNull(record.frota),
      tipo_implemento: orNull(record.tipoImplemento),
      numero_bicos: record.numeroBicos,
      local_coleta: orNull(record.localColeta),
      operador: orNull(record.operador),
      turno: orNull(record.turno),
      taxa_desejada: record.taxaDesejada,
      velocidade: record.velocidade,
      espacamento: record.espacamento,
      vazao_teorica: record.vazaoTeorica,
      media_real: record.mediaReal,
      desvio_percent: record.desvioPercent,
      status_geral: record.statusGeral,
      coletas: asJsonArray(record.coletas),
      modo: record.modo ?? null,
      material: record.material ?? null,
      metodo: record.metodo ?? null,
      faixa_util: record.faixaUtil ?? null,
      tempo_coleta: record.tempoColeta ?? null,
      massa_coletada: record.massaColetada ?? null,
      vazao_max_sistema: record.vazaoMaxSistema ?? null,
      comporta_atual: record.comportaAtual ?? null,
      comporta_ideal: record.comportaIdeal ?? null,
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao salvar a aferição", error);
}

export async function getAllAfericoes(): Promise<AfericaoVazaoRecord[]> {
  const { data, error } = await supabase
    .from("spray_calibrations")
    .select("*")
    .order("data_hora", { ascending: false });
  if (error) throw storageError("Falha ao carregar as aferições", error);
  return (data as AfericaoRow[]).map(fromRow);
}

export async function getAfericaoById(id: string): Promise<AfericaoVazaoRecord | undefined> {
  const { data, error } = await supabase
    .from("spray_calibrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw storageError("Falha ao carregar a aferição", error);
  return data ? fromRow(data as AfericaoRow) : undefined;
}

export async function deleteAfericao(id: string): Promise<void> {
  const { error } = await supabase.from("spray_calibrations").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir a aferição", error);
}