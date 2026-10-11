-- =============================================================================
-- FASE 2 — Estoque por filial, com transferência entre filiais
-- =============================================================================
-- Decisão do usuário: cada filial tem seu próprio saldo. Uma entrada de estoque
-- pertence a uma filial, e mover material entre filiais passa a ser um
-- lançamento explícito, validado e auditado — em vez de um saldo único
-- misturado, onde ninguém consegue dizer de quem é a carga.
--
-- Movimentações:
--   entrada                soma na filial
--   transferencia_entrada  soma na filial que recebeu
--   transferencia_saida    subtrai na filial que entregou
--
-- As saídas por consumo (OS, manutenção, abastecimento) continuam sendo
-- derivadas; a diferença é que agora cada uma é atribuída à filial do
-- equipamento/OS que a originou.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipo de movimentação
-- -----------------------------------------------------------------------------
ALTER TABLE public.stock_entries
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'entrada';

UPDATE public.stock_entries SET tipo = 'entrada' WHERE tipo IS NULL;

ALTER TABLE public.stock_entries
  DROP CONSTRAINT IF EXISTS stock_entries_tipo_check;
ALTER TABLE public.stock_entries
  ADD CONSTRAINT stock_entries_tipo_check
  CHECK (tipo IN ('entrada', 'transferencia_entrada', 'transferencia_saida'));

ALTER TABLE public.stock_entries
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.stock_entries.tipo IS
  'entrada: compra. transferencia_saida/entrada: remessa e recebimento entre filiais.';
COMMENT ON COLUMN public.stock_entries.origem IS
  'Rastreio: número da OS, id da manutenção ou observação da transferência.';

CREATE INDEX IF NOT EXISTS idx_stock_entries_branch ON public.stock_entries(branch_id);


-- -----------------------------------------------------------------------------
-- Saldo mínimo por filial
-- -----------------------------------------------------------------------------
-- A chave primária anterior (tenant_key, item_key) não distinguia filiais. Como
-- branch_id é anulável e NULLs não colidem num índice único, guardamos uma
-- chave textual — a filial Matriz da empresa quando branch_id é nulo.
ALTER TABLE public.stock_settings
  ADD COLUMN IF NOT EXISTS branch_key text NOT NULL DEFAULT '__empresa__';

UPDATE public.stock_settings s
   SET branch_key = COALESCE(s.branch_id::text, '__empresa__');

ALTER TABLE public.stock_settings DROP CONSTRAINT IF EXISTS stock_settings_pkey;
ALTER TABLE public.stock_settings ADD CONSTRAINT stock_settings_pkey PRIMARY KEY (tenant_key, branch_key, item_key);


-- -----------------------------------------------------------------------------
-- Saldo de uma filial, numa única transação
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stock_balance(p_branch_key text)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(round(sum(
           CASE e.tipo
             WHEN 'transferencia_saida' THEN -e.quantidade
             ELSE e.quantidade
           END), 2), 0)
    FROM public.stock_entries e
   WHERE e.tenant_key = public.current_tenant_key()
     AND COALESCE(e.branch_id::text, '__empresa__') = p_branch_key
$$;


-- -----------------------------------------------------------------------------
-- Transferência entre filiais
-- -----------------------------------------------------------------------------
-- Valida o saldo na origem e grava as duas movimentações na mesma transação.
-- Se a segunda escrita falhar, a primeira é revertida junto — não existe meio
-- caminho com a mercadoria sumindo do estoque.
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_de        uuid,
  p_para      uuid,
  p_item_key  text,
  p_item_nome text,
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
  empresa  text := public.current_tenant_key();
  de_ok    boolean;
  para_ok  boolean;
  saldo_de numeric;
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

  -- As duas filiais precisam ser da mesma empresa e estar liberadas ao usuário.
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
    (empresa, p_de, split_part(p_item_key, ':', 1), p_item_key, p_item_nome,
     p_quantidade, 0, CURRENT_DATE, '', COALESCE(p_observacao, ''),
     'transferencia_saida', 'transferencia');

  INSERT INTO public.stock_entries
    (tenant_key, branch_id, categoria, item_key, item_nome, quantidade, valor_total,
     data, fornecedor, observacao, tipo, origem)
  VALUES
    (empresa, p_para, split_part(p_item_key, ':', 1), p_item_key, p_item_nome,
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


-- -----------------------------------------------------------------------------
-- register_stock_entry e set_stock_minimum, agora por filial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_stock_entry(
  p_categoria   text,
  p_item_key    text,
  p_item_nome   text,
  p_quantidade  numeric,
  p_valor_total numeric DEFAULT 0,
  p_data        date    DEFAULT CURRENT_DATE,
  p_fornecedor  text    DEFAULT '',
  p_observacao  text    DEFAULT '',
  p_branch_id   uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  empresa   text := public.current_tenant_key();
  filial    uuid;
  novo_id   uuid;
  saldo     numeric;
BEGIN
  IF empresa IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a uma empresa';
  END IF;
  IF p_item_key IS NULL OR btrim(p_item_key) = '' THEN
    RAISE EXCEPTION 'item_key é obrigatório';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'quantidade deve ser maior que zero';
  END IF;

  -- Sem filial informada, a entrada vai para a Matriz.
  filial := COALESCE(p_branch_id, (SELECT b.id FROM public.branches b
                                     WHERE b.company_id::text = empresa AND b.is_hq LIMIT 1));

  IF filial IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.branches b WHERE b.id = filial AND b.company_id::text = empresa
  ) THEN
    RAISE EXCEPTION 'Filial inválida';
  END IF;

  IF filial <> ALL (public.current_branch_ids()) THEN
    RAISE EXCEPTION 'Sem acesso a esta filial';
  END IF;

  INSERT INTO public.stock_entries
    (tenant_key, branch_id, categoria, item_key, item_nome, quantidade, valor_total,
     data, fornecedor, observacao, tipo, origem)
  VALUES
    (empresa, filial, p_categoria, p_item_key, p_item_nome, p_quantidade,
     COALESCE(p_valor_total, 0), COALESCE(p_data, CURRENT_DATE),
     COALESCE(p_fornecedor, ''), COALESCE(p_observacao, ''), 'entrada', '')
  RETURNING id INTO novo_id;

  SELECT public.stock_balance(filial::text) INTO saldo;

  RETURN jsonb_build_object('id', novo_id, 'branch_id', filial, 'saldo', saldo);
END
$$;

CREATE OR REPLACE FUNCTION public.set_stock_minimum(
  p_item_key   text,
  p_categoria  text,
  p_minimo     numeric,
  p_branch_id  uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  empresa text := public.current_tenant_key();
  filial  uuid;
  chave   text;
  linha   public.stock_settings%ROWTYPE;
BEGIN
  filial := COALESCE(p_branch_id, (SELECT b.id FROM public.branches b
                                     WHERE b.company_id::text = empresa AND b.is_hq LIMIT 1));
  chave  := COALESCE(filial::text, '__empresa__');

  INSERT INTO public.stock_settings (tenant_key, branch_key, branch_id, item_key, categoria, minimo, ativo)
  VALUES (empresa, chave, filial, p_item_key, p_categoria, COALESCE(p_minimo, 0), true)
  ON CONFLICT (tenant_key, branch_key, item_key) DO UPDATE
    SET minimo = EXCLUDED.minimo,
        categoria = EXCLUDED.categoria,
        ativo = true,
        updated_at = now()
  RETURNING * INTO linha;

  RETURN to_jsonb(linha);
END
$$;

CREATE OR REPLACE FUNCTION public.delete_stock_entry(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  alvo  public.stock_entries%ROWTYPE;
  saldo numeric;
BEGIN
  SELECT * INTO alvo FROM public.stock_entries
   WHERE id = p_id AND tenant_key = public.current_tenant_key()
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada de estoque não encontrada';
  END IF;

  DELETE FROM public.stock_entries WHERE id = p_id;

  SELECT public.stock_balance(COALESCE(alvo.branch_id::text, '__empresa__')) INTO saldo;

  RETURN jsonb_build_object(
    'item_key', alvo.item_key,
    'branch_id', alvo.branch_id,
    'saldo', saldo
  );
END
$$;