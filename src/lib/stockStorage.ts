import { supabase } from "@/integrations/supabase/client";
import { activeBranch, num, storageError } from "@/lib/db";
import type { ItemManutencao } from "./equipmentMaintenanceStorage";
import type { ComponenteCatalogo } from "./componenteStorage";
import { TIPOS_COMBUSTIVEL } from "./equipmentFuelStorage";

// ============================================
// TYPES
// ============================================

export const CATEGORIAS_ESTOQUE = ["produto", "peca", "acessorio", "combustivel"] as const;

export type CategoriaEstoque = (typeof CATEGORIAS_ESTOQUE)[number];

export const CATEGORIA_LABELS: Record<CategoriaEstoque, string> = {
  produto: "Produtos",
  peca: "Peças",
  acessorio: "Acessórios",
  combustivel: "Combustível",
};

export interface EntradaEstoque {
  id: string;
  categoria: CategoriaEstoque;
  item_key: string;
  item_nome: string;
  quantidade: number;
  valor_total: number;
  data: string;
  fornecedor: string;
  observacao: string;
  created_at: string;
  updated_at: string;
}

export type EntradaEstoqueInput = Omit<
  EntradaEstoque,
  "id" | "created_at" | "updated_at" | "valor_total"
> & { valor_total?: number };

export interface ConfigEstoque {
  item_key: string;
  categoria: CategoriaEstoque;
  minimo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Linha agregada devolvida por `public.stock_snapshot()`. */
export interface SnapshotItem {
  categoria: CategoriaEstoque;
  item_key: string;
  nome: string;
  nome_norm: string;
  entradas_total: number;
  saida_total: number;
  saldo: number;
  valor_ultima_entrada: number;
  data_ultima_entrada: string | null;
}

export type SnapshotDados = Record<CategoriaEstoque, SnapshotItem[]>;

// ============================================
// CHAVES (vínculo com o cadastro do módulo correspondente)
// ============================================

const PREFIXO_CATEGORIA: Record<CategoriaEstoque, string> = {
  produto: "prod",
  peca: "peca",
  acessorio: "acc",
  combustivel: "comb",
};

/**
 * Chave do item no estoque. Liga a linha do estoque ao cadastro do módulo
 * correspondente: prod:<registered_products.id> · peca:<equipment_maintenance_items.id> ·
 * acc:<component_catalog.id> · comb:<tipo de combustível>.
 */
export function buildItemKey(categoria: CategoriaEstoque, origemId: string): string {
  return `${PREFIXO_CATEGORIA[categoria]}:${origemId}`;
}

// ============================================
// LEITURA
// ============================================

export async function getAllEntradas(categoria?: CategoriaEstoque): Promise<EntradaEstoque[]> {
  let query = supabase.from("stock_entries").select("*");
  if (categoria) query = query.eq("categoria", categoria);
  const { data, error } = await query.order("data", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, quantidade: num(row.quantidade), valor_total: num(row.valor_total) })) as EntradaEstoque[];
}

/**
 * Estoque mínimo dos itens.
 *
 * O mínimo é definido por filial (`stock_settings.branch_key`). Sem o filtro, uma
 * empresa com várias filiais recebia uma linha por filial e `montarEstoque` as
 * reduzia a um mapa por `item_key` — o mínimo de uma filial vazava para as
 * outras e o alerta de estoque baixo disparava no lugar errado.
 */
export async function getAllConfigs(): Promise<ConfigEstoque[]> {
  const filial = activeBranch();
  let query = supabase.from("stock_settings").select("*");
  if (filial) query = query.eq("branch_key", filial);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({ ...row, minimo: num(row.minimo) })) as ConfigEstoque[];
}

/**
* Saldo consolidado, calculado em uma única transação no PostgreSQL.
  *
  * Antes o saldo era somado no navegador cruzando entradas (Supabase) com saídas
  * derivadas de OS, manutenções, drones e abastecimentos — fontes distintas que
  * podiam ser lidas em estados diferentes e gerar divergência. Todas essas
  * fontes agora vivem no mesmo banco, então o snapshot é internamente coerente.
  *
  * O banco devolve uma seção por filial. Sem filial, devolve a visão
  * consolidada da empresa inteira.
  */
export async function getEstoqueSnapshot(): Promise<SnapshotDados> {
  // O parâmetro precisa ser enviado mesmo quando é nulo: o PostgREST casa a
  // chamada pelo conjunto exato de argumentos e não aceita a chamada vazia.
  const { data, error } = await supabase.rpc("stock_snapshot", {
    p_branch: activeBranch(),
  });
  if (error) throw storageError("Falha ao calcular o saldo do estoque", error);

  return normalizarSnapshot(data);
}

/** Snapshot de uma filial específica. */
export async function getEstoqueSnapshotFilial(branchId: string): Promise<SnapshotDados> {
  const { data, error } = await supabase.rpc("stock_snapshot", { p_branch: branchId });
  if (error) throw storageError("Falha ao calcular o saldo do estoque da filial", error);
  return normalizarSnapshot(data);
}

function normalizarSnapshot(data: unknown): SnapshotDados {
  const bruto = (data ?? {}) as Record<string, unknown>;
  const vazio = (): SnapshotItem[] => [];

  // O banco devolve { branch_key: [itens...] }. Quando há uma única filial,
  // devolvemos direto; com várias, o cliente escolhe qual soma.
  const secoes = Object.values(bruto).filter(Array.isArray);
  const linhas = secoes.flat() as (SnapshotItem & { branch_key?: string })[];

  const agrupado: SnapshotItem[] = linhas.map((row) => ({
    categoria: row.categoria,
    item_key: row.item_key,
    nome: row.nome,
    nome_norm: row.nome_norm ?? row.nome?.trim().toLowerCase() ?? "",
    entradas_total: num(row.entradas_total),
    saida_total: num(row.saida_total),
    saldo: num(row.saldo),
    valor_ultima_entrada: num(row.valor_ultima_entrada),
    data_ultima_entrada: row.data_ultima_entrada ?? null,
  }));

  return {
    produto: agrupado.filter((i) => i.categoria === "produto"),
    peca: agrupado.filter((i) => i.categoria === "peca"),
    acessorio: agrupado.filter((i) => i.categoria === "acessorio"),
    combustivel: agrupado.filter((i) => i.categoria === "combustivel"),
  };
}

// ============================================
// ESCRITA ATÔMICA
// ============================================

/**
 * Registra uma entrada de estoque.
 *
 * A RPC grava a linha e recalcula o saldo do item dentro da mesma transação, e
 * devolve o novo saldo  a tela deixa de exibir um valor defasado entre a
 * gravação e o recarregamento.
 */
export async function createEntrada(
  rec: EntradaEstoqueInput,
  branchId?: string | null
): Promise<EntradaEstoque> {
  const { data, error } = await supabase.rpc("register_stock_entry", {
    p_categoria: rec.categoria,
    p_item_key: rec.item_key,
    p_item_nome: rec.item_nome,
    p_quantidade: rec.quantidade,
    p_valor_total: rec.valor_total ?? 0,
    p_data: rec.data,
    p_fornecedor: rec.fornecedor,
    p_observacao: rec.observacao,
    p_branch_id: branchId ?? activeBranch(),
  });

  if (error) throw storageError("Falha ao registrar a entrada de estoque", error);

  const id = (data as { id: string } | null)?.id;
  if (!id) throw new Error("Falha ao registrar a entrada de estoque: o banco não devolveu o identificador.");

  const criadas = await getAllEntradas(rec.categoria);
  return (
    criadas.find((e) => e.id === id) ?? {
      ...rec,
      id,
      valor_total: rec.valor_total ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  );
}

/**
 * Transfere material entre filiais.
 *
 * A RPC valida o saldo na origem e grava as duas movimentações na mesma
 * transação. Se algo falhar no meio, nada é gravado — não existe caminho em que
 * a mercadoria sai de uma filial e não chega à outra.
 */
export async function transferirEstoque(params: {
  de: string;
  para: string;
  itemKey: string;
  itemNome: string;
  quantidade: number;
  observacao?: string;
}): Promise<{ saldoOrigem: number; saldoDestino: number }> {
  const { data, error } = await supabase.rpc("transfer_stock", {
    p_de: params.de,
    p_para: params.para,
    p_item_key: params.itemKey,
    p_item_nome: params.itemNome,
    p_quantidade: params.quantidade,
    p_observacao: params.observacao ?? "",
  });

  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { saldo_origem?: number; saldo_destino?: number };
  return { saldoOrigem: num(r.saldo_origem), saldoDestino: num(r.saldo_destino) };
}

export async function updateEntrada(
  id: string,
  updates: Partial<EntradaEstoqueInput>
): Promise<void> {
  const { error } = await supabase.from("stock_entries").update(updates).eq("id", id);
  if (error) throw error;
}

/** Exclui uma entrada e recalcula o saldo afetado na mesma transação. */
export async function deleteEntrada(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_stock_entry", { p_id: id });
  if (error) throw storageError("Falha ao excluir a entrada de estoque", error);
}

/** Cria ou atualiza o estoque mínimo de um item (upsert atômico no banco). */
export async function upsertConfig(
  itemKey: string,
  categoria: CategoriaEstoque,
  minimo: number,
  branchId?: string | null
): Promise<void> {
  const { error } = await supabase.rpc("set_stock_minimum", {
    p_item_key: itemKey,
    p_categoria: categoria,
    p_minimo: minimo,
    p_branch_id: branchId ?? activeBranch(),
  });
  if (error) throw storageError("Falha ao salvar o estoque mínimo", error);
}

// ============================================
// MONTAGEM DA TELA (apresentação — a aritmética vem do snapshot)
// ============================================

export interface ProdutoCadastrado {
  id: string;
  commercial_name: string;
  unit: string;
  package_size: number;
  preco_unitario: number;
}

export interface ItemEstoque {
  itemKey: string;
  categoria: CategoriaEstoque;
  nome: string;
  /** Detalhe do cadastro (unidade, categoria/embalagem, modelo, etc). */
  detalhe: string;
  unidade: string;
  /** entradas − saídas (pode ficar negativo quando faltam entradas). */
  saldo: number;
  entradasTotal: number;
  saidaTotal: number;
  minimo: number;
  temConfig: boolean;
  abaixoDoMinimo: boolean;
  valorUltimaEntrada: number;
  dataUltimaEntrada: string | null;
}

export interface DadosEstoque {
  produto: ItemEstoque[];
  peca: ItemEstoque[];
  acessorio: ItemEstoque[];
  combustivel: ItemEstoque[];
}

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

function detalheProduto(p: ProdutoCadastrado): string {
  if (p.package_size > 0) {
    return (
      `Emb. ${p.package_size} ${p.unit || ""}`.trim() +
      (p.preco_unitario > 0 ? ` · R$ ${brl(p.preco_unitario)}` : "")
    );
  }
  return p.preco_unitario > 0 ? `R$ ${brl(p.preco_unitario)}` : "";
}

function formatar(
  categoria: CategoriaEstoque,
  snapshot: SnapshotItem[],
  detalhes: Map<string, { detalhe: string; unidade: string }>,
  configs: Map<string, ConfigEstoque>
): ItemEstoque[] {
  const itens: ItemEstoque[] = snapshot.map((row) => {
    const extra = detalhes.get(row.item_key);
    const config = configs.get(row.item_key);
    const saldo = row.saldo;
    const minimo = config?.minimo ?? 0;

    return {
      itemKey: row.item_key,
      categoria,
      nome: row.nome,
      detalhe: extra?.detalhe ?? "",
      unidade: extra?.unidade ?? "",
      saldo,
      entradasTotal: row.entradas_total,
      saidaTotal: row.saida_total,
      minimo,
      temConfig: !!config,
      abaixoDoMinimo: !!config && saldo < minimo,
      valorUltimaEntrada: row.valor_ultima_entrada,
      dataUltimaEntrada: row.data_ultima_entrada,
    };
  });

  itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return itens;
}

/**
 * Junta o retrato calculado pelo banco com os metadados de exibição dos
 * cadastros. Nenhuma soma é feita aqui — saldo, entradas e saídas já vêm
 * consolidados de `public.stock_snapshot()`.
 */
export function montarEstoque(params: {
  produtos: ProdutoCadastrado[];
  pecas: ItemManutencao[];
  acessorios: ComponenteCatalogo[];
  tiposCombustivel?: readonly string[];
  snapshot: SnapshotDados;
  configs: ConfigEstoque[];
}): DadosEstoque {
  const configs = new Map(params.configs.map((c) => [c.item_key, c]));

  const detalhesProduto = new Map<string, { detalhe: string; unidade: string }>();
  for (const p of params.produtos) {
    detalhesProduto.set(buildItemKey("produto", p.id), {
      detalhe: detalheProduto(p),
      unidade: p.unit || "",
    });
  }

  const detalhesPeca = new Map<string, { detalhe: string; unidade: string }>();
  for (const p of params.pecas) {
    detalhesPeca.set(buildItemKey("peca", p.id), {
      detalhe: [p.categoria, p.custo > 0 ? `R$ ${brl(p.custo)}` : ""].filter(Boolean).join(" · "),
      unidade: p.unidade || "",
    });
  }

  const detalhesAcessorio = new Map<string, { detalhe: string; unidade: string }>();
  for (const a of params.acessorios) {
    detalhesAcessorio.set(buildItemKey("acessorio", a.id), {
      detalhe: [a.marca, a.modelo].filter(Boolean).join(" "),
      unidade: "un",
    });
  }

  // O snapshot só devolve os combustíveis que já tiveram abastecimento.
  // A lista oficial é mesclada para o operador ver os tipos cadastráveis.
  const combustivel: SnapshotItem[] = [];
  const vistos = new Set(params.snapshot.combustivel.map((i) => i.nome_norm));
  for (const tipo of params.tiposCombustivel ?? TIPOS_COMBUSTIVEL) {
    const chave = buildItemKey("combustivel", tipo);
    if (vistos.has(tipo.trim().toLowerCase()) || vistos.has(chave)) continue;
    combustivel.push({
      categoria: "combustivel",
      item_key: chave,
      nome: tipo,
      nome_norm: tipo.trim().toLowerCase(),
      entradas_total: 0,
      saida_total: 0,
      saldo: 0,
      valor_ultima_entrada: 0,
      data_ultima_entrada: null,
    });
  }
  combustivel.push(...params.snapshot.combustivel);

  return {
    produto: formatar("produto", params.snapshot.produto, detalhesProduto, configs),
    peca: formatar("peca", params.snapshot.peca, detalhesPeca, configs),
    acessorio: formatar("acessorio", params.snapshot.acessorio, detalhesAcessorio, configs),
    combustivel: formatar(
      "combustivel",
      combustivel,
      new Map(combustivel.map((i) => [i.item_key, { detalhe: "Litros", unidade: "L" }])),
      configs
    ),
  };
}

/** KPIs de uma categoria: total de itens, abaixo do mínimo e valor de entradas. */
export function calcularKpis(itens: ItemEstoque[]): {
  totalItens: number;
  abaixoMinimo: number;
  saldoTotal: number;
} {
  return {
    totalItens: itens.length,
    abaixoMinimo: itens.filter((i) => i.abaixoDoMinimo).length,
    saldoTotal: Math.round(itens.reduce((s, i) => s + i.saldo, 0) * 100) / 100,
  };
}