import { supabase } from "@/integrations/supabase/client";
import { num, orNull, requireScope, storageError } from "@/lib/db";
import type { StatusTitulo } from "./financeiroStorage";
import {
  getAllContasPlano,
  resolverCentroCustoAutomatico,
  resolverContaPorCategoria,
} from "@/lib/planoContasStorage";

export const CATEGORIAS_PAGAR = [
  "Insumos",
  "Manutenção",
  "Combustível",
  "Serviços",
  "Pessoal",
  "Impostos",
  "Aluguel",
  "Outros",
] as const;

export type CategoriaPagar = (typeof CATEGORIAS_PAGAR)[number];

export interface TituloPagar {
  id: string;
  numero: string;          // sequencial formatado (0001, 0002, ...)
  dataEmissao: string;     // yyyy-mm-dd
  dataVencimento?: string; // yyyy-mm-dd
  fornecedorId?: string;
  fornecedorNome: string;
  categoria: string;
  descricao: string;
  manutencaoId?: string;   // manutenção de drone que gerou o título (dedupe)
  droneId?: string;
  equipmentId?: string;    // equipamento cuja manutenção gerou o título (dedupe)
  valor: number;
  status: StatusTitulo;
  dataPagamento?: string;  // yyyy-mm-dd
  formaPagamento?: string;
  observacao?: string;
  /** Conta do plano de contas — obrigatória. */
  planoContaId?: string;
  /** Departamento/centro de custo — obrigatório. */
  centroCustoId?: string;
  criadoEm: string;        // ISO
}

interface TituloPagarRow {
  id: string;
  numero: string;
  data_emissao: string;
  data_vencimento: string | null;
  fornecedor_id: string | null;
  fornecedor_nome: string;
  categoria: string;
  descricao: string;
  manutencao_id: string | null;
  drone_id: string | null;
  equipment_id: string | null;
  valor: number | string;
  status: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacao: string | null;
  plano_conta_id: string | null;
  centro_custo_id: string | null;
  criado_em: string;
}

const fromRow = (row: TituloPagarRow): TituloPagar => ({
  id: row.id,
  numero: row.numero,
  dataEmissao: row.data_emissao,
  dataVencimento: row.data_vencimento ?? undefined,
  fornecedorId: row.fornecedor_id ?? undefined,
  fornecedorNome: row.fornecedor_nome,
  categoria: row.categoria,
  descricao: row.descricao,
  manutencaoId: row.manutencao_id ?? undefined,
  droneId: row.drone_id ?? undefined,
  equipmentId: row.equipment_id ?? undefined,
  valor: num(row.valor),
  status: (row.status as StatusTitulo) ?? "aberto",
  dataPagamento: row.data_pagamento ?? undefined,
  formaPagamento: row.forma_pagamento ?? undefined,
  observacao: row.observacao ?? undefined,
  planoContaId: row.plano_conta_id ?? undefined,
  centroCustoId: row.centro_custo_id ?? undefined,
  criadoEm: row.criado_em,
});

/** Numeração sequencial compartilhada entre dispositivos (sequence do Postgres). */
async function nextNumero(): Promise<string> {
  const { data, error } = await supabase.rpc("next_payable_numero");
  if (error) throw storageError("Não foi possível gerar o número do título", error);
  return String(data);
}

/**
 * Classificação obrigatória de todo lançamento.
 *
 * A interface sempre pede a escolha ao usuário (conta + departamento). Quando
 * a origem do título não tem ninguém para perguntar — geração automática a
 * partir de manutenções, importação do armazenamento local — o sistema cai no
 * centro de custo padrão / "Não classificado" e na conta correspondente à
 * categoria, para nenhum lançamento entrar sem departamento.
 */
async function classificar(input: {
  planoContaId?: string;
  centroCustoId?: string;
  categoria: string;
}): Promise<{ planoContaId: string; centroCustoId: string }> {
  const centroCustoId = input.centroCustoId || (await resolverCentroCustoAutomatico());
  const planoContaId =
    input.planoContaId ||
    (await resolverContaPorCategoria(await getAllContasPlano(), input.categoria));
  return { planoContaId, centroCustoId };
}

export async function criarTituloPagar(input: {
  fornecedorId?: string;
  fornecedorNome: string;
  categoria: string;
  descricao: string;
  valor: number;
  dataEmissao?: string;
  dataVencimento?: string;
  manutencaoId?: string;
  droneId?: string;
  equipmentId?: string;
  observacao?: string;
  planoContaId?: string;
  centroCustoId?: string;
}): Promise<TituloPagar> {
  const { userId, branchId } = await requireScope();
  const id = `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const classificacao = await classificar(input);

  const { data, error } = await supabase
    .from("financial_payables")
    .insert({
      id,
      user_id: userId,
      branch_id: branchId,
      numero: await nextNumero(),
      data_emissao: input.dataEmissao || new Date().toISOString().slice(0, 10),
      data_vencimento: orNull(input.dataVencimento),
      fornecedor_id: orNull(input.fornecedorId),
      fornecedor_nome: input.fornecedorNome,
      categoria: input.categoria,
      descricao: input.descricao,
      manutencao_id: orNull(input.manutencaoId),
      drone_id: orNull(input.droneId),
      equipment_id: orNull(input.equipmentId),
      valor: input.valor,
      status: "aberto",
      observacao: orNull(input.observacao),
      plano_conta_id: classificacao.planoContaId,
      centro_custo_id: classificacao.centroCustoId,
      criado_em: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("sem departamento") || error.message?.includes("plano de contas")) {
      throw new Error(error.message);
    }
    throw storageError("Falha ao criar o título a pagar", error);
  }
  return fromRow(data as TituloPagarRow);
}

export async function getAllTitulosPagar(): Promise<TituloPagar[]> {
  const { data, error } = await supabase
    .from("financial_payables")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw storageError("Falha ao carregar os títulos a pagar", error);
  return (data as TituloPagarRow[]).map(fromRow);
}

/** Manutenções que já geraram título (evita duplicidade na geração em lote). */
export async function manutencoesComTitulo(): Promise<Set<string>> {
  const all = await getAllTitulosPagar();
  return new Set(all.map((t) => t.manutencaoId).filter((v): v is string => !!v));
}

export async function updateTituloPagar(id: string, patch: Partial<TituloPagar>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("dataVencimento" in patch) payload.data_vencimento = orNull(patch.dataVencimento);
  if ("fornecedorId" in patch) payload.fornecedor_id = orNull(patch.fornecedorId);
  if ("fornecedorNome" in patch) payload.fornecedor_nome = patch.fornecedorNome;
  if ("categoria" in patch) payload.categoria = patch.categoria;
  if ("descricao" in patch) payload.descricao = patch.descricao;
  if ("manutencaoId" in patch) payload.manutencao_id = orNull(patch.manutencaoId);
  if ("droneId" in patch) payload.drone_id = orNull(patch.droneId);
  if ("equipmentId" in patch) payload.equipment_id = orNull(patch.equipmentId);
  if ("valor" in patch) payload.valor = patch.valor;
  if ("status" in patch) payload.status = patch.status;
  if ("dataPagamento" in patch) payload.data_pagamento = orNull(patch.dataPagamento);
  if ("formaPagamento" in patch) payload.forma_pagamento = orNull(patch.formaPagamento);
  if ("observacao" in patch) payload.observacao = orNull(patch.observacao);
  // Classificação é obrigatória: um valor vazio é ignorado em vez de apagar a
  // coluna (a trigger do banco recusaria o lançamento sem departamento).
  if ("planoContaId" in patch && patch.planoContaId) payload.plano_conta_id = patch.planoContaId;
  if ("centroCustoId" in patch && patch.centroCustoId)
    payload.centro_custo_id = patch.centroCustoId;

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from("financial_payables").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao atualizar o título a pagar", error);
}

/**
 * Importa um título preservando id, número e datas originais.
 *
 * Usado pela migração do armazenamento local: o `numero` precisa ser mantido
 * porque ele já foi impresso em comprovantes e declarado ao fornecedor.
 */
export async function salvarTituloPagar(titulo: TituloPagar): Promise<void> {
  const { userId, branchId } = await requireScope();
  const classificacao = await classificar({
    planoContaId: titulo.planoContaId,
    centroCustoId: titulo.centroCustoId,
    categoria: titulo.categoria,
  });
  const { error } = await supabase.from("financial_payables").upsert(
    {
      id: titulo.id,
      user_id: userId,
      branch_id: branchId,
      numero: titulo.numero,
      data_emissao: titulo.dataEmissao,
      data_vencimento: orNull(titulo.dataVencimento),
      fornecedor_id: orNull(titulo.fornecedorId),
      fornecedor_nome: titulo.fornecedorNome,
      categoria: titulo.categoria,
      descricao: titulo.descricao,
      manutencao_id: orNull(titulo.manutencaoId),
      drone_id: orNull(titulo.droneId),
      equipment_id: orNull(titulo.equipmentId),
      valor: titulo.valor,
      status: titulo.status,
      data_pagamento: orNull(titulo.dataPagamento),
      forma_pagamento: orNull(titulo.formaPagamento),
      observacao: orNull(titulo.observacao),
      plano_conta_id: classificacao.planoContaId,
      centro_custo_id: classificacao.centroCustoId,
      criado_em: titulo.criadoEm,
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao importar o título a pagar", error);
}

export async function deleteTituloPagar(id: string): Promise<void> {
  const { error } = await supabase.from("financial_payables").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o título a pagar", error);
}

/** Baixa (pagamento) de um título a pagar. */
export async function pagarTitulo(
  id: string,
  info: { dataPagamento: string; formaPagamento?: string; observacao?: string }
): Promise<void> {
  await updateTituloPagar(id, {
    status: "pago",
    dataPagamento: info.dataPagamento,
    formaPagamento: info.formaPagamento,
    observacao: info.observacao,
  });
}

/** Reabre um título que foi pago por engano. */
export async function estornarTituloPagar(id: string): Promise<void> {
  await updateTituloPagar(id, { status: "aberto", dataPagamento: undefined, formaPagamento: undefined });
}

export async function cancelarTituloPagar(id: string): Promise<void> {
  await updateTituloPagar(id, { status: "cancelado" });
}