import { supabase } from "@/integrations/supabase/client";
import { asArray, asJsonArray, num, orNull, requireScope, storageError } from "@/lib/db";

export interface ProdutoDose {
  produto: string;
  dose: string;
  unit?: string;        // "L" ou "KG"
  packageSize?: number;  // tamanho da embalagem
  preco_unitario?: number;
}

export interface ServicoOS {
  servicoId: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
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

/**
 * Condições climáticas capturadas no encerramento da OS (Open-Meteo).
 * Dado agronômico: vento e umidade definem se a aplicação era segura.
 */
export interface ClimaRegistro {
  temperaturaC?: number;
  umidadeRelativa?: number;
  precipitacaoMm?: number;
  ventoKmh?: number;
  ventoDirecaoGraus?: number;
  latitude?: number;
  longitude?: number;
  fonte?: string;
  capturadoEm?: string;
}

export type AssinaturaMetodo = "biometrica" | "toque";

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
  // Serviços vinculados
  servicos?: ServicoOS[];
  // Valores financeiros
  valorHerbicidas?: number;
  valorServico?: number;
  valorTotal?: number;
  // Assinatura do encerramento (WebAuthn/biométrica ou toque)
  assinaturaBase64?: string;
  assinadoEm?: string;
  assinadoPorNome?: string;
  assinaturaMetodo?: AssinaturaMetodo;
  // Condições de aplicação no momento do encerramento
  clima?: ClimaRegistro;
}

interface OsRow {
  id: string;
  os_externa: string | null;
  data: string;
  propriedade: string;
  codigo_area: string | null;
  responsavel_tecnico: string | null;
  aplicador: string | null;
  talhoes: unknown;
  created_at: string;
  volume_calda_ha: string | null;
  coordenadas: string | null;
  tipo_aplicacao: string | null;
  codigo_aplicacao: string | null;
  apontamentos: unknown;
  status: string | null;
  equipamentos: unknown;
  cliente_id: string | null;
  cliente_nome: string | null;
  servicos: unknown;
  valor_herbicidas: number | string | null;
  valor_servico: number | string | null;
  valor_total: number | string | null;
  assinatura_base64: string | null;
  assinado_em: string | null;
  assinado_por_nome: string | null;
  assinatura_metodo: string | null;
  clima: unknown | null;
}

function getTodayPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function fromRow(row: OsRow): OrdemServico {
  return {
    id: row.id,
    osExterna: row.os_externa ?? undefined,
    data: row.data,
    propriedade: row.propriedade,
    codigoArea: row.codigo_area ?? "",
    responsavelTecnico: row.responsavel_tecnico ?? "",
    aplicador: row.aplicador ?? "",
    talhoes: asArray<TalhaoData>(row.talhoes),
    createdAt: row.created_at,
    volumeCaldaHa: row.volume_calda_ha ?? undefined,
    coordenadas: row.coordenadas ?? undefined,
    tipoAplicacao: row.tipo_aplicacao ?? undefined,
    codigoAplicacao: row.codigo_aplicacao ?? undefined,
    apontamentos: asArray<ApontamentoTalhao>(row.apontamentos),
    status: (row.status as OrdemServico["status"]) ?? undefined,
    equipamentos: asArray<string>(row.equipamentos),
    clienteId: row.cliente_id ?? undefined,
    clienteNome: row.cliente_nome ?? undefined,
    servicos: asArray<ServicoOS>(row.servicos),
    valorHerbicidas: row.valor_herbicidas == null ? undefined : num(row.valor_herbicidas),
    valorServico: row.valor_servico == null ? undefined : num(row.valor_servico),
    valorTotal: row.valor_total == null ? undefined : num(row.valor_total),
    assinaturaBase64: row.assinatura_base64 ?? undefined,
    assinadoEm: row.assinado_em ?? undefined,
    assinadoPorNome: row.assinado_por_nome ?? undefined,
    assinaturaMetodo: (row.assinatura_metodo as AssinaturaMetodo) ?? undefined,
    clima: (row.clima as ClimaRegistro | null) ?? undefined,
  };
}

function toRow(os: OrdemServico, userId: string, branchId: string | null) {
  return {
    id: os.id,
    user_id: userId,
    branch_id: branchId,
    os_externa: orNull(os.osExterna),
    data: os.data,
    propriedade: os.propriedade,
    codigo_area: os.codigoArea,
    responsavel_tecnico: os.responsavelTecnico,
    aplicador: os.aplicador,
    talhoes: asJsonArray(os.talhoes),
    created_at: os.createdAt,
    volume_calda_ha: orNull(os.volumeCaldaHa),
    coordenadas: orNull(os.coordenadas),
    tipo_aplicacao: orNull(os.tipoAplicacao),
    codigo_aplicacao: orNull(os.codigoAplicacao),
    apontamentos: asJsonArray(os.apontamentos),
    status: os.status ?? null,
    equipamentos: asJsonArray(os.equipamentos),
    cliente_id: orNull(os.clienteId),
    cliente_nome: orNull(os.clienteNome),
    servicos: asJsonArray(os.servicos),
    valor_herbicidas: os.valorHerbicidas ?? null,
    valor_servico: os.valorServico ?? null,
    valor_total: os.valorTotal ?? null,
    assinatura_base64: orNull(os.assinaturaBase64),
    assinado_em: orNull(os.assinadoEm),
    assinado_por_nome: orNull(os.assinadoPorNome),
    assinatura_metodo: orNull(os.assinaturaMetodo),
    clima: (os.clima as Record<string, string | number | boolean | null> | undefined) ?? null,
  };
}

/**
 * Próximo identificador do dia (AAAAMMDD-NNN).
 *
 * A numeração é resolvida no PostgreSQL com trava de concorrência: o
 * contador anterior ficava no navegador e reiniciava em cada dispositivo,
 * gerando ids duplicados assim que alguém abriu uma OS no celular.
 */
export async function generateOSId(): Promise<string> {
  const { data, error } = await supabase.rpc("next_os_id", {
    p_prefix: getTodayPrefix(),
  });
  if (error) throw storageError("Não foi possível gerar o número da OS", error);
  return String(data);
}

export async function saveOS(os: OrdemServico): Promise<void> {
  const { userId, branchId } = await requireScope();

  const { error } = await supabase
    .from("orders_of_service")
    .upsert({ ...toRow(os, userId, branchId) }, { onConflict: "id" });

  if (error) throw storageError("Falha ao salvar a OS", error);
}

export async function getAllOS(): Promise<OrdemServico[]> {
  const { data, error } = await supabase
    .from("orders_of_service")
    .select("*")
    .order("id", { ascending: false });

  if (error) throw storageError("Falha ao carregar as OS", error);
  return (data as OsRow[]).map(fromRow);
}

export async function getOSById(id: string): Promise<OrdemServico | undefined> {
  const { data, error } = await supabase
    .from("orders_of_service")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw storageError("Falha ao carregar a OS", error);
  return data ? fromRow(data as OsRow) : undefined;
}

export async function deleteOS(id: string): Promise<void> {
  const { error } = await supabase.from("orders_of_service").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir a OS", error);
}