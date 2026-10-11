-- =============================================================================
-- FASE 2 — RLS por empresa E filial
-- =============================================================================
-- Política única, idêntica nas 31 tabelas:
--
--   USING (tenant_key = current_tenant_key()
--          AND (branch_id IS NULL OR branch_id = ANY(current_branch_ids())))
--
-- A primeira cláusula é a empresa; a segunda é a filial. Dados sem filial
-- (branch_id IS NULL) são compartilhados e passam para todos — é o que mantém
-- o cadastro comercial único para a empresa inteira.
--
-- current_branch_ids() devolve as filiais concedidas ao usuário e, para
-- administrador, todas as filiais da empresa: quem administra não deveria
-- precisar trocar de filial para conferir um dado da outra.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_branch_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid() AND p.role IN ('master', 'gestor')
         AND p.company_id = public.current_company_id()
    ) THEN (
      SELECT COALESCE(array_agg(b.id), '{}'::uuid[])
        FROM public.branches b
       WHERE b.company_id = public.current_company_id() AND b.status = 'active'
    )
    ELSE (
      SELECT COALESCE(array_agg(ub.branch_id), '{}'::uuid[])
        FROM public.user_branches ub
        JOIN public.branches b ON b.id = ub.branch_id
       WHERE ub.user_id = auth.uid()
         AND b.company_id = public.current_company_id()
         AND b.status = 'active'
    )
  END
$$;

COMMENT ON FUNCTION public.current_branch_ids() IS
  'Filiais visíveis ao usuário: as concedidas, ou todas da empresa se for administrador.';


-- -----------------------------------------------------------------------------
-- Regenera as policies das 31 tabelas de negócio
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
  t     text;
  antiga text;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    FOR antiga IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', antiga, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (tenant_key = public.current_tenant_key() AND (branch_id IS NULL OR branch_id = ANY(public.current_branch_ids()))) WITH CHECK (tenant_key = public.current_tenant_key() AND (branch_id IS NULL OR branch_id = ANY(public.current_branch_ids())))',
      'Tenant and branch can manage ' || t, t
    );
  END LOOP;
END
$$;


-- -----------------------------------------------------------------------------
-- convites: convites nascem na empresa e são usados na filial
-- -----------------------------------------------------------------------------
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;