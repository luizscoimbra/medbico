-- =============================================================================
-- Correção: public.stock_snapshot()
-- =============================================================================
-- A versão anterior referenciava o alias de jsonb_array_elements() sem nomear a
-- coluna (`p->>'produto'`). O PostgreSQL resolvia `p` como a linha inteira
-- (record) em vez da coluna jsonb, e a chamada falhava com:
--   operator does not exist: record ->> unknown
--
-- A correção nomeia explicitamente a coluna de cada lateral join.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.stock_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t         text;
  entradas   jsonb;
  saidas     jsonb;
  resultado  jsonb;
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
    SELECT public.norm_key(p.val->>'produto') AS nome_norm,
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
    WHERE os.tenant_key = t
      AND public.to_num(ap.val->>'areaAplicada') > 0
      AND public.norm_key(p.val->>'produto') <> ''
    GROUP BY 1
  ),

  -- Peças: Σ quantidade dos itens de tipo "peca" lançados nas manutenções.
  consumo_peca AS (
    SELECT it.val->>'itemId' AS origem_id,
           round(sum(public.to_num(it.val->>'quantidade')), 2) AS total
    FROM public.equipment_maintenance_records mr
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(mr.itens) = 'array' THEN mr.itens ELSE '[]'::jsonb END
    ) AS it(val)
    WHERE it.val->>'tipo' = 'peca'
      AND COALESCE(it.val->>'itemId', '') <> ''
      AND public.to_num(it.val->>'quantidade') > 0
    GROUP BY 1
  ),

  -- Acessórios: 1 unidade por componente trocado na manutenção de drones.
  consumo_acessorio AS (
    SELECT public.norm_key(cp.val->>'nome') AS nome_norm,
           count(*)::numeric AS total
    FROM public.maintenance_records dr
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(dr.componentes_trocados) = 'array'
           THEN dr.componentes_trocados ELSE '[]'::jsonb END
    ) AS cp(val)
    WHERE public.norm_key(cp.val->>'nome') <> ''
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
    SELECT 'prod:' || rp.id::text AS item_key, cp.nome_norm, cp.total
    FROM public.registered_products rp
    JOIN consumo_produto cp ON cp.nome_norm = public.norm_key(rp.commercial_name)
    WHERE rp.user_id::text = t OR rp.user_id::text = auth.uid()::text
  ),
  saidas_peca AS (
    SELECT 'peca:' || mi.id::text AS item_key, cp.origem_id AS nome_norm, cp.total
    FROM public.equipment_maintenance_items mi
    JOIN consumo_peca cp ON cp.origem_id = mi.id::text
  ),
  saidas_acessorio AS (
    SELECT 'acc:' || cc.id AS item_key, ca.nome_norm, ca.total
    FROM public.component_catalog cc
    JOIN consumo_acessorio ca ON ca.nome_norm = public.norm_key(cc.nome)
    WHERE cc.tenant_key = t
  ),
  saidas_combustivel AS (
    SELECT 'comb:' || ccb.nome_norm AS item_key, ccb.nome_norm, ccb.total
    FROM consumo_combustivel ccb
  ),

  todas_saidas AS (
    SELECT * FROM saidas_produto
    UNION ALL SELECT * FROM saidas_peca
    UNION ALL SELECT * FROM saidas_acessorio
    UNION ALL SELECT * FROM saidas_combustivel
  ),

  saidas_agregadas AS (
    SELECT item_key, round(sum(total), 2) AS saida_total
    FROM todas_saidas
    GROUP BY item_key
  )

  SELECT COALESCE(jsonb_agg(to_jsonb(sg) ORDER BY sg.item_key), '[]'::jsonb) INTO saidas
  FROM saidas_agregadas sg;

  ------------------------------------------------------------------
  -- Monta o retrato final: catálogo de cada categoria + entradas + saídas
  ------------------------------------------------------------------
  WITH e AS (
    SELECT * FROM jsonb_to_recordset(entradas)
      AS (item_key text, categoria text, nome text, entradas_total numeric,
          valor_ultima_entrada numeric, data_ultima_entrada text)
  ),
  s AS (
    SELECT * FROM jsonb_to_recordset(saidas)
      AS (item_key text, saida_total numeric)
  ),
  catalogo AS (
    SELECT 'produto'::text AS categoria,
           'prod:' || rp.id::text AS item_key,
           rp.commercial_name AS nome
    FROM public.registered_products rp
    WHERE rp.user_id::text = t OR rp.user_id::text = auth.uid()::text

    UNION ALL
    SELECT 'peca', 'peca:' || mi.id::text, mi.nome
    FROM public.equipment_maintenance_items mi
    WHERE mi.ativo AND mi.tipo = 'peca'

    UNION ALL
    SELECT 'acessorio', 'acc:' || cc.id, cc.nome
    FROM public.component_catalog cc
    WHERE cc.tenant_key = t

    UNION ALL
    SELECT 'combustivel', 'comb:' || public.norm_key(cb.tipo_combustivel), cb.tipo_combustivel
    FROM public.equipment_fuel_refuelings cb
    WHERE cb.tenant_key = t AND public.norm_key(cb.tipo_combustivel) <> ''
    GROUP BY public.norm_key(cb.tipo_combustivel), cb.tipo_combustivel
  ),
  combinado AS (
    SELECT
      cat.categoria                                   AS categoria,
      cat.item_key                                    AS item_key,
      cat.nome                                        AS nome,
      public.norm_key(cat.nome)                       AS nome_norm,
      round(COALESCE(e.entradas_total, 0), 2)        AS entradas_total,
      round(COALESCE(s.saida_total, 0), 2)           AS saida_total,
      round(COALESCE(e.entradas_total, 0) - COALESCE(s.saida_total, 0), 2) AS saldo,
      COALESCE(e.valor_ultima_entrada, 0)            AS valor_ultima_entrada,
      e.data_ultima_entrada                          AS data_ultima_entrada
    FROM catalogo cat
    LEFT JOIN e ON e.item_key = cat.item_key
    LEFT JOIN s ON s.item_key = cat.item_key
  )
  SELECT COALESCE(jsonb_object_agg(gr.categoria, gr.itens), '{}'::jsonb) INTO resultado
  FROM (
    SELECT categoria, jsonb_agg(to_jsonb(combinado) ORDER BY nome COLLATE "pt-BR") AS itens
    FROM combinado
    GROUP BY categoria
  ) gr;

  RETURN resultado;
END
$$;

REVOKE ALL ON FUNCTION public.stock_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_snapshot() TO authenticated;