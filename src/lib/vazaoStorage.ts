import { get, set, keys, del } from "idb-keyval";

export interface AfericaoVazaoRecord {
  id: string;
  dataHora: string;
  modeloTrator: string;
  frota: string;
  tipoImplemento: string;
  numeroBicos: number;
  localColeta: string;
  operador: string;
  turno: string;
  taxaDesejada: number;
  velocidade: number;
  espacamento: number;
  vazaoTeorica: number;
  mediaReal: number;
  desvioPercent: number;
  statusGeral: "calibrado" | "ajustar" | "trocar";
  coletas: {
    nozzleNumber: number;
    value: number;
  }[];
}

const STORAGE_PREFIX = "afericao-vazao-";

export async function saveAfericao(record: AfericaoVazaoRecord): Promise<void> {
  await set(`${STORAGE_PREFIX}${record.id}`, record);
}

export async function getAllAfericoes(): Promise<AfericaoVazaoRecord[]> {
  const allKeys = await keys();
  const filteredKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith(STORAGE_PREFIX)
  );
  const results: AfericaoVazaoRecord[] = [];
  for (const k of filteredKeys) {
    const val = await get<AfericaoVazaoRecord>(k);
    if (val) results.push(val);
  }
  return results.sort((a, b) => b.dataHora.localeCompare(a.dataHora));
}

export async function deleteAfericao(id: string): Promise<void> {
  await del(`${STORAGE_PREFIX}${id}`);
}
