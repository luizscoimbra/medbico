-- =============================================================================
-- Cadastro fiscal da empresa e das filiais (produtor rural)
-- =============================================================================
-- A auditoria apontou que companies tinha só `document` e branches nada de
-- endereço. Para emitir documentos e atender fiscalmente, a empresa precisa de
-- razão social, inscrições, regime e endereço; cada filial (propriedade) precisa
-- do próprio endereço, IE produtor e CAR.
--
-- Escopo:
--   * companies: identificação jurídica + endereço da sede;
--   * branches: endereço da propriedade + IE do produtor + CAR;
--   * RPCs para gravar sem expor UPDATE direto (padrão do projeto).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Colunas fiscais da empresa (Matriz)
-- -----------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS razao_social      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_fantasia     text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ie                text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS im                text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS regime_tributario text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cnae              text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logradouro        text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero            text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS complemento       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro            text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipio         text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf                text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep               text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefone          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email             text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.companies.document          IS 'CNPJ ou CPF do produtor (máscara livre).';
COMMENT ON COLUMN public.companies.razao_social      IS 'Razão social para documentos fiscais.';
COMMENT ON COLUMN public.companies.ie                IS 'Inscrição Estadual (ou "ISENTO").';
COMMENT ON COLUMN public.companies.im                IS 'Inscrição Municipal.';
COMMENT ON COLUMN public.companies.regime_tributario IS 'simples | lucro_presumido | lucro_real | mei | produtor_rural';

-- -----------------------------------------------------------------------------
-- Colunas fiscais da filial (propriedade rural)
-- -----------------------------------------------------------------------------
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS ie          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS car         text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS logradouro  text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS numero      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS complemento text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bairro      text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS municipio   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS uf          text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep         text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefone    text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.branches.ie          IS 'Inscrição Estadual do produtor nesta propriedade.';
COMMENT ON COLUMN public.branches.car         IS 'Código do Cadastro Ambiental Rural (CAR).';
COMMENT ON COLUMN public.branches.responsavel IS 'Responsável legal / produtor da propriedade.';

-- -----------------------------------------------------------------------------
-- Gravar dados fiscais da empresa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_company_fiscal(
  p_document          text DEFAULT '',
  p_razao_social      text DEFAULT '',
  p_nome_fantasia     text DEFAULT '',
  p_ie                text DEFAULT '',
  p_im                text DEFAULT '',
  p_regime_tributario text DEFAULT '',
  p_cnae              text DEFAULT '',
  p_logradouro        text DEFAULT '',
  p_numero            text DEFAULT '',
  p_complemento       text DEFAULT '',
  p_bairro            text DEFAULT '',
  p_municipio         text DEFAULT '',
  p_uf                text DEFAULT '',
  p_cep               text DEFAULT '',
  p_telefone          text DEFAULT '',
  p_email             text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
  uf_limpa text := upper(btrim(COALESCE(p_uf, '')));
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master pode alterar os dados da empresa';
  END IF;
  IF empresa IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a uma empresa';
  END IF;

  IF uf_limpa <> '' AND uf_limpa !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'UF inválida: %', uf_limpa;
  END IF;

  UPDATE public.companies
     SET document          = btrim(COALESCE(p_document, '')),
         razao_social      = btrim(COALESCE(p_razao_social, '')),
         nome_fantasia     = btrim(COALESCE(p_nome_fantasia, '')),
         ie                = btrim(COALESCE(p_ie, '')),
         im                = btrim(COALESCE(p_im, '')),
         regime_tributario = btrim(COALESCE(p_regime_tributario, '')),
         cnae              = btrim(COALESCE(p_cnae, '')),
         logradouro        = btrim(COALESCE(p_logradouro, '')),
         numero            = btrim(COALESCE(p_numero, '')),
         complemento       = btrim(COALESCE(p_complemento, '')),
         bairro            = btrim(COALESCE(p_bairro, '')),
         municipio         = btrim(COALESCE(p_municipio, '')),
         uf                = uf_limpa,
         cep               = btrim(COALESCE(p_cep, '')),
         telefone          = btrim(COALESCE(p_telefone, '')),
         email             = btrim(COALESCE(p_email, '')),
         updated_at        = now()
   WHERE id = empresa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.update_company_fiscal(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_company_fiscal(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Criar filial (agora com endereço e dados do produtor)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_branch(text, text);
CREATE FUNCTION public.create_branch(
  p_name        text,
  p_code        text DEFAULT '',
  p_ie          text DEFAULT '',
  p_car         text DEFAULT '',
  p_logradouro  text DEFAULT '',
  p_numero      text DEFAULT '',
  p_complemento text DEFAULT '',
  p_bairro      text DEFAULT '',
  p_municipio   text DEFAULT '',
  p_uf          text DEFAULT '',
  p_cep         text DEFAULT '',
  p_telefone    text DEFAULT '',
  p_responsavel text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa  uuid := public.current_company_id();
  nova     uuid;
  limpo    text;
  uf_limpa text := upper(btrim(COALESCE(p_uf, '')));
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode criar filiais';
  END IF;
  IF empresa IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a uma empresa';
  END IF;

  limpo := btrim(COALESCE(p_name, ''));
  IF limpo = '' THEN
    RAISE EXCEPTION 'Informe o nome da filial';
  END IF;
  IF uf_limpa <> '' AND uf_limpa !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'UF inválida: %', uf_limpa;
  END IF;

  IF btrim(COALESCE(p_code, '')) <> '' AND EXISTS (
    SELECT 1 FROM public.branches b
     WHERE b.company_id = empresa AND b.code = btrim(p_code)
  ) THEN
    RAISE EXCEPTION 'Já existe uma filial com o código %', btrim(p_code);
  END IF;

  INSERT INTO public.branches (
    company_id, name, code, is_hq,
    ie, car, logradouro, numero, complemento, bairro,
    municipio, uf, cep, telefone, responsavel
  )
  VALUES (
    empresa, limpo, btrim(COALESCE(p_code, '')), false,
    btrim(COALESCE(p_ie, '')), btrim(COALESCE(p_car, '')),
    btrim(COALESCE(p_logradouro, '')), btrim(COALESCE(p_numero, '')),
    btrim(COALESCE(p_complemento, '')), btrim(COALESCE(p_bairro, '')),
    btrim(COALESCE(p_municipio, '')), uf_limpa,
    btrim(COALESCE(p_cep, '')), btrim(COALESCE(p_telefone, '')),
    btrim(COALESCE(p_responsavel, ''))
  )
  RETURNING id INTO nova;

  RETURN nova;
END
$$;

GRANT EXECUTE ON FUNCTION public.create_branch(text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Alterar filial (endereço e dados do produtor)
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_branch(uuid, text, text, text);
CREATE FUNCTION public.update_branch(
  p_branch      uuid,
  p_name        text,
  p_code        text DEFAULT '',
  p_status      text DEFAULT 'active',
  p_ie          text DEFAULT '',
  p_car         text DEFAULT '',
  p_logradouro  text DEFAULT '',
  p_numero      text DEFAULT '',
  p_complemento text DEFAULT '',
  p_bairro      text DEFAULT '',
  p_municipio   text DEFAULT '',
  p_uf          text DEFAULT '',
  p_cep         text DEFAULT '',
  p_telefone    text DEFAULT '',
  p_responsavel text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa  uuid := public.current_company_id();
  atual    public.branches%ROWTYPE;
  uf_limpa text := upper(btrim(COALESCE(p_uf, '')));
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode alterar filiais';
  END IF;

  SELECT * INTO atual FROM public.branches b WHERE b.id = p_branch;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filial não encontrada';
  END IF;
  IF atual.company_id <> empresa THEN
    RAISE EXCEPTION 'Esta filial pertence a outra empresa';
  END IF;

  IF atual.is_hq AND p_status <> 'active' THEN
    RAISE EXCEPTION 'A filial Matriz não pode ser desativada';
  END IF;

  IF p_status NOT IN ('active', 'inactive') THEN
    RAISE EXCEPTION 'Situação inválida: %', p_status;
  END IF;
  IF uf_limpa <> '' AND uf_limpa !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'UF inválida: %', uf_limpa;
  END IF;

  IF btrim(COALESCE(p_code, '')) <> '' AND EXISTS (
    SELECT 1 FROM public.branches b
     WHERE b.company_id = empresa AND b.code = btrim(p_code) AND b.id <> p_branch
  ) THEN
    RAISE EXCEPTION 'Já existe uma filial com o código %', btrim(p_code);
  END IF;

  UPDATE public.branches
     SET name        = btrim(COALESCE(p_name, name)),
         code        = btrim(COALESCE(p_code, '')),
         status      = p_status,
         ie          = btrim(COALESCE(p_ie, '')),
         car         = btrim(COALESCE(p_car, '')),
         logradouro  = btrim(COALESCE(p_logradouro, '')),
         numero      = btrim(COALESCE(p_numero, '')),
         complemento = btrim(COALESCE(p_complemento, '')),
         bairro      = btrim(COALESCE(p_bairro, '')),
         municipio   = btrim(COALESCE(p_municipio, '')),
         uf          = uf_limpa,
         cep         = btrim(COALESCE(p_cep, '')),
         telefone    = btrim(COALESCE(p_telefone, '')),
         responsavel = btrim(COALESCE(p_responsavel, '')),
         updated_at  = now()
   WHERE id = p_branch;
END
$$;

GRANT EXECUTE ON FUNCTION public.update_branch(uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Resumo por filial: passa a expor município/UF para a tela
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.branch_overview();
CREATE FUNCTION public.branch_overview()
RETURNS TABLE (
  branch_id    uuid,
  nome         text,
  codigo       text,
  is_hq        boolean,
  status       text,
  municipio    text,
  uf           text,
  ie           text,
  usuarios     bigint,
  ordens       bigint,
  saldo_itens  bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH empresa AS (SELECT public.current_company_id() AS id)
  SELECT
    b.id,
    b.name,
    b.code,
    b.is_hq,
    b.status,
    b.municipio,
    b.uf,
    b.ie,
    (SELECT count(*) FROM public.user_branches ub WHERE ub.branch_id = b.id),
    (SELECT count(*) FROM public.orders_of_service o
      WHERE o.branch_id = b.id AND o.tenant_key = (SELECT id::text FROM empresa)),
    (SELECT count(DISTINCT se.item_key) FROM public.stock_entries se
      WHERE se.branch_id = b.id AND se.tenant_key = (SELECT id::text FROM empresa))
  FROM public.branches b
  WHERE b.company_id = (SELECT id FROM empresa)
  ORDER BY b.is_hq DESC, b.name
$$;

GRANT EXECUTE ON FUNCTION public.branch_overview() TO authenticated;
