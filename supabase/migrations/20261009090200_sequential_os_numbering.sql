-- =============================================================================
-- Numeração sequencial compartilhada
-- =============================================================================
-- O contador diário de OS vivia no IndexedDB e reiniciava a cada dispositivo.
-- Agora é resolvido no banco, com lock para impedir duplicidade quando dois
-- usuários abrem OS ao mesmo tempo.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.next_os_id(p_prefix text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next integer;
BEGIN
  IF p_prefix IS NULL OR btrim(p_prefix) = '' THEN
    RAISE EXCEPTION 'prefixo da OS é obrigatório';
  END IF;

  -- Serializa apenas os geradores concorrentes do mesmo dia.
  PERFORM pg_advisory_xact_lock(hashtext(p_prefix));

  SELECT COALESCE(MAX(NULLIF(regexp_replace(id, '^' || p_prefix || '-', ''), '')::integer), 0) + 1
    INTO v_next
    FROM public.orders_of_service
   WHERE tenant_key = public.current_tenant_key()
     AND id LIKE p_prefix || '-%';

  RETURN p_prefix || '-' || lpad(v_next::text, 3, '0');
END
$$;

REVOKE ALL ON FUNCTION public.next_os_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_os_id(text) TO authenticated;

COMMENT ON FUNCTION public.next_os_id(text) IS
  'Próximo identificador de OS no formato AAAAMMDD-NNN, sequencial e compartilhado entre dispositivos.';