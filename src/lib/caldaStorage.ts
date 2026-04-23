import { get, set, keys, del } from "idb-keyval";

export interface ProdutoCalda {
  id: string;
  nome: string;
  formulacao: string;
  dose: number;
  unidade: "L/ha" | "kg/ha";
}

export interface CalculoCaldaRecord {
  id: string;
  data: string;
  talhao: string;
  areaTalhao: number;
  vazaoTrabalho: number;
  capacidadeTanque: number;
  produtos: ProdutoCalda[];
  volumeTotalCalda: number;
  tanquesCheios: number;
  volumeRestante: number;
  tanquesNecessarios: number;
  // Campos adicionais úteis
  frota?: string;
  trator?: string;
}

const STORAGE_PREFIX = "calculo-calda-";

export async function saveCalculoCalda(record: CalculoCaldaRecord): Promise<void> {
  await set(`${STORAGE_PREFIX}${record.id}`, record);
}

export async function getAllCalculosCalda(): Promise<CalculoCaldaRecord[]> {
  const allKeys = await keys();
  const filteredKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith(STORAGE_PREFIX)
  );
  const results: CalculoCaldaRecord[] = [];
  for (const k of filteredKeys) {
    const val = await get<CalculoCaldaRecord>(k);
    if (val) results.push(val);
  }
  return results.sort((a, b) => b.data.localeCompare(a.data));
}

export async function deleteCalculoCalda(id: string): Promise<void> {
  await del(`${STORAGE_PREFIX}${id}`);
}
