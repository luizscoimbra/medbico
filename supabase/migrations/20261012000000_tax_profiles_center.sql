-- =============================================================================
-- Central de Tributação
-- =============================================================================
-- Antes, a tributação era preenchida campo a campo em cada produto — e os
-- campos foram justamente derrubados (20260921000001) por não caberem ali.
-- Agora a empresa cadastra UMA vez os perfis de tributação (NCM, CEST, CFOP,
-- CST/CSOSN, origem e alíquotas) e cada produto referencia um perfil de saída
-- (venda) e um de entrada (compra). Quando a emissão de NF-e for implementada,
-- o emissor busca os dados no perfil do produto.
--
-- Escopo:
--   * tax_profiles: perfis por empresa (RLS por company_id), seed de agro;
--   * registered_products: tax_profile_saida_id / tax_profile_entrada_id;
--   * RPCs upsert/delete guardadas por current_is_company_admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabela de perfis de tributação
-- -----------------------------------------------------------------------------
CREATE TABLE public.tax_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name             text NOT NULL,
  descricao        text NOT NULL DEFAULT '',
  ncm              text NOT NULL DEFAULT '',
  cest             text NOT NULL DEFAULT '',
  cfop             text NOT NULL DEFAULT '',
  cst_csosn        text NOT NULL DEFAULT '',
  origem           text NOT NULL DEFAULT '0',
  aliquota_icms    numeric NOT NULL DEFAULT 0,
  aliquota_ipi     numeric NOT NULL DEFAULT 0,
  enquadramento_ipi text NOT NULL DEFAULT '',
  aliquota_pis     numeric NOT NULL DEFAULT 0,
  aliquota_cofins  numeric NOT NULL DEFAULT 0,
  ativo            boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tax_profiles_origem_valida CHECK (origem ~ '^[0-8]$'),
  CONSTRAINT tax_profiles_icms_valida CHECK (aliquota_icms >= 0 AND aliquota_icms <= 100),
  CONSTRAINT tax_profiles_ipi_valida  CHECK (aliquota_ipi  >= 0 AND aliquota_ipi  <= 100),
  CONSTRAINT tax_profiles_pis_valida  CHECK (aliquota_pis  >= 0 AND aliquota_pis  <= 100),
  CONSTRAINT tax_profiles_cofins_valida CHECK (aliquota_cofins >= 0 AND aliquota_cofins <= 100)
);

COMMENT ON TABLE public.tax_profiles IS
  'Central de tributação: perfis fiscais (NCM/CEST/CFOP/alíquotas) referenciados pelos produtos.';
COMMENT ON COLUMN public.tax_profiles.origem IS 'Origem da mercadoria (0 a 8, tabela de origem ICMS).';
COMMENT ON COLUMN public.tax_profiles.cfop IS 'CFOP padrão de saída (venda) deste item.';
COMMENT ON COLUMN public.tax_profiles.cst_csosn IS 'CST (não-Simples) ou CSOSN (Simples Nacional).';

CREATE INDEX tax_profiles_company_idx ON public.tax_profiles(company_id);

-- -----------------------------------------------------------------------------
-- RLS: membros leem; só o master cadastra/edita/apaga
-- -----------------------------------------------------------------------------
ALTER TABLE public.tax_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can read tax profiles"
  ON public.tax_profiles FOR SELECT
  USING (company_id = public.current_company_id());

CREATE POLICY "Company admins can manage tax profiles"
  ON public.tax_profiles FOR ALL
  USING (company_id = public.current_company_id() AND public.current_is_company_admin())
  WITH CHECK (company_id = public.current_company_id());

-- -----------------------------------------------------------------------------
-- Vínculo produto -> perfil (saída = venda/NF-e, entrada = compra)
-- -----------------------------------------------------------------------------
ALTER TABLE public.registered_products
  ADD COLUMN IF NOT EXISTS tax_profile_saida_id   uuid REFERENCES public.tax_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_profile_entrada_id uuid REFERENCES public.tax_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.registered_products.tax_profile_saida_id   IS 'Perfil de tributação usado na saída (venda / NF-e).';
COMMENT ON COLUMN public.registered_products.tax_profile_entrada_id IS 'Perfil de tributação usado na entrada (compra).';

-- -----------------------------------------------------------------------------
-- Gravação (só master da empresa)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_tax_profile(
  p_id                uuid DEFAULT NULL,
  p_name              text DEFAULT '',
  p_descricao         text DEFAULT '',
  p_ncm               text DEFAULT '',
  p_cest              text DEFAULT '',
  p_cfop              text DEFAULT '',
  p_cst_csosn         text DEFAULT '',
  p_origem            text DEFAULT '0',
  p_aliquota_icms     numeric DEFAULT 0,
  p_aliquota_ipi      numeric DEFAULT 0,
  p_enquadramento_ipi text DEFAULT '',
  p_aliquota_pis      numeric DEFAULT 0,
  p_aliquota_cofins   numeric DEFAULT 0,
  p_ativo             boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
  nome    text := btrim(COALESCE(p_name, ''));
  id      uuid := p_id;
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master pode gerenciar a tributação';
  END IF;
  IF empresa IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a uma empresa';
  END IF;
  IF nome = '' THEN
    RAISE EXCEPTION 'Informe o nome do perfil de tributação';
  END IF;

  IF id IS NULL THEN
    INSERT INTO public.tax_profiles (company_id, name)
    VALUES (empresa, nome)
    RETURNING id INTO id;
  END IF;

  UPDATE public.tax_profiles
     SET name              = nome,
         descricao         = btrim(COALESCE(p_descricao, '')),
         ncm               = btrim(COALESCE(p_ncm, '')),
         cest              = btrim(COALESCE(p_cest, '')),
         cfop              = btrim(COALESCE(p_cfop, '')),
         cst_csosn         = btrim(COALESCE(p_cst_csosn, '')),
         origem            = COALESCE(p_origem, '0'),
         aliquota_icms     = COALESCE(p_aliquota_icms, 0),
         aliquota_ipi      = COALESCE(p_aliquota_ipi, 0),
         enquadramento_ipi = btrim(COALESCE(p_enquadramento_ipi, '')),
         aliquota_pis      = COALESCE(p_aliquota_pis, 0),
         aliquota_cofins   = COALESCE(p_aliquota_cofins, 0),
         ativo             = COALESCE(p_ativo, true),
         updated_at        = now()
   WHERE id = id AND company_id = empresa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de tributação não encontrado';
  END IF;

  RETURN id;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_tax_profile(uuid, text, text, text, text, text, text, text, numeric, numeric, text, numeric, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_tax_profile(uuid, text, text, text, text, text, text, text, numeric, numeric, text, numeric, numeric, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_tax_profile(p_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master pode gerenciar a tributação';
  END IF;

  DELETE FROM public.tax_profiles
   WHERE id = p_id AND company_id = empresa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de tributação não encontrado';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.delete_tax_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_tax_profile(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Perfis de exemplo do agronegócio
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_tax_profiles(p_company uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_company IS NULL THEN
    RETURN;
  END IF;
  -- Só semeia se a empresa ainda não tem perfis (evita duplicar no reprocesso).
  IF EXISTS (SELECT 1 FROM public.tax_profiles WHERE company_id = p_company) THEN
    RETURN;
  END IF;

  INSERT INTO public.tax_profiles
    (company_id, name, descricao, ncm, cfop, cst_csosn, origem)
  VALUES
    (p_company, 'Herbicida — Saída',            'Exemplo editável: venda de herbicida (Simples Nacional).',   '3808.93.19', '5102', '102', '0'),
    (p_company, 'Fungicida — Saída',            'Exemplo editável: venda de fungicida (Simples Nacional).',   '3808.24.00', '5102', '102', '0'),
    (p_company, 'Inseticida — Saída',           'Exemplo editável: venda de inseticida (Simples Nacional).',  '3808.91.19', '5102', '102', '0'),
    (p_company, 'Adubo/Fertilizante — Saída',   'Exemplo editável: venda de adubo ou fertilizante.',          '3105.90.00', '5102', '102', '0'),
    (p_company, 'Outros Insumos — Saída',       'Exemplo editável: venda de insumo sem perfil específico.',   '3808.99.99', '5102', '102', '0'),
    (p_company, 'Compra de Revenda — Entrada',  'Exemplo editável: entrada para comercialização.',            '3808.93.19', '1102', '',   '0');
END
$$;

REVOKE ALL ON FUNCTION public.seed_default_tax_profiles(uuid) FROM PUBLIC;

-- Empresas já existentes recebem os perfis agora.
DO $$
DECLARE
  emp uuid;
BEGIN
  FOR emp IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_default_tax_profiles(emp);
  END LOOP;
END
$$;

-- Empresas criadas daqui pra frente também (signup e plataforma passam por aqui).
CREATE OR REPLACE FUNCTION public.tg_seed_tax_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.seed_default_tax_profiles(NEW.id);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS seed_tax_profiles_on_company ON public.companies;
CREATE TRIGGER seed_tax_profiles_on_company
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_seed_tax_profiles();
