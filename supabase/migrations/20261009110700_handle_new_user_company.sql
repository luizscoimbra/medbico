-- =============================================================================
-- Correção: handle_new_user com empresa e filial
-- =============================================================================
-- Reescreve o gatilho de cadastro sobre o modelo da Fase 1. Cada cadastro cria
-- a empresa, a filial Matriz, o vínculo de acesso e o master que vai
-- administrá-las — tudo na mesma transação do INSERT em auth.users.
--
-- Empresa nova nasce com status 'trial': o vendedor libera depois. A empresa
-- do primeiro usuário do sistema nasce 'active', para não existir um limbo em
-- que ninguém tem acesso em uma instalação nova.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  nome_empresa text;
  doc_empresa  text;
  nova_empresa uuid;
  nova_filial  uuid;
  eh_primeiro  boolean;
BEGIN
  -- Serializa os cadastros: um único primeiro master e slugs sem colisão.
  PERFORM pg_advisory_xact_lock(hashtext('herbilog:cadastro'));

  nome_empresa := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'company_name'), ''), 'Minha Empresa');
  doc_empresa  := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'document'), ''), '');

  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE company_id IS NOT NULL
  ) INTO eh_primeiro;

  INSERT INTO public.companies (name, slug, document, status)
  VALUES (
    nome_empresa,
    public.unique_company_slug(nome_empresa),
    doc_empresa,
    CASE WHEN eh_primeiro THEN 'active' ELSE 'trial' END
  )
  RETURNING id INTO nova_empresa;

  INSERT INTO public.branches (company_id, name, code, is_hq)
  VALUES (nova_empresa, 'Matriz', 'MTZ', true)
  RETURNING id INTO nova_filial;

  INSERT INTO public.profiles
    (id, full_name, company, company_id, phone, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), ''),
    nome_empresa,
    nova_empresa,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    'master',
    'active',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_branches (user_id, branch_id)
  VALUES (NEW.id, nova_filial)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cadastro self-service: cria empresa, filial Matriz e o master que as administra.';