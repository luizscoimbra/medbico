-- =============================================================================
-- FINANCEIRO — FRENTE 3
-- Emissão de boletos com QR Code Pix (boleto híbrido).
--
-- Regras de negócio cobertas aqui:
--   * Carteira de cobrança registrada junto ao banco (convênio, código da
--     carteira, chave Pix vinculada, ambiente e status de homologação).
--   * Credenciais de API do banco vivem em bank_api_credentials (Frente 2).
--   * Documento de cobrança guarda linha digitável, código de barras e o BR
--     Code Pix (QR Code), além do vínculo com o título a receber.
--   * Trilha de auditoria de emissão/baixa — é o que o banco cobra na
--     homologação (testes de emissão e baixa pelo sistema).
--
-- Padrões do projeto: id text, tenant_key + branch_id, RLS, updated_at.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Carteira de cobrança
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_portfolios (
  id                 text PRIMARY KEY,
  tenant_key         text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id          uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  bank_account_id    text NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  nome               text NOT NULL,
  carteira_codigo    text NOT NULL,
  convenio           text,
  modalidade         text NOT NULL DEFAULT 'hibrido'
                       CHECK (modalidade IN ('boleto', 'hibrido')),
  aceita_qr_pix      boolean NOT NULL DEFAULT true,
  chave_pix          text,
  ambiente           text NOT NULL DEFAULT 'homologacao'
                       CHECK (ambiente IN ('homologacao', 'producao')),
  status_homologacao text NOT NULL DEFAULT 'pendente'
                       CHECK (status_homologacao IN ('pendente', 'homologado', 'reprovado')),
  registro_remoto    boolean NOT NULL DEFAULT true,
  ativo              boolean NOT NULL DEFAULT true,
  observacao         text,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bank_portfolios IS
  'Carteira de cobrança registrada no banco — nem toda carteira aceita QR Code Pix (Cobrança Pix).';
COMMENT ON COLUMN public.bank_portfolios.modalidade IS
  'hibrido = boleto com QR Code Pix; boleto = apenas código de barras tradicional.';
COMMENT ON COLUMN public.bank_portfolios.ambiente IS
  'homologação é obrigatória antes de liberar a produção junto ao banco.';
COMMENT ON COLUMN public.bank_portfolios.chave_pix IS
  'Chave Pix da conta emissora (CNPJ/e-mail) — deve pertencer à mesma conta da carteira.';

CREATE INDEX IF NOT EXISTS idx_bank_portfolios_tenant  ON public.bank_portfolios(tenant_key);
CREATE INDEX IF NOT EXISTS idx_bank_portfolios_account ON public.bank_portfolios(bank_account_id);

-- -----------------------------------------------------------------------------
-- 2. Sequência do nosso número
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.bank_charge_documents_seq;

CREATE OR REPLACE FUNCTION public.next_nosso_numero()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT lpad(nextval('public.bank_charge_documents_seq')::text, 9, '0')
$$;

REVOKE ALL ON FUNCTION public.next_nosso_numero() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_nosso_numero() TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Documentos de cobrança (boletos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_charge_documents (
  id                text PRIMARY KEY,
  tenant_key        text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id         uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  receivable_id     text REFERENCES public.financial_receivables(id) ON DELETE SET NULL,
  bank_account_id   text NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  portfolio_id      text NOT NULL REFERENCES public.bank_portfolios(id) ON DELETE RESTRICT,
  numero_documento  text NOT NULL,
  nosso_numero      text NOT NULL,
  beneficiario_nome     text NOT NULL DEFAULT '',
  beneficiario_documento text,
  sacado_nome       text NOT NULL DEFAULT '',
  sacado_documento  text,
  sacado_endereco   text,
  sacado_cidade     text,
  valor             numeric(14, 2) NOT NULL DEFAULT 0 CHECK (valor > 0),
  vencimento        date NOT NULL,
  especie           text NOT NULL DEFAULT 'DM',
  aceite            text NOT NULL DEFAULT 'N' CHECK (aceite IN ('S', 'N')),
  instrucoes        text,
  linha_digitavel   text NOT NULL DEFAULT '',
  codigo_barras     text NOT NULL DEFAULT '',
  qr_code_pix       text NOT NULL DEFAULT '',
  qr_code_modo      text NOT NULL DEFAULT 'estatico'
                      CHECK (qr_code_modo IN ('estatico', 'dinamico')),
  geracao           text NOT NULL DEFAULT 'local'
                      CHECK (geracao IN ('local', 'banco')),
  status            text NOT NULL DEFAULT 'emitido'
                      CHECK (status IN ('rascunho', 'emitido', 'pago', 'cancelado')),
  ambiente          text NOT NULL DEFAULT 'homologacao'
                      CHECK (ambiente IN ('homologacao', 'producao')),
  emitido_em        timestamptz,
  payload           jsonb,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, nosso_numero)
);

COMMENT ON TABLE public.bank_charge_documents IS
  'Boletos emitidos: linha digitável, código de barras e QR Code Pix (híbrido).';
COMMENT ON COLUMN public.bank_charge_documents.qr_code_modo IS
  'dinamico exige a API do banco (Cobrança Pix); estatico é gerado localmente pela chave Pix.';
COMMENT ON COLUMN public.bank_charge_documents.geracao IS
  'local = calculado pelo sistema; banco = devolvido pela API do banco.';

CREATE INDEX IF NOT EXISTS idx_charge_documents_tenant    ON public.bank_charge_documents(tenant_key);
CREATE INDEX IF NOT EXISTS idx_charge_documents_receivable ON public.bank_charge_documents(receivable_id);
CREATE INDEX IF NOT EXISTS idx_charge_documents_status    ON public.bank_charge_documents(tenant_key, status);
CREATE INDEX IF NOT EXISTS idx_charge_documents_venc      ON public.bank_charge_documents(vencimento);

-- -----------------------------------------------------------------------------
-- 4. Trilha de auditoria (exigida na homologação)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_charge_events (
  id           text PRIMARY KEY,
  tenant_key   text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id    uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  document_id  text NOT NULL REFERENCES public.bank_charge_documents(id) ON DELETE CASCADE,
  evento       text NOT NULL
                 CHECK (evento IN ('emitido', 'registrado', 'baixado', 'cancelado', 'homologado', 'erro')),
  ambiente     text NOT NULL DEFAULT 'homologacao',
  detalhe      text,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charge_events_document ON public.bank_charge_events(document_id);

-- -----------------------------------------------------------------------------
-- 5. Baixa automática do título a receber quando o boleto/Pix liquidar
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_evento_cobranca(
  p_document_id text,
  p_evento      text,
  p_detalhe     text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant text;
  v_status text;
  v_receivable_id text;
  v_vencimento date;
  v_valor numeric;
  v_ambiente text;
BEGIN
  SELECT tenant_key, status, receivable_id, vencimento, valor, ambiente
    INTO v_tenant, v_status, v_receivable_id, v_vencimento, v_valor, v_ambiente
    FROM public.bank_charge_documents
   WHERE id = p_document_id;

  IF v_tenant IS NULL OR v_tenant <> public.current_tenant_key() THEN
    RAISE EXCEPTION 'Documento de cobrança não encontrado.';
  END IF;

  INSERT INTO public.bank_charge_events (id, tenant_key, document_id, evento, ambiente, detalhe)
  VALUES ('ce-' || md5(p_document_id || p_evento || clock_timestamp()::text),
          v_tenant, p_document_id, p_evento, v_ambiente, p_detalhe);

  IF p_evento = 'baixado' THEN
    UPDATE public.bank_charge_documents SET status = 'pago' WHERE id = p_document_id;

    IF v_receivable_id IS NOT NULL THEN
      UPDATE public.financial_receivables
         SET status = 'pago',
             data_pagamento = CURRENT_DATE,
             forma_pagamento = 'Boleto',
             updated_at = now()
       WHERE id = v_receivable_id AND tenant_key = v_tenant AND status = 'aberto';
    END IF;
  ELSIF p_evento = 'cancelado' THEN
    UPDATE public.bank_charge_documents SET status = 'cancelado' WHERE id = p_document_id;
  ELSIF p_evento = 'emitido' THEN
    UPDATE public.bank_charge_documents
       SET status = 'emitido',
           emitido_em = COALESCE(emitido_em, now())
     WHERE id = p_document_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_evento_cobranca(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_evento_cobranca(text, text, text) TO authenticated;

COMMENT ON FUNCTION public.registrar_evento_cobranca(text, text, text) IS
  'Registra o evento de cobrança (emissão, registro, baixa) e dá baixa no título a receber.';

-- -----------------------------------------------------------------------------
-- 6. RLS + updated_at
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  antiga text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bank_portfolios', 'bank_charge_documents', 'bank_charge_events']
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
