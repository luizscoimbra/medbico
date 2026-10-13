import { supabase } from "@/integrations/supabase/client";
import { num, orNull, requireScope, storageError } from "@/lib/db";

/**
 * Contas bancárias e credenciais de integração.
 *
 * Duas camadas aqui: os dados básicos da conta (banco, agência, conta, dígito)
 * que qualquer usuário do financeiro vê, e as chaves de API do banco, que são
 * gravadas em uma tabela própria e nunca devolvidas integralmente na tela.
 */

export type TipoContaBancaria = "corrente" | "poupanca" | "caixa" | "pagamento";
export type IntegracaoTipo = "nenhuma" | "ofx" | "api" | "open_banking";
export type IntegracaoStatus = "desconectado" | "pendente" | "conectado" | "erro";

export interface ContaBancaria {
  id: string;
  codigoBanco: string;
  nomeBanco: string;
  agencia: string;
  agenciaDv?: string;
  conta: string;
  contaDv?: string;
  tipo: TipoContaBancaria;
  moeda: string;
  saldoInicial: number;
  chavePix?: string;
  ativo: boolean;
  integracaoTipo: IntegracaoTipo;
  integracaoStatus: IntegracaoStatus;
  integracaoDetalhe?: string;
  ultimaImportacao?: string;
}

export interface CredencialBanco {
  bankAccountId: string;
  provider: string;
  clientId?: string;
  clientSecret?: string;
  certificadoPfx?: string;
  certificadoSenha?: string;
  tokenOauth?: string;
  webhookUrl?: string;
  ambiente: "homologacao" | "producao";
}

/** Visão de leitura: nunca expõe segredos. */
export interface StatusCredencial {
  bankAccountId: string;
  provider: string;
  clientId?: string;
  webhookUrl?: string;
  ambiente: "homologacao" | "producao";
  status: IntegracaoStatus;
  ultimoErro?: string;
  sincronizadoEm?: string;
  temClientSecret: boolean;
  temCertificado: boolean;
  temToken: boolean;
}

interface ContaRow {
  id: string;
  codigo_banco: string;
  nome_banco: string;
  agencia: string;
  agencia_dv: string | null;
  conta: string;
  conta_dv: string | null;
  tipo: string;
  moeda: string;
  saldo_inicial: number | string;
  chave_pix: string | null;
  ativo: boolean;
  integracao_tipo: string;
  integracao_status: string;
  integracao_detalhe: string | null;
  ultima_importacao: string | null;
}

const fromRow = (r: ContaRow): ContaBancaria => ({
  id: r.id,
  codigoBanco: r.codigo_banco,
  nomeBanco: r.nome_banco,
  agencia: r.agencia,
  agenciaDv: r.agencia_dv ?? undefined,
  conta: r.conta,
  contaDv: r.conta_dv ?? undefined,
  tipo: (r.tipo as TipoContaBancaria) || "corrente",
  moeda: r.moeda || "BRL",
  saldoInicial: num(r.saldo_inicial),
  chavePix: r.chave_pix ?? undefined,
  ativo: !!r.ativo,
  integracaoTipo: (r.integracao_tipo as IntegracaoTipo) || "nenhuma",
  integracaoStatus: (r.integracao_status as IntegracaoStatus) || "desconectado",
  integracaoDetalhe: r.integracao_detalhe ?? undefined,
  ultimaImportacao: r.ultima_importacao ?? undefined,
});

const novoId = (p: string) =>
  `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Catálogo FEBRABAN dos bancos mais usados (código → nome). */
export const BANCOS: { codigo: string; nome: string }[] = [
  { codigo: "001", nome: "Banco do Brasil" },
  { codigo: "033", nome: "Santander" },
  { codigo: "041", nome: "Banrisul" },
  { codigo: "070", nome: "BRB" },
  { codigo: "077", nome: "Banco Inter" },
  { codigo: "085", nome: "Cecred" },
  { codigo: "104", nome: "Caixa Econômica Federal" },
  { codigo: "136", nome: "Unicred" },
  { codigo: "197", nome: "Banco Olé Consignado" },
  { codigo: "208", nome: "BTG Pactual" },
  { codigo: "212", nome: "Banco Master" },
  { codigo: "237", nome: "Bradesco" },
  { codigo: "246", nome: "ABC Brasil" },
  { codigo: "260", nome: "Nu Pagamentos (Nubank)" },
  { codigo: "290", nome: "PagBank" },
  { codigo: "318", nome: "BMG" },
  { codigo: "336", nome: "Banco C6" },
  { codigo: "341", nome: "Itaú Unibanco" },
  { codigo: "389", nome: "Banco Mercantil" },
  { codigo: "422", nome: "Safra" },
  { codigo: "545", nome: "Sicredi" },
  { codigo: "604", nome: "Banco Industrial do Brasil" },
  { codigo: "613", nome: "Omni" },
  { codigo: "623", nome: "Banco Pan" },
  { codigo: "633", nome: "Banco Rendimento" },
  { codigo: "655", nome: "Banco Votorantim" },
  { codigo: "741", nome: "Banco Ribeirão Preto" },
  { codigo: "745", nome: "Citibank" },
  { codigo: "748", nome: "Sicredi" },
  { codigo: "756", nome: "Sicoob" },
];

export function nomeBancoPorCodigo(codigo: string): string {
  return BANCOS.find((b) => b.codigo === (codigo || "").padStart(3, "0"))?.nome || "";
}

export async function getAllContasBancarias(): Promise<ContaBancaria[]> {
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*")
    .order("nome_banco", { ascending: true });
  if (error) throw storageError("Falha ao carregar as contas bancárias", error);
  return (data as ContaRow[]).map(fromRow);
}

export async function criarContaBancaria(
  input: Omit<ContaBancaria, "id" | "integracaoStatus" | "integracaoDetalhe" | "ultimaImportacao" | "moeda">
): Promise<ContaBancaria> {
  const { userId, branchId } = await requireScope();
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      id: novoId("bk"),
      user_id: userId,
      branch_id: branchId,
      codigo_banco: input.codigoBanco.padStart(3, "0"),
      nome_banco: input.nomeBanco,
      agencia: input.agencia,
      agencia_dv: orNull(input.agenciaDv),
      conta: input.conta,
      conta_dv: orNull(input.contaDv),
      tipo: input.tipo,
      saldo_inicial: input.saldoInicial || 0,
      chave_pix: orNull(input.chavePix),
      ativo: input.ativo,
      integracao_tipo: input.integracaoTipo,
      integracao_status: "desconectado",
    })
    .select("*")
    .single();
  if (error) throw storageError("Falha ao criar a conta bancária", error);
  return fromRow(data as ContaRow);
}

export async function updateContaBancaria(
  id: string,
  patch: Partial<ContaBancaria>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if ("codigoBanco" in patch) payload.codigo_banco = (patch.codigoBanco || "").padStart(3, "0");
  if ("nomeBanco" in patch) payload.nome_banco = patch.nomeBanco;
  if ("agencia" in patch) payload.agencia = patch.agencia;
  if ("agenciaDv" in patch) payload.agencia_dv = orNull(patch.agenciaDv);
  if ("conta" in patch) payload.conta = patch.conta;
  if ("contaDv" in patch) payload.conta_dv = orNull(patch.contaDv);
  if ("tipo" in patch) payload.tipo = patch.tipo;
  if ("saldoInicial" in patch) payload.saldo_inicial = patch.saldoInicial;
  if ("chavePix" in patch) payload.chave_pix = orNull(patch.chavePix);
  if ("ativo" in patch) payload.ativo = patch.ativo;
  if ("integracaoTipo" in patch) payload.integracao_tipo = patch.integracaoTipo;
  if (!Object.keys(payload).length) return;

  const { error } = await supabase.from("bank_accounts").update(payload).eq("id", id);
  if (error) throw storageError("Falha ao atualizar a conta bancária", error);
}

export async function deleteContaBancaria(id: string): Promise<void> {
  const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Esta conta tem extrato ou documentos de cobrança vinculados. Cancele-os antes de excluir.");
    }
    throw storageError("Falha ao excluir a conta bancária", error);
  }
}

// ─── Credenciais ────────────────────────────────────────────────────────────

/**
 * Leitura das credenciais sem os segredos — é o que a tela mostra.
 * Os campos sensíveis só saem do banco na gravação.
 */
export async function getStatusCredencial(bankAccountId: string): Promise<StatusCredencial | null> {
  const { data, error } = await supabase
    .from("bank_api_credentials")
    .select(
      "bank_account_id, provider, client_id, webhook_url, ambiente, status, ultimo_erro, sincronizado_em, client_secret, certificado_pfx, token_oauth"
    )
    .eq("bank_account_id", bankAccountId)
    .maybeSingle();
  if (error) throw storageError("Falha ao carregar as credenciais do banco", error);
  if (!data) return null;

  const row = data as unknown as {
    bank_account_id: string;
    provider: string;
    client_id: string | null;
    webhook_url: string | null;
    ambiente: string;
    status: string;
    ultimo_erro: string | null;
    sincronizado_em: string | null;
    client_secret: string | null;
    certificado_pfx: string | null;
    token_oauth: string | null;
  };

  return {
    bankAccountId: row.bank_account_id,
    provider: row.provider,
    clientId: row.client_id ?? undefined,
    webhookUrl: row.webhook_url ?? undefined,
    ambiente: row.ambiente === "producao" ? "producao" : "homologacao",
    status: (row.status as IntegracaoStatus) || "desconectado",
    ultimoErro: row.ultimo_erro ?? undefined,
    sincronizadoEm: row.sincronizado_em ?? undefined,
    temClientSecret: !!row.client_secret,
    temCertificado: !!row.certificado_pfx,
    temToken: !!row.token_oauth,
  };
}

/**
 * Grava as chaves fornecidas pelo banco. Segredos vazios mantêm o valor
 * já armazenado — assim a tela consem atualizar o Client ID sem reenviar
 * o Client Secret toda vez.
 */
export async function salvarCredencial(bankAccountId: string, input: CredencialBanco): Promise<void> {
  const { branchId } = await requireScope();

  const payload: Record<string, unknown> = {
    bank_account_id: bankAccountId,
    branch_id: branchId,
    provider: input.provider || "outro",
    ambiente: input.ambiente,
    updated_at: new Date().toISOString(),
  };

  if (input.clientId !== undefined) payload.client_id = orNull(input.clientId);
  if (input.clientSecret) payload.client_secret = input.clientSecret;
  if (input.certificadoPfx) payload.certificado_pfx = input.certificadoPfx;
  if (input.certificadoSenha) payload.certificado_senha = input.certificadoSenha;
  if (input.tokenOauth) payload.token_oauth = input.tokenOauth;
  if (input.webhookUrl !== undefined) payload.webhook_url = orNull(input.webhookUrl);

  const { data: existente } = await supabase
    .from("bank_api_credentials")
    .select("bank_account_id")
    .eq("bank_account_id", bankAccountId)
    .maybeSingle();

  const { error } = existente
    ? await supabase.from("bank_api_credentials").update(payload).eq("bank_account_id", bankAccountId)
    : await supabase
        .from("bank_api_credentials")
        .insert({ ...payload, id: novoId("bc"), criado_em: new Date().toISOString() });

  if (error) throw storageError("Falha ao salvar as credenciais do banco", error);
}

/**
 * Verificação local das chaves + mudança de status.
 *
 * Sem as credenciais do banco não existe conexão real para abrir — por isso a
 * integração fica `pendente` ("chaves registradas, aguardando a instituição")
 * e nunca `conectado` por conta própria do sistema.
 */
export async function validarIntegracao(bankAccountId: string): Promise<{
  ok: boolean;
  faltando: string[];
}> {
  const status = await getStatusCredencial(bankAccountId);
  const conta = (await getAllContasBancarias()).find((c) => c.id === bankAccountId);

  const faltando: string[] = [];
  if (!status) faltando.push("credenciais não cadastradas");
  else {
    if (!status.clientId) faltando.push("Client ID");
    if (!status.temClientSecret) faltando.push("Client Secret");
  }
  if (conta && !conta.chavePix) faltando.push("chave Pix da conta");

  const ok = faltando.length === 0;
  const detalhe = ok
    ? "Chaves registradas. A conexão automática passa a valer após a liberação/homologação junto à instituição."
    : `Falta configurar: ${faltando.join(", ")}.`;

  const { error } = await supabase
    .from("bank_accounts")
    .update({
      integracao_status: ok ? "pendente" : "desconectado",
      integracao_detalhe: detalhe,
    })
    .eq("id", bankAccountId);

  if (error) throw storageError("Falha ao atualizar o status da integração", error);
  return { ok, faltando };
}
