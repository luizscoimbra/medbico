-- =============================================================================
-- Limpeza do cenário de QA da Fase 2
-- =============================================================================
DELETE FROM auth.users WHERE email IN ('qa.fase2@exemplo.invalido', 'qa.fase2.interior@exemplo.invalido');

DO $$
DECLARE
  e uuid;
BEGIN
  FOR e IN
    SELECT c.id FROM public.companies c
     WHERE c.slug IN ('grupo-gamma', 'grupo-gamma-1')
       AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id = c.id)
  LOOP
    DELETE FROM public.branches        WHERE company_id = e;
    DELETE FROM public.invites         WHERE company_id = e;
    DELETE FROM public.stock_settings  WHERE tenant_key = e::text;
    DELETE FROM public.companies       WHERE id = e;
  END LOOP;
END
$$;

DO $$
DECLARE
  empresas integer;
  perfis   integer;
  notas    integer;
BEGIN
  SELECT count(*) INTO empresas FROM public.companies;
  SELECT count(*) INTO perfis   FROM public.profiles;
  SELECT count(*) INTO notas    FROM public.stock_entries;
  RAISE NOTICE 'Fase 2 validada. Empresas: %. Perfis: %. Movimentacoes de estoque: %.',
    empresas, perfis, notas;
END
$$;