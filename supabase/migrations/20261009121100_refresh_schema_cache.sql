-- =============================================================================
-- Recarga do cache de esquema do PostgREST
-- =============================================================================
-- Trocar a assinatura de uma função (adicionar/renomear parâmetros) deixa o
-- cache do PostgREST apontando para a versão antiga, e a chamada passa a
-- responder 404 "Could not find the function in the schema cache".
--
-- Um COMMENT em qualquer tabela invalida o cache. Usamos a própria tabela
-- envolvida na mudança.
-- =============================================================================

COMMENT ON FUNCTION public.stock_snapshot(uuid) IS
  'Saldo de estoque por filial. Sem argumento devolve a visão consolidada da empresa.';