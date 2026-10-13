// Tipagem estendida do banco gerada pelo Lovable.
//
// As tabelas/funções do módulo financeiro foram adicionadas por migrações locais
// (`supabase/migrations/20261014*`) e o arquivo gerado `types.ts` não as conhece.
// Em vez de regenerar (exigiria o CLI do Supabase), declaramos aqui o que falta e
// cruzamos com o `Database` gerado. Se um dia o `types.ts` for regenerado, basta
// remover as entradas repetidas deste arquivo.
import type { Database, Json } from "./types";

type NovaTabela<Row extends object> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

/** Colunas novas em `financial_payables` (classificação obrigatória). */
type ClassificacaoTitulo = {
  plano_conta_id: string | null;
  centro_custo_id: string | null;
};

type PayablesGerado = Database["public"]["Tables"]["financial_payables"];

type TabelaPayables = {
  Row: PayablesGerado["Row"] & ClassificacaoTitulo;
  Insert: PayablesGerado["Insert"] & Partial<ClassificacaoTitulo>;
  Update: PayablesGerado["Update"] & Partial<ClassificacaoTitulo>;
  Relationships: PayablesGerado["Relationships"];
};

type TabelasNovas = {
  chart_of_accounts: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    codigo: string;
    nome: string;
    tipo: string;
    parent_id: string | null;
    ativo: boolean;
    criado_em: string;
    updated_at: string;
  }>;

  cost_centers: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    codigo: string;
    nome: string;
    descricao: string | null;
    padrao: boolean;
    ativo: boolean;
    criado_em: string;
    updated_at: string;
  }>;

  financial_payable_allocations: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    payable_id: string;
    cost_center_id: string;
    percentual: number | null;
    valor: number | null;
    criado_em: string;
    updated_at: string;
  }>;

  bank_accounts: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    user_id: string;
    codigo_banco: string;
    nome_banco: string;
    agencia: string;
    agencia_dv: string | null;
    conta: string;
    conta_dv: string | null;
    tipo: string;
    moeda: string;
    saldo_inicial: number;
    chave_pix: string | null;
    ativo: boolean;
    integracao_tipo: string;
    integracao_status: string;
    integracao_detalhe: string | null;
    ultima_importacao: string | null;
    criado_em: string;
    updated_at: string;
  }>;

  bank_api_credentials: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    bank_account_id: string;
    provider: string;
    client_id: string | null;
    client_secret: string | null;
    certificado_pfx: string | null;
    certificado_senha: string | null;
    token_oauth: string | null;
    webhook_url: string | null;
    ambiente: string;
    status: string;
    ultimo_erro: string | null;
    sincronizado_em: string | null;
    criado_em: string;
    updated_at: string;
  }>;

  bank_statement_imports: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    bank_account_id: string;
    arquivo_nome: string;
    arquivo_hash: string;
    formato: string;
    linhas: number;
    creditos: number;
    debitos: number;
    periodo_de: string | null;
    periodo_ate: string | null;
    importado_em: string;
    updated_at: string;
  }>;

  bank_statements: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    bank_account_id: string;
    import_id: string | null;
    data: string;
    fitid: string | null;
    historico: string;
    descricao: string | null;
    doc: string | null;
    favorecido: string | null;
    valor: number;
    credito: boolean;
    forma_pagamento: string | null;
    categoria: string | null;
    plano_conta_id: string | null;
    centro_custo_id: string | null;
    conciliado: boolean;
    conciliado_em: string | null;
    payable_id: string | null;
    receivable_id: string | null;
    observacao: string | null;
    criado_em: string;
    updated_at: string;
  }>;

  conciliation_rules: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    nome: string;
    match_tipo: string;
    match_valor: string;
    forma_pagamento: string | null;
    categoria: string | null;
    plano_conta_id: string | null;
    centro_custo_id: string | null;
    prioridade: number;
    ativo: boolean;
    criado_em: string;
    updated_at: string;
  }>;

  bank_portfolios: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
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
    criado_em: string;
    updated_at: string;
  }>;

  bank_charge_documents: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
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
    valor: number;
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
    payload: Json | null;
    criado_em: string;
    updated_at: string;
  }>;

  bank_charge_events: NovaTabela<{
    id: string;
    tenant_key: string;
    branch_id: string | null;
    document_id: string;
    evento: string;
    ambiente: string;
    detalhe: string | null;
    criado_em: string;
    updated_at: string;
  }>;
};

type FuncoesNovas = {
  seed_default_chart_of_accounts: {
    Args: { p_tenant?: string };
    Returns: undefined;
  };
  seed_default_conciliation_rules: {
    Args: { p_tenant?: string };
    Returns: undefined;
  };
  conciliar_lancamento: {
    Args: {
      p_statement_id: string;
      p_payable_id?: string;
      p_receivable_id?: string;
      p_data_pagamento?: string;
      p_forma_pagamento?: string;
    };
    Returns: undefined;
  };
  next_nosso_numero: { Args: never; Returns: string };
  registrar_evento_cobranca: {
    Args: { p_document_id: string; p_evento: string; p_detalhe?: string };
    Returns: undefined;
  };
};

export type AppDatabase = {
  __InternalSupabase: Database["__InternalSupabase"];
  public: {
    Tables: Database["public"]["Tables"] &
      TabelasNovas & {
        financial_payables: TabelaPayables;
      };
    Views: Database["public"]["Views"];
    Functions: Database["public"]["Functions"] & FuncoesNovas;
    Enums: Database["public"]["Enums"];
    CompositeTypes: Database["public"]["CompositeTypes"];
  };
};
