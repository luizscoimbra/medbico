import { supabase } from "@/integrations/supabase/client";
import { asJsonArray, num, orNull, requireScope, storageError } from "@/lib/db";

export type StatusTitulo = "aberto" | "pago" | "cancelado";

export interface TituloReceber {
  id: string;
  numero: string;          // sequencial formatado (0001, 0002, ...)
  dataEmissao: string;     // yyyy-mm-dd
  dataVencimento?: string; // yyyy-mm-dd
  clienteId?: string;
  clienteNome: string;
  descricao: string;
  osId?: string;           // OS que gerou o título (faturamento)
  valor: number;
  status: StatusTitulo;
  dataPagamento?: string;  // yyyy-mm-dd
  formaPagamento?: string;
  observacao?: string;
  criadoEm: string;        // ISO
}

interface TituloRow {
  id: string;
  numero: string;
  data_emissao: string;
  data_vencimento: string | null;
  cliente_id: string | null;
  cliente_nome: string;
  descricao: string;
  os_id: string | null;
  valor: number | string;
  status: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacao: string | null;
  criado_em: string;
}

const fromRow = (row: TituloRow): TituloReceber => ({
  id: row.id,
  numero: row.numero,
  dataEmissao: row.data_emissao,
  dataVencimento: row.data_vencimento ?? undefined,
  clienteId: row.cliente_id ?? undefined,
  clienteNome: row.cliente_nome,
  descricao: row.descricao,
  osId: row.os_id ?? undefined,
  valor: num(row.valor),
  status: (row.status as StatusTitulo) ?? "aberto",
  dataPagamento: row.data_pagamento ?? undefined,
  formaPagamento: row.forma_pagamento ?? undefined,
  observacao: row.observacao ?? undefined,
  criadoEm: row.criado_em,
});

/**
 * Numeração sequencial compartilhada.
 *
 * O contador anterior vivia no IndexedDB: reiniciava a cada navegador e cada
 * dispositivo gerava o mesmo número. Agora a sequência é do PostgreSQL, com
 * `pg_advisory_xact_lock` implícito na chamada da sequence.
 */
async function nextNumero(): Promise<string> {
  const { data, error } = await supabase.rpc("next_receivable_numero");
  if (error) throw storageError("Não foi possível gerar o número do título", error);
  return String(data);
}

export async function criarTituloReceber(input: {
  clienteId?: string;
  clienteNome: string;
  descricao: string;
  valor: number;
  osId?: string;
  dataVencimento?: string;
  observacao?: string;
}): Promise<TituloReceber> {
  const { userId, branchId } = await requireScope();
  const id = `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const { data, error } = await supabase
    .from("financial_receivables")
    .insert({
      id,
      user_id: userId,
      branch_id: branchId,
      numero: await nextNumero(),
      data_emissao: new Date().toISOString().slice(0, 10),
      data_vencimento: orNull(input.dataVencimento),
      cliente_id: orNull(input.clienteId),
      cliente_nome: input.clienteNome,
      descricao: input.descricao,
      os_id: orNull(input.osId),
      valor: input.valor,
      status: "aberto",
      observacao: orNull(input.observacao),
      criado_em: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw storageError("Falha ao criar o título a receber", error);
  return fromRow(data as TituloRow);
}

export async function getAllTitulos(): Promise<TituloReceber[]> {
  const { data, error } = await supabase
    .from("financial_receivables")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw storageError("Falha ao carregar os títulos a receber", error);
  return (data as TituloRow[]).map(fromRow);
}

export async function getTituloByOS(osId: string): Promise<TituloReceber | undefined> {
  const { data, error } = await supabase
    .from("financial_receivables")
    .select("*")
    .eq("os_id", osId)
    .neq("status", "cancelado")
    .order("criado_em", { ascending: false })
    .limit(1);
  if (error) throw storageError("Falha ao carregar o título da OS", error);
  const row = (data as TituloRow[])[0];
  return row ? fromRow(row) : undefined;
}

export async function updateTitulo(id: string, patch: Partial<TituloReceber>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("dataVencimento" in patch) payload.data_vencimento = orNull(patch.dataVencimento);
  if ("clienteId" in patch) payload.cliente_id = orNull(patch.clienteId);
  if ("clienteNome" in patch) payload.cliente_nome = patch.clienteNome;
  if ("descricao" in patch) payload.descricao = patch.descricao;
  if ("osId" in patch) payload.os_id = orNull(patch.osId);
  if ("valor" in patch) payload.valor = patch.valor;
  if ("status" in patch) payload.status = patch.status;
  if ("dataPagamento" in patch) payload.data_pagamento = orNull(patch.dataPagamento);
  if ("formaPagamento" in patch) payload.forma_pagamento = orNull(patch.formaPagamento);
  if ("observacao" in patch) payload.observacao = orNull(patch.observacao);

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("financial_receivables").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao atualizar o título a receber", error);
}

/**
 * Importa um título preservando id, número e datas originais.
 *
 * Usado pela migração do armazenamento local: o `numero` precisa ser mantido
 * porque ele já foi impresso em comprovantes e declarado ao cliente.
 */
export async function salvarTituloReceber(titulo: TituloReceber): Promise<void> {
  const { userId, branchId } = await requireScope();
  const { error } = await supabase.from("financial_receivables").upsert(
    {
      id: titulo.id,
      user_id: userId,
      branch_id: branchId,
      numero: titulo.numero,
      data_emissao: titulo.dataEmissao,
      data_vencimento: orNull(titulo.dataVencimento),
      cliente_id: orNull(titulo.clienteId),
      cliente_nome: titulo.clienteNome,
      descricao: titulo.descricao,
      os_id: orNull(titulo.osId),
      valor: titulo.valor,
      status: titulo.status,
      data_pagamento: orNull(titulo.dataPagamento),
      forma_pagamento: orNull(titulo.formaPagamento),
      observacao: orNull(titulo.observacao),
      criado_em: titulo.criadoEm,
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao importar o título a receber", error);
}

export async function deleteTitulo(id: string): Promise<void> {
  const { error } = await supabase.from("financial_receivables").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o título a receber", error);
}

/** Baixa (recebimento) de um título a receber. */
export async function baixarTitulo(
  id: string,
  info: { dataPagamento: string; formaPagamento?: string; observacao?: string }
): Promise<void> {
  await updateTitulo(id, {
    status: "pago",
    dataPagamento: info.dataPagamento,
    formaPagamento: info.formaPagamento,
    observacao: info.observacao,
  });
}

/** Reabre um título que foi baixado por engano. */
export async function estornarTitulo(id: string): Promise<void> {
  await updateTitulo(id, { status: "aberto", dataPagamento: undefined, formaPagamento: undefined });
}

export async function cancelarTitulo(id: string): Promise<void> {
  await updateTitulo(id, { status: "cancelado" });
}

/** Valor a faturar de uma OS (usa o total fechado no encerramento). */
export function valorFaturavelOS(os: {
  valorTotal?: number;
  valorHerbicidas?: number;
  valorServico?: number;
}): number {
  if (os.valorTotal && os.valorTotal > 0) return os.valorTotal;
  return (os.valorHerbicidas || 0) + (os.valorServico || 0);
}