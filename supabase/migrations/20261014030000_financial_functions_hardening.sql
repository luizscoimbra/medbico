-- =============================================================================
-- FINANCEIRO — ENDURECIMENTO DAS FUNÇÕES NOVAS
--
-- Durante a aplicação das migrações anteriores ficou claro que o ACL padrão do
-- Supabase dá EXECUTE em funções de `public` para o papel `anon`: o revoke era
-- apenas `FROM PUBLIC`, que não remove a permissão explícita de `anon`.
--
-- Consequências corrigidas aqui:
--   * `next_nosso_numero()` era chamável sem login e avançava a sequência.
--   * `conciliar_lancamento()`/`registrar_evento_cobranca()` têm comparação
--     `v_tenant <> current_tenant_key()` que vira NULL quando a sessão é
--     anônima — a condição falhava em "falso" e o corpo seguia executando.
--     Como as funções são SECURITY DEFINER (dono `postgres`, sem RLS), isso
--     era um caminho de escrita cruzada sem sessão.
--   * As funções de semente aceitavam `p_tenant` explícito de qualquer usuário
--     autenticado (sementear a árvore/contas de outra empresa).
--
-- A trilha de volta (migração de backfill) roda como `postgres`, sem usuário
-- autenticado: por isso a trava de semente só age quando há tenant na sessão.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Trava de sessão na conciliação e na trilha de cobrança
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
  v_sessao text;
BEGIN
  v_sessao := public.current_tenant_key();

  SELECT tenant_key INTO v_tenant
    FROM public.bank_statements
   WHERE id = p_statement_id;

  -- v_sessao NULL = sem sessão autenticada: nesse caso não há nada a conciliar.
  IF v_sessao IS NULL OR v_tenant IS NULL OR v_tenant <> v_sessao THEN
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
  v_sessao text;
  v_status text;
  v_receivable_id text;
  v_vencimento date;
  v_valor numeric;
  v_ambiente text;
BEGIN
  v_sessao := public.current_tenant_key();

  SELECT tenant_key, status, receivable_id, vencimento, valor, ambiente
    INTO v_tenant, v_status, v_receivable_id, v_vencimento, v_valor, v_ambiente
    FROM public.bank_charge_documents
   WHERE id = p_document_id;

  IF v_sessao IS NULL OR v_tenant IS NULL OR v_tenant <> v_sessao THEN
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

-- -----------------------------------------------------------------------------
-- 2. Sementes: só a própria empresa (a chamada de migração roda sem sessão)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_chart_of_accounts(p_tenant text DEFAULT public.current_tenant_key())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_codigo text;
  v_nome   text;
  v_tipo   text;
  v_parent text;
  v_parent_id text;
  v_sessao text;
BEGIN
  v_sessao := public.current_tenant_key();
  IF v_sessao IS NOT NULL AND p_tenant IS DISTINCT FROM v_sessao THEN
    RAISE EXCEPTION 'Semente do plano de contas restrita à empresa da sessão.';
  END IF;
  IF p_tenant IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
    FROM public.chart_of_accounts
   WHERE tenant_key = p_tenant;

  -- Só semeia a primeira vez: depois disso o plano é do usuário.
  IF v_count > 0 THEN
    RETURN;
  END IF;

  FOR v_codigo, v_nome, v_tipo, v_parent IN
    SELECT * FROM (VALUES
      ('1',     'Despesas',                     'despesa', NULL::text),
      ('1.1',   'Despesas Operacionais',        'despesa', '1'),
      ('1.1.1', 'Insumos',                      'despesa', '1.1'),
      ('1.1.2', 'Manutenção',                   'despesa', '1.1'),
      ('1.1.3', 'Combustível',                  'despesa', '1.1'),
      ('1.1.4', 'Serviços',                     'despesa', '1.1'),
      ('1.1.5', 'Pessoal',                      'despesa', '1.1'),
      ('1.1.6', 'Aluguel',                      'despesa', '1.1'),
      ('1.2',   'Despesas Financeiras',         'despesa', '1'),
      ('1.3',   'Despesas Tributárias',         'despesa', '1'),
      ('1.3.1', 'Impostos',                     'despesa', '1.3'),
      ('1.4',   'Despesas Administrativas',     'despesa', '1'),
      ('1.9',   'Outras Despesas',              'despesa', '1'),
      ('2',     'Receitas',                     'receita', NULL::text),
      ('2.1',   'Receitas Operacionais',        'receita', '2'),
      ('2.1.1', 'Serviços Prestados',           'receita', '2.1'),
      ('2.1.2', 'Venda de Produtos',            'receita', '2.1'),
      ('2.9',   'Outras Receitas',              'receita', '2')
    ) AS s(codigo, nome, tipo, parent)
  LOOP
    v_parent_id := CASE
      WHEN v_parent IS NULL THEN NULL
      ELSE 'ca-' || md5(p_tenant || v_parent)
    END;

    INSERT INTO public.chart_of_accounts (id, tenant_key, codigo, nome, tipo, parent_id)
    VALUES ('ca-' || md5(p_tenant || v_codigo), p_tenant, v_codigo, v_nome, v_tipo, v_parent_id)
    ON CONFLICT (tenant_key, codigo) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_default_conciliation_rules(p_tenant text DEFAULT public.current_tenant_key())
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sessao text;
BEGIN
  v_sessao := public.current_tenant_key();
  IF v_sessao IS NOT NULL AND p_tenant IS DISTINCT FROM v_sessao THEN
    RAISE EXCEPTION 'Semente de regras de conciliação restrita à empresa da sessão.';
  END IF;
  IF p_tenant IS NULL THEN
    RETURN;
  END IF;

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

-- -----------------------------------------------------------------------------
-- 3. ACL: EXECUTE só para quem tem sessão (o revoke de PUBLIC não cobre anon)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.seed_default_chart_of_accounts(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seed_default_conciliation_rules(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conciliar_lancamento(text, text, text, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_evento_cobranca(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.next_nosso_numero() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.seed_default_chart_of_accounts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_conciliation_rules(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conciliar_lancamento(text, text, text, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_evento_cobranca(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_nosso_numero() TO authenticated;
