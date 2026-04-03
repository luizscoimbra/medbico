import { get, set, keys, del } from "idb-keyval";

export interface TipoAplicacao {
  id: string;
  nome: string;
  codigo: string;
  createdAt: string;
}

export async function saveTipoAplicacao(tipo: TipoAplicacao): Promise<void> {
  await set(`tipo-aplicacao-${tipo.id}`, tipo);
}

export async function getAllTiposAplicacao(): Promise<TipoAplicacao[]> {
  const allKeys = await keys();
  const tipoKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith("tipo-aplicacao-")
  );
  const results: TipoAplicacao[] = [];
  for (const k of tipoKeys) {
    const val = await get<TipoAplicacao>(k);
    if (val) results.push(val);
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteTipoAplicacao(id: string): Promise<void> {
  await del(`tipo-aplicacao-${id}`);
}
