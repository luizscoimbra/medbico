import { get, set, keys, del } from "idb-keyval";

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

const STORAGE_PREFIX = "titulo-receber-";
const COUNTER_KEY = "titulo-receber-counter";

async function nextNumero(): Promise<string> {
  const current = (await get<number>(COUNTER_KEY)) || 0;
  const next = current + 1;
  await set(COUNTER_KEY, next);
  return String(next).padStart(4, "0");
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
  const titulo: TituloReceber = {
    id: `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    numero: await nextNumero(),
    dataEmissao: new Date().toISOString().slice(0, 10),
    dataVencimento: input.dataVencimento || undefined,
    clienteId: input.clienteId,
    clienteNome: input.clienteNome,
    descricao: input.descricao,
    osId: input.osId,
    valor: input.valor,
    status: "aberto",
    observacao: input.observacao || undefined,
    criadoEm: new Date().toISOString(),
  };
  await set(`${STORAGE_PREFIX}${titulo.id}`, titulo);
  return titulo;
}

export async function getAllTitulos(): Promise<TituloReceber[]> {
  const allKeys = await keys();
  const titulosKeys = allKeys.filter(
    (k) =>
      typeof k === "string" &&
      k !== COUNTER_KEY &&
      k.startsWith(STORAGE_PREFIX)
  );
  const results: TituloReceber[] = [];
  for (const k of titulosKeys) {
    const val = await get<TituloReceber>(k);
    if (val && typeof val === "object" && "criadoEm" in val) results.push(val);
  }
  return results.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
}

export async function getTituloByOS(osId: string): Promise<TituloReceber | undefined> {
  const all = await getAllTitulos();
  return all.find((t) => t.osId === osId && t.status !== "cancelado");
}

export async function updateTitulo(id: string, patch: Partial<TituloReceber>): Promise<void> {
  const key = `${STORAGE_PREFIX}${id}`;
  const existing = await get<TituloReceber>(key);
  if (!existing) return;
  await set(key, { ...existing, ...patch });
}

export async function deleteTitulo(id: string): Promise<void> {
  await del(`${STORAGE_PREFIX}${id}`);
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
