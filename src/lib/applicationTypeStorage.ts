import { supabase } from "@/integrations/supabase/client";
import { requireUserId, storageError } from "@/lib/db";

export interface TipoAplicacao {
  id: string;
  nome: string;
  codigo: string;
  createdAt: string;
}

interface TipoRow {
  id: string;
  nome: string;
  codigo: string;
  created_at: string;
}

const fromRow = (row: TipoRow): TipoAplicacao => ({
  id: row.id,
  nome: row.nome,
  codigo: row.codigo,
  createdAt: row.created_at,
});

export async function saveTipoAplicacao(tipo: TipoAplicacao): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("application_types").upsert(
    {
      id: tipo.id,
      user_id: userId,
      nome: tipo.nome,
      codigo: tipo.codigo,
      created_at: tipo.createdAt,
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao salvar o tipo de aplicação", error);
}

export async function getAllTiposAplicacao(): Promise<TipoAplicacao[]> {
  const { data, error } = await supabase
    .from("application_types")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw storageError("Falha ao carregar os tipos de aplicação", error);
  return (data as TipoRow[]).map(fromRow);
}

export async function deleteTipoAplicacao(id: string): Promise<void> {
  const { error } = await supabase.from("application_types").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o tipo de aplicação", error);
}