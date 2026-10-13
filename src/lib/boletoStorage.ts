import { supabase } from "@/integrations/supabase/client";
import { num, orNull, requireScope, storageError } from "@/lib/db";
import { gerarBoleto, montarCampoLivre, normalizarNossoNumero } from "@/lib/boleto";
import { brCodeDoBoleto } from "@/lib/pixBrCode";
import { fetchCompanyContext } from "@/lib/companyStorage";
import { requireUserId } from "@/lib/db";

/**
 * Documentos de cobrança: carteira registrada no banco + emissão do boleto
 * com QR Code Pix (híbrido).
 *
 * O QR é gerado localmente no modo estático (a chave Pix da carteira). No modo
 * dinâmico o payload vem da API do banco — aí o `payloadDinamico` entra na
 * emissão e o registro fica marcado como `geracao = "banco"`.
 */

export type AmbienteCobranca = "homologacao" | "producao";

export interface CarteiraCobranca {
  id: string;
  bankAccountId: string;
  nome: string;
  carteiraCodigo: string;
  convenio?: string;
  modalidade: "boleto" | "hibrido";
  aceitaQrPix: boolean;
  chavePix?: string;
  ambiente: AmbienteCobranca;
  statusHomologacao: "pendente" | "homologado" | "reprovado";
  registroRemoto: boolean;
  ativo: boolean;
  observacao?: string;
}

export interface DocumentoCobranca {
  id: string;
  receivableId?: string;
  bankAccountId: string;
  portfolioId: string;
  numeroDocumento: string;
  nossoNumero: string;
  beneficiarioNome: string;
  beneficiarioDocumento?: string;
  sacadoNome: string;
  sacadoDocumento?: string;
  sacadoEndereco?: string;
  sacadoCidade?: string;
  valor: number;
  vencimento: string;
  especie: string;
  aceite: "S" | "N";
  instrucoes?: string;
  linhaDigitavel: string;
  codigoBarras: string;
  qrCodePix: string;
  qrCodeModo: "estatico" | "dinamico";
  geracao: "local" | "banco";
  status: "rascunho" | "emitido" | "pago" | "cancelado";
  ambiente: AmbienteCobranca;
  emitidoEm?: string;
  criadoEm: string;
}

export interface EventoCobranca {
  id: string;
  documentId: string;
  evento: string;
  ambiente: string;
  detalhe?: string;
  criadoEm: string;
}

interface CarteiraRow {
  id: string;
  bank_account_id: string;
  nome: string;
  carteira_codigo: string;
  convenio: string | null;
  modalidade: string;
  aceita_qr_pix: boolean;
  chave_pix: string | null;
  ambiente: string;
  status_homologacao: string;
  registro_remoto: boolean;
  ativo: boolean;
  observacao: string | null;
}

interface DocumentoRow {
  id: string;
  receivable_id: string | null;
  bank_account_id: string;
  portfolio_id: string;
  numero_documento: string;
  nosso_numero: string;
  beneficiario_nome: string;
  beneficiario_documento: string | null;
  sacado_nome: string;
  sacado_documento: string | null;
  sacado_endereco: string | null;
  sacado_cidade: string | null;
  valor: number | string;
  vencimento: string;
  especie: string;
  aceite: string;
  instrucoes: string | null;
  linha_digitavel: string;
  codigo_barras: string;
  qr_code_pix: string;
  qr_code_modo: string;
  geracao: string;
  status: string;
  ambiente: string;
  emitido_em: string | null;
  criado_em: string;
}

const carteiraFromRow = (r: CarteiraRow): CarteiraCobranca => ({
  id: r.id,
  bankAccountId: r.bank_account_id,
  nome: r.nome,
  carteiraCodigo: r.carteira_codigo,
  convenio: r.convenio ?? undefined,
  modalidade: r.modalidade === "boleto" ? "boleto" : "hibrido",
  aceitaQrPix: !!r.aceita_qr_pix,
  chavePix: r.chave_pix ?? undefined,
  ambiente: r.ambiente === "producao" ? "producao" : "homologacao",
  statusHomologacao: (r.status_homologacao as CarteiraCobranca["statusHomologacao"]) || "pendente",
  registroRemoto: !!r.registro_remoto,
  ativo: !!r.ativo,
  observacao: r.observacao ?? undefined,
});

const docFromRow = (r: DocumentoRow): DocumentoCobranca => ({
  id: r.id,
  receivableId: r.receivable_id ?? undefined,
  bankAccountId: r.bank_account_id,
  portfolioId: r.portfolio_id,
  numeroDocumento: r.numero_documento,
  nossoNumero: r.nosso_numero,
  beneficiarioNome: r.beneficiario_nome,
  beneficiarioDocumento: r.beneficiario_documento ?? undefined,
  sacadoNome: r.sacado_nome,
  sacadoDocumento: r.sacado_documento ?? undefined,
  sacadoEndereco: r.sacado_endereco ?? undefined,
  sacadoCidade: r.sacado_cidade ?? undefined,
  valor: num(r.valor),
  vencimento: r.vencimento,
  especie: r.especie,
  aceite: r.aceite === "S" ? "S" : "N",
  instrucoes: r.instrucoes ?? undefined,
  linhaDigitavel: r.linha_digitavel,
  codigoBarras: r.codigo_barras,
  qrCodePix: r.qr_code_pix,
  qrCodeModo: r.qr_code_modo === "dinamico" ? "dinamico" : "estatico",
  geracao: r.geracao === "banco" ? "banco" : "local",
  status: (r.status as DocumentoCobranca["status"]) || "emitido",
  ambiente: r.ambiente === "producao" ? "producao" : "homologacao",
  emitidoEm: r.emitido_em ?? undefined,
  criadoEm: r.criado_em,
});

const novoId = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function nextNossoNumero(): Promise<string> {
  const { data, error } = await supabase.rpc("next_nosso_numero");
  if (error) throw storageError("Não foi possível gerar o nosso número", error);
  return String(data);
}

// ─── Carteiras ──────────────────────────────────────────────────────────────

export async function getAllCarteiras(bankAccountId?: string): Promise<CarteiraCobranca[]> {
  let consulta = supabase.from("bank_portfolios").select("*").order("nome", { ascending: true });
  if (bankAccountId) consulta = consulta.eq("bank_account_id", bankAccountId);
  const { data, error } = await consulta;
  if (error) throw storageError("Falha ao carregar as carteiras de cobrança", error);
  return (data as CarteiraRow[]).map(carteiraFromRow);
}

export async function criarCarteira(
  input: Omit<CarteiraCobranca, "id" | "statusHomologacao">
): Promise<CarteiraCobranca> {
  const { branchId } = await requireScope();
  const { data, error } = await supabase
    .from("bank_portfolios")
    .insert({
      id: novoId("pf"),
      branch_id: branchId,
      bank_account_id: input.bankAccountId,
      nome: input.nome,
      carteira_codigo: input.carteiraCodigo,
      convenio: orNull(input.convenio),
      modalidade: input.modalidade,
      aceita_qr_pix: input.aceitaQrPix,
      chave_pix: orNull(input.chavePix),
      ambiente: input.ambiente,
      registro_remoto: input.registroRemoto,
      ativo: input.ativo,
      observacao: orNull(input.observacao),
    })
    .select("*")
    .single();
  if (error) throw storageError("Falha ao criar a carteira", error);
  return carteiraFromRow(data as CarteiraRow);
}

export async function updateCarteira(id: string, patch: Partial<CarteiraCobranca>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("nome" in patch) payload.nome = patch.nome;
  if ("carteiraCodigo" in patch) payload.carteira_codigo = patch.carteiraCodigo;
  if ("convenio" in patch) payload.convenio = orNull(patch.convenio);
  if ("modalidade" in patch) payload.modalidade = patch.modalidade;
  if ("aceitaQrPix" in patch) payload.aceita_qr_pix = patch.aceitaQrPix;
  if ("chavePix" in patch) payload.chave_pix = orNull(patch.chavePix);
  if ("ambiente" in patch) payload.ambiente = patch.ambiente;
  if ("statusHomologacao" in patch) payload.status_homologacao = patch.statusHomologacao;
  if ("registroRemoto" in patch) payload.registro_remoto = patch.registroRemoto;
  if ("ativo" in patch) payload.ativo = patch.ativo;
  if ("observacao" in patch) payload.observacao = orNull(patch.observacao);
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("bank_portfolios").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao atualizar a carteira", error);
}

export async function deleteCarteira(id: string): Promise<void> {
  const { error } = await supabase.from("bank_portfolios").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Esta carteira tem boletos emitidos. Cancele-os antes de excluir.");
    }
    throw storageError("Falha ao excluir a carteira", error);
  }
}

// ─── Documentos ─────────────────────────────────────────────────────────────

export async function getAllDocumentos(): Promise<DocumentoCobranca[]> {
  const { data, error } = await supabase
    .from("bank_charge_documents")
    .select("*")
    .order("criado_em", { ascending: false });
  if (error) throw storageError("Falha ao carregar os boletos", error);
  return (data as DocumentoRow[]).map(docFromRow);
}

export interface InputBoleto {
  bankAccountId: string;
  portfolioId: string;
  receivableId?: string;
  valor: number;
  vencimento: string;
  sacadoNome: string;
  sacadoDocumento?: string;
  sacadoEndereco?: string;
  sacadoCidade?: string;
  instrucoes?: string;
  especie?: string;
  aceite?: "S" | "N";
  /** Payload BR Code devolvido pela API do banco (QR dinâmico). */
  payloadDinamico?: string;
}

/**
 * Emite o boleto: calcula nosso número, campo livre, código de barras, linha
 * digitável e o QR Code Pix, grava o documento e registra o evento de emissão.
 */
export async function emitirBoleto(input: InputBoleto): Promise<DocumentoCobranca> {
  const { branchId } = await requireScope();

  if (!(input.valor > 0)) throw new Error("Informe um valor maior que zero.");
  if (!input.vencimento) throw new Error("Informe o vencimento.");
  if (!input.sacadoNome.trim()) throw new Error("Informe o sacado (cliente).");

  const [contas, carteiras] = await Promise.all([
    supabase.from("bank_accounts").select("*").eq("id", input.bankAccountId).maybeSingle(),
    supabase.from("bank_portfolios").select("*").eq("id", input.portfolioId).maybeSingle(),
  ]);
  if (contas.error || !contas.data) throw new Error("Conta bancária não encontrada.");
  if (carteiras.error || !carteiras.data) throw new Error("Carteira de cobrança não encontrada.");

  const conta = contas.data as {
    codigo_banco: string;
    chave_pix: string | null;
    nome_banco: string;
  };
  const carteira = carteiraFromRow(carteiras.data as CarteiraRow);

  if (carteira.modalidade === "hibrido" && !carteira.aceitaQrPix) {
    throw new Error(
      "Esta carteira não aceita QR Code Pix. Contrate a modalidade Cobrança Pix junto ao banco ou emita em modo 'Boleto'."
    );
  }

  const chavePix = carteira.chavePix || conta.chave_pix || "";
  const precisaQr = carteira.modalidade === "hibrido";
  if (precisaQr && !chavePix) {
    throw new Error("Cadastre a chave Pix da carteira (ou da conta) para emitir o boleto híbrido.");
  }

  const empresa = await fetchCompanyContext(await requireUserId());
  const beneficiario =
    empresa.company?.razao_social || empresa.company?.name || "Emitente nao informado";
  const documentoBeneficiario = empresa.company?.document || undefined;
  const cidadeBeneficiario = empresa.company?.municipio || "SAO PAULO";

  const nossoNumero = await nextNossoNumero();
  const campoLivre = montarCampoLivre({
    nossoNumero,
    carteira: carteira.carteiraCodigo,
    convenio: carteira.convenio,
  });

  const { codigoBarras, linhaDigitavel } = gerarBoleto({
    banco: conta.codigo_banco,
    valor: input.valor,
    vencimento: input.vencimento,
    campoLivre,
  });

  const qrCodePix = precisaQr
    ? brCodeDoBoleto({
        payloadDinamico: input.payloadDinamico,
        chave: chavePix,
        nome: beneficiario,
        cidade: cidadeBeneficiario,
        valor: input.valor,
        txid: normalizarNossoNumero(nossoNumero).replace(/^0+/, "") || nossoNumero,
      })
    : "";

  const id = novoId("cd");
  const { data, error } = await supabase
    .from("bank_charge_documents")
    .insert({
      id,
      branch_id: branchId,
      receivable_id: orNull(input.receivableId),
      bank_account_id: input.bankAccountId,
      portfolio_id: input.portfolioId,
      numero_documento: nossoNumero,
      nosso_numero: nossoNumero,
      beneficiario_nome: beneficiario,
      beneficiario_documento: orNull(documentoBeneficiario),
      sacado_nome: input.sacadoNome.trim(),
      sacado_documento: orNull(input.sacadoDocumento),
      sacado_endereco: orNull(input.sacadoEndereco),
      sacado_cidade: orNull(input.sacadoCidade),
      valor: input.valor,
      vencimento: input.vencimento,
      especie: input.especie || "DM",
      aceite: input.aceite || "N",
      instrucoes: orNull(input.instrucoes),
      linha_digitavel: linhaDigitavel,
      codigo_barras: codigoBarras,
      qr_code_pix: qrCodePix,
      qr_code_modo: input.payloadDinamico ? "dinamico" : "estatico",
      geracao: input.payloadDinamico ? "banco" : "local",
      status: "emitido",
      ambiente: carteira.ambiente,
      emitido_em: new Date().toISOString(),
      payload: { nossoNumero, campoLivre, codigoBarras },
      criado_em: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw storageError("Falha ao emitir o boleto", error);

  await registrarEvento(id, "emitido", `Emissão em ambiente de ${carteira.ambiente}.`);

  return docFromRow(data as DocumentoRow);
}

async function registrarEvento(documentId: string, evento: string, detalhe?: string): Promise<void> {
  const { error } = await supabase.rpc("registrar_evento_cobranca", {
    p_document_id: documentId,
    p_evento: evento,
    p_detalhe: detalhe ?? null,
  });
  if (error) throw storageError("Falha ao registrar o evento de cobrança", error);
}

/** Baixa do boleto (pagamento) — dá baixa também no título a receber. */
export async function baixarBoleto(documentId: string, detalhe?: string): Promise<void> {
  await registrarEvento(documentId, "baixado", detalhe);
}

export async function cancelarBoleto(documentId: string, motivo?: string): Promise<void> {
  await registrarEvento(documentId, "cancelado", motivo);
}

export async function getEventos(documentId: string): Promise<EventoCobranca[]> {
  const { data, error } = await supabase
    .from("bank_charge_events")
    .select("*")
    .eq("document_id", documentId)
    .order("criado_em", { ascending: false });
  if (error) throw storageError("Falha ao carregar os eventos do boleto", error);
  return (data as {
    id: string;
    document_id: string;
    evento: string;
    ambiente: string;
    detalhe: string | null;
    criado_em: string;
  }[]).map((r) => ({
    id: r.id,
    documentId: r.document_id,
    evento: r.evento,
    ambiente: r.ambiente,
    detalhe: r.detalhe ?? undefined,
    criadoEm: r.criado_em,
  }));
}

/** Falhas conhecidas antes de emitir — evita tentar e errar no meio do caminho. */
export function verificarPrerequisitosEmissao(params: {
  carteira?: CarteiraCobranca;
  chavePixConta?: string;
  temCredenciaisBanco: boolean;
}): string[] {
  const problemas: string[] = [];
  const { carteira } = params;
  if (!carteira) {
    problemas.push("Cadastre uma carteira de cobrança registrada no banco.");
    return problemas;
  }
  if (!carteira.ativo) problemas.push("A carteira está inativa.");
  if (carteira.modalidade === "hibrido" && !carteira.aceitaQrPix) {
    problemas.push("A carteira não aceita QR Code Pix (contrate a Cobrança Pix).");
  }
  if (carteira.modalidade === "hibrido" && !carteira.chavePix && !params.chavePixConta) {
    problemas.push("Falta a chave Pix vinculada à conta emissora.");
  }
  if (carteira.statusHomologacao !== "homologado") {
    problemas.push(
      "Carteira ainda em homologação — o banco exige testes de emissão e baixa antes da produção."
    );
  }
  if (!params.temCredenciaisBanco) {
    problemas.push("Credenciais de API do banco não cadastradas (Client ID/Secret).");
  }
  return problemas;
}
