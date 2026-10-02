import { supabase } from "@/integrations/supabase/client";
import type { Abastecimento } from "./equipmentFuelStorage";
import { TIPOS_COMBUSTIVEL } from "./equipmentFuelStorage";
import type { ItemManutencao, RegistroManutencao } from "./equipmentMaintenanceStorage";
import type { MaintenanceRecord } from "./droneStorage";
import type { ComponenteCatalogo } from "./componenteStorage";
import type { OrdemServico } from "./osStorage";

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
 * acc:<ComponenteCatalogo.id> · comb:<tipo de combustível>.
 */
export function buildItemKey(categoria: CategoriaEstoque, origemId: string): string {
  return `${PREFIXO_CATEGORIA[categoria]}:${origemId}`;
}

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();

// ============================================
// CRUD (Supabase)
// ============================================

export async function getAllEntradas(categoria?: CategoriaEstoque): Promise<EntradaEstoque[]> {
  let query = supabase.from("stock_entries").select("*");
  if (categoria) query = query.eq("categoria", categoria);
  const { data, error } = await query.order("data", { ascending: false });
  if (error) throw error;
  return (data || []) as EntradaEstoque[];
}

export async function createEntrada(rec: EntradaEstoqueInput): Promise<EntradaEstoque> {
  const { data, error } = await supabase.from("stock_entries").insert(rec).select().single();
  if (error) throw error;
  return data as EntradaEstoque;
}

export async function updateEntrada(
  id: string,
  updates: Partial<EntradaEstoqueInput>
): Promise<void> {
  const { error } = await supabase.from("stock_entries").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteEntrada(id: string): Promise<void> {
  const { error } = await supabase.from("stock_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function getAllConfigs(): Promise<ConfigEstoque[]> {
  const { data, error } = await supabase.from("stock_settings").select("*");
  if (error) throw error;
  return (data || []) as ConfigEstoque[];
}

/** Cria ou atualiza o estoque mínimo de um item. */
export async function upsertConfig(
  itemKey: string,
  categoria: CategoriaEstoque,
  minimo: number
): Promise<void> {
  const { error } = await supabase
    .from("stock_settings")
    .upsert({ item_key: itemKey, categoria, minimo, ativo: true }, { onConflict: "item_key" });
  if (error) throw error;
}

// ============================================
// SAÍDAS DERIVADAS DOS MÓDULOS VINCULADOS (puras)
// ============================================

/** Consumo real de produtos por nome (OS): Σ dose × área apontada, com substitutos. */
export function consumoProdutosOS(oss: OrdemServico[]): Map<string, number> {
  const consumo = new Map<string, number>();
  for (const os of oss) {
    for (const ap of os.apontamentos || []) {
      const talhao = os.talhoes[ap.talhaoIndex];
      if (!talhao) continue;
      const area = parseFloat(ap.areaAplicada) || 0;
      if (area <= 0) continue;
      const produtos =
        ap.produtosSubstitutos && ap.produtosSubstitutos.length > 0
          ? ap.produtosSubstitutos
          : talhao.produtos;
      for (const p of produtos) {
        if (!p.produto) continue;
        const dose = parseFloat(p.dose) || 0;
        const total = dose * area;
        if (total <= 0) continue;
        const key = norm(p.produto);
        consumo.set(key, (consumo.get(key) || 0) + total);
      }
    }
  }
  for (const [k, v] of consumo) consumo.set(k, Math.round(v * 100) / 100);
  return consumo;
}

/** Saída de peças por cadastro (itemId): Σ quantidade dos itens lançados nas manutenções. */
export function consumoPecasManutencao(
  registros: RegistroManutencao[]
): Map<string, number> {
  const consumo = new Map<string, number>();
  for (const reg of registros) {
    for (const item of reg.itens || []) {
      if (item.tipo !== "peca" || !item.itemId) continue;
      const total = item.quantidade || 0;
      if (total <= 0) continue;
      consumo.set(item.itemId, (consumo.get(item.itemId) || 0) + total);
    }
  }
  for (const [k, v] of consumo) consumo.set(k, Math.round(v * 100) / 100);
  return consumo;
}

/** Saída de acessórios por nome (manutenção de drones): 1 unidade por componente trocado. */
export function consumoAcessoriosDrones(registros: MaintenanceRecord[]): Map<string, number> {
  const consumo = new Map<string, number>();
  for (const reg of registros) {
    for (const comp of reg.componentes_trocados || []) {
      const key = norm(comp.nome);
      if (!key) continue;
      consumo.set(key, (consumo.get(key) || 0) + 1);
    }
  }
  return consumo;
}

/** Saída de combustível por tipo (abastecimentos): Σ litros. */
export function consumoCombustivelAbastecimentos(
  abastecimentos: Abastecimento[]
): Map<string, number> {
  const consumo = new Map<string, number>();
  for (const a of abastecimentos) {
    const key = norm(a.tipo_combustivel);
    if (!key) continue;
    consumo.set(key, (consumo.get(key) || 0) + (a.litros || 0));
  }
  for (const [k, v] of consumo) consumo.set(k, Math.round(v * 100) / 100);
  return consumo;
}

// ============================================
// MONTAGEM DO ESTOQUE (pura)
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

function montarCategoria(params: {
  categoria: CategoriaEstoque;
  itens: Array<{ origemId: string; nome: string; detalhe: string; unidade: string }>;
  consumo: Map<string, number>;
  entradasPorKey: Map<string, EntradaEstoque[]>;
  configs: Map<string, ConfigEstoque>;
  /** true = a saída casa por nome normalizado; false = casa por item_key direto. */
  saidaPorNome: boolean;
}): ItemEstoque[] {
  const itens: ItemEstoque[] = [];

  for (const src of params.itens) {
    const itemKey = buildItemKey(params.categoria, src.origemId);
    const entradas = params.entradasPorKey.get(itemKey) || [];
    const entradasTotal = Math.round(entradas.reduce((s, e) => s + (e.quantidade || 0), 0) * 100) / 100;
    const ultima = entradas.length
      ? entradas.reduce((a, b) => (a.data >= b.data ? a : b))
      : null;

    const saidaTotal = params.saidaPorNome
      ? params.consumo.get(norm(src.nome)) || 0
      : params.consumo.get(src.origemId) || 0;

    const config = params.configs.get(itemKey);
    const saldo = Math.round((entradasTotal - saidaTotal) * 100) / 100;
    const minimo = config?.minimo ?? 0;
    const temConfig = !!config;

    itens.push({
      itemKey,
      categoria: params.categoria,
      nome: src.nome,
      detalhe: src.detalhe,
      unidade: src.unidade,
      saldo,
      entradasTotal,
      saidaTotal: Math.round(saidaTotal * 100) / 100,
      minimo,
      temConfig,
      abaixoDoMinimo: temConfig && saldo < minimo,
      valorUltimaEntrada: ultima?.valor_total || 0,
      dataUltimaEntrada: ultima?.data || null,
    });
  }

  itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return itens;
}

export function montarEstoque(params: {
  produtos: ProdutoCadastrado[];
  pecas: ItemManutencao[];
  acessorios: ComponenteCatalogo[];
  tiposCombustivel?: readonly string[];
  entradas: EntradaEstoque[];
  configs: ConfigEstoque[];
  oss: OrdemServico[];
  registrosManutencao: RegistroManutencao[];
  registrosDrone: MaintenanceRecord[];
  abastecimentos: Abastecimento[];
}): DadosEstoque {
  const entradasPorKey = new Map<string, EntradaEstoque[]>();
  for (const e of params.entradas) {
    const lista = entradasPorKey.get(e.item_key) || [];
    lista.push(e);
    entradasPorKey.set(e.item_key, lista);
  }

  const configs = new Map(params.configs.map((c) => [c.item_key, c]));

  // Tipos de combustível: lista oficial + tipos distintos já lançados nos abastecimentos.
  const tipos = new Set<string>(params.tiposCombustivel ?? TIPOS_COMBUSTIVEL);
  for (const a of params.abastecimentos) {
    if (a.tipo_combustivel && a.tipo_combustivel.trim()) tipos.add(a.tipo_combustivel.trim());
  }

  const consumoProduto = consumoProdutosOS(params.oss);
  const consumoPeca = consumoPecasManutencao(params.registrosManutencao);
  const consumoAcessorio = consumoAcessoriosDrones(params.registrosDrone);
  const consumoCombustivel = consumoCombustivelAbastecimentos(params.abastecimentos);

  return {
    produto: montarCategoria({
      categoria: "produto",
      itens: params.produtos.map((p) => ({
        origemId: p.id,
        nome: p.commercial_name,
        detalhe:
          p.package_size > 0
            ? `Emb. ${p.package_size} ${p.unit || ""}`.trim() +
              (p.preco_unitario > 0
                ? ` · R$ ${p.preco_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : "")
            : p.preco_unitario > 0
              ? `R$ ${p.preco_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : "",
        unidade: p.unit || "",
      })),
      consumo: consumoProduto,
      entradasPorKey,
      configs,
      saidaPorNome: true,
    }),
    peca: montarCategoria({
      categoria: "peca",
      itens: params.pecas.map((p) => ({
        origemId: p.id,
        nome: p.nome,
        detalhe: [p.categoria, p.custo > 0 ? `R$ ${p.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""]
          .filter(Boolean)
          .join(" · "),
        unidade: p.unidade || "",
      })),
      consumo: consumoPeca,
      entradasPorKey,
      configs,
      saidaPorNome: false,
    }),
    acessorio: montarCategoria({
      categoria: "acessorio",
      itens: params.acessorios.map((a) => ({
        origemId: a.id,
        nome: a.nome,
        detalhe: [a.marca, a.modelo].filter(Boolean).join(" "),
        unidade: "un",
      })),
      consumo: consumoAcessorio,
      entradasPorKey,
      configs,
      saidaPorNome: true,
    }),
    combustivel: montarCategoria({
      categoria: "combustivel",
      itens: [...tipos].map((t) => ({
        origemId: t,
        nome: t,
        detalhe: "Litros",
        unidade: "L",
      })),
      consumo: consumoCombustivel,
      entradasPorKey,
      configs,
      saidaPorNome: true,
    }),
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
