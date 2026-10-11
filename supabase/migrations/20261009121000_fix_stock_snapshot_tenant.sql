-- =============================================================================
-- Correção: catálogo do estoque filtrado por empresa, não por usuário
-- =============================================================================
-- stock_snapshot filtrava o catálogo com `rp.user_id::text = empresa`, mas
-- user_id é o uuid de uma pessoa, não o da empresa. Como a função é SECURITY
-- DEFINER (ignora RLS), essa comparação não filtrava nada e deixava passar o
-- catálogo inteiro de todos os clientes — ou, quando comparada com
-- auth.uid(), mostrava a cada usuário apenas os produtos que ele mesmo
-- cadastrou.
--
-- O filtro correto é tenant_key, a mesma chave que a RLS usa.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.stock_snapshot(p_branch uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  empresa      text;
  filiais      text[];
  entradas     jsonb;
  saidas       jsonb;
  resultado    jsonb;
BEGIN
  empresa := public.current_tenant_key();
  IF empresa IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  filiais := COALESCE(
    (SELECT array_agg(b.id::text)
       FROM public.branches b
      WHERE b.company_id::text = empresa
        AND b.status = 'active'
        AND (p_branch IS NULL OR b.id = p_branch)
        AND b.id = ANY(public.current_branch_ids())),
    '{}'::text[]
  );

  IF array_length(filiais, 1) IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  ------------------------------------------------------------------
  -- Entradas
  ------------------------------------------------------------------
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.nome), '[]'::jsonb) INTO entradas
  FROM (
    SELECT
      e.item_key                                 AS item_key,
      e.categoria                                AS categoria,
      max(e.item_nome)                           AS nome,
      COALESCE(e.branch_id::text, '__empresa__')  AS branch_key,
      round(COALESCE(sum(
        CASE e.tipo WHEN 'transferencia_saida' THEN -e.quantidade ELSE e.quantidade END), 0), 2)
                                             AS entradas_total,
      round(COALESCE(max(e.valor_total), 0), 2) AS valor_ultima_entrada,
      max(e.data)::text                         AS data_ultima_entrada
    FROM public.stock_entries e
    WHERE e.tenant_key = empresa
      AND COALESCE(e.branch_id::text, '__empresa__') = ANY(filiais)
    GROUP BY e.item_key, e.categoria, COALESCE(e.branch_id::text, '__empresa__')
  ) x;

  ------------------------------------------------------------------
  -- Saídas, atribuídas à filial que as originou
  ------------------------------------------------------------------
  WITH
  consumo_produto AS (
    SELECT COALESCE(os.branch_id::text, '__empresa__') AS branch_key,
           public.norm_key(p.val->>'produto') AS nome_norm,
           round(sum(public.to_num(p.val->>'dose') * public.to_num(ap.val->>'areaAplicada')), 2) AS total
    FROM public.orders_of_service os
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(os.apontamentos) = 'array' THEN os.apontamentos ELSE '[]'::jsonb END
    ) AS ap(val)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(ap.val->'produtosSubstitutos') = 'array'
             AND jsonb_array_length(ap.val->'produtosSubstitutos') > 0
          THEN ap.val->'produtosSubstitutos'
        ELSE COALESCE(
               (os.talhoes -> public.to_num(ap.val->>'talhaoIndex')::int) -> 'produtos',
               '[]'::jsonb
             )
      END
    ) AS p(val)
    WHERE os.tenant_key = empresa
      AND COALESCE(os.branch_id::text, '__empresa__') = ANY(filiais)
      AND public.to_num(ap.val->>'areaAplicada') > 0
      AND public.norm_key(p.val->>'produto') <> ''
    GROUP BY 1, 2
  ),

  consumo_peca AS (
    SELECT COALESCE(r.branch_id::text, '__empresa__') AS branch_key,
           it.val->>'itemId' AS item_id,
           round(sum(public.to_num(it.val->>'quantidade')), 2) AS total
    FROM public.equipment_maintenance_records r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.itens) = 'array' THEN r.itens ELSE '[]'::jsonb END
    ) AS it(val)
    WHERE it.val->>'tipo' = 'peca'
      AND COALESCE(it.val->>'itemId', '') <> ''
      AND public.to_num(it.val->>'quantidade') > 0
      AND COALESCE(r.branch_id::text, '__empresa__') = ANY(filiais)
    GROUP BY 1, 2
  ),

  consumo_acessorio AS (
    SELECT COALESCE(r.branch_id::text, '__empresa__') AS branch_key,
           public.norm_key(cp.val->>'nome') AS nome_norm,
           count(*)::numeric AS total
    FROM public.maintenance_records r
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(r.componentes_trocados) = 'array'
           THEN r.componentes_trocados ELSE '[]'::jsonb END
    ) AS cp(val)
    WHERE public.norm_key(cp.val->>'nome') <> ''
      AND COALESCE(r.branch_id::text, '__empresa__') = ANY(filiais)
    GROUP BY 1, 2
  ),

  consumo_combustivel AS (
    SELECT COALESCE(a.branch_id::text, '__empresa__') AS branch_key,
           public.norm_key(a.tipo_combustivel) AS nome_norm,
           round(sum(a.litros), 2) AS total
    FROM public.equipment_fuel_refuelings a
    WHERE a.tenant_key = empresa
      AND public.norm_key(a.tipo_combustivel) <> ''
      AND COALESCE(a.branch_id::text, '__empresa__') = ANY(filiais)
    GROUP BY 1, 2
  ),

  saidas_produto AS (
    SELECT cp.branch_key, 'prod:' || rp.id::text AS item_key, cp.total
    FROM public.registered_products rp
    JOIN consumo_produto cp ON cp.nome_norm = public.norm_key(rp.commercial_name)
    WHERE rp.tenant_key = empresa
  ),
  saidas_peca AS (
    SELECT cp.branch_key, 'peca:' || mi.id::text AS item_key, cp.total
    FROM public.equipment_maintenance_items mi
    JOIN consumo_peca cp ON cp.item_id = mi.id::text
    WHERE mi.ativo AND mi.tipo = 'peca' AND mi.tenant_key = empresa
  ),
  saidas_acessorio AS (
    SELECT ca.branch_key, 'acc:' || cc.id AS item_key, ca.total
    FROM public.component_catalog cc
    JOIN consumo_acessorio ca ON ca.nome_norm = public.norm_key(cc.nome)
    WHERE cc.tenant_key = empresa
  ),
  saidas_combustivel AS (
    SELECT cb.branch_key, 'comb:' || cb.nome_norm AS item_key, cb.total
    FROM consumo_combustivel cb
  ),

  todas_saidas AS (
    SELECT * FROM saidas_produto
    UNION ALL SELECT * FROM saidas_peca
    UNION ALL SELECT * FROM saidas_acessorio
    UNION ALL SELECT * FROM saidas_combustivel
  ),

  saidas_agregadas AS (
    SELECT branch_key, item_key, round(sum(total), 2) AS saida_total
    FROM todas_saidas GROUP BY branch_key, item_key
  )

  SELECT COALESCE(jsonb_agg(to_jsonb(sg) ORDER BY sg.branch_key, sg.item_key), '[]'::jsonb)
    INTO saidas
  FROM saidas_agregadas sg;

  ------------------------------------------------------------------
  -- Monta o retrato
  ------------------------------------------------------------------
  WITH e AS (
    SELECT * FROM jsonb_to_recordset(entradas)
      AS (item_key text, categoria text, nome text, branch_key text,
          entradas_total numeric, valor_ultima_entrada numeric, data_ultima_entrada text)
  ),
  s AS (
    SELECT * FROM jsonb_to_recordset(saidas)
      AS (branch_key text, item_key text, saida_total numeric)
  ),
  catalogo AS (
    SELECT categoria, item_key, nome, branch_key FROM (
      SELECT 'produto'::text AS categoria, 'prod:' || rp.id::text AS item_key,
             rp.commercial_name AS nome, unnest(filiais) AS branch_key
        FROM public.registered_products rp
       WHERE rp.tenant_key = empresa
      UNION ALL
      SELECT 'peca', 'peca:' || mi.id::text, mi.nome, unnest(filiais)
        FROM public.equipment_maintenance_items mi
       WHERE mi.ativo AND mi.tipo = 'peca' AND mi.tenant_key = empresa
      UNION ALL
      SELECT 'acessorio', 'acc:' || cc.id, cc.nome, unnest(filiais)
        FROM public.component_catalog cc
       WHERE cc.tenant_key = empresa
    ) c
  ),
  combustiveis AS (
    SELECT 'combustivel'::text AS categoria,
           'comb:' || public.norm_key(cb.tipo_combustivel) AS item_key,
           cb.tipo_combustivel AS nome, unnest(filiais) AS branch_key
    FROM public.equipment_fuel_refuelings cb
    WHERE cb.tenant_key = empresa AND public.norm_key(cb.tipo_combustivel) <> ''
    GROUP BY public.norm_key(cb.tipo_combustivel), cb.tipo_combustivel
  ),
  combinado AS (
    SELECT
      cat.categoria                              AS categoria,
      cat.item_key                               AS item_key,
      cat.nome                                   AS nome,
      cat.branch_key                             AS branch_key,
      round(COALESCE(e.entradas_total, 0), 2)   AS entradas_total,
      round(COALESCE(s.saida_total, 0), 2)      AS saida_total,
      round(COALESCE(e.entradas_total, 0) - COALESCE(s.saida_total, 0), 2) AS saldo,
      COALESCE(e.valor_ultima_entrada, 0)       AS valor_ultima_entrada,
      e.data_ultima_entrada                     AS data_ultima_entrada
    FROM (SELECT * FROM catalogo UNION ALL SELECT * FROM combustiveis) cat
    LEFT JOIN e ON e.item_key = cat.item_key AND e.branch_key = cat.branch_key
    LEFT JOIN s ON s.item_key = cat.item_key AND s.branch_key = cat.branch_key
  )
  SELECT COALESCE(jsonb_object_agg(gr.branch_key, gr.itens), '{}'::jsonb) INTO resultado
  FROM (
    SELECT branch_key, jsonb_agg(to_jsonb(combinado) ORDER BY nome) AS itens
    FROM combinado GROUP BY branch_key
  ) gr;

  RETURN resultado;
END
$$;

REVOKE ALL ON FUNCTION public.stock_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_snapshot(uuid) TO authenticated;