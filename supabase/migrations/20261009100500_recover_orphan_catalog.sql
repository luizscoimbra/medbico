-- =============================================================================
-- FASE 0 — recuperação das linhas órfãs
-- =============================================================================
-- O backfill da Fase 0 deduz o tenant pelo `user_id`. products,
-- registered_products e services guardam `user_id` SEM foreign key, então
-- linhas cujo usuário foi excluído ficaram sem dono e foram parar em
-- 'legacy' — onde ninguém consegue enxergá-las.
--
-- São catálogos (produtos e serviços). Adotamos o mesmo critério usado para os
-- demais catálogos órfãos: o tenant do administrador master mais antigo, que é
-- o dono natural do cadastro de produtos da operação.
-- =============================================================================

UPDATE public.registered_products r
   SET tenant_key = public.legacy_tenant_default()
 WHERE r.tenant_key = 'legacy';

UPDATE public.services s
   SET tenant_key = public.legacy_tenant_default()
 WHERE s.tenant_key = 'legacy';

DO $$
DECLARE
  pendentes bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM public.registered_products WHERE tenant_key = 'legacy') +
    (SELECT count(*) FROM public.services                 WHERE tenant_key = 'legacy')
  INTO pendentes;

  IF pendentes > 0 THEN
    RAISE WARNING 'Fase 0: % linha(s) de catálogo continuam sem dono.', pendentes;
  ELSE
    RAISE NOTICE 'Fase 0: catálogo órfão recuperado para o tenant do administrador master.';
  END IF;
END
$$;

-- Remove a função de diagnóstico.
DROP FUNCTION IF EXISTS public.__audit_legacy_tenants();