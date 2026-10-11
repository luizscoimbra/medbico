-- =============================================================================
-- FASE 2 — Coluna branch_id nas tabelas de negócio
-- =============================================================================
-- A empresa já é um tenant de verdade. Agora entra a filial, um segundo nível:
-- dentro de uma empresa, cada filial enxerga apenas os seus dados.
--
-- Semântica de branch_id:
--   NULL  → dado compartilhado, visível para todas as filiais da empresa.
--           É onde fica o cadastro comercial (clientes, produtos, serviços) e
--           onde permanecem os dados criados antes desta fase.
--   uuid  → dado exclusivo de uma filial.
--
-- Decisão do usuário sobre os dados existentes: ficam como estão, no nível da
-- empresa. A única exceção é o estoque — como ele passa a ser por filial, um
-- saldo que nenhuma filial posee seria um saldo que ninguém consegue
-- explicar, então as entradas atuais são atribuídas à Matriz.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colunas
-- -----------------------------------------------------------------------------
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
  t text;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(branch_id)', 'idx_' || t || '_branch_id', t);
  END LOOP;
END
$$;

-- -----------------------------------------------------------------------------
-- Backfill: estoque vai para a Matriz da empresa
-- -----------------------------------------------------------------------------
-- O saldo precisa pertencer a alguém. A filial Matriz é a sede natural e é o
-- destino que o administrador esperaria ao migrar um sistema de empresa única.
DO $$
DECLARE
  movidos bigint;
BEGIN
  UPDATE public.stock_entries e
     SET branch_id = b.id
    FROM public.branches b
   WHERE b.company_id::text = e.tenant_key
     AND b.is_hq
     AND e.branch_id IS NULL;
  GET DIAGNOSTICS movidos = ROW_COUNT;

  UPDATE public.stock_settings s
     SET branch_id = b.id
    FROM public.branches b
   WHERE b.company_id::text = s.tenant_key
     AND b.is_hq
     AND s.branch_id IS NULL;

  RAISE NOTICE 'Fase 2: % entrada(s) de estoque movidas para a Matriz.', movidos;
END
$$;

-- O saldo mínimo do estoque precisa acompanhar a mesma filial.
DO $$
BEGIN
  UPDATE public.stock_settings s
     SET branch_id = (
       SELECT se.branch_id FROM public.stock_entries se WHERE se.item_key = s.item_key LIMIT 1
     )
   WHERE s.branch_id IS NULL;
END
$$;