import { supabase } from "@/integrations/supabase/client";
import { asArray, asJsonArray, num, orNull, requireScope, storageError } from "@/lib/db";

export interface ProdutoCalda {
  id: string;
  nome: string;
  formulacao: string;
  dose: number;
  unidade: "L/ha" | "kg/ha";
}

export interface CalculoCaldaRecord {
  id: string;
  data: string;
  talhao: string;
  areaTalhao: number;
  vazaoTrabalho: number;
  capacidadeTanque: number;
  produtos: ProdutoCalda[];
  volumeTotalCalda: number;
  tanquesCheios: number;
  volumeRestante: number;
  tanquesNecessarios: number;
  // Campos adicionais úteis
  frota?: string;
  trator?: string;
  /** Terrestre ou drone — determina a faixa de volume de calda aceita. */
  modo?: string;
  createdAt?: string;
}

interface CaldaRow {
  id: string;
  data: string;
  talhao: string | null;
  area_talhao: number | string;
  vazao_trabalho: number | string;
  capacidade_tanque: number | string;
  produtos: unknown;
  volume_total_calda: number | string;
  tanques_cheios: number;
  volume_restante: number | string;
  tanques_necessarios: number;
  frota: string | null;
  trator: string | null;
  modo: string | null;
  created_at: string;
}

const fromRow = (row: CaldaRow): CalculoCaldaRecord => ({
  id: row.id,
  data: row.data,
  talhao: row.talhao ?? "",
  areaTalhao: num(row.area_talhao),
  vazaoTrabalho: num(row.vazao_trabalho),
  capacidadeTanque: num(row.capacidade_tanque),
  produtos: asArray<ProdutoCalda>(row.produtos),
  volumeTotalCalda: num(row.volume_total_calda),
  tanquesCheios: row.tanques_cheios,
  volumeRestante: num(row.volume_restante),
  tanquesNecessarios: row.tanques_necessarios,
  frota: row.frota ?? undefined,
  trator: row.trator ?? undefined,
  modo: row.modo ?? undefined,
  createdAt: row.created_at,
});

export async function saveCalculoCalda(record: CalculoCaldaRecord): Promise<void> {
  const { userId, branchId } = await requireScope();
  const { error } = await supabase.from("spray_mix_recipes").upsert(
    {
      id: record.id,
      user_id: userId,
      branch_id: branchId,
      data: record.data,
      talhao: orNull(record.talhao),
      area_talhao: record.areaTalhao,
      vazao_trabalho: record.vazaoTrabalho,
      capacidade_tanque: record.capacidadeTanque,
      produtos: asJsonArray(record.produtos),
      volume_total_calda: record.volumeTotalCalda,
      tanques_cheios: record.tanquesCheios,
      volume_restante: record.volumeRestante,
      tanques_necessarios: record.tanquesNecessarios,
      frota: orNull(record.frota),
      trator: orNull(record.trator),
      modo: orNull(record.modo),
      created_at: record.createdAt ?? new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao salvar o cálculo de calda", error);
}

export async function getAllCalculosCalda(): Promise<CalculoCaldaRecord[]> {
  const { data, error } = await supabase
    .from("spray_mix_recipes")
    .select("*")
    .order("data", { ascending: false });
  if (error) throw storageError("Falha ao carregar o histórico de caldas", error);
  return (data as CaldaRow[]).map(fromRow);
}

export async function getCalculoCaldaById(id: string): Promise<CalculoCaldaRecord | undefined> {
  const { data, error } = await supabase
    .from("spray_mix_recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw storageError("Falha ao carregar o cálculo de calda", error);
  return data ? fromRow(data as CaldaRow) : undefined;
}

export async function deleteCalculoCalda(id: string): Promise<void> {
  const { error } = await supabase.from("spray_mix_recipes").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o cálculo de calda", error);
}