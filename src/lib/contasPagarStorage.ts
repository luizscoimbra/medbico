import { get, set, keys, del } from "idb-keyval";
import type { StatusTitulo } from "./financeiroStorage";

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
  criadoEm: string;        // ISO
}

const STORAGE_PREFIX = "titulo-pagar-";
const COUNTER_KEY = "titulo-pagar-counter";

async function nextNumero(): Promise<string> {
  const current = (await get<number>(COUNTER_KEY)) || 0;
  const next = current + 1;
  await set(COUNTER_KEY, next);
  return String(next).padStart(4, "0");
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
}): Promise<TituloPagar> {
  const titulo: TituloPagar = {
    id: `tp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    numero: await nextNumero(),
    dataEmissao: input.dataEmissao || new Date().toISOString().slice(0, 10),
    dataVencimento: input.dataVencimento || undefined,
    fornecedorId: input.fornecedorId,
    fornecedorNome: input.fornecedorNome,
    categoria: input.categoria,
    descricao: input.descricao,
    manutencaoId: input.manutencaoId,
    droneId: input.droneId,
    equipmentId: input.equipmentId,
    valor: input.valor,
    status: "aberto",
    observacao: input.observacao || undefined,
    criadoEm: new Date().toISOString(),
  };
  await set(`${STORAGE_PREFIX}${titulo.id}`, titulo);
  return titulo;
}

export async function getAllTitulosPagar(): Promise<TituloPagar[]> {
  const allKeys = await keys();
  const titulosKeys = allKeys.filter(
    (k) =>
      typeof k === "string" &&
      k !== COUNTER_KEY &&
      k.startsWith(STORAGE_PREFIX)
  );
  const results: TituloPagar[] = [];
  for (const k of titulosKeys) {
    const val = await get<TituloPagar>(k);
    if (val && typeof val === "object" && "criadoEm" in val) results.push(val);
  }
  return results.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
}

/** Manutenções que já geraram título (evita duplicidade na geração em lote). */
export async function manutencoesComTitulo(): Promise<Set<string>> {
  const all = await getAllTitulosPagar();
  return new Set(all.map((t) => t.manutencaoId).filter((v): v is string => !!v));
}

export async function updateTituloPagar(id: string, patch: Partial<TituloPagar>): Promise<void> {
  const key = `${STORAGE_PREFIX}${id}`;
  const existing = await get<TituloPagar>(key);
  if (!existing) return;
  await set(key, { ...existing, ...patch });
}

export async function deleteTituloPagar(id: string): Promise<void> {
  await del(`${STORAGE_PREFIX}${id}`);
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
