import { get, set, keys, values } from "idb-keyval";

export interface ProdutoDose {
  produto: string;
  dose: string;
  unit?: string;        // "L" ou "KG"
  packageSize?: number;  // tamanho da embalagem
}

export interface TalhaoData {
  nome: string;
  area: string;
  produtos: ProdutoDose[];
  testemunho: boolean;
  testemunhoArea: string;
  testeProduto: boolean;
  produtoTeste: string;
  produtoTesteQtd: string;
}

export interface ApontamentoTalhao {
  talhaoIndex: number;
  areaAplicada: string;
  caldaRestante: string;
  bombasCheias?: string;
  aplicador?: string;
  tratorFrota?: string;
  dataApontamento: string;
  observacoes: string;
}

export interface OrdemServico {
  id: string;
  data: string;
  propriedade: string;
  codigoArea: string;
  responsavelTecnico: string;
  aplicador: string;
  talhoes: TalhaoData[];
  createdAt: string;
  volumeCaldaHa?: string;
  coordenadas?: string;
  apontamentos?: ApontamentoTalhao[];
  status?: "aberta" | "em_andamento" | "concluida";
}

function getTodayPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export async function generateOSId(): Promise<string> {
  const prefix = getTodayPrefix();
  const counterKey = `os-counter-${prefix}`;
  const current = (await get<number>(counterKey)) || 0;
  const next = current + 1;
  await set(counterKey, next);
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

export async function saveOS(os: OrdemServico): Promise<void> {
  await set(`os-${os.id}`, os);
}

export async function getAllOS(): Promise<OrdemServico[]> {
  const allKeys = await keys();
  const osKeys = allKeys.filter(
    (k) => typeof k === "string" && k.startsWith("os-") && !k.startsWith("os-counter-")
  );
  const results: OrdemServico[] = [];
  for (const k of osKeys) {
    const val = await get<OrdemServico>(k);
    if (val) results.push(val);
  }
  return results.sort((a, b) => b.id.localeCompare(a.id));
}
