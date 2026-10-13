-- =============================================================================
-- FINANCEIRO — FRENTE 2
-- Cadastro de bancos, importação de OFX e conciliação bancária.
--
-- Regras de negócio cobertas aqui:
--   * Conta bancária com dados FEBRABAN (banco, agência, conta, dígito) e
--     parâmetros de integração (API / Open Banking) com status de conexão.
--   * Credenciais ficam em tabela própria: a listagem de contas nunca devolve
--     client_secret, certificado ou token.
--   * Importação de extrato em OFX, idempotente por hash de arquivo.
--   * Lançamentos do extrato guardam a ligação com o título baixado.
--   * Regras de categorização padrão (Pix, TED, Boleto, Cartão) usadas para
--     cruzar extrato × títulos automaticamente.
--
-- Padrões do projeto: id text, tenant_key + branch_id, RLS, updated_at.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Contas bancárias
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id                 text PRIMARY KEY,
  tenant_key         text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id          uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id            uuid NOT NULL DEFAULT auth.uid(),
  codigo_banco       text NOT NULL CHECK (codigo_banco ~ '^[0-9]{3}$'),
  nome_banco         text NOT NULL,
  agencia            text NOT NULL,
  agencia_dv         text,
  conta              text NOT NULL,
  conta_dv           text,
  tipo               text NOT NULL DEFAULT 'corrente'
                       CHECK (tipo IN ('corrente', 'poupanca', 'caixa', 'pagamento')),
  moeda              text NOT NULL DEFAULT 'BRL',
  saldo_inicial      numeric(14, 2) NOT NULL DEFAULT 0,
  chave_pix          text,
  ativo              boolean NOT NULL DEFAULT true,
  integracao_tipo    text NOT NULL DEFAULT 'nenhuma'
                       CHECK (integracao_tipo IN ('nenhuma', 'ofx', 'api', 'open_banking')),
  integracao_status  text NOT NULL DEFAULT 'desconectado'
                       CHECK (integracao_status IN ('desconectado', 'pendente', 'conectado', 'erro')),
  integracao_detalhe text,
  ultima_importacao  timestamptz,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bank_accounts IS
  'Contas bancárias da empresa: dados básicos, credenciais de integração (status) e saldo inicial.';
COMMENT ON COLUMN public.bank_accounts.integracao_tipo IS
  'ofx = importação manual do extrato; api/open_banking = integração automática com a instituição.';
COMMENT ON COLUMN public.bank_accounts.codigo_banco IS 'Código FEBRABAN de 3 dígitos (341 = Itaú, 033 = Santander...).';

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON public.bank_accounts(tenant_key);

-- -----------------------------------------------------------------------------
-- 2. Credenciais de integração (write-only na interface)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_api_credentials (
  id               text PRIMARY KEY,
  tenant_key       text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id        uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  bank_account_id  text NOT NULL UNIQUE REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  provider         text NOT NULL DEFAULT 'outro',
  client_id        text,
  client_secret    text,
  certificado_pfx  text,
  certificado_senha text,
  token_oauth      text,
  webhook_url      text,
  ambiente         text NOT NULL DEFAULT 'homologacao'
                     CHECK (ambiente IN ('homologacao', 'producao')),
  status           text NOT NULL DEFAULT 'desconectado'
                     CHECK (status IN ('desconectado', 'pendente', 'conectado', 'erro')),
  ultimo_erro      text,
  sincronizado_em  timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bank_api_credentials IS
  'Chaves de integração fornecidas pelo banco (Client ID/Secret, certificado .pfx, OAuth). '
  'Nunca devem ser selecionadas integralmente na interface — exibir apenas "configurado".';
COMMENT ON COLUMN public.bank_api_credentials.ambiente IS
  'homologação = testes de emissão/baixa exigidos pelo banco antes da produção.';

CREATE INDEX IF NOT EXISTS idx_bank_credentials_tenant ON public.bank_api_credentials(tenant_key);

-- -----------------------------------------------------------------------------
-- 3. Imports de extrato (OFX)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id               text PRIMARY KEY,
  tenant_key       text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id        uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  bank_account_id  text NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  arquivo_nome     text NOT NULL,
  arquivo_hash     text NOT NULL,
  formato          text NOT NULL DEFAULT 'ofx' CHECK (formato IN ('ofx')),
  linhas           integer NOT NULL DEFAULT 0,
  creditos         numeric(14, 2) NOT NULL DEFAULT 0,
  debitos          numeric(14, 2) NOT NULL DEFAULT 0,
  periodo_de       date,
  periodo_ate      date,
  importado_em     timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_key, bank_account_id, arquivo_hash)
);

COMMENT ON TABLE public.bank_statement_imports IS
  'Cabeçalho de cada arquivo de extrato importado — o hash impede reimportar o mesmo arquivo.';

-- -----------------------------------------------------------------------------
-- 4. Lançamentos do extrato
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id                text PRIMARY KEY,
  tenant_key        text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id         uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  bank_account_id   text NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  import_id         text REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  data              date NOT NULL,
  fitid             text,
  historico         text NOT NULL DEFAULT '',
  descricao         text,
  doc               text,
  favorecido        text,
  valor             numeric(14, 2) NOT NULL,
  credito           boolean NOT NULL DEFAULT false,
  forma_pagamento   text,
  categoria         text,
  plano_conta_id    text REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  centro_custo_id   text REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  conciliado        boolean NOT NULL DEFAULT false,
  conciliado_em     timestamptz,
  payable_id        text REFERENCES public.financial_payables(id) ON DELETE SET NULL,
  receivable_id     text REFERENCES public.financial_receivables(id) ON DELETE SET NULL,
  observacao        text,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bank_statements IS
  'Movimentos do extrato bancário (OFX ou manuais) já classificados e conciliados.';
COMMENT ON COLUMN public.bank_statements.fitid IS
  'ID do lançamento no arquivo OFX — chave de idempência contra reimportação.';
COMMENT ON COLUMN public.bank_statements.payable_id IS
  'Título a pagar baixado por este movimento (conciliação).';
COMMENT ON COLUMN public.bank_statements.receivable_id IS
  'Título a receber liquidado por este movimento (conciliação).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statements_fitid
  ON public.bank_statements(bank_account_id, fitid) WHERE fitid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_statements_account   ON public.bank_statements(bank_account_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_bank_statements_tenant    ON public.bank_statements(tenant_key);
CREATE INDEX IF NOT EXISTS idx_bank_statements_pendente  ON public.bank_statements(tenant_key, conciliado);
CREATE INDEX IF NOT EXISTS idx_bank_statements_payable   ON public.bank_statements(payable_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_receivable ON public.bank_statements(receivable_id);

-- -----------------------------------------------------------------------------
-- 5. Regras de categorização padrão
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conciliation_rules (
  id               text PRIMARY KEY,
  tenant_key       text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id        uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  nome             text NOT NULL,
  match_tipo       text NOT NULL
                     CHECK (match_tipo IN ('historico_contem', 'historico_igual', 'favorecido_contem', 'doc_igual')),
  match_valor      text NOT NULL,
  forma_pagamento  text,
  categoria        text,
  plano_conta_id   text REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
  centro_custo_id  text REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  prioridade       integer NOT NULL DEFAULT 100,
  ativo            boolean NOT NULL DEFAULT true,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.conciliation_rules IS
  'Regras que classificam automaticamente os lançamentos do extrato '
  '(ex.: histórico contém "PIX" → forma Pix e conta de receita).';

CREATE INDEX IF NOT EXISTS idx_conciliation_rules_tenant ON public.conciliation_rules(tenant_key);

-- -----------------------------------------------------------------------------
-- 6. Seed de regras padrão (formas de pagamento)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_conciliation_rules(p_tenant text DEFAULT public.current_tenant_key())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.conciliation_rules WHERE tenant_key = p_tenant) THEN
    RETURN;
  END IF;

  INSERT INTO public.conciliation_rules
    (id, tenant_key, nome, match_tipo, match_valor, forma_pagamento, prioridade)
  VALUES
    ('cr-' || md5(p_tenant || 'pix'),    p_tenant, 'Pix',        'historico_contem', 'PIX',   'Pix',        10),
    ('cr-' || md5(p_tenant || 'ted'),    p_tenant, 'TED',        'historico_contem', 'TED',   'Transferência', 20),
    ('cr-' || md5(p_tenant || 'doc'),    p_tenant, 'DOC',        'historico_contem', 'DOC',   'Transferência', 25),
    ('cr-' || md5(p_tenant || 'boleto'), p_tenant, 'Boleto',     'historico_contem', 'BOLETO', 'Boleto',    30),
    ('cr-' || md5(p_tenant || 'cartao'), p_tenant, 'Cartão',     'historico_contem', 'CARTAO', 'Cartão',    40),
    ('cr-' || md5(p_tenant || 'cheque'), p_tenant, 'Cheque',     'historico_contem', 'CHEQUE', 'Cheque',    50)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_conciliation_rules(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_conciliation_rules(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Baixa conciliada: marca o título como pago junto com o lançamento
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.conciliar_lancamento(
  p_statement_id text,
  p_payable_id   text DEFAULT NULL,
  p_receivable_id text DEFAULT NULL,
  p_data_pagamento date DEFAULT NULL,
  p_forma_pagamento text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant text;
BEGIN
  SELECT tenant_key INTO v_tenant
    FROM public.bank_statements
   WHERE id = p_statement_id;

  IF v_tenant IS NULL OR v_tenant <> public.current_tenant_key() THEN
    RAISE EXCEPTION 'Lançamento do extrato não encontrado.';
  END IF;

  UPDATE public.bank_statements
     SET conciliado = true,
         conciliado_em = now(),
         payable_id = COALESCE(p_payable_id, payable_id),
         receivable_id = COALESCE(p_receivable_id, receivable_id),
         forma_pagamento = COALESCE(p_forma_pagamento, forma_pagamento)
   WHERE id = p_statement_id;

  IF p_payable_id IS NOT NULL THEN
    UPDATE public.financial_payables
       SET status = 'pago',
           data_pagamento = COALESCE(p_data_pagamento, CURRENT_DATE),
           forma_pagamento = COALESCE(p_forma_pagamento, forma_pagamento),
           updated_at = now()
     WHERE id = p_payable_id
       AND tenant_key = v_tenant
       AND status = 'aberto';
  END IF;

  IF p_receivable_id IS NOT NULL THEN
    UPDATE public.financial_receivables
       SET status = 'pago',
           data_pagamento = COALESCE(p_data_pagamento, CURRENT_DATE),
           forma_pagamento = COALESCE(p_forma_pagamento, forma_pagamento),
           updated_at = now()
     WHERE id = p_receivable_id
       AND tenant_key = v_tenant
       AND status = 'aberto';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.conciliar_lancamento(text, text, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conciliar_lancamento(text, text, text, date, text) TO authenticated;

COMMENT ON FUNCTION public.conciliar_lancamento(text, text, text, date, text) IS
  'Concilia um movimento do extrato com um título e dá baixa nele em uma única transação.';

-- -----------------------------------------------------------------------------
-- 8. RLS + updated_at
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  antiga text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bank_accounts', 'bank_api_credentials', 'bank_statement_imports',
    'bank_statements', 'conciliation_rules'
  ]
  LOOP
    FOR antiga IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', antiga, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (tenant_key = public.current_tenant_key() AND (branch_id IS NULL OR branch_id = ANY(public.current_branch_ids()))) WITH CHECK (tenant_key = public.current_tenant_key() AND (branch_id IS NULL OR branch_id = ANY(public.current_branch_ids())))',
      'Tenant and branch can manage ' || t, t
    );

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'touch_' || t || '_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      'touch_' || t || '_updated_at', t
    );
  END LOOP;
END
$$;
