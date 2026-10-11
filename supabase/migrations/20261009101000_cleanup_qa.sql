-- =============================================================================
-- Limpeza do ambiente de QA
-- =============================================================================
-- Remove a conta criada por SQL para validar a cadeia de isolamento
-- (cadastro -> empresa isolada -> master -> RLS), os dados que ela criou e a
-- função de auditoria temporária.
-- =============================================================================

DELETE FROM public.clients WHERE id = 'qa-cliente-001';

DELETE FROM auth.users WHERE email = 'qa.fase0@exemplo.invalido';

DROP FUNCTION IF EXISTS public.__audit_profiles();

DO $$
DECLARE
  restantes integer;
BEGIN
  SELECT count(*) INTO restantes FROM auth.users WHERE email = 'qa.fase0@exemplo.invalido';
  IF restantes = 0 THEN
    RAISE NOTICE 'Ambiente de QA removido.';
  ELSE
    RAISE WARNING 'Conta de QA ainda existe.';
  END IF;
END
$$;