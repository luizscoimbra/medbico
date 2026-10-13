import { supabase } from "@/integrations/supabase/client";
import { num, orNull, requireScope, storageError } from "@/lib/db";
import { hashOfx, parseOfx, type OfxTransacao } from "@/lib/ofxParser";
import { getAllTitulosPagar, type TituloPagar } from "@/lib/contasPagarStorage";
import { getAllTitulos, type TituloReceber } from "@/lib/financeiroStorage";

/**
 * Conciliação bancária: importação de extrato (OFX), categorização por regras
 * e batimento dos movimentos com os títulos lançados no sistema.
 */

export interface MovimentoExtrato {
  id: string;
  bankAccountId: string;
  data: string;
  fitid?: string;
  historico: string;
  descricao?: string;
  doc?: string;
  favorecido?: string;
  valor: number;
  credito: boolean;
  formaPagamento?: string;
  categoria?: string;
  conciliado: boolean;
  conciliadoEm?: string;
  payableId?: string;
  receivableId?: string;
  observacao?: string;
}

export interface RegraConciliacao {
  id: string;
  nome: string;
  matchTipo: "historico_contem" | "historico_igual" | "favorecido_contem" | "doc_igual";
  matchValor: string;
  formaPagamento?: string;
  categoria?: string;
  planoContaId?: string;
  centroCustoId?: string;
  prioridade: number;
  ativo: boolean;
}

export interface ImportacaoExtrato {
  id: string;
  arquivoNome: string;
  linhas: number;
  creditos: number;
  debitos: number;
  periodoDe?: string;
  periodoAte?: string;
  importadoEm: string;
}

interface MovimentoRow {
  id: string;
  bank_account_id: string;
  data: string;
  fitid: string | null;
  historico: string;
  descricao: string | null;
  doc: string | null;
  favorecido: string | null;
  valor: number | string;
  credito: boolean;
  forma_pagamento: string | null;
  categoria: string | null;
  conciliado: boolean;
  conciliado_em: string | null;
  payable_id: string | null;
  receivable_id: string | null;
  observacao: string | null;
}

const movFromRow = (r: MovimentoRow): MovimentoExtrato => ({
  id: r.id,
  bankAccountId: r.bank_account_id,
  data: r.data,
  fitid: r.fitid ?? undefined,
  historico: r.historico,
  descricao: r.descricao ?? undefined,
  doc: r.doc ?? undefined,
  favorecido: r.favorecido ?? undefined,
  valor: num(r.valor),
  credito: !!r.credito,
  formaPagamento: r.forma_pagamento ?? undefined,
  categoria: r.categoria ?? undefined,
  conciliado: !!r.conciliado,
  conciliadoEm: r.conciliado_em ?? undefined,
  payableId: r.payable_id ?? undefined,
  receivableId: r.receivable_id ?? undefined,
  observacao: r.observacao ?? undefined,
});

const novoId = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizar = (v: string) =>
  (v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// ─── Regras de categorização ────────────────────────────────────────────────

interface RegraRow {
  id: string;
  nome: string;
  match_tipo: string;
  match_valor: string;
  forma_pagamento: string | null;
  categoria: string | null;
  plano_conta_id: string | null;
  centro_custo_id: string | null;
  prioridade: number;
  ativo: boolean;
}

const regraFromRow = (r: RegraRow): RegraConciliacao => ({
  id: r.id,
  nome: r.nome,
  matchTipo: r.match_tipo as RegraConciliacao["matchTipo"],
  matchValor: r.match_valor,
  formaPagamento: r.forma_pagamento ?? undefined,
  categoria: r.categoria ?? undefined,
  planoContaId: r.plano_conta_id ?? undefined,
  centroCustoId: r.centro_custo_id ?? undefined,
  prioridade: r.prioridade,
  ativo: !!r.ativo,
});

export async function getAllRegras(): Promise<RegraConciliacao[]> {
  const { data, error } = await supabase
    .from("conciliation_rules")
    .select("*")
    .order("prioridade", { ascending: true });
  if (error) throw storageError("Falha ao carregar as regras de conciliação", error);
  return (data as RegraRow[]).map(regraFromRow);
}

export async function semearRegras(): Promise<void> {
  const { error } = await supabase.rpc("seed_default_conciliation_rules");
  if (error) throw storageError("Falha ao criar as regras padrão", error);
}

export async function criarRegra(input: Omit<RegraConciliacao, "id">): Promise<void> {
  const { branchId } = await requireScope();
  const { error } = await supabase.from("conciliation_rules").insert({
    id: novoId("cr"),
    branch_id: branchId,
    nome: input.nome,
    match_tipo: input.matchTipo,
    match_valor: input.matchValor,
    forma_pagamento: orNull(input.formaPagamento),
    categoria: orNull(input.categoria),
    plano_conta_id: orNull(input.planoContaId),
    centro_custo_id: orNull(input.centroCustoId),
    prioridade: input.prioridade,
    ativo: input.ativo,
  });
  if (error) throw storageError("Falha ao criar a regra", error);
}

export async function updateRegra(id: string, patch: Partial<RegraConciliacao>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("nome" in patch) payload.nome = patch.nome;
  if ("matchTipo" in patch) payload.match_tipo = patch.matchTipo;
  if ("matchValor" in patch) payload.match_valor = patch.matchValor;
  if ("formaPagamento" in patch) payload.forma_pagamento = orNull(patch.formaPagamento);
  if ("categoria" in patch) payload.categoria = orNull(patch.categoria);
  if ("planoContaId" in patch) payload.plano_conta_id = orNull(patch.planoContaId);
  if ("centroCustoId" in patch) payload.centro_custo_id = orNull(patch.centroCustoId);
  if ("prioridade" in patch) payload.prioridade = patch.prioridade;
  if ("ativo" in patch) payload.ativo = patch.ativo;
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("conciliation_rules").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao atualizar a regra", error);
}

export async function deleteRegra(id: string): Promise<void> {
  const { error } = await supabase.from("conciliation_rules").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir a regra", error);
}

/** Aplica as regras ativas a um movimento, em ordem de prioridade. */
export function aplicarRegras(
  trn: OfxTransacao,
  regras: RegraConciliacao[]
): Partial<Pick<RegraConciliacao, "formaPagamento" | "categoria" | "planoContaId" | "centroCustoId">> {
  const historico = normalizar(trn.memo || "");
  const favorecido = normalizar(trn.memo || "");
  const doc = normalizar(trn.doc || trn.refnum || trn.chknum || "");

  const ordenadas = [...regras].filter((r) => r.ativo).sort((a, b) => a.prioridade - b.prioridade);

  for (const regra of ordenadas) {
    const alvo = normalizar(regra.matchValor);
    if (!alvo) continue;

    let bateu = false;
    if (regra.matchTipo === "historico_contem") bateu = historico.includes(alvo);
    else if (regra.matchTipo === "historico_igual") bateu = historico === alvo;
    else if (regra.matchTipo === "favorecido_contem") bateu = favorecido.includes(alvo);
    else if (regra.matchTipo === "doc_igual") bateu = !!doc && doc === alvo;

    if (bateu) {
      return {
        formaPagamento: regra.formaPagamento,
        categoria: regra.categoria,
        planoContaId: regra.planoContaId,
        centroCustoId: regra.centroCustoId,
      };
    }
  }
  return {};
}

// ─── Importação de OFX ──────────────────────────────────────────────────────

export async function importarOfx(params: {
  bankAccountId: string;
  arquivoNome: string;
  texto: string;
}): Promise<{ inseridos: number; ignorados: number; total: number }> {
  const { branchId } = await requireScope();
  const ofx = parseOfx(params.texto);
  const hash = hashOfx(params.texto);

  if (ofx.transacoes.length === 0) {
    throw new Error("Nenhum lançamento encontrado no arquivo OFX.");
  }

  // Arquivo já importado? O hash impede duplicar a mesma base.
  const { data: jaImportado, error: errHash } = await supabase
    .from("bank_statement_imports")
    .select("id")
    .eq("bank_account_id", params.bankAccountId)
    .eq("arquivo_hash", hash)
    .maybeSingle();
  if (errHash) throw storageError("Falha ao verificar o arquivo", errHash);
  if (jaImportado) {
    throw new Error("Este extrato já foi importado anteriormente.");
  }

  const datas = ofx.transacoes.map((t) => t.dtposted).sort();
  const { data: importRow, error: errImport } = await supabase
    .from("bank_statement_imports")
    .insert({
      id: novoId("bi"),
      branch_id: branchId,
      bank_account_id: params.bankAccountId,
      arquivo_nome: params.arquivoNome,
      arquivo_hash: hash,
      formato: "ofx",
      linhas: ofx.transacoes.length,
      creditos: ofx.transacoes.filter((t) => t.trnamt > 0).reduce((s, t) => s + t.trnamt, 0),
      debitos: Math.abs(ofx.transacoes.filter((t) => t.trnamt < 0).reduce((s, t) => s + t.trnamt, 0)),
      periodo_de: datas[0],
      periodo_ate: datas[datas.length - 1],
      importado_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (errImport) throw storageError("Falha ao registrar a importação", errImport);

  // FITID já existentes nesta conta: reimportar o mesmo período não duplica.
  const fitids = ofx.transacoes.map((t) => t.fitid).filter((v): v is string => !!v);
  const existentes = new Set<string>();
  if (fitids.length) {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("fitid")
      .eq("bank_account_id", params.bankAccountId)
      .in("fitid", fitids);
    if (error) throw storageError("Falha ao conferir lançamentos existentes", error);
    (data || []).forEach((r) => existentes.add(String((r as { fitid: string }).fitid)));
  }

  const regras = await getAllRegras();
  const linhas = ofx.transacoes
    .filter((t) => !t.fitid || !existentes.has(t.fitid))
    .map((t) => {
      const classe = aplicarRegras(t, regras);
      const historico = [t.memo, t.refnum, t.chknum].filter(Boolean).join(" · ");
      return {
        id: novoId("bs"),
        branch_id: branchId,
        bank_account_id: params.bankAccountId,
        import_id: importRow.id,
        data: t.dtposted,
        fitid: orNull(t.fitid),
        historico: historico || t.trntype || "Lançamento",
        doc: orNull(t.doc),
        valor: t.trnamt,
        credito: t.trnamt > 0,
        forma_pagamento: orNull(classe.formaPagamento),
        categoria: orNull(classe.categoria),
        plano_conta_id: orNull(classe.planoContaId),
        centro_custo_id: orNull(classe.centroCustoId),
        conciliado: false,
      };
    });

  if (linhas.length) {
    const { error } = await supabase.from("bank_statements").insert(linhas);
    if (error) throw storageError("Falha ao gravar os lançamentos do extrato", error);
  }

  const { error: errConta } = await supabase
    .from("bank_accounts")
    .update({ ultima_importacao: new Date().toISOString() })
    .eq("id", params.bankAccountId);
  if (errConta) throw storageError("Falha ao atualizar a conta bancária", errConta);

  return {
    inseridos: linhas.length,
    ignorados: ofx.transacoes.length - linhas.length,
    total: ofx.transacoes.length,
  };
}

export async function getUltimasImportacoes(
  bankAccountId: string,
  limite = 5
): Promise<ImportacaoExtrato[]> {
  const { data, error } = await supabase
    .from("bank_statement_imports")
    .select("*")
    .eq("bank_account_id", bankAccountId)
    .order("importado_em", { ascending: false })
    .limit(limite);
  if (error) throw storageError("Falha ao carregar as importações", error);
  return (data as {
    id: string;
    arquivo_nome: string;
    linhas: number;
    creditos: number | string;
    debitos: number | string;
    periodo_de: string | null;
    periodo_ate: string | null;
    importado_em: string;
  }[]).map((r) => ({
    id: r.id,
    arquivoNome: r.arquivo_nome,
    linhas: r.linhas,
    creditos: num(r.creditos),
    debitos: num(r.debitos),
    periodoDe: r.periodo_de ?? undefined,
    periodoAte: r.periodo_ate ?? undefined,
    importadoEm: r.importado_em,
  }));
}

// ─── Extrato ────────────────────────────────────────────────────────────────

export async function getExtrato(
  bankAccountId: string,
  filtro?: { de?: string; ate?: string; conciliado?: boolean }
): Promise<MovimentoExtrato[]> {
  let consulta = supabase
    .from("bank_statements")
    .select("*")
    .eq("bank_account_id", bankAccountId)
    .order("data", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);

  if (filtro?.de) consulta = consulta.gte("data", filtro.de);
  if (filtro?.ate) consulta = consulta.lte("data", filtro.ate);
  if (filtro?.conciliado !== undefined) consulta = consulta.eq("conciliado", filtro.conciliado);

  const { data, error } = await consulta;
  if (error) throw storageError("Falha ao carregar o extrato", error);
  return (data as MovimentoRow[]).map(movFromRow);
}

export interface ResumoExtrato {
  creditos: number;
  debitos: number;
  saldo: number;
  pendentes: number;
  conciliados: number;
}

export function resumirExtrato(movimentos: MovimentoExtrato[], saldoInicial = 0): ResumoExtrato {
  const creditos = movimentos.filter((m) => m.valor > 0).reduce((s, m) => s + m.valor, 0);
  const debitos = movimentos.filter((m) => m.valor < 0).reduce((s, m) => s + Math.abs(m.valor), 0);
  return {
    creditos,
    debitos,
    saldo: saldoInicial + creditos - debitos,
    pendentes: movimentos.filter((m) => !m.conciliado).length,
    conciliados: movimentos.filter((m) => m.conciliado).length,
  };
}

// ─── Conciliação ────────────────────────────────────────────────────────────

/**
 * Sugere o título que bate com o movimento: valor igual (centavo a centavo)
 * e, se houver empate, quem tiver o vencimento/lançamento mais próximo.
 */
export function sugerirTitulo(
  mov: MovimentoExtrato,
  titulos: { pagar: TituloPagar[]; receber: TituloReceber[] }
): { id: string; nome: string; tipo: "pagar" | "receber"; diferenca: number } | null {
  const alvo = Math.abs(mov.valor);
  const candidatos: {
    id: string;
    nome: string;
    tipo: "pagar" | "receber";
    diferenca: number;
    data?: string;
  }[] = [];

  const historico = normalizar(mov.historico);

  if (mov.valor < 0) {
    titulos.pagar
      .filter((t) => t.status === "aberto")
      .forEach((t) => {
        const dif = Math.abs(t.valor - alvo);
        if (dif > 0.009) return;
        candidatos.push({
          id: t.id,
          nome: t.fornecedorNome || t.descricao,
          tipo: "pagar",
          diferenca: dif,
          data: t.dataVencimento,
        });
      });
  } else {
    titulos.receber
      .filter((t) => t.status === "aberto")
      .forEach((t) => {
        const dif = Math.abs(t.valor - alvo);
        if (dif > 0.009) return;
        candidatos.push({
          id: t.id,
          nome: t.clienteNome || t.descricao,
          tipo: "receber",
          diferenca: dif,
          data: t.dataVencimento,
        });
      });
  }

  if (!candidatos.length) return null;

  // Prioriza quem aparece citado no histórico do extrato.
  const citado = candidatos.filter((c) => c.nome && historico.includes(normalizar(c.nome)));
  const base = citado.length ? citado : candidatos;
  base.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const melhor = base[0];
  return { id: melhor.id, nome: melhor.nome, tipo: melhor.tipo, diferenca: melhor.diferenca };
}

/** Carrega os títulos em aberto usados nas sugestões de batimento. */
export async function carregarTitulosParaBatimento(): Promise<{
  pagar: TituloPagar[];
  receber: TituloReceber[];
}> {
  const [pagar, receber] = await Promise.all([getAllTitulosPagar(), getAllTitulos()]);
  return { pagar, receber };
}

/**
 * Concilia o movimento com um título e dá baixa nele, em uma única chamada
 * ao banco (RPC) — extrato e título mudam juntos ou nada muda.
 */
export async function conciliarMovimento(params: {
  statementId: string;
  payableId?: string;
  receivableId?: string;
  dataPagamento?: string;
  formaPagamento?: string;
}): Promise<void> {
  const { error } = await supabase.rpc("conciliar_lancamento", {
    p_statement_id: params.statementId,
    p_payable_id: params.payableId ?? null,
    p_receivable_id: params.receivableId ?? null,
    p_data_pagamento: params.dataPagamento ?? null,
    p_forma_pagamento: params.formaPagamento ?? null,
  });
  if (error) throw storageError("Falha ao conciliar o movimento", error);
}

/**
 * Desfaz a conciliação: o movimento volta para a fila e o título reabre.
 * Feito em duas etapas (fora de transação) — por isso o título só é reaberto
 * se ele ainda estiver marcado como pago.
 */
export async function desconciliarMovimento(mov: MovimentoExtrato): Promise<void> {
  const { error } = await supabase
    .from("bank_statements")
    .update({ conciliado: false, conciliado_em: null, payable_id: null, receivable_id: null })
    .eq("id", mov.id);
  if (error) throw storageError("Falha ao desfazer a conciliação", error);

  if (mov.payableId) {
    await supabase
      .from("financial_payables")
      .update({ status: "aberto", data_pagamento: null, forma_pagamento: null })
      .eq("id", mov.payableId)
      .eq("status", "pago");
  }
  if (mov.receivableId) {
    await supabase
      .from("financial_receivables")
      .update({ status: "aberto", data_pagamento: null, forma_pagamento: null })
      .eq("id", mov.receivableId)
      .eq("status", "pago");
  }
}

/** Classificação manual de um movimento (categoria, conta, departamento). */
export async function classificarMovimento(
  id: string,
  patch: {
    categoria?: string;
    formaPagamento?: string;
    planoContaId?: string;
    centroCustoId?: string;
    observacao?: string;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("categoria" in patch) payload.categoria = orNull(patch.categoria);
  if ("formaPagamento" in patch) payload.forma_pagamento = orNull(patch.formaPagamento);
  if ("planoContaId" in patch) payload.plano_conta_id = orNull(patch.planoContaId);
  if ("centroCustoId" in patch) payload.centro_custo_id = orNull(patch.centroCustoId);
  if ("observacao" in patch) payload.observacao = orNull(patch.observacao);
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("bank_statements").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao classificar o movimento", error);
}

export async function excluirMovimento(id: string): Promise<void> {
  const { error } = await supabase.from("bank_statements").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o movimento", error);
}
