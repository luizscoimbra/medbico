-- =============================================================================
-- FINANCEIRO — FRENTE 1
-- Plano de contas estruturado, centros de custo (departamentos) e rateio.
--
-- Regras de negócio cobertas aqui:
--   * Plano de contas em árvore (código hierárquico, tipo despesa/receita).
--   * Cadastro de centros de custo = departamentos/projetos que dividem despesas.
--   * Rateio opcional de um título entre vários departamentos (% ou valor).
--   * Obrigatoriedade: nenhum lançamento de contas a pagar entra sem conta do
--     plano E sem departamento — validado na aplicação e garantido por trigger.
--
-- Padrões do projeto: id text, tenant_key (empresa) + branch_id (filial),
-- RLS com current_tenant_key()/current_branch_ids(), updated_at automático.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Plano de contas (árvore)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id          text PRIMARY KEY,
  tenant_key  text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id   uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  codigo      text NOT NULL,
  nome        text NOT NULL,
  tipo        text NOT NULL DEFAULT 'despesa' CHECK (tipo IN ('despesa', 'receita')),
  parent_id   text REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_key, codigo)
);

COMMENT ON TABLE public.chart_of_accounts IS
  'Plano de contas financeiro em árvore (Despesas > Operacionais > Pessoal...).';

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant ON public.chart_of_accounts(tenant_key);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent  ON public.chart_of_accounts(parent_id);

-- -----------------------------------------------------------------------------
-- 2. Centros de custo / departamentos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id          text PRIMARY KEY,
  tenant_key  text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id   uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  codigo      text NOT NULL,
  nome        text NOT NULL,
  descricao   text,
  padrao      boolean NOT NULL DEFAULT false,
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_key, codigo)
);

COMMENT ON TABLE public.cost_centers IS
  'Departamentos/projetos usados como divisor das despesas (rateio e relatórios).';
COMMENT ON COLUMN public.cost_centers.padrao IS
  'Departamento usado quando a origem do título não permite escolha manual (manutenções automáticas, importação legada).';

CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant ON public.cost_centers(tenant_key);

-- -----------------------------------------------------------------------------
-- 3. Classificação do lançamento (obrigatória) em contas a pagar
-- -----------------------------------------------------------------------------
ALTER TABLE public.financial_payables
  ADD COLUMN IF NOT EXISTS plano_conta_id   text REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS centro_custo_id  text REFERENCES public.cost_centers(id)      ON DELETE RESTRICT;

COMMENT ON COLUMN public.financial_payables.plano_conta_id  IS 'Conta do plano de contas — obrigatória.';
COMMENT ON COLUMN public.financial_payables.centro_custo_id IS 'Departamento/centro de custo — obrigatório.';

CREATE INDEX IF NOT EXISTS idx_payables_plano_conta   ON public.financial_payables(plano_conta_id);
CREATE INDEX IF NOT EXISTS idx_payables_centro_custo  ON public.financial_payables(centro_custo_id);

-- -----------------------------------------------------------------------------
-- 4. Rateio entre departamentos (opcional)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_payable_allocations (
  id                text PRIMARY KEY,
  tenant_key        text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id         uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  payable_id        text NOT NULL REFERENCES public.financial_payables(id) ON DELETE CASCADE,
  cost_center_id    text NOT NULL REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  percentual        numeric(9, 4),
  valor             numeric(14, 2),
  criado_em         timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.financial_payable_allocations IS
  'Rateio de um título a pagar entre departamentos (percentual ou valor). '
  'Sem linhas aqui o título é 100% do centro de custo do próprio título.';

CREATE INDEX IF NOT EXISTS idx_payable_allocations_payable ON public.financial_payable_allocations(payable_id);
CREATE INDEX IF NOT EXISTS idx_payable_allocations_tenant  ON public.financial_payable_allocations(tenant_key);

-- -----------------------------------------------------------------------------
-- 5. Seed do plano de contas padrão (árvore de exemplo, editável)
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
BEGIN
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

REVOKE ALL ON FUNCTION public.seed_default_chart_of_accounts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_chart_of_accounts(text) TO authenticated;

COMMENT ON FUNCTION public.seed_default_chart_of_accounts(text) IS
  'Cria a árvore padrão do plano de contas quando a empresa ainda não tem nenhuma conta.';

-- -----------------------------------------------------------------------------
-- 6. Obrigatoriedade no lançamento (trigger)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_payable_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.centro_custo_id IS NULL THEN
    RAISE EXCEPTION 'Lançamento sem departamento: selecione o centro de custo antes de salvar o título nº %.', NEW.numero
      USING ERRCODE = '23514';
  END IF;

  IF NEW.plano_conta_id IS NULL THEN
    RAISE EXCEPTION 'Lançamento sem conta do plano de contas: classifique o título nº %.', NEW.numero
      USING ERRCODE = '23514';
  END IF;

  -- Existência + dono: a interface já filtra inativos na hora de escolher.
  -- Não checa `ativo` aqui para que títulos legados classificados em um
  -- departamento já desativado continuem editáveis.
  IF NOT EXISTS (
    SELECT 1 FROM public.cost_centers c
     WHERE c.id = NEW.centro_custo_id
       AND c.tenant_key = NEW.tenant_key
  ) THEN
    RAISE EXCEPTION 'Centro de custo inexistente para este título nº %.', NEW.numero
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts a
     WHERE a.id = NEW.plano_conta_id
       AND a.tenant_key = NEW.tenant_key
  ) THEN
    RAISE EXCEPTION 'Conta do plano de contas inexistente para o título nº %.', NEW.numero
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payable_classification ON public.financial_payables;
CREATE TRIGGER trg_enforce_payable_classification
  BEFORE INSERT OR UPDATE ON public.financial_payables
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payable_classification();

-- -----------------------------------------------------------------------------
-- 7. Rateio
--    A soma do rateio é validada pela aplicação em uma única transação
--    (apagar as linhas antigas e gravar as novas de uma vez): uma trigger por
--    linha não serve aqui, porque ela enxergaria o rateio pela metade no meio
--    da gravação e reprovaria títulos com 3 ou mais departamentos.
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 8. Backfill dos lançamentos que já existem
--    (senão a trigger nova bloquearia a edição dos títulos legados)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_tenant text;
BEGIN
  FOR v_tenant IN
    SELECT DISTINCT tenant_key FROM public.financial_payables
     WHERE centro_custo_id IS NULL OR plano_conta_id IS NULL
  LOOP
    -- departamento de destino para o legado, marcado como padrão do tenant
    INSERT INTO public.cost_centers (id, tenant_key, codigo, nome, descricao, padrao, ativo)
    VALUES (
      'cc-nao-class-' || md5(v_tenant),
      v_tenant,
      'NAO-CLASSIFICADO',
      'Não classificado',
      'Departamento usado em lançamentos anteriores ao cadastro de centros de custo.',
      true,
      false
    )
    ON CONFLICT (tenant_key, codigo) DO NOTHING;

    -- plano de contas padrão, para poder vincular os títulos legados
    PERFORM public.seed_default_chart_of_accounts(v_tenant);

    -- Uma única instrução: a trigger recém-criada só aprova a linha quando
    -- departamento e conta já estão preenchidos ao mesmo tempo.
    UPDATE public.financial_payables p
       SET centro_custo_id = COALESCE(p.centro_custo_id, 'cc-nao-class-' || md5(v_tenant)),
           plano_conta_id = COALESCE(
             p.plano_conta_id,
             (SELECT a.id FROM public.chart_of_accounts a
               WHERE a.tenant_key = p.tenant_key
                 AND a.tipo = 'despesa'
                 AND lower(a.nome) = lower(CASE p.categoria
                         WHEN 'Outros' THEN 'Outras Despesas'
                         ELSE p.categoria
                       END)
               ORDER BY a.codigo LIMIT 1),
             (SELECT a.id FROM public.chart_of_accounts a
               WHERE a.tenant_key = p.tenant_key AND a.codigo = '1.9' LIMIT 1),
             (SELECT a.id FROM public.chart_of_accounts a
               WHERE a.tenant_key = p.tenant_key AND a.tipo = 'despesa'
               ORDER BY a.codigo LIMIT 1)
           )
     WHERE p.tenant_key = v_tenant
       AND (p.centro_custo_id IS NULL OR p.plano_conta_id IS NULL);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- 9. RLS + updated_at
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  antiga text;
BEGIN
  FOREACH t IN ARRAY ARRAY['chart_of_accounts', 'cost_centers', 'financial_payable_allocations']
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
