import { supabase } from "@/integrations/supabase/client";
import { orNull, requireUserId, storageError } from "@/lib/db";

export interface Cliente {
  id: string;
  tipo: "pessoa_fisica" | "pessoa_juridica";
  // Pessoa Física
  nomeCompleto?: string;
  cpf?: string;
  // Pessoa Jurídica
  razaoSocial?: string;
  nomeFantasia?: string;
  cnpj?: string;
  // Comuns
  telefone?: string;
  email?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  observacoes?: string;
  createdAt: string;
}

interface ClienteRow {
  id: string;
  tipo: string;
  nome_completo: string | null;
  cpf: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  observacoes: string | null;
  created_at: string;
}

function fromRow(row: ClienteRow): Cliente {
  return {
    id: row.id,
    tipo: (row.tipo as Cliente["tipo"]) ?? "pessoa_fisica",
    nomeCompleto: row.nome_completo ?? undefined,
    cpf: row.cpf ?? undefined,
    razaoSocial: row.razao_social ?? undefined,
    nomeFantasia: row.nome_fantasia ?? undefined,
    cnpj: row.cnpj ?? undefined,
    telefone: row.telefone ?? undefined,
    email: row.email ?? undefined,
    endereco: row.endereco ?? undefined,
    cidade: row.cidade ?? undefined,
    estado: row.estado ?? undefined,
    observacoes: row.observacoes ?? undefined,
    createdAt: row.created_at,
  };
}

function toRow(cliente: Cliente, userId: string) {
  return {
    id: cliente.id,
    user_id: userId,
    tipo: cliente.tipo,
    nome_completo: orNull(cliente.nomeCompleto),
    cpf: orNull(cliente.cpf),
    razao_social: orNull(cliente.razaoSocial),
    nome_fantasia: orNull(cliente.nomeFantasia),
    cnpj: orNull(cliente.cnpj),
    telefone: orNull(cliente.telefone),
    email: orNull(cliente.email),
    endereco: orNull(cliente.endereco),
    cidade: orNull(cliente.cidade),
    estado: orNull(cliente.estado),
    observacoes: orNull(cliente.observacoes),
    created_at: cliente.createdAt,
  };
}

export const saveCliente = async (cliente: Cliente): Promise<void> => {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("clients")
    .upsert({ ...toRow(cliente, userId) }, { onConflict: "id" });
  if (error) throw storageError("Falha ao salvar o cliente", error);
};

export const getAllClientes = async (): Promise<Cliente[]> => {
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw storageError("Falha ao carregar os clientes", error);
  return (data as ClienteRow[]).map(fromRow);
};

export const getClienteById = async (id: string): Promise<Cliente | undefined> => {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw storageError("Falha ao carregar o cliente", error);
  return data ? fromRow(data as ClienteRow) : undefined;
};

export const deleteCliente = async (id: string): Promise<void> => {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o cliente", error);
};

export const deleteAllClientes = async (): Promise<void> => {
  const { error } = await supabase.from("clients").delete().neq("id", "");
  if (error) throw storageError("Falha ao excluir os clientes", error);
};