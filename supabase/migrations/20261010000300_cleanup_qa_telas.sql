-- =============================================================================
-- Limpeza do cenário de QA das telas
-- =============================================================================
DELETE FROM auth.users WHERE email IN ('qa.telas@exemplo.invalido', 'qa.plataforma@exemplo.invalido');

DO $$
DECLARE
  e uuid;
BEGIN
  FOR e IN
    SELECT c.id FROM public.companies c
     WHERE c.slug IN ('agro-delta', 'agro-delta-1')
       AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id = c.id)
  LOOP
    DELETE FROM public.branches       WHERE company_id = e;
    DELETE FROM public.invites        WHERE company_id = e;
    DELETE FROM public.stock_settings WHERE tenant_key = e::text;
    DELETE FROM public.companies      WHERE id = e;
  END LOOP;
END
$$;

DO $$
DECLARE
  empresas integer;
  filiais  integer;
BEGIN
  SELECT count(*) INTO empresas FROM public.companies;
  SELECT count(*) INTO filiais  FROM public.branches;
  RAISE NOTICE 'Cenas validadas. Empresas: %. Filiais: %.', empresas, filiais;
END
$$;