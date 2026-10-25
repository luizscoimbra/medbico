import { supabase } from "@/integrations/supabase/client";
import { buildItemKey, createEntrada } from "@/lib/stockStorage";
import type { NfeDocumento, NfeItem } from "@/lib/nfeXmlParser";

export interface ProdutoCatalogo {
  id: string;
  commercial_name: string;
  formulation: string;
  unit: string;
  package_size: number;
  preco_unitario: number | null;
  preco_custo: number | null;
  codigo_barras: string | null;
}

export type OrigemMatch =
  | "codigo_barras"
  | "nome_exato"
  | "nome_semelhante"
  | "manual"
  | null;

export type StatusLinha = "pendente" | "vincular" | "novo" | "ignorar";

export interface NovoProduto {
  nome: string;
  unidade: string;
  package_size: string;
  preco_custo: string;
}

export interface LinhaImportacao {
  id: string;
  item: NfeItem;
  produto: ProdutoCatalogo | null;
  origem: OrigemMatch;
  semelhanca: number;
  candidatos: ProdutoCatalogo[];
  custoAtual: number;
  custoNota: number;
  variacao: number | null;
  quantidadeEstoque: number;
  valorLiquido: number;
  status: StatusLinha;
  aplicarCorrecao: boolean;
  novo: NovoProduto;
  aviso: string;
}

export interface ResultadoImportacao {
  vinculados: number;
  criados: number;
  entradas: number;
  correcoes: number;
  ignorados: number;
  erros: string[];
}

// ---------------------------------------------------------------------------
// Normalização / similaridade
// ---------------------------------------------------------------------------

export function normalizarNome(bruto: string): string {
  return (bruto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(bruto: string): Set<string> {
  return new Set(normalizarNome(bruto).split(" ").filter(Boolean));
}

/** Similaridade 0..1 combinando Jaccard e contenção (para nomes de tamanhos diferentes). */
export function similaridade(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;

  let intersecao = 0;
  ta.forEach((t) => {
    if (tb.has(t)) intersecao += 1;
  });
  if (!intersecao) return 0;

  const uniao = ta.size + tb.size - intersecao;
  const menor = Math.min(ta.size, tb.size);
  const jaccard = intersecao / uniao;
  const contencao = intersecao / menor;
  return 0.5 * jaccard + 0.5 * contencao;
}

function normalizarUnidade(bruto: string): string {
  const u = (bruto || "").toUpperCase().trim();
  if (["L", "LT", "LITRO", "LITROS"].includes(u)) return "L";
  if (["KG", "KGS", "QUILO", "QUILOS", "KILO", "KILOS"].includes(u)) return "KG";
  if (["UN", "UNID", "UNIDADE", "UNIDADES", "PC", "PCT", "CX", "FD"].includes(u)) return "UN";
  return u;
}

function mesmaUnidade(a: string, b: string): boolean {
  const na = normalizarUnidade(a);
  const nb = normalizarUnidade(b);
  if (na && nb) return na === nb;
  return (a || "").toUpperCase().trim() === (b || "").toUpperCase().trim();
}

/** Quantidade da nota convertida para a unidade de medida do produto cadastrado. */
export function quantidadeEmUnidade(item: NfeItem, produto: ProdutoCatalogo): number {
  if (mesmaUnidade(item.unidade, produto.unit)) return item.quantidade;
  if (produto.package_size > 0) return item.quantidade * produto.package_size;
  return item.quantidade;
}

/** Custo unitário da nota já convertido para a unidade de medida do produto. */
export function custoDaNota(item: NfeItem, produto: ProdutoCatalogo | null): number {
  const liquido = item.valorTotal - item.desconto;
  const unitario = item.quantidade > 0 ? liquido / item.quantidade : item.valorUnitario;
  if (!produto) return unitario;
  if (mesmaUnidade(item.unidade, produto.unit)) return unitario;
  if (produto.package_size > 0) return unitario / produto.package_size;
  return unitario;
}

/** Preço de custo vigente; cai para o preço de venda quando o custo ainda não foi informado. */
export function custoCadastrado(produto: ProdutoCatalogo): number {
  if (produto.preco_custo && produto.preco_custo > 0) return produto.preco_custo;
  if (produto.preco_unitario && produto.preco_unitario > 0) return produto.preco_unitario;
  return 0;
}

export function percentualVariacao(atual: number, novo: number): number | null {
  if (!atual || atual <= 0 || !novo || novo <= 0) return null;
  return ((novo - atual) / atual) * 100;
}

// ---------------------------------------------------------------------------
// Catálogo + montagem das linhas
// ---------------------------------------------------------------------------

export async function carregarCatalogo(): Promise<ProdutoCatalogo[]> {
  const { data, error } = await supabase
    .from("registered_products")
    .select(
      "id, commercial_name, formulation, unit, package_size, preco_unitario, preco_custo, codigo_barras",
    )
    .order("commercial_name");

  if (error) throw new Error(error.message || "Erro ao carregar os produtos cadastrados.");
  return (data ?? []) as unknown as ProdutoCatalogo[];
}

function unidadeSugerida(item: NfeItem): string {
  const u = normalizarUnidade(item.unidade);
  if (u === "L" || u === "KG" || u === "UN") return u;
  if (u === "ML" || u === "G") return u === "ML" ? "L" : "KG";
  return "UN";
}

function embalagemSugerida(item: NfeItem, unidade: string): string {
  const u = normalizarUnidade(item.unidade);
  if (u === "ML" && unidade === "L") return "1";
  if (u === "G" && unidade === "KG") return "1";
  if (u === unidade) return "1";
  return item.quantidade > 0 ? String(item.quantidade) : "1";
}

export function montarLinhas(doc: NfeDocumento, catalogo: ProdutoCatalogo[]): LinhaImportacao[] {
  return doc.itens.map((item, indice) => {
    const porBarras = item.ean
      ? catalogo.find((p) => (p.codigo_barras || "").replace(/\D/g, "") === item.ean)
      : undefined;

    let produto: ProdutoCatalogo | null = porBarras ?? null;
    let origem: OrigemMatch = porBarras ? "codigo_barras" : null;
    let semelhanca = porBarras ? 1 : 0;

    const pontuados = catalogo
      .map((p) => ({ p, s: similaridade(item.descricao, p.commercial_name) }))
      .sort((a, b) => b.s - a.s);

    if (!produto && pontuados[0] && pontuados[0].s >= 0.999) {
      produto = pontuados[0].p;
      origem = "nome_exato";
      semelhanca = 1;
    } else if (!produto && pontuados[0] && pontuados[0].s >= 0.6) {
      produto = pontuados[0].p;
      origem = "nome_semelhante";
      semelhanca = pontuados[0].s;
    }

    const candidatos = pontuados
      .filter((c) => c.s >= 0.35 && (!produto || c.p.id !== produto.id))
      .slice(0, 5)
      .map((c) => c.p);

    const custoAtual = produto ? custoCadastrado(produto) : 0;
    const custoNota = custoDaNota(item, produto);

    const unidade = unidadeSugerida(item);
    const embalagem = embalagemSugerida(item, unidade);

    return {
      id: `${doc.chave || doc.arquivoNome}:${item.numero}:${indice}`,
      item,
      produto,
      origem,
      semelhanca,
      candidatos,
      custoAtual,
      custoNota,
      variacao: produto ? percentualVariacao(custoAtual, custoNota) : null,
      quantidadeEstoque: produto ? quantidadeEmUnidade(item, produto) : item.quantidade,
      valorLiquido: item.valorTotal - item.desconto,
      status: produto ? "pendente" : "pendente",
      aplicarCorrecao: false,
      novo: {
        nome: item.descricao,
        unidade,
        package_size: embalagem,
        preco_custo: custoNota > 0 ? custoNota.toFixed(4) : "",
      },
      aviso: "",
    };
  });
}

/** Recalcula os campos derivados quando o usuário troca o produto vinculado. */export function reverLinha(linha: LinhaImportacao, produto: ProdutoCatalogo | null): LinhaImportacao {
  const custoAtual = produto ? custoCadastrado(produto) : 0;
  const custoNota = custoDaNota(linha.item, produto);
  const variacao = produto ? percentualVariacao(custoAtual, custoNota) : null;
  return {
    ...linha,
    produto,
    custoAtual,
    custoNota,
    variacao,
    quantidadeEstoque: produto ? quantidadeEmUnidade(linha.item, produto) : linha.item.quantidade,
    origem: produto ? "manual" : null,
    semelhanca: produto ? 1 : 0,
    aplicarCorrecao: linha.aplicarCorrecao && variacao !== null && Math.abs(variacao) >= 0.01,
    status: produto ? (linha.status === "ignorar" ? "pendente" : linha.status) : "pendente",
  };
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

/**
 * Marca como ignoradas as linhas cujo produto já recebeu entrada desta mesma NF-e.
 * Evita duplicar o estoque quando o mesmo XML é importado duas vezes.
 */
export async function marcarJaImportados(
  doc: NfeDocumento,
  linhas: LinhaImportacao[],
): Promise<LinhaImportacao[]> {
  if (!doc.chave) return linhas;

  const { data } = await supabase
    .from("stock_entries")
    .select("item_key")
    .eq("categoria", "produto")
    .like("observacao", `%${doc.chave}%`);

  if (!data?.length) return linhas;

  const chaves = new Set(data.map((r) => r.item_key));
  return linhas.map((linha) => {
    if (!linha.produto || linha.status === "ignorar") return linha;
    if (!chaves.has(buildItemKey("produto", linha.produto.id))) return linha;
    return {
      ...linha,
      status: "ignorar" as StatusLinha,
      aviso: "Este item já recebeu entrada desta mesma NF-e.",
    };
  });
}

function rotuloUnidade(u: string): string {
  return normalizarUnidade(u) || (u || "UN");
}

export async function executarImportacao(
  doc: NfeDocumento,
  linhas: LinhaImportacao[],
): Promise<ResultadoImportacao> {
  const resultado: ResultadoImportacao = {
    vinculados: 0,
    criados: 0,
    entradas: 0,
    correcoes: 0,
    ignorados: 0,
    erros: [],
  };

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error("Sessão expirada. Entre novamente para importar a nota.");

  const marcador = doc.chave || `${doc.numero}/${doc.serie}`;
  const jaImportados = new Set<string>();
  if (doc.chave) {
    const { data: anteriores } = await supabase
      .from("stock_entries")
      .select("item_key")
      .eq("categoria", "produto")
      .like("observacao", `%${doc.chave}%`);
    (anteriores ?? []).forEach((r) => jaImportados.add(r.item_key));
  }

  const fornecedor = doc.emitente.nome || doc.emitente.fantasia || "";
  const observacaoBase = `NF-e ${doc.numero}${doc.serie ? "/" + doc.serie : ""} — ${marcador}`;

  for (const linha of linhas) {
    if (linha.status === "ignorar" || linha.status === "pendente") {
      resultado.ignorados += 1;
      continue;
    }

    try {
      let produto = linha.produto;

      if (linha.status === "novo") {
        const nome = linha.novo.nome.trim();
        if (!nome) throw new Error("Informe o nome do produto.");
        const tamanho = Number.parseFloat(linha.novo.package_size.replace(",", ".")) || 1;
        const custo = Number.parseFloat(linha.novo.preco_custo.replace(",", ".")) || 0;
        const unidade = rotuloUnidade(linha.novo.unidade);

        const { data: inserido, error } = await supabase
          .from("registered_products")
          .insert({
            user_id: userId,
            commercial_name: nome,
            formulation: "SL",
            unit: unidade,
            package_size: tamanho > 0 ? tamanho : 1,
            preco_custo: custo,
            preco_unitario: custo,
            codigo_barras: linha.item.ean || "",
            nr_registro_mapa: "",
            agrofit_formulacao: "",
            ingredientes_ativos: "",
          })
          .select("id, commercial_name, formulation, unit, package_size, preco_unitario, preco_custo, codigo_barras")
          .single();

        if (error) throw new Error(error.message || "Falha ao cadastrar o produto.");
        produto = inserido as unknown as ProdutoCatalogo;
        resultado.criados += 1;
      }

      if (!produto) throw new Error("Produto não identificado.");

      const itemKey = buildItemKey("produto", produto.id);

      if (jaImportados.has(itemKey)) {
        resultado.ignorados += 1;
        continue;
      }

      if (linha.status === "vincular" && linha.aplicarCorrecao && linha.custoNota > 0) {
        const { error } = await supabase
          .from("registered_products")
          .update({ preco_custo: linha.custoNota })
          .eq("id", produto.id);
        if (error) throw new Error(`Correção de preço: ${error.message}`);
        resultado.correcoes += 1;
      }

      await createEntrada({
        categoria: "produto",
        item_key: itemKey,
        item_nome: produto.commercial_name,
        quantidade: linha.quantidadeEstoque > 0 ? linha.quantidadeEstoque : linha.item.quantidade,
        valor_total: linha.valorLiquido,
        data: doc.dataEmissao,
        fornecedor,
        observacao: observacaoBase,
      });

      resultado.entradas += 1;
      if (linha.status === "vincular") resultado.vinculados += 1;
    } catch (e) {
      resultado.erros.push(
        `${linha.item.descricao || `Item ${linha.item.numero}`}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return resultado;
}
