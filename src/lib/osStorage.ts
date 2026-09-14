import { get, set, keys, del } from "idb-keyval";

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

export type MotivoParada = "quebra_equipamento" | "condicoes_climaticas" | "fim_turno" | "outro";

export const MOTIVO_PARADA_LABELS: Record<MotivoParada, string> = {
  quebra_equipamento: "Quebra de Equipamento",
  condicoes_climaticas: "Condições Climáticas Impróprias",
  fim_turno: "Fim de Turno",
  outro: "Outro Motivo",
};

export interface ApontamentoTalhao {
  talhaoIndex: number;
  areaAplicada: string;
  caldaRestante: string;
  sobraUtilizada?: string; // Calda utilizada de um talhão anterior
  bombasCheias?: string;
  cargaParcial?: string;  // Volume parcial em litros (carga que não completa 1 bomba)
  aplicador?: string;
  tratorFrota?: string;
  dataApontamento: string;
  horaRegistro?: string;  // Hora do registro (HH:MM)
  observacoes: string;
  // Campos de parada/interrupção
  statusRegistro?: "em_andamento" | "interrompido" | "concluido" | "reparado";
  motivoParada?: MotivoParada;
  motivoParadaDetalhe?: string; // Detalhamento livre do motivo
  caldaTransferida?: string;   // Volume transferido para outro equipamento (quebra)
  equipamentoOrigem?: string;  // Frota do equipamento de origem (continuação)
  equipamentoDestino?: string; // Frota do equipamento que recebeu a calda (quebra)
  registroAnteriorIdx?: number; // Índice do registro anterior (encadeamento)
  produtosSubstitutos?: ProdutoDose[]; // Insumos alternativos usados apenas neste apontamento
}

export interface OrdemServico {
  id: string;
  osExterna?: string;
  data: string;
  propriedade: string;
  codigoArea: string;
  responsavelTecnico: string;
  aplicador: string;
  talhoes: TalhaoData[];
  createdAt: string;
  volumeCaldaHa?: string;
  coordenadas?: string;
  tipoAplicacao?: string;
  codigoAplicacao?: string;
  apontamentos?: ApontamentoTalhao[];
  status?: "aberta" | "em_andamento" | "concluida";
  equipamentos?: string[];
  // Cliente vinculado
  clienteId?: string;
  clienteNome?: string;
  // Valores financeiros
  valorHerbicidas?: number;
  valorServico?: number;
  valorTotal?: number;
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

export async function deleteOS(id: string): Promise<void> {
  await del(`os-${id}`);
}
