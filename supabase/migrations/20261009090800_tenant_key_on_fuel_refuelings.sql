-- =============================================================================
-- Isolamento por tenant: abastecimentos
-- =============================================================================
-- public.stock_snapshot() filtra o consumo de combustível por tenant, mas a
-- tabela public.equipment_fuel_refuelings não tinha a coluna tenant_key e a
-- função falhava em tempo de execução com:
--   column cb.tenant_key does not exist
--
-- A tabela também mantinha a política "qualquer autenticado lê e escreve",
-- sem escopo de empresa. Passa a seguir o mesmo padrão do restante do sistema.
-- =============================================================================

ALTER TABLE public.equipment_fuel_refuelings ADD COLUMN IF NOT EXISTS tenant_key text;

UPDATE public.equipment_fuel_refuelings
   SET tenant_key = COALESCE(public.current_tenant_key(), 'legacy')
 WHERE tenant_key IS NULL;

ALTER TABLE public.equipment_fuel_refuelings
  ALTER COLUMN tenant_key SET DEFAULT public.current_tenant_key();
ALTER TABLE public.equipment_fuel_refuelings
  ALTER COLUMN tenant_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_eqf_tenant_key ON public.equipment_fuel_refuelings(tenant_key);

DROP POLICY IF EXISTS "Authenticated users can manage equipment_fuel_refuelings"
  ON public.equipment_fuel_refuelings;

CREATE POLICY "Tenant can manage equipment_fuel_refuelings" ON public.equipment_fuel_refuelings
  FOR ALL USING (tenant_key = public.current_tenant_key())
  WITH CHECK (tenant_key = public.current_tenant_key());