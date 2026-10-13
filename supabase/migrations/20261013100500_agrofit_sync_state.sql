-- =============================================================================
-- Estado da fonte Agrofit + limpeza do staging (apoio ao sync diário)
-- =============================================================================
--   * agrofit_sync_state: linha única com o metadata_modified do recurso
--     oficial visto na última execução — permite ao script pular o download
--     de 374 MB quando a fonte não mudou (verificação diária barata);
--   * agrofit_clear_staging: RPC de limpeza (PostgREST não executa SQL livre).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.agrofit_sync_state (
  id              boolean PRIMARY KEY DEFAULT true CHECK (id),
  fonte_modified  text NOT NULL DEFAULT '',
  ultima_execucao timestamptz,
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agrofit_sync_state IS
  'Estado do sync Agrofit: metadata_modified da fonte oficial visto na última execução (linha única).';

ALTER TABLE public.agrofit_sync_state ENABLE ROW LEVEL SECURITY;
-- sem policies: apenas service_role/postgres acessam (o histórico é a visão pública).

INSERT INTO public.agrofit_sync_state (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.agrofit_clear_staging()
RETURNS void
LANGUAGE sql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  DELETE FROM public.agrofit_staging;
$$;

COMMENT ON FUNCTION public.agrofit_clear_staging() IS
  'Esvazia o staging Agrofit antes de uma nova carga (usado por scripts/agrofit-sync.mjs via PostgREST).';

REVOKE ALL ON FUNCTION public.agrofit_clear_staging() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agrofit_clear_staging() TO service_role;
