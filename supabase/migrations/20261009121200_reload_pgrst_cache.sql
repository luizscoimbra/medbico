-- =============================================================================
-- Recarga do cache de esquema do PostgREST
-- =============================================================================
-- Trocar a assinatura de uma função deixa o cache do PostgREST apontando para a
-- versão antiga e a chamada responde 404 "Could not find the function in the
-- schema cache".
--
-- COMMENT em tabela é o truque já usado neste projeto; NOTIFY é o mecanismo
-- documentado. Os dois juntos garantem a recarga.
-- =============================================================================

COMMENT ON TABLE public.stock_entries IS
  'Movimentações de estoque por filial. tipo: entrada, transferencia_entrada, transferencia_saida.';

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  -- pg_notify fora de sessão transacional não impede a migração.
  NULL;
END
$$;