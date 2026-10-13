-- =============================================================================
-- Sync Agrofit: staging com id + RPC de aplicação otimizada
-- =============================================================================
-- A primeira versão de agrofit_apply_sync estourava o timeout do gateway
-- (524) por montar temporárias largas (jsonb por linha) e fazer 6 anti-joins
-- aninhados sobre 280 mil linhas. Reescrita:
--
--   * agrofit_staging ganha `id` (identity) — detalhes do diff resolvem por PK
--     em vez de carregar jsonb nas junções;
--   * temporárias guardam só id/h/k (hash md5 + chave lógica), ~12 MB;
--   * um único FULL OUTER JOIN por hash produz adicionados/removidos/chaves;
--   * work_mem elevado na execução (função isolada em própria transação).
-- =============================================================================

TRUNCATE public.agrofit_staging;

ALTER TABLE public.agrofit_staging
  ADD COLUMN IF NOT EXISTS id bigint GENERATED ALWAYS AS IDENTITY;

CREATE OR REPLACE FUNCTION public.agrofit_apply_sync(
  p_origem         text    DEFAULT 'rotina_diaria',
  p_fonte_alterada boolean DEFAULT true,
  p_mensagem       text    DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_stage       integer;
  v_adicionados integer := 0;
  v_removidos   integer := 0;
  v_modificados integer := 0;
  v_cadastro    integer := 0;
  v_total       integer := 0;
  v_status      text;
  v_det_ad      jsonb := '[]'::jsonb;
  v_det_rm      jsonb := '[]'::jsonb;
  v_det_mod     jsonb := '[]'::jsonb;
  v_det_cad     jsonb := '[]'::jsonb;
  v_id          uuid;
BEGIN
  PERFORM set_config('work_mem', '512MB', true);

  SELECT count(*) INTO v_stage FROM public.agrofit_staging;
  IF v_stage = 0 THEN
    RAISE EXCEPTION 'Staging vazio: carregue o CSV Agrofit antes de aplicar (scripts/agrofit-sync.mjs)';
  END IF;

  DROP TABLE IF EXISTS _ag_live;
  DROP TABLE IF EXISTS _ag_stage;
  DROP TABLE IF EXISTS _cmp;
  DROP TABLE IF EXISTS _ag_del;
  DROP TABLE IF EXISTS _ag_ins;

  -- Lado produção: só id + hash + chave lógica (jsonb transitório no hash)
  CREATE TEMP TABLE _ag_live AS
    SELECT p.id,
           md5(public.agrofit_row_jsonb(
             p.nr_registro, p.marca_comercial, p.formulacao, p.ingrediente_ativo,
             p.titular, p.classe, p.modo_de_acao, p.cultura, p.praga_cientifico,
             p.praga_comum, p.classe_toxicologica, p.classe_ambiental, p.organicos, p.situacao
           )::text) AS h,
           concat_ws(chr(31), coalesce(p.nr_registro, ''), coalesce(p.marca_comercial, ''),
                     coalesce(p.cultura, ''), coalesce(p.praga_cientifico, '')) AS k
      FROM public.agrofit_produtos p;

  -- Lado staging: id de linha para resolver detalhes depois
  CREATE TEMP TABLE _ag_stage AS
    SELECT st.id AS sid,
           md5(public.agrofit_row_jsonb(
             st.nr_registro, st.marca_comercial, st.formulacao, st.ingrediente_ativo,
             st.titular, st.classe, st.modo_de_acao, st.cultura, st.praga_cientifico,
             st.praga_comum, st.classe_toxicologica, st.classe_ambiental, st.organicos, st.situacao
           )::text) AS h,
           concat_ws(chr(31), coalesce(st.nr_registro, ''), coalesce(st.marca_comercial, ''),
                     coalesce(st.cultura, ''), coalesce(st.praga_cientifico, '')) AS k
      FROM public.agrofit_staging st;
  CREATE INDEX _ag_stage_k_idx ON _ag_stage (k);

  -- Único passe: igualdade por hash de conteúdo
  CREATE TEMP TABLE _cmp AS
    SELECT l.id, l.k AS lk, s.sid, s.k AS sk
      FROM _ag_live l
      FULL OUTER JOIN _ag_stage s ON s.h = l.h;
  CREATE INDEX _cmp_sk_idx ON _cmp (sk);
  CREATE INDEX _cmp_lk_idx ON _cmp (lk);

  -- Removidos: linha da produção sem correspondente no staging
  CREATE TEMP TABLE _ag_del AS
    SELECT c.id, c.lk FROM _cmp c WHERE c.sid IS NULL;
  CREATE INDEX _ag_del_k_idx ON _ag_del (lk);

  SELECT count(*) INTO v_adicionados FROM _cmp c WHERE c.id IS NULL;

  SELECT count(*) INTO v_removidos
    FROM _ag_del d
   WHERE NOT EXISTS (SELECT 1 FROM _ag_stage s WHERE s.k = d.lk);

  SELECT count(DISTINCT d.lk) INTO v_modificados
    FROM _ag_del d
   WHERE EXISTS (SELECT 1 FROM _ag_stage s WHERE s.k = d.lk);

  -- Amostras do diff (detalhes resolvem por id/PK, fora das junções grandes)
  SELECT coalesce(jsonb_agg(x.d ORDER BY x.d->>'marca_comercial'), '[]'::jsonb) INTO v_det_ad
    FROM (
      SELECT jsonb_build_object('registro', st.nr_registro, 'marca', st.marca_comercial,
                                'cultura', st.cultura, 'praga', st.praga_cientifico) AS d
        FROM _cmp c
        JOIN public.agrofit_staging st ON st.id = c.sid
       WHERE c.id IS NULL
       ORDER BY st.marca_comercial
       LIMIT 500
    ) x;

  SELECT coalesce(jsonb_agg(x.d ORDER BY x.d->>'marca_comercial'), '[]'::jsonb) INTO v_det_rm
    FROM (
      SELECT jsonb_build_object('registro', p.nr_registro, 'marca', p.marca_comercial,
                                'cultura', p.cultura, 'praga', p.praga_cientifico) AS d
        FROM (
          SELECT d.id FROM _ag_del d
           WHERE NOT EXISTS (SELECT 1 FROM _ag_stage s WHERE s.k = d.lk)
           ORDER BY d.id
           LIMIT 500
        ) ids
        JOIN public.agrofit_produtos p ON p.id = ids.id
       ORDER BY p.marca_comercial
    ) x;

  SELECT coalesce(jsonb_agg(m.d ORDER BY m.d->>'marca_comercial'), '[]'::jsonb) INTO v_det_mod
    FROM (
      SELECT DISTINCT ON (k.lk)
             jsonb_build_object(
               'registro', po.nr_registro,
               'marca',    po.marca_comercial,
               'cultura',  po.cultura,
               'praga',    po.praga_cientifico,
               'campos',   coalesce((
                 SELECT jsonb_agg(jsonb_build_object('campo', e.key, 'de', velho.jo -> e.key, 'para', novo.jn -> e.key))
                   FROM jsonb_each(velho.jo) e
                  WHERE velho.jo -> e.key IS DISTINCT FROM novo.jn -> e.key
               ), '[]'::jsonb)
             ) AS d
        FROM (
          SELECT DISTINCT d.lk
            FROM _ag_del d
           WHERE EXISTS (SELECT 1 FROM _ag_stage s WHERE s.k = d.lk)
           ORDER BY d.lk
           LIMIT 300
        ) k
        JOIN (
          SELECT DISTINCT ON (d.lk) d.lk, d.id FROM _ag_del d ORDER BY d.lk, d.id
        ) old ON old.lk = k.lk
        JOIN public.agrofit_produtos po ON po.id = old.id
        CROSS JOIN LATERAL (
          SELECT public.agrofit_row_jsonb(
                   po.nr_registro, po.marca_comercial, po.formulacao, po.ingrediente_ativo,
                   po.titular, po.classe, po.modo_de_acao, po.cultura, po.praga_cientifico,
                   po.praga_comum, po.classe_toxicologica, po.classe_ambiental, po.organicos, po.situacao
                 ) AS jo
        ) velho
        CROSS JOIN LATERAL (
          SELECT public.agrofit_row_jsonb(
                   st.nr_registro, st.marca_comercial, st.formulacao, st.ingrediente_ativo,
                   st.titular, st.classe, st.modo_de_acao, st.cultura, st.praga_cientifico,
                   st.praga_comum, st.classe_toxicologica, st.classe_ambiental, st.organicos, st.situacao
                 ) AS jn
            FROM (
              SELECT DISTINCT ON (s.k) s.sid FROM _ag_stage s WHERE s.k = k.lk
            ) pick
            JOIN public.agrofit_staging st ON st.id = pick.sid
        ) novo
       ORDER BY k.lk
    ) m;

  -- Aplicação: insere linhas novas (ids existentes permanecem)
  INSERT INTO public.agrofit_produtos (
    nr_registro, marca_comercial, formulacao, ingrediente_ativo, titular, classe,
    modo_de_acao, cultura, praga_cientifico, praga_comum, classe_toxicologica,
    classe_ambiental, organicos, situacao
  )
  SELECT st.nr_registro, st.marca_comercial, st.formulacao, st.ingrediente_ativo,
         st.titular, st.classe, st.modo_de_acao, st.cultura, st.praga_cientifico,
         st.praga_comum, st.classe_toxicologica, st.classe_ambiental, st.organicos, st.situacao
    FROM public.agrofit_staging st
   WHERE NOT EXISTS (
     SELECT 1 FROM _ag_live l
      WHERE l.h = md5(public.agrofit_row_jsonb(
        st.nr_registro, st.marca_comercial, st.formulacao, st.ingrediente_ativo,
        st.titular, st.classe, st.modo_de_acao, st.cultura, st.praga_cientifico,
        st.praga_comum, st.classe_toxicologica, st.classe_ambiental, st.organicos, st.situacao)::text)
   );

  CREATE TEMP TABLE _ag_ins AS
    SELECT p.id,
           concat_ws(chr(31), coalesce(p.nr_registro, ''), coalesce(p.marca_comercial, ''),
                     coalesce(p.cultura, ''), coalesce(p.praga_cientifico, '')) AS k
      FROM public.agrofit_produtos p
     WHERE NOT EXISTS (SELECT 1 FROM _ag_live l WHERE l.id = p.id);
  CREATE INDEX _ag_ins_k_idx ON _ag_ins (k);

  -- Remapeia recomendações que apontavam para linhas substituídas
  UPDATE public.visit_recommendations r
     SET agrofit_id = i.id
    FROM _ag_del d
    JOIN _ag_ins i ON i.k = d.lk
   WHERE r.agrofit_id = d.id;

  -- Remove linhas obsoletas (fora da fonte ou substituídas por versão nova)
  DELETE FROM public.agrofit_produtos p
   USING _ag_del d
   WHERE p.id = d.id;

  -- Enriquece produtos já cadastrados (marca ou nº de registro correspondente)
  WITH src AS (
    SELECT DISTINCT ON (lower(btrim(marca_comercial)))
           lower(btrim(marca_comercial)) AS marca,
           nr_registro,
           coalesce(formulacao, '')          AS formulacao,
           coalesce(ingrediente_ativo, '')   AS ingrediente_ativo
      FROM public.agrofit_staging
     ORDER BY lower(btrim(marca_comercial)), nr_registro
  ),
  upd AS (
    UPDATE public.registered_products rp
       SET nr_registro_mapa    = s.nr_registro,
           agrofit_formulacao  = s.formulacao,
           ingredientes_ativos = s.ingrediente_ativo,
           updated_at          = now()
      FROM src s
     WHERE (lower(btrim(rp.commercial_name)) = s.marca
            OR (rp.nr_registro_mapa <> '' AND rp.nr_registro_mapa = s.nr_registro))
       AND (rp.nr_registro_mapa    IS DISTINCT FROM s.nr_registro
         OR rp.agrofit_formulacao  IS DISTINCT FROM s.formulacao
         OR rp.ingredientes_ativos IS DISTINCT FROM s.ingrediente_ativo)
    RETURNING jsonb_build_object(
                'produto', rp.commercial_name,
                'de', jsonb_build_object('registro', rp.nr_registro_mapa,
                                         'formulacao', rp.agrofit_formulacao,
                                         'ingredientes', rp.ingredientes_ativos),
                'para', jsonb_build_object('registro', s.nr_registro,
                                           'formulacao', s.formulacao,
                                           'ingredientes', s.ingrediente_ativo)
              ) AS d
  )
  SELECT coalesce(jsonb_agg(d ORDER BY d->>'produto'), '[]'::jsonb) INTO v_det_cad FROM upd;

  v_cadastro := jsonb_array_length(v_det_cad);
  SELECT count(*) INTO v_total FROM public.agrofit_produtos;

  v_status := CASE
    WHEN (v_adicionados + v_modificados + v_removidos + v_cadastro) > 0 THEN 'aplicado'
    ELSE 'sem_alteracoes'
  END;

  INSERT INTO public.agrofit_sync_history (
    origem, status, fonte_alterada, total_final, adicionados, modificados,
    removidos, cadastro_atualizados, mensagem, detalhes
  ) VALUES (
    coalesce(nullif(btrim(p_origem), ''), 'rotina_diaria'),
    v_status,
    p_fonte_alterada,
    v_total,
    v_adicionados,
    v_modificados,
    v_removidos,
    v_cadastro,
    coalesce(p_mensagem, ''),
    jsonb_build_object('adicionados', v_det_ad, 'removidos', v_det_rm,
                       'modificados', v_det_mod, 'cadastro', v_det_cad)
  )
  RETURNING id INTO v_id;

  DROP TABLE IF EXISTS _ag_live;
  DROP TABLE IF EXISTS _ag_stage;
  DROP TABLE IF EXISTS _cmp;
  DROP TABLE IF EXISTS _ag_del;
  DROP TABLE IF EXISTS _ag_ins;

  RETURN jsonb_build_object(
    'id', v_id,
    'status', v_status,
    'total_final', v_total,
    'adicionados', v_adicionados,
    'modificados', v_modificados,
    'removidos', v_removidos,
    'cadastro_atualizados', v_cadastro,
    'mensagem', coalesce(p_mensagem, '')
  );
END
$$;

REVOKE ALL ON FUNCTION public.agrofit_apply_sync(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agrofit_apply_sync(text, boolean, text) TO service_role;
