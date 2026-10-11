import { supabase } from "@/integrations/supabase/client";
import { orNull, requireUserId, storageError } from "@/lib/db";

export interface Fornecedor {
  id: string;
  nome: string;
  documento?: string; // CNPJ/CPF
  telefone?: string;
  email?: string;
  createdAt: string;
}

interface FornecedorRow {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  created_at: string;
}

const fromRow = (row: FornecedorRow): Fornecedor => ({
  id: row.id,
  nome: row.nome,
  documento: row.documento ?? undefined,
  telefone: row.telefone ?? undefined,
  email: row.email ?? undefined,
  createdAt: row.created_at,
});

export const saveFornecedor = async (
  fornecedor: Omit<Fornecedor, "id" | "createdAt"> & { id?: string }
): Promise<Fornecedor> => {
  const userId = await requireUserId();
  const id = fornecedor.id ?? `for-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const row = {
    id,
    user_id: userId,
    nome: fornecedor.nome,
    documento: orNull(fornecedor.documento),
    telefone: orNull(fornecedor.telefone),
    email: orNull(fornecedor.email),
  };

  const { data, error } = await supabase
    .from("suppliers")
    .upsert({ ...row, created_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw storageError("Falha ao salvar o fornecedor", error);
  return fromRow(data as FornecedorRow);
};

export const getAllFornecedores = async (): Promise<Fornecedor[]> => {
  const { data, error } = await supabase.from("suppliers").select("*").order("nome");
  if (error) throw storageError("Falha ao carregar os fornecedores", error);
  return (data as FornecedorRow[]).map(fromRow);
};

export const getFornecedorById = async (id: string): Promise<Fornecedor | undefined> => {
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  if (error) throw storageError("Falha ao carregar o fornecedor", error);
  return data ? fromRow(data as FornecedorRow) : undefined;
};

export const deleteFornecedor = async (id: string): Promise<void> => {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o fornecedor", error);
};