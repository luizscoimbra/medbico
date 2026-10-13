-- =============================================================================
-- Sincronização diária da base Agrofit com o cadastro de produtos + histórico
-- =============================================================================
-- Frente de manutenção da base oficial Agrofit/MAPA (dados abertos, CC-BY,
-- atualização diária) para que o cadastro de produtos enriqueça sozinho:
--
--   * registered_products: colunas Agrofit — nº de registro MAPA, formulação
--     oficial e ingredientes ativos (usados como descrição do produto);
--   * agrofit_staging: área temporária de carga do CSV diário (sem policies —
--     escrita apenas pelo service role via scripts/agrofit-sync.mjs);
--   * agrofit_sync_history: trilha de auditoria de TODA atualização, com
--     contagens e amostras do que foi adicionado, modificado e removido;
--   * agrofit_apply_sync: RPC que difere staging × produção (hash md5 por
--     linha, normalizado), aplica o diff preservando ids (remapeando
--     visit_recommendations.agrofit_id), atualiza produtos cadastrados
--     correspondentes e grava a linha de histórico.
--
-- Rotina diária: .github/workflows/agrofit-sync.yml executa
-- scripts/agrofit-sync.mjs (baixa CSV → staging → RPC → resumo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Hash normalizado de linha Agrofit (NULL e '' contam como igual)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.agrofit_row_jsonb(
  p_nr_registro        text,
  p_marca_comercial    text,
  p_formulacao         text,
  p_ingrediente_ativo  text,
  p_titular            text,
  p_classe             text,
  p_modo_de_acao       text,
  p_cultura            text,
  p_praga_cientifico   text,
  p_praga_comum        text,
  p_classe_toxicologica text,
  p_classe_ambiental   text,
  p_organicos          text,
  p_situacao           text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'nr_registro',         coalesce(p_nr_registro, ''),
    'marca_comercial',     coalesce(p_marca_comercial, ''),
    'formulacao',          coalesce(p_formulacao, ''),
    'ingrediente_ativo',   coalesce(p_ingrediente_ativo, ''),
    'titular',             coalesce(p_titular, ''),
    'classe',              coalesce(p_classe, ''),
    'modo_de_acao',        coalesce(p_modo_de_acao, ''),
    'cultura',             coalesce(p_cultura, ''),
    'praga_cientifico',    coalesce(p_praga_cientifico, ''),
    'praga_comum',         coalesce(p_praga_comum, ''),
    'classe_toxicologica', coalesce(p_classe_toxicologica, ''),
    'classe_ambiental',    coalesce(p_classe_ambiental, ''),
    'organicos',           coalesce(p_organicos, ''),
    'situacao',            coalesce(p_situacao, '')
  )
$$;

COMMENT ON FUNCTION public.agrofit_row_jsonb(text, text, text, text, text, text, text, text, text, text, text, text, text, text) IS
  'Representação canônica de uma linha Agrofit para comparação (NULL = vazio).';

-- -----------------------------------------------------------------------------
-- 2. Colunas Agrofit no cadastro de produtos
-- -----------------------------------------------------------------------------
ALTER TABLE public.registered_products
  ADD COLUMN IF NOT EXISTS nr_registro_mapa    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS agrofit_formulacao  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ingredientes_ativos text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.registered_products.nr_registro_mapa IS
  'Nº de registro no MAPA (Agrofit) — validade legal do produto agrotóxico.';
COMMENT ON COLUMN public.registered_products.agrofit_formulacao IS
  'Formulação oficial Agrofit (ex.: "SL - Concentrado Solúvel").';
COMMENT ON COLUMN public.registered_products.ingredientes_ativos IS
  'Ingredientes ativos — descrição técnica do produto (base Agrofit).';

-- -----------------------------------------------------------------------------
-- 3. Staging de carga do CSV diário (sem policies: só service role/postgres)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agrofit_staging (
  nr_registro         text NOT NULL,
  marca_comercial     text NOT NULL,
  formulacao          text,
  ingrediente_ativo   text,
  titular             text,
  classe              text,
  modo_de_acao        text,
  cultura             text,
  praga_cientifico    text,
  praga_comum         text,
  classe_toxicologica text,
  classe_ambiental    text,
  organicos           text,
  situacao            text
);

COMMENT ON TABLE public.agrofit_staging IS
  'Área temporária de carga do CSV Agrofit (diário) — processada por agrofit_apply_sync e limpa a cada execução.';

ALTER TABLE public.agrofit_staging ENABLE ROW LEVEL SECURITY;
-- sem policies: acesso negado a usuários; apenas service_role (bypass) e postgres.

-- -----------------------------------------------------------------------------
-- 4. Histórico de atualizações (auditoria: o que foi adicionado/modificado)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agrofit_sync_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executado_em        timestamptz NOT NULL DEFAULT now(),
  origem              text NOT NULL DEFAULT 'rotina_diaria'
                      CHECK (origem IN ('rotina_diaria', 'manual', 'importacao_inicial')),
  status              text NOT NULL
                      CHECK (status IN ('sem_alteracoes', 'aplicado', 'falha')),
  fonte_alterada      boolean NOT NULL DEFAULT false,
  total_final         integer NOT NULL DEFAULT 0,
  adicionados         integer NOT NULL DEFAULT 0,
  modificados         integer NOT NULL DEFAULT 0,
  removidos           integer NOT NULL DEFAULT 0,
  cadastro_atualizados integer NOT NULL DEFAULT 0,
  mensagem            text NOT NULL DEFAULT '',
  detalhes            jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.agrofit_sync_history IS
  'Trilha de auditoria das atualizações da base Agrofit: o que foi adicionado, modificado e removido, e produtos do cadastro atualizados.';
COMMENT ON COLUMN public.agrofit_sync_history.detalhes IS
  'Amostras limitadas: { adicionados: [...], removidos: [...], modificados: [{registro, marca, cultura, praga, campos: [{campo, de, para}]}], cadastro: [...] }.';
COMMENT ON COLUMN public.agrofit_sync_history.fonte_alterada IS
  'O recurso oficial no portal de dados abertos tinha metadata_modified mais novo que a última execução.';

CREATE INDEX IF NOT EXISTS agrofit_sync_history_data_idx
  ON public.agrofit_sync_history (executado_em DESC);

ALTER TABLE public.agrofit_sync_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read agrofit sync history" ON public.agrofit_sync_history;
CREATE POLICY "Authenticated can read agrofit sync history"
  ON public.agrofit_sync_history FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 5. RPC: aplica staging → produção, atualiza cadastro e grava histórico
-- -----------------------------------------------------------------------------
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
  SELECT count(*) INTO v_stage FROM public.agrofit_staging;
  IF v_stage = 0 THEN
    RAISE EXCEPTION 'Staging vazio: carregue o CSV Agrofit antes de aplicar (scripts/agrofit-sync.mjs)';
  END IF;

  -- Snapshot da produção (id + hash + chave lógica + json normalizado)
  DROP TABLE IF EXISTS _ag_live;
  DROP TABLE IF EXISTS _ag_stage;
  DROP TABLE IF EXISTS _ag_del;
  DROP TABLE IF EXISTS _ag_ins;

  CREATE TEMP TABLE _ag_live AS
    SELECT t.id,
           t.j,
           md5(t.j::text) AS h,
           concat_ws(chr(31), t.j->>'nr_registro', t.j->>'marca_comercial',
                     t.j->>'cultura', t.j->>'praga_cientifico') AS k
      FROM (
        SELECT p.id,
               public.agrofit_row_jsonb(
                 p.nr_registro, p.marca_comercial, p.formulacao, p.ingrediente_ativo,
                 p.titular, p.classe, p.modo_de_acao, p.cultura, p.praga_cientifico,
                 p.praga_comum, p.classe_toxicologica, p.classe_ambiental, p.organicos, p.situacao
               ) AS j
          FROM public.agrofit_produtos p
      ) t;

  CREATE TEMP TABLE _ag_stage AS
    SELECT t.j,
           md5(t.j::text) AS h,
           concat_ws(chr(31), t.j->>'nr_registro', t.j->>'marca_comercial',
                     t.j->>'cultura', t.j->>'praga_cientifico') AS k
      FROM (
        SELECT public.agrofit_row_jsonb(
                 s.nr_registro, s.marca_comercial, s.formulacao, s.ingrediente_ativo,
                 s.titular, s.classe, s.modo_de_acao, s.cultura, s.praga_cientifico,
                 s.praga_comum, s.classe_toxicologica, s.classe_ambiental, s.organicos, s.situacao
               ) AS j
          FROM public.agrofit_staging s
      ) t;
  CREATE INDEX _ag_live_h_idx ON _ag_live (h);
  CREATE INDEX _ag_stage_h_idx ON _ag_stage (h);
  CREATE INDEX _ag_live_k_idx ON _ag_live (k);
  CREATE INDEX _ag_stage_k_idx ON _ag_stage (k);

  -- Conjunto a remover (linha da produção que não existe mais na fonte)
  CREATE TEMP TABLE _ag_del AS
    SELECT l.id, l.k, l.j
      FROM _ag_live l
     WHERE NOT EXISTS (SELECT 1 FROM _ag_stage s WHERE s.h = l.h);

  -- Contagens e amostras do diff
  SELECT count(*) INTO v_adicionados
    FROM _ag_stage s
   WHERE NOT EXISTS (SELECT 1 FROM _ag_live l WHERE l.h = s.h);

  SELECT count(*) INTO v_removidos
    FROM _ag_del d
   WHERE NOT EXISTS (SELECT 1 FROM _ag_stage s WHERE s.k = d.k);

  SELECT count(DISTINCT d.k) INTO v_modificados
    FROM _ag_del d
   WHERE EXISTS (SELECT 1 FROM _ag_stage s WHERE s.k = d.k);

  SELECT coalesce(jsonb_agg(x.d ORDER BY x.d->>'marca_comercial'), '[]'::jsonb) INTO v_det_ad
    FROM (
      SELECT jsonb_build_object('registro', s.j->>'nr_registro', 'marca', s.j->>'marca_comercial',
                                'cultura', s.j->>'cultura', 'praga', s.j->>'praga_cientifico') AS d
        FROM _ag_stage s
       WHERE NOT EXISTS (SELECT 1 FROM _ag_live l WHERE l.h = s.h)
       ORDER BY s.j->>'marca_comercial'
       LIMIT 500
    ) x;

  SELECT coalesce(jsonb_agg(x.d ORDER BY x.d->>'marca_comercial'), '[]'::jsonb) INTO v_det_rm
    FROM (
      SELECT jsonb_build_object('registro', d.j->>'nr_registro', 'marca', d.j->>'marca_comercial',
                                'cultura', d.j->>'cultura', 'praga', d.j->>'praga_cientifico') AS d
        FROM _ag_del d
       WHERE NOT EXISTS (SELECT 1 FROM _ag_stage s WHERE s.k = d.k)
       ORDER BY d.j->>'marca_comercial'
       LIMIT 500
    ) x;

  SELECT coalesce(jsonb_agg(m.d ORDER BY m.d->>'marca_comercial'), '[]'::jsonb) INTO v_det_mod
    FROM (
      SELECT DISTINCT ON (x.k)
             jsonb_build_object(
               'registro', x.j->>'nr_registro',
               'marca',    x.j->>'marca_comercial',
               'cultura',  x.j->>'cultura',
               'praga',    x.j->>'praga_cientifico',
               'campos',   coalesce((
                 SELECT jsonb_agg(jsonb_build_object('campo', e.key, 'de', x.j -> e.key, 'para', y.j -> e.key))
                   FROM jsonb_each(x.j) e
                  WHERE x.j -> e.key IS DISTINCT FROM y.j -> e.key
               ), '[]'::jsonb)
             ) AS d
        FROM _ag_del x
        JOIN _ag_stage y ON y.k = x.k
       ORDER BY x.k
       LIMIT 300
    ) m;

  -- Aplicação: insere as linhas novas (ids novos preservam os existentes)
  INSERT INTO public.agrofit_produtos (
    nr_registro, marca_comercial, formulacao, ingrediente_ativo, titular, classe,
    modo_de_acao, cultura, praga_cientifico, praga_comum, classe_toxicologica,
    classe_ambiental, organicos, situacao
  )
  SELECT s.j->>'nr_registro', s.j->>'marca_comercial', s.j->>'formulacao',
         s.j->>'ingrediente_ativo', s.j->>'titular', s.j->>'classe',
         s.j->>'modo_de_acao', s.j->>'cultura', s.j->>'praga_cientifico',
         s.j->>'praga_comum', s.j->>'classe_toxicologica', s.j->>'classe_ambiental',
         s.j->>'organicos', s.j->>'situacao'
    FROM _ag_stage s
   WHERE NOT EXISTS (SELECT 1 FROM _ag_live l WHERE l.h = s.h);

  CREATE TEMP TABLE _ag_ins AS
    SELECT p.id,
           concat_ws(chr(31), p.nr_registro, p.marca_comercial,
                     coalesce(p.cultura, ''), coalesce(p.praga_cientifico, '')) AS k
      FROM public.agrofit_produtos p
     WHERE NOT EXISTS (SELECT 1 FROM _ag_live l WHERE l.id = p.id);

  -- Remapeia recomendações que apontavam para linhas substituídas (mesma chave lógica)
  UPDATE public.visit_recommendations r
     SET agrofit_id = i.id
    FROM _ag_del d
    JOIN _ag_ins i ON i.k = d.k
   WHERE r.agrofit_id = d.id;

  -- Remove linhas obsoletas (removidas da fonte ou substituídas por versão nova)
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

COMMENT ON FUNCTION public.agrofit_apply_sync(text, boolean, text) IS
  'Difere o staging × produção por hash de linha, aplica o diff preservando ids, atualiza produtos cadastrados correspondentes e grava o histórico da execução.';

REVOKE ALL ON FUNCTION public.agrofit_apply_sync(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agrofit_apply_sync(text, boolean, text) TO service_role;
