-- =============================================================================
-- Limpeza do ambiente de QA da Fase 1
-- =============================================================================
DELETE FROM auth.users WHERE email = 'qa.fase1@exemplo.invalido';

-- A empresa e a filial da conta de teste saem por cascata (auth.users ->
-- profiles -> company_id é ON DELETE RESTRICT no companies, então são
-- removidas explicitamente, na ordem inversa da criação).
DO $$
DECLARE
  e uuid;
BEGIN
  FOR e IN
    SELECT c.id FROM public.companies c
     WHERE c.slug = 'fazenda-beta'
       AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id = c.id)
  LOOP
    DELETE FROM public.branches   WHERE company_id = e;
    DELETE FROM public.invites    WHERE company_id = e;
    DELETE FROM public.companies  WHERE id = e;
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS public.__audit_phase1();

DO $$
DECLARE
  empresas integer;
  perfis   integer;
BEGIN
  SELECT count(*) INTO empresas FROM public.companies;
  SELECT count(*) INTO perfis FROM public.profiles;
  RAISE NOTICE 'Fase 1 validada. Empresas: %. Perfis: %.', empresas, perfis;
END
$$;