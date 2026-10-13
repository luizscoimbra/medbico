-- =============================================================================
-- agrofit_clear_staging: TRUNCATE em plpgsql
-- =============================================================================
-- O PostgREST recusa executar funções SQL com DELETE sem cláusula WHERE
-- ("DELETE requires a WHERE clause"). Como a limpeza do staging é sempre
-- total, troca-se para TRUNCATE dentro de plpgsql (não inlineável).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.agrofit_clear_staging()
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  TRUNCATE public.agrofit_staging;
END
$$;

REVOKE ALL ON FUNCTION public.agrofit_clear_staging() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agrofit_clear_staging() TO service_role;
