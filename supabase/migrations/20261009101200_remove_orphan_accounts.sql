-- =============================================================================
-- Remoção das contas órfãs do auto-cadastro
-- =============================================================================
-- Duas contas criadas em 10/10 pelo formulário público, antes do self-service:
-- nasceram como `operador` sem empresa, ou seja, num tenant vazio e isolado.
--
-- A Fase 0 passou a isolar cada empresa por RLS, o que tem duas consequências:
-- elas não aparecem na lista de Acessos do administrador AGROCANA, e o
-- delete_user() recusa apagá-las por pertencerem a outra empresa. Só uma
-- migração com acesso de administrador consegue limpá-las.
--
-- A auditoria anterior confirmou zero linhas em todas as 31 tabelas com
-- tenant_key, então não há trabalho a descartar. A limpeza defensiva abaixo
-- roda mesmo assim, caso algum dado exista de fora.
-- =============================================================================

DO $$
DECLARE
  u         record;
  tabelas   text[];
  t         text;
  apagados  integer := 0;
BEGIN
  tabelas := ARRAY[
    'app_settings','application_types','battery_cycles','clients','component_catalog',
    'document_alerts','drone_components','drones','equipment','equipment_fuel_refuelings',
    'equipment_maintenance_items','equipment_maintenance_records','equipment_maintenance_schedules',
    'financial_payables','financial_receivables','flight_logs','maintenance_records',
    'maintenance_schedules','nozzle_measurements','operators','orders_of_service','pilots',
    'products','registered_products','service_areas','services','spray_calibrations',
    'spray_mix_recipes','stock_entries','stock_settings','suppliers'
  ];

  FOR u IN
    SELECT id FROM public.profiles
     WHERE COALESCE(NULLIF(btrim(company), ''), '') = ''
  LOOP
    -- O tenant de uma conta sem empresa é o próprio id do usuário.
    FOREACH t IN ARRAY tabelas LOOP
      EXECUTE format('DELETE FROM public.%I WHERE tenant_key = $1', t) USING u.id::text;
    END LOOP;

    -- profiles.id tem ON DELETE CASCADE para auth.users.
    DELETE FROM auth.users WHERE id = u.id;
    IF FOUND THEN
      apagados := apagados + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Contas órfãs removidas: %.', apagados;
END
$$;

-- Remove a função de auditoria usada para confirmar que estavam vazias.
DROP FUNCTION IF EXISTS public.__audit_orphan_accounts();

DO $$
DECLARE
  restantes integer;
BEGIN
  SELECT count(*) INTO restantes
    FROM public.profiles
   WHERE COALESCE(NULLIF(btrim(company), ''), '') = '';

  IF restantes = 0 THEN
    RAISE NOTICE 'Nenhuma conta órfã restante.';
  ELSE
    RAISE WARNING 'Ainda restam % conta(s) sem empresa.', restantes;
  END IF;
END
$$;