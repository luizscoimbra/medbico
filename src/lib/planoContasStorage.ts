import { supabase } from "@/integrations/supabase/client";
import { num, orNull, requireScope, storageError } from "@/lib/db";

/**
 * Plano de contas (árvore) e centros de custo (departamentos).
 *
 * São os dois cadastros que sustentam o módulo financeiro:
 *   * conta do plano → em que rubrica a despesa entra;
 *   * centro de custo → de qual departamento ela é (obrigatório no lançamento).
 */

export type TipoConta = "despesa" | "receita";

export interface ContaPlano {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoConta;
  parentId?: string;
  ativo: boolean;
}

export interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  padrao: boolean;
  ativo: boolean;
}

export interface RateioItem {
  centroCustoId: string;
  percentual: number;
  valor: number;
}

interface ContaPlanoRow {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  parent_id: string | null;
  ativo: boolean;
}

interface CentroCustoRow {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  padrao: boolean;
  ativo: boolean;
}

const contaFromRow = (r: ContaPlanoRow): ContaPlano => ({
  id: r.id,
  codigo: r.codigo,
  nome: r.nome,
  tipo: (r.tipo as TipoConta) || "despesa",
  parentId: r.parent_id ?? undefined,
  ativo: r.ativo,
});

const centroFromRow = (r: CentroCustoRow): CentroCusto => ({
  id: r.id,
  codigo: r.codigo,
  nome: r.nome,
  descricao: r.descricao ?? undefined,
  padrao: !!r.padrao,
  ativo: r.ativo,
});

const novoId = (prefixo: string) =>
  `${prefixo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ─── Plano de contas ────────────────────────────────────────────────────────

export async function getAllContasPlano(): Promise<ContaPlano[]> {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("*")
    .order("codigo", { ascending: true });
  if (error) throw storageError("Falha ao carregar o plano de contas", error);
  return (data as ContaPlanoRow[]).map(contaFromRow);
}

/**
 * Semeia a árvore padrão quando a empresa ainda não tem nenhuma conta.
 * Devolve `true` se algo foi criado (para a tela recarregar).
 */
export async function semearPlanoDeContas(): Promise<boolean> {
  const { error } = await supabase.rpc("seed_default_chart_of_accounts");
  if (error) throw storageError("Falha ao criar o plano de contas padrão", error);
  return true;
}

export async function criarContaPlano(input: {
  codigo: string;
  nome: string;
  tipo: TipoConta;
  parentId?: string;
}): Promise<ContaPlano> {
  const { branchId } = await requireScope();
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .insert({
      id: novoId("ca"),
      branch_id: branchId,
      codigo: input.codigo.trim(),
      nome: input.nome.trim(),
      tipo: input.tipo,
      parent_id: orNull(input.parentId),
      ativo: true,
    })
    .select("*")
    .single();
  if (error) throw storageError("Falha ao criar a conta", error);
  return contaFromRow(data as ContaPlanoRow);
}

export async function updateContaPlano(
  id: string,
  patch: Partial<Pick<ContaPlano, "codigo" | "nome" | "tipo" | "parentId" | "ativo">>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("codigo" in patch) payload.codigo = patch.codigo;
  if ("nome" in patch) payload.nome = patch.nome;
  if ("tipo" in patch) payload.tipo = patch.tipo;
  if ("parentId" in patch) payload.parent_id = orNull(patch.parentId);
  if ("ativo" in patch) payload.ativo = patch.ativo;
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("chart_of_accounts").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao atualizar a conta", error);
}

/** Contas que apontam para esta (inclusive por cascata) — impede apagar nó em uso. */
export async function contasDependentes(id: string): Promise<number> {
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("parent_id", id);
  if (error) throw storageError("Falha ao verificar dependentes da conta", error);
  return (data || []).length;
}

export async function contaEmUso(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("financial_payables")
    .select("id")
    .eq("plano_conta_id", id)
    .limit(1);
  if (error) throw storageError("Falha ao verificar uso da conta", error);
  return (data || []).length > 0;
}

export async function deleteContaPlano(id: string): Promise<void> {
  const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir a conta", error);
}

// ─── Centros de custo ───────────────────────────────────────────────────────

export async function getAllCentrosCusto(): Promise<CentroCusto[]> {
  const { data, error } = await supabase
    .from("cost_centers")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw storageError("Falha ao carregar os centros de custo", error);
  return (data as CentroCustoRow[]).map(centroFromRow);
}

export async function criarCentroCusto(input: {
  codigo: string;
  nome: string;
  descricao?: string;
}): Promise<CentroCusto> {
  const { branchId } = await requireScope();
  const { data, error } = await supabase
    .from("cost_centers")
    .insert({
      id: novoId("cc"),
      branch_id: branchId,
      codigo: input.codigo.trim(),
      nome: input.nome.trim(),
      descricao: orNull(input.descricao),
      ativo: true,
    })
    .select("*")
    .single();
  if (error) throw storageError("Falha ao criar o centro de custo", error);
  return centroFromRow(data as CentroCustoRow);
}

export async function updateCentroCusto(
  id: string,
  patch: Partial<Pick<CentroCusto, "codigo" | "nome" | "descricao" | "ativo" | "padrao">>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("codigo" in patch) payload.codigo = patch.codigo;
  if ("nome" in patch) payload.nome = patch.nome;
  if ("descricao" in patch) payload.descricao = orNull(patch.descricao);
  if ("ativo" in patch) payload.ativo = patch.ativo;
  if ("padrao" in patch) payload.padrao = patch.padrao;
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("cost_centers").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao atualizar o centro de custo", error);
}

export async function centroCustoEmUso(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("financial_payables")
    .select("id")
    .eq("centro_custo_id", id)
    .limit(1);
  if (error) throw storageError("Falha ao verificar uso do centro de custo", error);
  return (data || []).length > 0;
}

export async function deleteCentroCusto(id: string): Promise<void> {
  const { error } = await supabase.from("cost_centers").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o centro de custo", error);
}

/**
 * Departamento usado quando a origem do título não deixa escolher
 * (geração a partir de manutenções, importação do armazenamento local).
 *
 * Prefere o centro marcado como padrão; se não houver, cria o
 * "Não classificado" — assim nenhum lançamento entra sem departamento,
 * e o relatório mostra exatamente o que ficou por classificar.
 */
export async function resolverCentroCustoAutomatico(): Promise<string> {
  const centros = await getAllCentrosCusto();
  const padrao = centros.find((c) => c.padrao && c.ativo);
  if (padrao) return padrao.id;
  const naoClassificado = centros.find((c) => c.codigo === "NAO-CLASSIFICADO");
  if (naoClassificado) return naoClassificado.id;
  const criado = await criarCentroCusto({
    codigo: "NAO-CLASSIFICADO",
    nome: "Não classificado",
    descricao: "Usado quando a origem do título não permite escolher o departamento.",
  });
  await updateCentroCusto(criado.id, { padrao: true, ativo: false });
  return criado.id;
}

/**
 * Conta do plano correspondente a uma categoria legada ("Manutenção",
 * "Combustível"...). Mantém os títulos gerados automaticamente classificados
 * sem obrigar o usuário a escolher a rubrica em cada geração em lote.
 */
export async function resolverContaPorCategoria(
  contas: ContaPlano[],
  categoria: string
): Promise<string> {
  let base = contas;
  if (base.length === 0) {
    await semearPlanoDeContas().catch(() => undefined);
    base = await getAllContasPlano();
  }

  const alvo = (categoria || "").trim().toLowerCase();
  const despesas = base.filter((c) => c.tipo === "despesa");
  const encontrada =
    despesas.find((c) => c.nome.trim().toLowerCase() === alvo) ||
    despesas.find((c) => c.nome.toLowerCase().includes("outras despesas")) ||
    despesas.find((c) => !c.parentId && c.nome.toLowerCase().includes("despesas operacionais")) ||
    despesas[0];
  if (encontrada) return encontrada.id;

  const criada = await criarContaPlano({
    codigo: `9${Date.now().toString().slice(-6)}`,
    nome: categoria || "Outras Despesas",
    tipo: "despesa",
  });
  return criada.id;
}

// ─── Rateio ─────────────────────────────────────────────────────────────────

export async function getRateio(payableId: string): Promise<RateioItem[]> {
  const { data, error } = await supabase
    .from("financial_payable_allocations")
    .select("*")
    .eq("payable_id", payableId)
    .order("valor", { ascending: false });
  if (error) throw storageError("Falha ao carregar o rateio", error);
  return (data as { cost_center_id: string; percentual: string | number | null; valor: string | number }[]).map(
    (r) => ({
      centroCustoId: r.cost_center_id,
      percentual: num(r.percentual),
      valor: num(r.valor),
    })
  );
}

/**
 * Grava o rateio do título de uma vez (apaga os itens antigos e escreve os
 * novos). A validação da soma acontece aqui, antes de qualquer gravação — o
 * banco não tem trigger por linha justamente porque ela enxergaria o rateio
 * pela metade durante a escrita.
 */
export async function salvarRateio(
  payableId: string,
  valorTitulo: number,
  itens: RateioItem[]
): Promise<void> {
  const limpos = itens.filter((i) => i.centroCustoId && i.valor > 0);

  if (limpos.length === 0) {
    const { error } = await supabase
      .from("financial_payable_allocations")
      .delete()
      .eq("payable_id", payableId);
    if (error) throw storageError("Falha ao limpar o rateio", error);
    return;
  }

  if (limpos.length < 2) {
    throw new Error("O rateio precisa de pelo menos 2 departamentos. Use o centro de custo do título.");
  }

  const soma = limpos.reduce((s, i) => s + i.valor, 0);
  if (Math.abs(soma - valorTitulo) > 0.009) {
    throw new Error(
      `O rateio soma ${soma.toFixed(2)} e o título vale ${valorTitulo.toFixed(2)}. Ajuste os valores.`
    );
  }

  const { branchId } = await requireScope();

  const { error: delError } = await supabase
    .from("financial_payable_allocations")
    .delete()
    .eq("payable_id", payableId);
  if (delError) throw storageError("Falha ao substituir o rateio", delError);

  const linhas = limpos.map((i) => ({
    id: novoId("ra"),
    branch_id: branchId,
    payable_id: payableId,
    cost_center_id: i.centroCustoId,
    percentual: (i.valor / valorTitulo) * 100,
    valor: i.valor,
  }));

  const { error } = await supabase.from("financial_payable_allocations").insert(linhas);
  if (error) throw storageError("Falha ao gravar o rateio", error);
}

export async function removerRateio(payableId: string): Promise<void> {
  const { error } = await supabase
    .from("financial_payable_allocations")
    .delete()
    .eq("payable_id", payableId);
  if (error) throw storageError("Falha ao remover o rateio", error);
}
