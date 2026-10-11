-- =============================================================================
-- ESTOQUE — transações atômicas e saldo calculado no banco
-- =============================================================================
-- Riscos tratados (Matriz de Riscos §05, linha "Inconsistência de concorrência
-- no estoque"):
--   1. O saldo era montado no navegador cruzando fontes diferentes (entradas no
--      Supabase × saídas derivadas de OS, manutenções, drones e abastecimentos).
--      Com dados em dois lugares, qualquer leitura parcial gerava divergência.
--      Agora TODAS as fontes estão no PostgreSQL e o saldo é calculado em uma
--      única consulta consistente (public.stock_snapshot).
--   2. O RLS de stock_entries/stock_settings liberava escrita para qualquer
--      usuário autenticado, sem escopo. Passa a ser por tenant.
--   3. Gravações de entrada e exclusão aconteciam em chamadas separadas do
--      cliente, deixando a tela com saldo obsoleto entre uma operação e outra.
--      As RPCs abaixo fazem insert/delete + recálculo na mesma transação.
-- =============================================================================

ALTER TABLE public.stock_entries  ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.stock_settings ADD COLUMN IF NOT EXISTS tenant_key text;

UPDATE public.stock_entries  SET tenant_key = COALESCE(public.current_tenant_key(), 'legacy') WHERE tenant_key IS NULL;
UPDATE public.stock_settings SET tenant_key = COALESCE(public.current_tenant_key(), 'legacy') WHERE tenant_key IS NULL;

ALTER TABLE public.stock_entries  ALTER COLUMN tenant_key SET DEFAULT public.current_tenant_key();
ALTER TABLE public.stock_settings ALTER COLUMN tenant_key SET DEFAULT public.current_tenant_key();
ALTER TABLE public.stock_entries  ALTER COLUMN tenant_key SET NOT NULL;
ALTER TABLE public.stock_settings ALTER COLUMN tenant_key SET NOT NULL;

-- O PRIMARY KEY de stock_settings precisa incluir o tenant para o RLS por
-- empresa funcionar quando duas empresas usam o mesmo item_key.
ALTER TABLE public.stock_settings DROP CONSTRAINT IF EXISTS stock_settings_pkey;
ALTER TABLE public.stock_settings ADD CONSTRAINT stock_settings_pkey PRIMARY KEY (tenant_key, item_key);

CREATE INDEX IF NOT EXISTS idx_stock_entries_tenant_key  ON public.stock_entries(tenant_key);
CREATE INDEX IF NOT EXISTS idx_stock_settings_tenant_key ON public.stock_settings(tenant_key);
CREATE INDEX IF NOT EXISTS idx_stock_entries_tenant_item ON public.stock_entries(tenant_key, item_key);

DROP POLICY IF EXISTS "Authenticated users can manage stock_entries"  ON public.stock_entries;
DROP POLICY IF EXISTS "Authenticated users can manage stock_settings" ON public.stock_settings;

CREATE POLICY "Tenant can manage stock_entries" ON public.stock_entries
  FOR ALL USING (tenant_key = public.current_tenant_key())
  WITH CHECK (tenant_key = public.current_tenant_key());

CREATE POLICY "Tenant can manage stock_settings" ON public.stock_settings
  FOR ALL USING (tenant_key = public.current_tenant_key())
  WITH CHECK (tenant_key = public.current_tenant_key());


-- -----------------------------------------------------------------------------
-- Leitura numérica tolerante (aceita "2,5", "2.5", "1.234,56", "", null)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.to_num(txt text)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v numeric;
BEGIN
  IF txt IS NULL OR btrim(txt) = '' THEN
    RETURN 0;
  END IF;
  BEGIN
    v := btrim(txt)::numeric;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      v := btrim(replace(txt, '.', ''), ',', '.')::numeric;
    EXCEPTION WHEN OTHERS THEN
      v := 0;
    END;
  END;
  RETURN COALESCE(v, 0);
END
$$;

-- Normalização de nomes idêntica à usada no cliente: trim + lowercase.
CREATE OR REPLACE FUNCTION public.norm_key(txt text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT lower(btrim(COALESCE(txt, '')))
$$;


-- -----------------------------------------------------------------------------
-- Snapshot atômico do estoque
-- -----------------------------------------------------------------------------
-- Devolve, numa única transação e num único snapshot (READ COMMITTED do
-- PostgreSQL garante consistência entre as várias sub-CTEs), as entradas e as
-- saídas já agregadas por item. O cliente apenas formata — não soma mais nada.
CREATE OR REPLACE FUNCTION public.stock_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t    text;
  saidas jsonb;
  entradas jsonb;
  resultado jsonb;
BEGIN
  t := public.current_tenant_key();

  ------------------------------------------------------------------
  -- Entradas (compras) agregadas por item_key
  ------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'nome'), '[]'::jsonb) INTO entradas
  FROM (
    SELECT
      e.item_key                                AS item_key,
      e.categoria                               AS categoria,
      max(e.item_nome)                          AS nome,
      round(COALESCE(sum(e.quantidade), 0), 2)  AS entradas_total,
      round(COALESCE(max(e.valor_total), 0), 2) AS valor_ultima_entrada,
      max(e.data)::text                         AS data_ultima_entrada
    FROM public.stock_entries e
    WHERE e.tenant_key = t
    GROUP BY e.item_key, e.categoria
  ) x;

  ------------------------------------------------------------------
  -- Saídas: consumo real derivado dos módulos operacionais
  ------------------------------------------------------------------
  WITH
  -- Produtos: Σ dose × área apontada na OS (usa substitutos quando existem).
  consumo_produto AS (
    SELECT public.norm_key(p->>'produto') AS nome_norm,
           round(sum(public.to_num(p->>'dose') * public.to_num(ap->>'areaAplicada')), 2) AS total
    FROM public.orders_of_service os
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(os.apontamentos) = 'array' THEN os.apontamentos ELSE '[]'::jsonb END
    ) ap
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(ap->'produtosSubstitutos') = 'array'
             AND jsonb_array_length(ap->'produtosSubstitutos') > 0
          THEN ap->'produtosSubstitutos'
        ELSE COALESCE(
               (os.talhoes -> public.to_num(ap->>'talhaoIndex')::int) -> 'produtos',
               '[]'::jsonb
             )
      END
    ) p
    WHERE os.tenant_key = t
      AND public.to_num(ap->>'areaAplicada') > 0
      AND public.norm_key(p->>'produto') <> ''
    GROUP BY 1
  ),

  -- Peças: Σ quantidade dos itens de tipo "peca" lançados nas manutenções.
  consumo_peca AS (
    SELECT it->>'itemId' AS origem_id,
           round(sum(public.to_num(it->>'quantidade')), 2) AS total
    FROM public.equipment_maintenance_records r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.itens) = 'array' THEN r.itens ELSE '[]'::jsonb END
    ) it
    WHERE it->>'tipo' = 'peca'
      AND COALESCE(it->>'itemId', '') <> ''
      AND public.to_num(it->>'quantidade') > 0
    GROUP BY 1
  ),

  -- Acessórios: 1 unidade por componente trocado na manutenção de drones.
  consumo_acessorio AS (
    SELECT public.norm_key(c->>'nome') AS nome_norm,
           count(*)::numeric AS total
    FROM public.maintenance_records r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.componentes_trocados) = 'array'
           THEN r.componentes_trocados ELSE '[]'::jsonb END
    ) c
    WHERE public.norm_key(c->>'nome') <> ''
    GROUP BY 1
  ),

  -- Combustível: Σ litros por tipo nos abastecimentos.
  consumo_combustivel AS (
    SELECT public.norm_key(a.tipo_combustivel) AS nome_norm,
           round(sum(a.litros), 2) AS total
    FROM public.equipment_fuel_refuelings a
    WHERE a.tenant_key = t
      AND public.norm_key(a.tipo_combustivel) <> ''
    GROUP BY 1
  ),

  saidas_produto AS (
    SELECT 'prod:' || rp.id::text AS item_key, c.nome_norm, c.total
    FROM public.registered_products rp
    JOIN consumo_produto c ON c.nome_norm = public.norm_key(rp.commercial_name)
    WHERE rp.user_id::text = t OR rp.user_id::text = auth.uid()::text
  ),
  saidas_peca AS (
    SELECT 'peca:' || i.id::text AS item_key, c.origem_id AS nome_norm, c.total
    FROM public.equipment_maintenance_items i
    JOIN consumo_peca c ON c.origem_id = i.id::text
  ),
  saidas_acessorio AS (
    SELECT 'acc:' || cc.id AS item_key, c.nome_norm, c.total
    FROM public.component_catalog cc
    JOIN consumo_acessorio c ON c.nome_norm = public.norm_key(cc.nome)
    WHERE cc.tenant_key = t
  ),
  saidas_combustivel AS (
    SELECT 'comb:' || s.nome_norm AS item_key, s.nome_norm, s.total FROM consumo_combustivel s
  ),

  todas_saidas AS (
    SELECT * FROM saidas_produto
    UNION ALL SELECT * FROM saidas_peca
    UNION ALL SELECT * FROM saidas_acessorio
    UNION ALL SELECT * FROM saidas_combustivel
  ),

  saidas_agregadas AS (
    SELECT item_key, round(sum(total), 2) AS saida_total FROM todas_saidas GROUP BY item_key
  )

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.item_key), '[]'::jsonb) INTO saidas
  FROM saidas_agregadas s;

  ------------------------------------------------------------------
  -- Monta o retrato final: catálogo de cada categoria + entradas + saídas
  ------------------------------------------------------------------
  WITH e AS (SELECT * FROM jsonb_to_recordset(entradas)
               AS (item_key text, categoria text, nome text, entradas_total numeric,
                   valor_ultima_entrada numeric, data_ultima_entrada text)),
       s AS (SELECT * FROM jsonb_to_recordset(saidas)
               AS (item_key text, saida_total numeric)),
       catalogo AS (
         SELECT 'produto'::text AS categoria,
                'prod:' || rp.id::text AS item_key,
                rp.commercial_name AS nome
         FROM public.registered_products rp
         WHERE rp.user_id::text = t OR rp.user_id::text = auth.uid()::text

         UNION ALL
         SELECT 'peca', 'peca:' || i.id::text, i.nome
         FROM public.equipment_maintenance_items i
         WHERE i.ativo AND i.tipo = 'peca'

         UNION ALL
         SELECT 'acessorio', 'acc:' || cc.id, cc.nome
         FROM public.component_catalog cc
         WHERE cc.tenant_key = t

         UNION ALL
         SELECT 'combustivel', 'comb:' || public.norm_key(a.tipo_combustivel), a.tipo_combustivel
         FROM public.equipment_fuel_refuelings a
         WHERE a.tenant_key = t AND public.norm_key(a.tipo_combustivel) <> ''
         GROUP BY public.norm_key(a.tipo_combustivel), a.tipo_combustivel
       ),
       combinado AS (
         SELECT
           c.categoria,
           c.item_key,
           c.nome,
           public.norm_key(c.nome) AS nome_norm,
           round(COALESCE(e.entradas_total, 0), 2) AS entradas_total,
           round(COALESCE(s.saida_total, 0), 2)    AS saida_total,
           round(COALESCE(e.entradas_total, 0) - COALESCE(s.saida_total, 0), 2) AS saldo,
           COALESCE(e.valor_ultima_entrada, 0)     AS valor_ultima_entrada,
           e.data_ultima_entrada
         FROM catalogo c
         LEFT JOIN e ON e.item_key = c.item_key
         LEFT JOIN s ON s.item_key = c.item_key
       )
  SELECT COALESCE(jsonb_object_agg(categoria, itens), '{}'::jsonb) INTO resultado
  FROM (
    SELECT categoria, jsonb_agg(to_jsonb(combinado) ORDER BY nome COLLATE "pt-BR") AS itens
    FROM combinado
    GROUP BY categoria
  ) g;

  RETURN resultado;
END
$$;

REVOKE ALL ON FUNCTION public.stock_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_snapshot() TO authenticated;

COMMENT ON FUNCTION public.stock_snapshot() IS
  'Saldo de estoque consolidado (entradas − saídas) calculado atomicamente no PostgreSQL.';


-- -----------------------------------------------------------------------------
-- RPCs de escrita atômica
-- -----------------------------------------------------------------------------

-- Registra uma entrada e devolve o saldo já recalculado do item.
CREATE OR REPLACE FUNCTION public.register_stock_entry(
  p_categoria    text,
  p_item_key     text,
  p_item_nome    text,
  p_quantidade   numeric,
  p_valor_total  numeric DEFAULT 0,
  p_data         date    DEFAULT CURRENT_DATE,
  p_fornecedor   text    DEFAULT '',
  p_observacao   text    DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  novo_id uuid;
  saldo   numeric;
BEGIN
  IF public.current_tenant_key() IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado para o usuário autenticado';
  END IF;
  IF p_item_key IS NULL OR btrim(p_item_key) = '' THEN
    RAISE EXCEPTION 'item_key é obrigatório';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade <= 0 THEN
    RAISE EXCEPTION 'quantidade deve ser maior que zero';
  END IF;

  INSERT INTO public.stock_entries
    (tenant_key, categoria, item_key, item_nome, quantidade, valor_total, data, fornecedor, observacao)
  VALUES
    (public.current_tenant_key(), p_categoria, p_item_key, p_item_nome,
     p_quantidade, COALESCE(p_valor_total, 0), COALESCE(p_data, CURRENT_DATE),
     COALESCE(p_fornecedor, ''), COALESCE(p_observacao, ''))
  RETURNING id INTO novo_id;

  SELECT COALESCE(sum(e.quantidade), 0) INTO saldo
  FROM public.stock_entries e
  WHERE e.tenant_key = public.current_tenant_key() AND e.item_key = p_item_key;

  RETURN jsonb_build_object('id', novo_id, 'saldo', round(saldo, 2));
END
$$;

-- Exclui uma entrada e devolve o saldo recalculado do item afetado.
CREATE OR REPLACE FUNCTION public.delete_stock_entry(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  alvo       public.stock_entries%ROWTYPE;
  saldo      numeric;
BEGIN
  SELECT * INTO alvo FROM public.stock_entries
  WHERE id = p_id AND tenant_key = public.current_tenant_key()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Entrada de estoque não encontrada';
  END IF;

  DELETE FROM public.stock_entries WHERE id = p_id;

  SELECT COALESCE(sum(e.quantidade), 0) INTO saldo
  FROM public.stock_entries e
  WHERE e.tenant_key = public.current_tenant_key() AND e.item_key = alvo.item_key;

  RETURN jsonb_build_object('item_key', alvo.item_key, 'saldo', round(saldo, 2));
END
$$;

-- Grava o estoque mínimo e devolve a linha resultante (upsert atômico).
CREATE OR REPLACE FUNCTION public.set_stock_minimum(
  p_item_key   text,
  p_categoria  text,
  p_minimo     numeric
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  linha public.stock_settings%ROWTYPE;
BEGIN
  INSERT INTO public.stock_settings (tenant_key, item_key, categoria, minimo, ativo)
  VALUES (public.current_tenant_key(), p_item_key, p_categoria, COALESCE(p_minimo, 0), true)
  ON CONFLICT (tenant_key, item_key) DO UPDATE
    SET minimo = EXCLUDED.minimo,
        categoria = EXCLUDED.categoria,
        ativo = true,
        updated_at = now()
  RETURNING * INTO linha;

  RETURN to_jsonb(linha);
END
$$;

REVOKE ALL ON FUNCTION public.register_stock_entry(text, text, text, numeric, numeric, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_stock_entry(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_stock_minimum(text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_stock_entry(text, text, text, numeric, numeric, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_stock_entry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_stock_minimum(text, text, numeric) TO authenticated;