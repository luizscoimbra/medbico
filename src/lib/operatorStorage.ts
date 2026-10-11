import { supabase } from "@/integrations/supabase/client";
import { requireScope, storageError } from "@/lib/db";

export interface Operador {
  id: string;
  nome: string;
  cracha: string;
  funcao: "Operador" | "Motorista" | "Gestor";
  setor: string;
  createdAt: string;
}

interface OperadorRow {
  id: string;
  nome: string;
  cracha: string;
  funcao: string;
  setor: string;
  created_at: string;
}

const fromRow = (row: OperadorRow): Operador => ({
  id: row.id,
  nome: row.nome,
  cracha: row.cracha,
  funcao: (row.funcao as Operador["funcao"]) ?? "Operador",
  setor: row.setor,
  createdAt: row.created_at,
});

export const saveOperador = async (operador: Operador): Promise<void> => {
  const { userId, branchId } = await requireScope();
  const { error } = await supabase
    .from("operators")
    .upsert(
      {
        id: operador.id,
        user_id: userId,
        branch_id: branchId,
        nome: operador.nome,
        cracha: operador.cracha,
        funcao: operador.funcao,
        setor: operador.setor,
        created_at: operador.createdAt,
      },
      { onConflict: "id" }
    );
  if (error) throw storageError("Falha ao salvar o operador", error);
};

export const getAllOperadores = async (): Promise<Operador[]> => {
  const { data, error } = await supabase
    .from("operators")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw storageError("Falha ao carregar os operadores", error);
  return (data as OperadorRow[]).map(fromRow);
};

export const deleteOperador = async (id: string): Promise<void> => {
  const { error } = await supabase.from("operators").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o operador", error);
};

export const deleteAllOperadores = async (): Promise<void> => {
  const { error } = await supabase.from("operators").delete().neq("id", "");
  if (error) throw storageError("Falha ao excluir os operadores", error);
};