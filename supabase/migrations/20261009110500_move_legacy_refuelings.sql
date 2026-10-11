-- =============================================================================
-- Correção (2): abastecimentos presos na empresa do bucket 'legacy'
-- =============================================================================
-- A tentativa anterior procurava o literal 'legacy' em tenant_key, mas a Fase 1
-- já reescreveu esse campo para o uuid da empresa. O alvo correto é a própria
-- empresa do bucket.
--
-- Diagnosticado antes: são 2 abastecimentos cujo equipment_id não corresponde a
-- nenhum equipamento cadastrado (mesmo caso das linhas de produtos e serviços
-- órfãs já tratada na Fase 0). Pertencem à única empresa com atividade.
-- =============================================================================

DO $$
DECLARE
  alvo      uuid;
  principal uuid;
  movidos   integer := 0;
  restantes bigint;
BEGIN
  SELECT c.id INTO alvo FROM public.companies c
   WHERE c.slug = 'dados-anteriores-identifica-o-de-empresa';

  IF alvo IS NULL THEN
    RAISE NOTICE 'Bucket legacy já não existe.';
    RETURN;
  END IF;

  SELECT p.company_id INTO principal
    FROM public.profiles p
   WHERE p.company_id IS NOT NULL AND p.company_id <> alvo
   ORDER BY p.created_at LIMIT 1;

  IF principal IS NULL THEN
    RAISE WARNING 'Não há empresa de destino; bucket legacy mantido.';
    RETURN;
  END IF;

  UPDATE public.equipment_fuel_refuelings
     SET tenant_key = principal::text
   WHERE tenant_key = alvo::text;
  GET DIAGNOSTICS movidos = ROW_COUNT;

  RAISE NOTICE 'Reatribuídos % abastecimento(s) para a empresa principal.', movidos;

  SELECT count(*) INTO restantes FROM public.equipment_fuel_refuelings WHERE tenant_key = alvo::text;

  IF restantes = 0 THEN
    DELETE FROM public.companies WHERE id = alvo;
    RAISE NOTICE 'Empresa vazia do bucket legacy removida.';
  ELSE
    RAISE WARNING 'Bucket legacy ainda tem % abastecimento(s).', restantes;
  END IF;
END
$$;