-- =============================================================================
-- FASE 2 — Caminhões pipa: de JSON em app_settings para tabela de verdade
-- =============================================================================
-- O cadastro de caminhões pipa vivia em app_settings, uma coluna JSONB sem
-- chave estrangeira, sem índice e sem vínculo com a filial. Passava ilesa por
-- qualquer verificação de escopo e não podia ser consultada por SQL.
--
-- Vira tabela com branch_id, como todo o resto do operacional.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.water_trucks (
  id            text PRIMARY KEY,
  tenant_key    text NOT NULL DEFAULT public.current_tenant_key(),
  branch_id     uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  fleet_number  text NOT NULL,
  model         text NOT NULL DEFAULT '',
  capacity      numeric NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_water_trucks_branch ON public.water_trucks(branch_id);
CREATE INDEX IF NOT EXISTS idx_water_trucks_tenant ON public.water_trucks(tenant_key);

ALTER TABLE public.water_trucks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant and branch can manage water_trucks" ON public.water_trucks;
CREATE POLICY "Tenant and branch can manage water_trucks" ON public.water_trucks
  FOR ALL
  USING (tenant_key = public.current_tenant_key()
         AND (branch_id IS NULL OR branch_id = ANY(public.current_branch_ids())))
  WITH CHECK (tenant_key = public.current_tenant_key()
              AND (branch_id IS NULL OR branch_id = ANY(public.current_branch_ids())));

-- Migra o que estava no app_settings, se houver.
DO $$
DECLARE
  legado jsonb;
  item   jsonb;
  n      integer := 0;
BEGIN
  SELECT value INTO legado FROM public.app_settings WHERE key = 'waterTrucks';

  IF legado IS NULL OR jsonb_typeof(legado) <> 'array' THEN
    RETURN;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(legado)
  LOOP
    INSERT INTO public.water_trucks (id, fleet_number, model, capacity)
    VALUES (
      COALESCE(item->>'id', gen_random_uuid()::text),
      COALESCE(item->>'fleet_number', ''),
      COALESCE(item->>'model', ''),
      COALESCE(public.to_num(item->>'capacity'), 0)
    )
    ON CONFLICT (id) DO NOTHING;
    n := n + 1;
  END LOOP;

  RAISE NOTICE 'Fase 2: % caminhão(ões) pipa migrado(s) para water_trucks.', n;
END
$$;

COMMENT ON TABLE public.water_trucks IS
  'Caminhões pipa de apoio. Substitui a chave waterTrucks em app_settings.';