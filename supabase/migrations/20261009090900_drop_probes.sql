-- =============================================================================
-- Remoção das sondas temporárias de diagnóstico
-- =============================================================================
-- __probe_jsonb e __probe_snapshot foram criados para isolar a falha de
-- stock_snapshot. A causa (ausência de tenant_key em equipment_fuel_refuelings)
-- já foi corrigida; as sondas não fazem parte do sistema.
-- =============================================================================

DROP FUNCTION IF EXISTS public.__probe_jsonb();
DROP FUNCTION IF EXISTS public.__probe_snapshot();