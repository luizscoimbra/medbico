import { supabase } from "@/integrations/supabase/client";
import {
  asArray,
  num,
  orNull,
  requireScope,
  storageError,
  toJson,
} from "@/lib/db";

/**
 * Gestão de visitas de campo, recomendação técnica e Receituário Agronômico.
 *
 * A base Agrofit (`agrofit_produtos`) é o filtro legal: só entram nas
 * recomendações produtos registrados no MAPA para a cultura e o alvo
 * diagnosticados. O receituário guarda um snapshot completo em JSONB
 * (produtor, propriedade, responsável técnico com CREA/ART e itens) porque
 * é documento fiscal e deve sobreviver a alterações futuras de cadastro.
 */

export type VisitaStatus = "planejada" | "em_campo" | "concluida" | "cancelada";
export type Severidade = "baixa" | "media" | "alta";
export type RecomendacaoStatus =
  | "pendente"
  | "enviada"
  | "comprada"
  | "aplicada"
  | "cancelada";
export type AssinaturaMetodo = "biometrica" | "toque";

export interface VisitaFoto {
  base64: string;
  em: string;
  coordenadas?: string;
  observacao?: string;
}

export interface VisitaCampo {
  id: string;
  data: string;
  clienteId?: string;
  clienteNome?: string;
  areaNome: string;
  talhaoNome?: string;
  coordenadas?: string;
  faseFenologica?: string;
  cultura?: string;
  observacoes?: string;
  fotos: VisitaFoto[];
  status: VisitaStatus;
  criadoEm: string;
}

export interface DiagnosticoVisita {
  id: string;
  visitId: string;
  alvoCientifico: string;
  alvoComum?: string;
  severidade: Severidade;
  percentual?: number;
  observacao?: string;
}

export interface RecomendacaoVisita {
  id: string;
  visitId: string;
  agrofitId?: number;
  nrRegistro?: string;
  marcaComercial?: string;
  ingredienteAtivo?: string;
  dose?: number;
  doseUnidade: string;
  areaHa?: number;
  quantidadeTotal?: number;
  intervaloSegurancaDias?: number;
  periodoReentradaDias?: number;
  modoAplicacao?: string;
  volumeCaldaLHa?: number;
  janelaInicio?: string;
  janelaFim?: string;
  observacao?: string;
  status: RecomendacaoStatus;
}

export interface ProdutoAgrofit {
  id: number;
  nrRegistro: string;
  marcaComercial: string;
  formulacao?: string;
  ingredienteAtivo?: string;
  titular?: string;
  classe?: string;
  modoDeAcao?: string;
  cultura?: string;
  pragaCientifico?: string;
  pragaComum?: string;
  classeToxicologica?: string;
  classeAmbiental?: string;
  organicos?: string;
  situacao?: string;
}

export interface ReceituarioItem {
  nrRegistro: string;
  marca: string;
  ingrediente: string;
  forma?: string;
  empresa?: string;
  cultura?: string;
  alvo?: string;
  dose: string;
  unidade: string;
  quantidade: string;
  intervaloSeguranca: string;
  reentrada: string;
  modoAplicacao?: string;
  volumeCalda?: string;
}

export interface ReceituarioDados {
  produtor?: { nome: string; documento: string; municipio?: string; uf?: string };
  propriedade?: { nome: string; municipio?: string; uf?: string; areaHa?: string; car?: string };
  tecnico?: { nome: string; titulo: string; crea: string; art: string };
  diagnostico?: string;
  itens: ReceituarioItem[];
  condicoes?: string;
}

export interface Receituario {
  id: string;
  numero: string;
  visitId?: string;
  dados: ReceituarioDados;
  assinaturaBase64?: string;
  assinadoEm?: string;
  assinadoPorNome?: string;
  assinaturaMetodo?: AssinaturaMetodo;
  status: "rascunho" | "emitida";
  criadoEm: string;
}

// ---------------------------------------------------------------------------
// Visitas
// ---------------------------------------------------------------------------

interface VisitaRow {
  id: string;
  data: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  area_nome: string;
  talhao_nome: string | null;
  coordenadas: string | null;
  fase_fenologica: string | null;
  cultura: string | null;
  observacoes: string | null;
  fotos: unknown;
  status: string;
  criado_em: string;
}

function visitaFromRow(row: VisitaRow): VisitaCampo {
  return {
    id: row.id,
    data: row.data,
    clienteId: row.cliente_id ?? undefined,
    clienteNome: row.cliente_nome ?? undefined,
    areaNome: row.area_nome,
    talhaoNome: row.talhao_nome ?? undefined,
    coordenadas: row.coordenadas ?? undefined,
    faseFenologica: row.fase_fenologica ?? undefined,
    cultura: row.cultura ?? undefined,
    observacoes: row.observacoes ?? undefined,
    fotos: asArray<VisitaFoto>(row.fotos),
    status: (row.status as VisitaStatus) ?? "em_campo",
    criadoEm: row.criado_em,
  };
}

export function novaVisitaId(): string {
  const agora = new Date();
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  const sufixo = crypto.randomUUID().slice(0, 4).toUpperCase();
  return `VST-${y}${m}${d}-${sufixo}`;
}

export async function listarVisitas(): Promise<VisitaCampo[]> {
  const { data, error } = await supabase
    .from("field_visits")
    .select("*")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) throw storageError("Falha ao carregar as visitas", error);
  return (data as VisitaRow[]).map(visitaFromRow);
}

export async function getVisita(id: string): Promise<VisitaCampo | undefined> {
  const { data, error } = await supabase
    .from("field_visits")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw storageError("Falha ao carregar a visita", error);
  return data ? visitaFromRow(data as VisitaRow) : undefined;
}

export async function salvarVisita(visita: VisitaCampo): Promise<void> {
  const { userId, branchId } = await requireScope();

  const { error } = await supabase
    .from("field_visits")
    .upsert(
      {
        id: visita.id,
        user_id: userId,
        branch_id: branchId,
        data: visita.data,
        cliente_id: orNull(visita.clienteId),
        cliente_nome: orNull(visita.clienteNome),
        area_nome: visita.areaNome,
        talhao_nome: orNull(visita.talhaoNome),
        coordenadas: orNull(visita.coordenadas),
        fase_fenologica: orNull(visita.faseFenologica),
        cultura: orNull(visita.cultura),
        observacoes: orNull(visita.observacoes),
        fotos: toJson(visita.fotos),
        status: visita.status,
      },
      { onConflict: "id" }
    );

  if (error) throw storageError("Falha ao salvar a visita", error);
}

export async function atualizarStatusVisita(
  id: string,
  status: VisitaStatus
): Promise<void> {
  const { error } = await supabase
    .from("field_visits")
    .update({ status })
    .eq("id", id);

  if (error) throw storageError("Falha ao atualizar a visita", error);
}

export async function excluirVisita(id: string): Promise<void> {
  const { error } = await supabase.from("field_visits").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir a visita", error);
}

// ---------------------------------------------------------------------------
// Diagnósticos
// ---------------------------------------------------------------------------

interface DiagnosticoRow {
  id: string;
  visit_id: string;
  alvo_cientifico: string;
  alvo_comum: string | null;
  severidade: string;
  percentual: number | string | null;
  observacao: string | null;
}

function diagnosticoFromRow(row: DiagnosticoRow): DiagnosticoVisita {
  return {
    id: row.id,
    visitId: row.visit_id,
    alvoCientifico: row.alvo_cientifico,
    alvoComum: row.alvo_comum ?? undefined,
    severidade: (row.severidade as Severidade) ?? "media",
    percentual: row.percentual == null ? undefined : num(row.percentual),
    observacao: row.observacao ?? undefined,
  };
}

export async function listarDiagnosticos(visitId: string): Promise<DiagnosticoVisita[]> {
  const { data, error } = await supabase
    .from("visit_diagnoses")
    .select("*")
    .eq("visit_id", visitId)
    .order("criado_em");

  if (error) throw storageError("Falha ao carregar os diagnósticos", error);
  return (data as DiagnosticoRow[]).map(diagnosticoFromRow);
}

export async function adicionarDiagnostico(
  diag: Omit<DiagnosticoVisita, "id">
): Promise<DiagnosticoVisita> {
  const { data, error } = await supabase
    .from("visit_diagnoses")
    .insert({
      visit_id: diag.visitId,
      alvo_cientifico: diag.alvoCientifico,
      alvo_comum: orNull(diag.alvoComum),
      severidade: diag.severidade,
      percentual: diag.percentual ?? null,
      observacao: orNull(diag.observacao),
    })
    .select()
    .single();

  if (error) throw storageError("Falha ao adicionar o diagnóstico", error);
  return diagnosticoFromRow(data as DiagnosticoRow);
}

export async function removerDiagnostico(id: string): Promise<void> {
  const { error } = await supabase.from("visit_diagnoses").delete().eq("id", id);
  if (error) throw storageError("Falha ao remover o diagnóstico", error);
}

// ---------------------------------------------------------------------------
// Recomendações técnicas / intenção de compra
// ---------------------------------------------------------------------------

interface RecRow {
  id: string;
  visit_id: string;
  agrofit_id: number | null;
  nr_registro: string | null;
  marca_comercial: string | null;
  ingrediente_ativo: string | null;
  dose: number | string | null;
  dose_unidade: string;
  area_ha: number | string | null;
  quantidade_total: number | string | null;
  intervalo_seguranca_dias: number | null;
  periodo_reentrada_dias: number | null;
  modo_aplicacao: string | null;
  volume_calda_l_ha: number | string | null;
  janela_inicio: string | null;
  janela_fim: string | null;
  observacao: string | null;
  status: string;
}

function recFromRow(row: RecRow): RecomendacaoVisita {
  return {
    id: row.id,
    visitId: row.visit_id,
    agrofitId: row.agrofit_id ?? undefined,
    nrRegistro: row.nr_registro ?? undefined,
    marcaComercial: row.marca_comercial ?? undefined,
    ingredienteAtivo: row.ingrediente_ativo ?? undefined,
    dose: row.dose == null ? undefined : num(row.dose),
    doseUnidade: row.dose_unidade,
    areaHa: row.area_ha == null ? undefined : num(row.area_ha),
    quantidadeTotal: row.quantidade_total == null ? undefined : num(row.quantidade_total),
    intervaloSegurancaDias: row.intervalo_seguranca_dias ?? undefined,
    periodoReentradaDias: row.periodo_reentrada_dias ?? undefined,
    modoAplicacao: row.modo_aplicacao ?? undefined,
    volumeCaldaLHa: row.volume_calda_l_ha == null ? undefined : num(row.volume_calda_l_ha),
    janelaInicio: row.janela_inicio ?? undefined,
    janelaFim: row.janela_fim ?? undefined,
    observacao: row.observacao ?? undefined,
    status: (row.status as RecomendacaoStatus) ?? "pendente",
  };
}

export async function listarRecomendacoes(visitId: string): Promise<RecomendacaoVisita[]> {
  const { data, error } = await supabase
    .from("visit_recommendations")
    .select("*")
    .eq("visit_id", visitId)
    .order("criado_em");

  if (error) throw storageError("Falha ao carregar as recomendações", error);
  return (data as RecRow[]).map(recFromRow);
}

export async function adicionarRecomendacao(
  rec: Omit<RecomendacaoVisita, "id" | "status">
): Promise<RecomendacaoVisita> {
  const { userId, branchId } = await requireScope();
  const id = crypto.randomUUID();

  const { data, error } = await supabase
    .from("visit_recommendations")
    .insert({
      id,
      user_id: userId,
      branch_id: branchId,
      visit_id: rec.visitId,
      agrofit_id: rec.agrofitId ?? null,
      nr_registro: orNull(rec.nrRegistro),
      marca_comercial: orNull(rec.marcaComercial),
      ingrediente_ativo: orNull(rec.ingredienteAtivo),
      dose: rec.dose ?? null,
      dose_unidade: rec.doseUnidade,
      area_ha: rec.areaHa ?? null,
      quantidade_total: rec.quantidadeTotal ?? null,
      intervalo_seguranca_dias: rec.intervaloSegurancaDias ?? null,
      periodo_reentrada_dias: rec.periodoReentradaDias ?? null,
      modo_aplicacao: orNull(rec.modoAplicacao),
      volume_calda_l_ha: rec.volumeCaldaLHa ?? null,
      janela_inicio: orNull(rec.janelaInicio),
      janela_fim: orNull(rec.janelaFim),
      observacao: orNull(rec.observacao),
      status: "pendente",
    })
    .select()
    .single();

  if (error) throw storageError("Falha ao adicionar a recomendação", error);
  return recFromRow(data as RecRow);
}

export async function atualizarRecomendacao(
  id: string,
  campos: Partial<Pick<RecomendacaoVisita, "status" | "observacao" | "dose" | "areaHa" | "quantidadeTotal">>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (campos.status !== undefined) payload.status = campos.status;
  if (campos.observacao !== undefined) payload.observacao = orNull(campos.observacao);
  if (campos.dose !== undefined) payload.dose = campos.dose ?? null;
  if (campos.areaHa !== undefined) payload.area_ha = campos.areaHa ?? null;
  if (campos.quantidadeTotal !== undefined) payload.quantidade_total = campos.quantidadeTotal ?? null;

  const { error } = await supabase
    .from("visit_recommendations")
    .update(payload)
    .eq("id", id);

  if (error) throw storageError("Falha ao atualizar a recomendação", error);
}

export async function removerRecomendacao(id: string): Promise<void> {
  const { error } = await supabase.from("visit_recommendations").delete().eq("id", id);
  if (error) throw storageError("Falha ao remover a recomendação", error);
}

// ---------------------------------------------------------------------------
// Base Agrofit (busca de produtos registrados)
// ---------------------------------------------------------------------------

/** Remove caracteres que quebram a sintaxe de filtro `or()` do PostgREST. */
function limparTermo(termo: string): string {
  return termo.replace(/[,()\\%]/g, " ").trim();
}

/**
 * Busca produtos registrados no MAPA para a cultura/alvo da visita.
 *
 * A coluna `situacao` vem 'TRUE' da base oficial — só registros vigentes
 * são considerados prescrição legal.
 */
export async function buscarAgrofit(opcoes: {
  cultura?: string;
  alvo?: string;
  busca?: string;
  limite?: number;
}): Promise<ProdutoAgrofit[]> {
  const limite = opcoes.limite ?? 50;
  let consulta = supabase
    .from("agrofit_produtos")
    .select("*")
    .eq("situacao", "TRUE")
    .limit(limite);

  const cultura = limparTermo(opcoes.cultura ?? "");
  const alvo = limparTermo(opcoes.alvo ?? "");
  const busca = limparTermo(opcoes.busca ?? "");

  if (cultura) consulta = consulta.ilike("cultura", `%${cultura}%`);
  if (alvo) {
    consulta = consulta.or(
      `praga_cientifico.ilike.%${alvo}%,praga_comum.ilike.%${alvo}%`
    );
  }
  if (busca) {
    consulta = consulta.or(
      `marca_comercial.ilike.%${busca}%,nr_registro.ilike.%${busca}%,ingrediente_ativo.ilike.%${busca}%`
    );
  }

  const { data, error } = await consulta.order("marca_comercial");

  if (error) throw storageError("Falha ao consultar a base Agrofit", error);

  // Deduplica: o mesmo registro aparece uma vez por cultura/praga autorizados.
  const vistos = new Set<string>();
  const produtos: ProdutoAgrofit[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const chave = `${row.nr_registro}|${row.marca_comercial}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    produtos.push({
      id: Number(row.id),
      nrRegistro: String(row.nr_registro ?? ""),
      marcaComercial: String(row.marca_comercial ?? ""),
      formulacao: (row.formulacao as string) ?? undefined,
      ingredienteAtivo: (row.ingrediente_ativo as string) ?? undefined,
      titular: (row.titular as string) ?? undefined,
      classe: (row.classe as string) ?? undefined,
      modoDeAcao: (row.modo_de_acao as string) ?? undefined,
      cultura: (row.cultura as string) ?? undefined,
      pragaCientifico: (row.praga_cientifico as string) ?? undefined,
      pragaComum: (row.praga_comum as string) ?? undefined,
      classeToxicologica: (row.classe_toxicologica as string) ?? undefined,
      classeAmbiental: (row.classe_ambiental as string) ?? undefined,
      organicos: (row.organicos as string) ?? undefined,
      situacao: (row.situacao as string) ?? undefined,
    });
  }
  return produtos;
}

/** Lista de culturas distintas da base — autocomplete na visita. */
export async function listarCulturasAgrofit(limite = 300): Promise<string[]> {
  const { data, error } = await supabase
    .from("agrofit_produtos")
    .select("cultura")
    .not("cultura", "is", null)
    .limit(5000);

  if (error) throw storageError("Falha ao carregar as culturas", error);
  const distintas = new Set(
    (data ?? []).map((r) => String((r as { cultura: string }).cultura).trim())
  );
  return [...distintas].sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, limite);
}

// ---------------------------------------------------------------------------
// Receituário Agronômico
// ---------------------------------------------------------------------------

interface ReceituarioRow {
  id: string;
  numero: string;
  visit_id: string | null;
  dados: unknown;
  assinatura_base64: string | null;
  assinado_em: string | null;
  assinado_por_nome: string | null;
  assinatura_metodo: string | null;
  status: string;
  criado_em: string;
}

function receituarioFromRow(row: ReceituarioRow): Receituario {
  const dados = (row.dados ?? {}) as ReceituarioDados;
  return {
    id: row.id,
    numero: row.numero,
    visitId: row.visit_id ?? undefined,
    dados: { itens: [], ...dados },
    assinaturaBase64: row.assinatura_base64 ?? undefined,
    assinadoEm: row.assinado_em ?? undefined,
    assinadoPorNome: row.assinado_por_nome ?? undefined,
    assinaturaMetodo: (row.assinatura_metodo as AssinaturaMetodo) ?? undefined,
    status: (row.status as Receituario["status"]) ?? "rascunho",
    criadoEm: row.criado_em,
  };
}

export async function listarReceituarios(): Promise<Receituario[]> {
  const { data, error } = await supabase
    .from("agronomic_prescriptions")
    .select("*")
    .order("criado_em", { ascending: false });

  if (error) throw storageError("Falha ao carregar os receituários", error);
  return (data as ReceituarioRow[]).map(receituarioFromRow);
}

export async function getReceituario(id: string): Promise<Receituario | undefined> {
  const { data, error } = await supabase
    .from("agronomic_prescriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw storageError("Falha ao carregar o receituário", error);
  return data ? receituarioFromRow(data as ReceituarioRow) : undefined;
}

export async function criarReceituario(
  dados: ReceituarioDados,
  visitId?: string
): Promise<Receituario> {
  const { userId, branchId } = await requireScope();

  const { data: numero, error: erroNumero } = await supabase.rpc(
    "next_receituario_numero"
  );
  if (erroNumero) throw storageError("Falha ao numerar o receituário", erroNumero);

  const { data, error } = await supabase
    .from("agronomic_prescriptions")
    .insert({
      numero: String(numero),
      visit_id: visitId ?? null,
      user_id: userId,
      branch_id: branchId,
      dados: toJson(dados),
      status: "rascunho",
    })
    .select()
    .single();

  if (error) throw storageError("Falha ao criar o receituário", error);
  return receituarioFromRow(data as ReceituarioRow);
}

export async function salvarReceituarioDados(
  id: string,
  dados: ReceituarioDados
): Promise<void> {
  const { error } = await supabase
    .from("agronomic_prescriptions")
    .update({ dados: toJson(dados) })
    .eq("id", id);

  if (error) throw storageError("Falha ao salvar o receituário", error);
}

/** Assina e emite o receituário — a partir daí o documento é legal. */
export async function assinarReceituario(
  id: string,
  assinatura: { base64: string; metodo: AssinaturaMetodo; nome: string }
): Promise<void> {
  const { error } = await supabase
    .from("agronomic_prescriptions")
    .update({
      assinatura_base64: assinatura.base64,
      assinatura_metodo: assinatura.metodo,
      assinado_por_nome: assinatura.nome,
      assinado_em: new Date().toISOString(),
      status: "emitida",
    })
    .eq("id", id);

  if (error) throw storageError("Falha ao assinar o receituário", error);
}

export async function excluirReceituario(id: string): Promise<void> {
  const { error } = await supabase
    .from("agronomic_prescriptions")
    .delete()
    .eq("id", id);
  if (error) throw storageError("Falha ao excluir o receituário", error);
}

// ---------------------------------------------------------------------------
// Fotos da visita
// ---------------------------------------------------------------------------

/**
 * Comprime a foto no navegador (JPEG, no máx. 1280px) e devolve dataURL —
 * as fotos ficam em JSONB da visita, sem bucket de storage.
 */
export async function comprimirFoto(file: File, maxSize = 1280, qualidade = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", qualidade);
}
