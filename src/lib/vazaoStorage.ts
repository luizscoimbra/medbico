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
  // ── Aferição por Drone (opcional — registros sem `modo` são terrestres) ──
  modo?: "terrestre" | "drone";
  material?: "liquido" | "solido";
  metodo?: "volumetrico" | "sensor" | "bancada" | "app";
  faixaUtil?: number;          // W — largura de trabalho / espalhamento (m)
  tempoColeta?: number;        // s (30 ou 60)
  massaColetada?: number;      // kg — ensaio de bancada (sólidos)
  vazaoMaxSistema?: number;    // kg/min a 100% de comporta (app do drone)
  comportaAtual?: number;      // % de abertura atual
  comportaIdeal?: number;      // % de abertura ideal calculada
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
