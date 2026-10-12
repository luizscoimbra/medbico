-- =============================================================================
-- Central de Tributação — adequação à Reforma (vigente 01/01/2027)
-- =============================================================================
-- A migration anterior (20261012000000) criou a central com os campos do
-- regime antigo. A partir de 1º de janeiro de 2027 (ADCT art. 126; LC 214/2025,
-- consolidada pela LC 227/2026):
--
--   * a CBS é cobrada pela alíquota de referência (fixada por Resolução do
--     Senado até 15/12/2026; em 2027-2028, reduzida em 0,1 p.p., art. 347);
--   * PIS e COFINS são extintos (art. 542);
--   * o IPI é zerado fora da Zona Franca de Manaus;
--   * o IBS segue simbólico em 0,05% estadual + 0,05% municipal (art. 344);
--   * a NF-e passa a exigir CST IBS/CBS e cClassTrib por item, até para
--     documentos do Simples Nacional (Ato Conjunto RFB/CGIBS nº 4/2026).
--
-- O que muda aqui:
--   * tax_profiles ganha aliquota_cbs, aliquota_ibs, cst_ibs_cbs e cclasstrib;
--   * PIS/COFINS/IPI são mantidos como histórico/vigência até 2026;
--   * o upsert passa a gravar os campos novos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Campos da Reforma
-- -----------------------------------------------------------------------------
ALTER TABLE public.tax_profiles
  ADD COLUMN IF NOT EXISTS aliquota_cbs  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliquota_ibs  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cst_ibs_cbs   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cclasstrib    text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.tax_profiles.aliquota_cbs IS
  'Alíquota da CBS (0 = aplicar a vigente do regime/Resolução do Senado). Em 2027-2028: referência menos 0,1 p.p. (LC 214, art. 347).';
COMMENT ON COLUMN public.tax_profiles.aliquota_ibs IS
  'Alíquota do IBS (0 = aplicar a vigente do ente). Em 2027-2028: 0,1% total — 0,05% estadual + 0,05% municipal (art. 344).';
COMMENT ON COLUMN public.tax_profiles.cst_ibs_cbs IS
  'CST IBS/CBS exigido na NF-e desde 2026 (ex.: 000 = tributação integral, 200 = redução de 60%).';
COMMENT ON COLUMN public.tax_profiles.cclasstrib IS
  'cClassTrib: código de classificação tributária derivado do enquadramento do NCM nos anexos da LC 214/2025.';
COMMENT ON COLUMN public.tax_profiles.aliquota_pis IS
  'Vigente até 31/12/2026 — PIS extinto em 2027 (ADCT art. 126). Manter apenas para histórico.';
COMMENT ON COLUMN public.tax_profiles.aliquota_cofins IS
  'Vigente até 31/12/2026 — COFINS extinto em 2027 (ADCT art. 126). Manter apenas para histórico.';
COMMENT ON COLUMN public.tax_profiles.aliquota_ipi IS
  'A partir de 2027 o IPI é zero fora da Zona Franca de Manaus (ADCT art. 126).';
COMMENT ON COLUMN public.tax_profiles.enquadramento_ipi IS
  'Vigente até 2026 (IPI zerado em 2027 fora da ZFM).';

ALTER TABLE public.tax_profiles
  ADD CONSTRAINT tax_profiles_cbs_valida CHECK (aliquota_cbs >= 0 AND aliquota_cbs <= 100),
  ADD CONSTRAINT tax_profiles_ibs_valida CHECK (aliquota_ibs >= 0 AND aliquota_ibs <= 100);

-- -----------------------------------------------------------------------------
-- Upset com os campos da Reforma
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upsert_tax_profile(uuid, text, text, text, text, text, text, text, numeric, numeric, text, numeric, numeric, boolean);
CREATE FUNCTION public.upsert_tax_profile(
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
  p_ativo             boolean DEFAULT true,
  p_aliquota_cbs      numeric DEFAULT 0,
  p_aliquota_ibs      numeric DEFAULT 0,
  p_cst_ibs_cbs       text DEFAULT '',
  p_cclasstrib        text DEFAULT ''
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
         aliquota_cbs      = COALESCE(p_aliquota_cbs, 0),
         aliquota_ibs      = COALESCE(p_aliquota_ibs, 0),
         cst_ibs_cbs       = btrim(COALESCE(p_cst_ibs_cbs, '')),
         cclasstrib        = btrim(COALESCE(p_cclasstrib, '')),
         ativo             = COALESCE(p_ativo, true),
         updated_at        = now()
   WHERE id = id AND company_id = empresa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil de tributação não encontrado';
  END IF;

  RETURN id;
END
$$;

GRANT EXECUTE ON FUNCTION public.upsert_tax_profile(uuid, text, text, text, text, text, text, text, numeric, numeric, text, numeric, numeric, boolean, numeric, numeric, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Perfis de exemplo já existentes: CST IBS/CBS padrão (tributação integral)
-- -----------------------------------------------------------------------------
UPDATE public.tax_profiles
   SET cst_ibs_cbs = '000'
 WHERE cst_ibs_cbs = '';

-- -----------------------------------------------------------------------------
-- Seed atualizado para as empresas futuras (CST IBS/CBS nasce preenchido)
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
  IF EXISTS (SELECT 1 FROM public.tax_profiles WHERE company_id = p_company) THEN
    RETURN;
  END IF;

  -- cst_ibs_cbs '000' = tributação integral (padrão dos insumos agrícolas);
  -- aliquota_cbs/ibs em 0 = aplicar a alíquota vigente do regime/Resolução do
  -- Senado no momento da emissão (a referência de 2027 é fixada até 15/12/2026).
  INSERT INTO public.tax_profiles
    (company_id, name, descricao, ncm, cfop, cst_csosn, origem, cst_ibs_cbs)
  VALUES
    (p_company, 'Herbicida — Saída',            'Exemplo editável: venda de herbicida (Simples Nacional).',   '3808.93.19', '5102', '102', '0', '000'),
    (p_company, 'Fungicida — Saída',            'Exemplo editável: venda de fungicida (Simples Nacional).',   '3808.24.00', '5102', '102', '0', '000'),
    (p_company, 'Inseticida — Saída',           'Exemplo editável: venda de inseticida (Simples Nacional).',  '3808.91.19', '5102', '102', '0', '000'),
    (p_company, 'Adubo/Fertilizante — Saída',   'Exemplo editável: venda de adubo ou fertilizante.',          '3105.90.00', '5102', '102', '0', '000'),
    (p_company, 'Outros Insumos — Saída',       'Exemplo editável: venda de insumo sem perfil específico.',   '3808.99.99', '5102', '102', '0', '000'),
    (p_company, 'Compra de Revenda — Entrada',  'Exemplo editável: entrada para comercialização.',            '3808.93.19', '1102', '',   '0', '000');
END
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_tax_profiles(uuid) TO PUBLIC;
