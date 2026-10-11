-- Sonda temporária: isola se a falha está no corpo de stock_snapshot ou na
-- serialização do retorno de uma função SECURITY DEFINER via PostgREST.
CREATE OR REPLACE FUNCTION public.__probe_jsonb()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT '{}'::jsonb
$$;

REVOKE ALL ON FUNCTION public.__probe_jsonb() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__probe_jsonb() TO authenticated;