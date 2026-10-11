import { supabase } from "@/integrations/supabase/client";
import { asArray, asJsonArray, num, orNull, requireScope, storageError } from "@/lib/db";

export interface AreaTalhao {
  id: string;
  numero: string;
  tamanhoHectares: number;
}

export interface AreaCadastro {
  id: string;
  nome: string;
  codigo?: string;
  coordenadas: string;
  quantidadeTalhoes: number;
  talhoes: AreaTalhao[];
  areaCarreador?: number;
  municipio: string;
  createdAt: string;
}

interface AreaRow {
  id: string;
  nome: string;
  codigo: string | null;
  coordenadas: string;
  quantidade_talhoes: number;
  talhoes: unknown;
  area_carreador: number | string | null;
  municipio: string;
  created_at: string;
}

const fromRow = (row: AreaRow): AreaCadastro => ({
  id: row.id,
  nome: row.nome,
  codigo: row.codigo ?? undefined,
  coordenadas: row.coordenadas,
  quantidadeTalhoes: row.quantidade_talhoes,
  talhoes: asArray<AreaTalhao>(row.talhoes),
  areaCarreador: row.area_carreador == null ? undefined : num(row.area_carreador),
  municipio: row.municipio,
  createdAt: row.created_at,
});

export async function saveArea(area: AreaCadastro): Promise<void> {
  const { userId, branchId } = await requireScope();
  const { error } = await supabase.from("service_areas").upsert(
    {
      id: area.id,
      user_id: userId,
      branch_id: branchId,
      nome: area.nome,
      codigo: orNull(area.codigo),
      coordenadas: area.coordenadas,
      quantidade_talhoes: area.quantidadeTalhoes,
      talhoes: asJsonArray(area.talhoes),
      area_carreador: area.areaCarreador ?? null,
      municipio: area.municipio,
      created_at: area.createdAt,
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao salvar a área", error);
}

export async function getArea(id: string): Promise<AreaCadastro | undefined> {
  const { data, error } = await supabase.from("service_areas").select("*").eq("id", id).maybeSingle();
  if (error) throw storageError("Falha ao carregar a área", error);
  return data ? fromRow(data as AreaRow) : undefined;
}

export async function getAllAreas(): Promise<AreaCadastro[]> {
  const { data, error } = await supabase
    .from("service_areas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw storageError("Falha ao carregar as áreas", error);
  return (data as AreaRow[]).map(fromRow);
}

export async function deleteArea(id: string): Promise<void> {
  const { error } = await supabase.from("service_areas").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir a área", error);
}