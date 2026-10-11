-- =============================================================================
-- Console do vendedor
-- =============================================================================
-- Quem administra a plataforma lista as empresas clientes, vÃª o tamanho de
-- cada uma e suspende o acesso quando houver pendÃªncia â€” sem apagar nada.
--
-- Um administrador de plataforma nÃ£o pertence a nenhuma empresa cliente e,
-- por isso, nÃ£o enxerga os dados de nenhuma. As funÃ§Ãµes abaixo devolvem sÃ³
-- metadados: nome, situaÃ§Ã£o, quando foi criada e quantos usuÃ¡rios tem.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Listar empresas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_companies()
RETURNS TABLE (
  id          uuid,
  nome        text,
  slug        text,
  status      text,
  plan        text,
  documento   text,
  criada_em   timestamptz,
  usuarios    bigint,
  filiais     bigint,
  status_em   timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito aos administradores da plataforma';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.slug,
    c.status,
    c.plan,
    c.document,
    c.created_at,
    (SELECT count(*) FROM public.profiles p WHERE p.company_id = c.id),
    (SELECT count(*) FROM public.branches b WHERE b.company_id = c.id),
    (SELECT max(p.updated_at) FROM public.profiles p WHERE p.company_id = c.id)
  FROM public.companies c
  ORDER BY c.created_at DESC;
END
$$;


-- -----------------------------------------------------------------------------
-- Alterar a situaÃ§Ã£o da empresa
-- -----------------------------------------------------------------------------
-- suspended corta o acesso na hora: as polÃ­ticas de RLS exigem que a empresa
-- esteja ativa, entÃ£o todas as consultas passam a devolver zero linhas. Os dados
-- permanecem intactos e voltam quando a empresa Ã© reativada.
CREATE OR REPLACE FUNCTION public.platform_set_company_status(
  p_company uuid,
  p_status  text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito aos administradores da plataforma';
  END IF;

  IF p_status NOT IN ('trial', 'active', 'suspended') THEN
    RAISE EXCEPTION 'SituaÃ§Ã£o invÃ¡lida: %', p_status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    RAISE EXCEPTION 'Empresa nÃ£o encontrada';
  END IF;

  UPDATE public.companies SET status = p_status, updated_at = now() WHERE id = p_company;
END
$$;


-- -----------------------------------------------------------------------------
-- Conceder ou revogar administrador de plataforma
-- -----------------------------------------------------------------------------
-- Fora da interface:grant por SQL. A tabela Ã© pequena e a concessÃ£o Ã© uma
-- decisÃ£o de negÃ³cio, nÃ£o uma tarefa recorrente.
CREATE OR REPLACE FUNCTION public.platform_grant(p_email text, p_grant boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  alvo uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso restrito aos administradores da plataforma';
  END IF;

  SELECT u.id INTO alvo FROM auth.users u WHERE lower(u.email) = lower(btrim(p_email));
  IF alvo IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta com o e-mail %', p_email;
  END IF;

  IF p_grant THEN
    INSERT INTO public.platform_admins (user_id) VALUES (alvo) ON CONFLICT DO NOTHING;
  ELSE
    -- NÃ£o permite remover o Ãºltimo administrador da plataforma.
    IF (SELECT count(*) FROM public.platform_admins) <= 1 THEN
      RAISE EXCEPTION 'NÃ£o Ã© possÃ­vel remover o Ãºnico administrador da plataforma';
    END IF;
    DELETE FROM public.platform_admins WHERE user_id = alvo;
  END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- Libera a ediÃ§Ã£o do nome/slug da empresa pelo prÃ³prio cliente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rename_own_company(p_name text, p_document text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master pode alterar os dados da empresa';
  END IF;

  IF btrim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Informe o nome da empresa';
  END IF;

  -- companies.name nÃ£o tem policy de UPDATE: a alteraÃ§Ã£o passa sÃ³ por aqui.
  UPDATE public.companies
     SET name = btrim(p_name),
         document = btrim(COALESCE(p_document, '')),
         updated_at = now()
   WHERE id = empresa;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa nÃ£o encontrada';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.platform_companies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_set_company_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.platform_grant(text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rename_own_company(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_company_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_grant(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rename_own_company(text, text) TO authenticated;

-- companies precisa permitir UPDATE apenas para a prÃ³pria empresa; o nome Ã©
-- espelhado em profiles.company pelo gatIGGER companies_sync_label.
DROP POLICY IF EXISTS "Tenant can update own company" ON public.companies;
CREATE POLICY "Tenant can update own company" ON public.companies
  FOR UPDATE TO authenticated
  USING (id = public.current_company_id())
  WITH CHECK (id = public.current_company_id());