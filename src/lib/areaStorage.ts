import { get, set, keys, del } from "idb-keyval";

export interface AreaTalhao {
  id: string;
  numero: string;
  tamanhoHectares: number;
}

export interface AreaCadastro {
  id: string;
  nome: string;
  codigo?: string;
  coordenadas: string;
  quantidadeTalhoes: number;
  talhoes: AreaTalhao[];
  areaCarreador?: number;
  municipio: string;
  createdAt: string;
}

export async function saveArea(area: AreaCadastro): Promise<void> {
  await set(`area-${area.id}`, area);
}

export async function getArea(id: string): Promise<AreaCadastro | undefined> {
  return await get(`area-${id}`);
}

export async function getAllAreas(): Promise<AreaCadastro[]> {
  const allKeys = await keys();
  const areaKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith("area-")
  );
  const results: AreaCadastro[] = [];
  for (const k of areaKeys) {
    const val = await get<AreaCadastro>(k);
    if (val) results.push(val);
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteArea(id: string): Promise<void> {
  await del(`area-${id}`);
}
