-- =============================================================================
-- Correção: abastecimentos órfãos do bucket 'legacy'
-- =============================================================================
-- A migração 20261009090800 (tenant_key em equipment_fuel_refuelings) rodou
-- com auth.uid() = NULL, porque migração não tem sessão. A expressão
-- COALESCE(current_tenant_key(), 'legacy') caiu no ramo 'legacy' para TODA a
-- tabela, não só para as linhas sem dono — 2 abastecimentos ficaram numa empresa
-- sem membros, invisíveis para o administrador.
--
-- A auditoria da Fase 1 não pegou isso porque ela cobria apenas as tabelas que
-- ganharam tenant_key na Fase 0; equipment_fuel_refuelings já tinha a coluna.
--
-- A correção usa o próprio vínculo do dado: o abastecimento referencia um
-- equipamento, e o equipamento pertence a uma empresa.
-- =============================================================================

DO $$
DECLARE
  sem_dono integer := 0;
BEGIN
  UPDATE public.equipment_fuel_refuelings f
     SET tenant_key = e.tenant_key
    FROM public.equipment e
   WHERE e.id = f.equipment_id
     AND f.tenant_key <> e.tenant_key
     AND NOT EXISTS (
       SELECT 1 FROM public.companies c WHERE c.id::text = f.tenant_key
     );

  GET DIAGNOSTICS sem_dono = ROW_COUNT;

  -- Sobras que não apontam para nenhum equipamento ficam na empresa do
  -- administrador master mais antigo, que é o dono natural do histórico.
  UPDATE public.equipment_fuel_refuelings f
     SET tenant_key = (
       SELECT p.company_id::text FROM public.profiles p
        WHERE p.company_id IS NOT NULL AND p.role = 'master'
        ORDER BY p.created_at LIMIT 1
     )
   WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id::text = f.tenant_key)
     AND NOT EXISTS (SELECT 1 FROM public.equipment e WHERE e.id = f.equipment_id)
     AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.company_id IS NOT NULL AND p.role = 'master');

  RAISE NOTICE 'Reatribuídos % abastecimento(s) para a empresa do equipamento.', sem_dono;
END
$$;

-- A empresa do bucket 'legacy' só é removida depois de esvaziada.
DO $$
DECLARE
  restantes bigint;
  alvo     uuid;
BEGIN
  SELECT c.id INTO alvo FROM public.companies c
   WHERE c.slug = 'dados-anteriores-identifica-o-de-empresa';

  IF alvo IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO restantes FROM public.equipment_fuel_refuelings
   WHERE tenant_key = alvo::text;

  IF restantes = 0 THEN
    DELETE FROM public.companies WHERE id = alvo;
    RAISE NOTICE 'Empresa vazia do bucket legacy removida.';
  ELSE
    RAISE WARNING 'Bucket legacy ainda tem % abastecimento(s); mantido para inspeção.', restantes;
  END IF;
END
$$;

-- Auditorias temporárias.
DROP FUNCTION IF EXISTS public.__audit_legacy_bucket();