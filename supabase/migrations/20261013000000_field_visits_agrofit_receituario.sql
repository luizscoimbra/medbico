-- =============================================================================
-- Gestão de Visitas de Campo, Base Agrofit (MAPA) e Receituário Agronômico
-- =============================================================================
-- Frente do roadmap de gestão fitossanitária (Lei 7.802/1989 e 14.785/2023):
--
--   * companies: dados do responsável técnico legalizador (CREA/ART);
--   * agrofit_produtos: base oficial de produtos registrados no MAPA
--     (dados abertos — produto formulado, registro × cultura × praga) usada
--     para validar que só se prescrevem produtos/culturas/alvos autorizados;
--   * field_visits / visit_diagnoses: visita de campo com check-in GPS,
--     diagnóstico fitossanitário e fotos geolocalizadas;
--   * visit_recommendations: recomendação técnica e intenção de compra
--     (dose × área → quantidade total), vinculada ao produto Agrofit;
--   * agronomic_prescriptions: Receituário Agronômico com snapshot legal,
--     numeração sequencial e assinatura eletrônica (WebAuthn/toque).
--
-- Padrões replicados das tabelas existentes: tenant_key + branch_id + RLS,
-- gravação de empresa via RPC (companies não tem policy de UPDATE).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Responsável técnico (legalizador) — cadastro na Empresa/Matriz
-- -----------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tecnico_nome   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tecnico_titulo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tecnico_crea   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tecnico_art    text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.companies.tecnico_nome   IS 'Nome do profissional legalizador (Receituário Agronômico).';
COMMENT ON COLUMN public.companies.tecnico_titulo IS 'Título profissional (ex.: Engenheiro Agrônomo, Técnico Agrícola).';
COMMENT ON COLUMN public.companies.tecnico_crea   IS 'Número do CREA (com UF, ex.: CREA-SP 123456).';
COMMENT ON COLUMN public.companies.tecnico_art    IS 'ART — Anotação de Responsabilidade Técnica (padrão a usar nos receituários).';

CREATE OR REPLACE FUNCTION public.update_company_tecnico(
  p_nome   text DEFAULT '',
  p_titulo text DEFAULT '',
  p_crea   text DEFAULT '',
  p_art    text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master pode alterar os dados do responsável técnico';
  END IF;
  IF empresa IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a uma empresa';
  END IF;

  UPDATE public.companies
     SET tecnico_nome   = btrim(COALESCE(p_nome, '')),
         tecnico_titulo = btrim(COALESCE(p_titulo, '')),
         tecnico_crea   = btrim(COALESCE(p_crea, '')),
         tecnico_art    = btrim(COALESCE(p_art, '')),
         updated_at     = now()
   WHERE id = empresa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.update_company_tecnico(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_company_tecnico(text, text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Base Agrofit — dados abertos do MAPA (CC-BY)
--    https://dados.agricultura.gov.br/dataset/sistema-de-agrotoxicos-fitossanitarios-agrofit
--    Uma linha por combinação registro × cultura × praga autorizada.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agrofit_produtos (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  situacao            text,
  criado_em           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agrofit_produtos IS
  'Base oficial Agrofit/MAPA: registro × cultura × praga autorizados (dados abertos, atualização diária).';

CREATE INDEX IF NOT EXISTS agrofit_cultura_idx    ON public.agrofit_produtos (lower(cultura));
CREATE INDEX IF NOT EXISTS agrofit_registro_idx   ON public.agrofit_produtos (nr_registro);
CREATE INDEX IF NOT EXISTS agrofit_marca_idx      ON public.agrofit_produtos (lower(marca_comercial));
CREATE INDEX IF NOT EXISTS agrofit_praga_idx      ON public.agrofit_produtos (lower(praga_cientifico));

ALTER TABLE public.agrofit_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read agrofit" ON public.agrofit_produtos;
CREATE POLICY "Authenticated can read agrofit"
  ON public.agrofit_produtos FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- 3. Visitas de campo (check-in GPS + diagnóstico + fotos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.field_visits (
  id               text PRIMARY KEY,
  user_id          uuid NOT NULL DEFAULT auth.uid(),
  branch_id        uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  tenant_key       text NOT NULL DEFAULT public.current_tenant_key(),
  data             date NOT NULL DEFAULT CURRENT_DATE,
  cliente_id       uuid,
  cliente_nome     text,
  area_nome        text NOT NULL DEFAULT '',
  talhao_nome      text,
  coordenadas      text,
  fase_fenologica  text,
  cultura          text,
  observacoes      text,
  fotos            jsonb NOT NULL DEFAULT '[]'::jsonb,
  status           text NOT NULL DEFAULT 'em_campo'
                   CHECK (status IN ('planejada', 'em_campo', 'concluida', 'cancelada')),
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.field_visits IS
  'Visitas do agrônomo: check-in GPS, diagnóstico do talhão, fotos e laudo técnico.';
COMMENT ON COLUMN public.field_visits.fotos IS
  'Array JSON: [{ base64, em, coordenadas, observacao }] — imagens comprimidas no cliente.';
COMMENT ON COLUMN public.field_visits.cultura IS
  'Cultura do talhão visitada — filtra a base Agrofit na recomendação.';

CREATE INDEX IF NOT EXISTS field_visits_data_idx    ON public.field_visits (data DESC);
CREATE INDEX IF NOT EXISTS field_visits_status_idx  ON public.field_visits (status);
CREATE INDEX IF NOT EXISTS field_visits_tenant_idx  ON public.field_visits (tenant_key);

ALTER TABLE public.field_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant and branch can manage field_visits" ON public.field_visits;
CREATE POLICY "Tenant and branch can manage field_visits"
  ON public.field_visits FOR ALL
  USING ((tenant_key = public.current_tenant_key()) AND (branch_id IS NULL OR branch_id = ANY (public.current_branch_ids())))
  WITH CHECK ((tenant_key = public.current_tenant_key()) AND (branch_id IS NULL OR branch_id = ANY (public.current_branch_ids())));

-- -----------------------------------------------------------------------------
-- 4. Diagnósticos da visita (alvo biológico × severidade)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visit_diagnoses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      text NOT NULL REFERENCES public.field_visits(id) ON DELETE CASCADE,
  tenant_key    text NOT NULL DEFAULT public.current_tenant_key(),
  alvo_cientifico text NOT NULL,
  alvo_comum    text,
  severidade    text NOT NULL CHECK (severidade IN ('baixa', 'media', 'alta')),
  percentual    numeric,
  observacao    text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visit_diagnoses_visit_idx ON public.visit_diagnoses (visit_id);

ALTER TABLE public.visit_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant and branch can manage visit_diagnoses" ON public.visit_diagnoses;
CREATE POLICY "Tenant and branch can manage visit_diagnoses"
  ON public.visit_diagnoses FOR ALL
  USING (tenant_key = public.current_tenant_key())
  WITH CHECK (tenant_key = public.current_tenant_key());

-- -----------------------------------------------------------------------------
-- 5. Recomendações técnicas e intenção de compra
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visit_recommendations (
  id                     text PRIMARY KEY,
  visit_id               text NOT NULL REFERENCES public.field_visits(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL DEFAULT auth.uid(),
  branch_id              uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  tenant_key             text NOT NULL DEFAULT public.current_tenant_key(),
  agrofit_id             bigint REFERENCES public.agrofit_produtos(id) ON DELETE SET NULL,
  nr_registro             text,
  marca_comercial         text,
  ingrediente_ativo       text,
  dose                   numeric,
  dose_unidade           text NOT NULL DEFAULT 'L/ha',
  area_ha                numeric,
  quantidade_total       numeric,
  intervalo_seguranca_dias integer,
  periodo_reentrada_dias  integer,
  modo_aplicacao         text,
  volume_calda_l_ha      numeric,
  janela_inicio          date,
  janela_fim             date,
  observacao             text,
  status                 text NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente', 'enviada', 'comprada', 'aplicada', 'cancelada')),
  criado_em              timestamptz NOT NULL DEFAULT now(),
  atualizado_em          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.visit_recommendations IS
  'Recomendação técnica da visita: dose × área = quantidade total; vira intenção de compra para suprimentos/estoque.';

CREATE INDEX IF NOT EXISTS visit_recs_visit_idx ON public.visit_recommendations (visit_id);
CREATE INDEX IF NOT EXISTS visit_recs_status_idx ON public.visit_recommendations (status);

ALTER TABLE public.visit_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant and branch can manage visit_recommendations" ON public.visit_recommendations;
CREATE POLICY "Tenant and branch can manage visit_recommendations"
  ON public.visit_recommendations FOR ALL
  USING ((tenant_key = public.current_tenant_key()) AND (branch_id IS NULL OR branch_id = ANY (public.current_branch_ids())))
  WITH CHECK ((tenant_key = public.current_tenant_key()) AND (branch_id IS NULL OR branch_id = ANY (public.current_branch_ids())));

-- -----------------------------------------------------------------------------
-- 6. Receituário Agronômico (documento legal)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.receituario_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.agronomic_prescriptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            text NOT NULL UNIQUE,
  visit_id          text REFERENCES public.field_visits(id) ON DELETE SET NULL,
  user_id           uuid NOT NULL DEFAULT auth.uid(),
  branch_id         uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  tenant_key        text NOT NULL DEFAULT public.current_tenant_key(),
  dados             jsonb NOT NULL DEFAULT '{}'::jsonb,
  assinatura_base64 text,
  assinado_em       timestamptz,
  assinado_por_nome text,
  assinatura_metodo text CHECK (assinatura_metodo IS NULL OR assinatura_metodo IN ('biometrica', 'toque')),
  status            text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'emitida')),
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agronomic_prescriptions IS
  'Receituário Agronômico (Lei 7.802/1989, 14.785/2023): snapshot legal completo + assinatura eletrônica.';
COMMENT ON COLUMN public.agronomic_prescriptions.dados IS
  'Snapshot: produtor, propriedade, responsável técnico (CREA/ART), itens prescritos, condições de aplicação.';

ALTER TABLE public.agronomic_prescriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant and branch can manage agronomic_prescriptions" ON public.agronomic_prescriptions;
CREATE POLICY "Tenant and branch can manage agronomic_prescriptions"
  ON public.agronomic_prescriptions FOR ALL
  USING ((tenant_key = public.current_tenant_key()) AND (branch_id IS NULL OR branch_id = ANY (public.current_branch_ids())))
  WITH CHECK ((tenant_key = public.current_tenant_key()) AND (branch_id IS NULL OR branch_id = ANY (public.current_branch_ids())));

-- Numeração sequencial do receituário (AAAAMMDD-NNN) no servidor.
CREATE OR REPLACE FUNCTION public.next_receituario_numero(p_prefix text DEFAULT '')
RETURNS text
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  prefixo text := nullif(btrim(COALESCE(p_prefix, '')), '');
  seq     bigint;
BEGIN
  seq := nextval('public.receituario_numero_seq');
  IF prefixo IS NULL THEN
    prefixo := to_char(now(), 'YYYYMMDD');
  END IF;
  RETURN prefixo || '-' || lpad(seq::text, 5, '0');
END
$$;

REVOKE ALL ON FUNCTION public.next_receituario_numero(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_receituario_numero(text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. updated_at genérico nas tabelas novas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
VOLATILE SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS field_visits_touch ON public.field_visits;
CREATE TRIGGER field_visits_touch BEFORE UPDATE ON public.field_visits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS visit_recs_touch ON public.visit_recommendations;
CREATE TRIGGER visit_recs_touch BEFORE UPDATE ON public.visit_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS prescriptions_touch ON public.agronomic_prescriptions;
CREATE TRIGGER prescriptions_touch BEFORE UPDATE ON public.agronomic_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
