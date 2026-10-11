import { supabase } from "@/integrations/supabase/client";
import { num, requireUserId, storageError } from "@/lib/db";

export interface ComponenteCatalogo {
  id: string;
  nome: string;
  numero_serie: string;
  marca: string;
  modelo: string;
  custo: number;
  createdAt: string;
}

interface ComponenteRow {
  id: string;
  nome: string;
  numero_serie: string;
  marca: string;
  modelo: string;
  custo: number | string;
  created_at: string;
}

const fromRow = (row: ComponenteRow): ComponenteCatalogo => ({
  id: row.id,
  nome: row.nome,
  numero_serie: row.numero_serie,
  marca: row.marca,
  modelo: row.modelo,
  custo: num(row.custo),
  createdAt: row.created_at,
});

export const saveComponente = async (componente: ComponenteCatalogo): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase.from("component_catalog").upsert(
    {
      id: componente.id,
      user_id: userId,
      nome: componente.nome,
      numero_serie: componente.numero_serie,
      marca: componente.marca,
      modelo: componente.modelo,
      custo: componente.custo,
      created_at: componente.createdAt,
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao salvar o componente", error);
};

export const getAllComponentes = async (): Promise<ComponenteCatalogo[]> => {
  const { data, error } = await supabase.from("component_catalog").select("*").order("nome");
  if (error) throw storageError("Falha ao carregar os componentes", error);
  return (data as ComponenteRow[]).map(fromRow);
};

export const deleteComponente = async (id: string): Promise<void> => {
  const { error } = await supabase.from("component_catalog").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o componente", error);
};