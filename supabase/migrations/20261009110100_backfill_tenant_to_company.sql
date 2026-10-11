-- =============================================================================
-- FASE 1 Ã¢â‚¬â€ Backfill: rÃƒÂ³tulo de texto vira empresa
-- =============================================================================
-- Cada tenant_key distinto que existe hoje se torna uma empresa. Depois, todas
-- as linhas passam a guardar o id dessa empresa em tenant_key.
--
-- A coluna `tenant_key text` ÃƒÂ© mantida de propÃƒÂ³sito: ela vira o cache do
-- company_id, e reescrever apenas o valor (UPDATE em massa) ÃƒÂ© muito mais
-- barato e menos arriscado que trocar o tipo e o nome da coluna em 31 tabelas.
-- A troca definitiva para `company_id uuid` ÃƒÂ© a Fase 2.
--
-- As chaves sÃƒÂ£o coletadas de TODAS as tabelas com tenant_key, nÃƒÂ£o sÃƒÂ³ de uma
-- amostra: uma linha em uma tabela nÃƒÂ£o mapeada ficaria ÃƒÂ³rfÃƒÂ£ e invisÃƒÂ­vel.
-- =============================================================================

CREATE TEMP TABLE IF NOT EXISTS _chaves (chave text PRIMARY KEY) ON COMMIT DROP;
CREATE TEMP TABLE IF NOT EXISTS _mapa_tenant (
  chave       text PRIMARY KEY,
  company_id  uuid NOT NULL
) ON COMMIT DROP;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid;
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

DO $$
DECLARE
  tabelas text[] := ARRAY[
    'app_settings','application_types','battery_cycles','clients','component_catalog',
    'document_alerts','drone_components','drones','equipment','equipment_fuel_refuelings',
    'equipment_maintenance_items','equipment_maintenance_records','equipment_maintenance_schedules',
    'financial_payables','financial_receivables','flight_logs','maintenance_records',
    'maintenance_schedules','nozzle_measurements','operators','orders_of_service','pilots',
    'products','registered_products','service_areas','services','spray_calibrations',
    'spray_mix_recipes','stock_entries','stock_settings','suppliers'
  ];
  t          text;
  reg        record;
  empresa_id uuid;
  nome       text;
  cand       text;
  base       text;
  n          integer;
  criadas    integer := 0;
  resumo     text := '';
BEGIN
  ---------------------------------------------------------------------------
  -- 1) Coleta todas as chaves em uso
  ---------------------------------------------------------------------------
  INSERT INTO _chaves (chave)
    SELECT DISTINCT btrim(p.company) FROM public.profiles p
     WHERE COALESCE(NULLIF(btrim(p.company), ''), '') <> ''
  ON CONFLICT DO NOTHING;

  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format(
      'INSERT INTO _chaves (chave) SELECT DISTINCT btrim(tenant_key) FROM public.%I WHERE tenant_key IS NOT NULL ON CONFLICT DO NOTHING',
      t
    );
  END LOOP;

  DELETE FROM _chaves WHERE chave IS NULL OR chave = '';

  ---------------------------------------------------------------------------
  -- 2) Uma empresa por chave
  ---------------------------------------------------------------------------
  FOR reg IN SELECT c.chave AS chave FROM _chaves c ORDER BY c.chave LOOP
    -- Um rÃƒÂ³tulo no formato de uuid veio do fallback antigo (usuÃƒÂ¡rio sem
    -- empresa). Vira uma empresa homÃƒÂ´nima do prÃƒÂ³prio identificador.
    IF reg.chave ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      nome := 'Empresa ' || left(reg.chave, 8);
    ELSIF reg.chave = 'legacy' THEN
      nome := 'Dados anteriores ÃƒÂ  identificaÃƒÂ§ÃƒÂ£o de empresas';
    ELSE
      nome := reg.chave;
    END IF;

    base := lower(regexp_replace(btrim(nome), '[^a-zA-Z0-9]+', '-', 'g'));
    base := trim(both '-' FROM base);
    IF base = '' THEN
      base := 'empresa';
    END IF;
    base := left(base, 40);

    n := 0;
    cand := base;
    WHILE EXISTS (SELECT 1 FROM public.companies c WHERE c.slug = cand) LOOP
      n := n + 1;
      cand := left(base, 44) || '-' || n::text;
    END LOOP;

    INSERT INTO public.companies (name, slug, status)
    VALUES (nome, cand, 'active')
    RETURNING id INTO empresa_id;

    INSERT INTO _mapa_tenant (chave, company_id) VALUES (reg.chave, empresa_id);

    resumo := resumo || format(E'\n  - "%s" -> %s [%s]', reg.chave, nome, empresa_id);
    criadas := criadas + 1;
  END LOOP;

  ---------------------------------------------------------------------------
  -- 3) Reescreve tenant_key nas 31 tabelas
  ---------------------------------------------------------------------------
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format(
      'UPDATE public.%I e SET tenant_key = m.company_id::text FROM _mapa_tenant m WHERE e.tenant_key = m.chave',
      t
    );
  END LOOP;

  ---------------------------------------------------------------------------
  -- 4) Liga cada perfil ÃƒÂ  empresa correspondente
  ---------------------------------------------------------------------------
  UPDATE public.profiles p
     SET company_id = m.company_id
    FROM _mapa_tenant m
   WHERE btrim(p.company) = m.chave;

  -- profiles.company passa a ser o nome de exibiÃƒÂ§ÃƒÂ£o, espelhado de companies.
  UPDATE public.profiles p
     SET company = c.name
    FROM public.companies c
   WHERE c.id = p.company_id
     AND COALESCE(btrim(p.company), '') <> c.name;

  ---------------------------------------------------------------------------
  -- 5) Matriz de cada empresa + vÃƒÂ­nculo dos usuÃƒÂ¡rios
  ---------------------------------------------------------------------------
  INSERT INTO public.branches (company_id, name, code, is_hq)
  SELECT c.id, 'Matriz', 'MTZ', true
    FROM public.companies c
   WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.company_id = c.id AND b.is_hq);

  INSERT INTO public.user_branches (user_id, branch_id)
  SELECT p.id, b.id
    FROM public.profiles p
    JOIN public.branches b ON b.company_id = p.company_id AND b.is_hq
  ON CONFLICT DO NOTHING;

  RAISE NOTICE E'Fase 1: % empresa(s) criada(s):%', criadas, resumo;
END
$$;