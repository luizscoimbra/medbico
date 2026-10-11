-- =============================================================================
-- Correção: categoria do item na transferência de estoque
-- =============================================================================
-- transfer_stock derivava a categoria por split_part(item_key, ':', 1), que
-- devolve o prefixo curto ('prod', 'acc'). O CHECK da tabela exige os valores
-- por extenso ('produto', 'acessorio'), e toda transferência era rejeitada.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_de         uuid,
  p_para       uuid,
  p_item_key   text,
  p_item_nome  text,
  p_quantidade numeric,
  p_observacao text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  empresa    text := public.current_tenant_key();
  categoria  text;
  de_ok      boolean;
  para_ok    boolean;
  saldo_de   numeric;
  saldo_para numeric;
BEGIN
  IF p_de IS NULL OR p_para IS NULL THEN
    RAISE EXCEPTION 'Informe as filiais de origem e destino';
  END IF;
  IF p_de = p_para THEN
    RAISE EXCEPTION 'A filial de origem e a de destino precisam ser diferentes';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'A quantidade transferida precisa ser maior que zero';
  END IF;
  IF p_item_key IS NULL OR btrim(p_item_key) = '' THEN
    RAISE EXCEPTION 'Informe o item a transferir';
  END IF;

  -- O prefixo do item_key é a fonte da categoria: prod:, peca:, acc:, comb:.
  categoria := CASE split_part(p_item_key, ':', 1)
    WHEN 'prod' THEN 'produto'
    WHEN 'peca' THEN 'peca'
    WHEN 'acc'  THEN 'acessorio'
    WHEN 'comb' THEN 'combustivel'
  END;

  IF categoria IS NULL THEN
    RAISE EXCEPTION 'Item inválido: % (esperado prod:, peca:, acc: ou comb:)', p_item_key;
  END IF;

  SELECT b.company_id::text = empresa AND b.status = 'active'
    INTO de_ok FROM public.branches b WHERE b.id = p_de;
  SELECT b.company_id::text = empresa AND b.status = 'active'
    INTO para_ok FROM public.branches b WHERE b.id = p_para;

  IF NOT COALESCE(de_ok, false) THEN
    RAISE EXCEPTION 'Filial de origem inválida ou sem acesso';
  END IF;
  IF NOT COALESCE(para_ok, false) THEN
    RAISE EXCEPTION 'Filial de destino inválida ou sem acesso';
  END IF;

  SELECT public.stock_balance(p_de::text) INTO saldo_de;
  IF saldo_de < p_quantidade THEN
    RAISE EXCEPTION 'Saldo insuficiente na filial de origem: disponível %, solicitado %',
      saldo_de, p_quantidade;
  END IF;

  INSERT INTO public.stock_entries
    (tenant_key, branch_id, categoria, item_key, item_nome, quantidade, valor_total,
     data, fornecedor, observacao, tipo, origem)
  VALUES
    (empresa, p_de, categoria, p_item_key, p_item_nome,
     p_quantidade, 0, CURRENT_DATE, '', COALESCE(p_observacao, ''),
     'transferencia_saida', 'transferencia');

  INSERT INTO public.stock_entries
    (tenant_key, branch_id, categoria, item_key, item_nome, quantidade, valor_total,
     data, fornecedor, observacao, tipo, origem)
  VALUES
    (empresa, p_para, categoria, p_item_key, p_item_nome,
     p_quantidade, 0, CURRENT_DATE, '', COALESCE(p_observacao, ''),
     'transferencia_entrada', 'transferencia');

  SELECT public.stock_balance(p_de::text) INTO saldo_de;
  SELECT public.stock_balance(p_para::text) INTO saldo_para;

  RETURN jsonb_build_object(
    'item_key', p_item_key,
    'saldo_origem', saldo_de,
    'saldo_destino', saldo_para
  );
END
$$;

REVOKE ALL ON FUNCTION public.transfer_stock(uuid, uuid, text, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, text, text, numeric, text) TO authenticated;