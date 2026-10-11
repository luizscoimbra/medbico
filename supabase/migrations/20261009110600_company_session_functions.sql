-- =============================================================================
-- FASE 1 — Funções de sessão sobre company_id
-- =============================================================================
-- Troca a chave de tenant: `current_tenant_key()` passa a devolver o id da
-- empresa (o mesmo valor gravado em tenant_key pelas 31 tabelas), e as funções
-- de autorização deixam de comparar rótulos de texto.
--
-- `tenant_key` continua existindo como coluna — é o cache do company_id. Isso
-- permite migrar a Fase 2 (branch_id) sem reescrever o tenancy de novo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Slug único de empresa (usado no auto-cadastro)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unique_company_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  base text;
  cand text;
  n    integer := 0;
BEGIN
  base := lower(regexp_replace(btrim(COALESCE(p_name, '')), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' FROM base);
  IF base = '' THEN
    base := 'empresa';
  END IF;
  base := left(base, 40);

  cand := base;
  WHILE EXISTS (SELECT 1 FROM public.companies c WHERE c.slug = cand) LOOP
    n := n + 1;
    cand := left(base, 44) || '-' || n::text;
  END LOOP;

  RETURN cand;
END
$$;

-- Mantido por compatibilidade com chamadas antigas.
CREATE OR REPLACE FUNCTION public.unique_tenant_slug(p_name text)
RETURNS text
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.unique_company_slug(p_name)
$$;


-- -----------------------------------------------------------------------------
-- Sessão corrente
-- -----------------------------------------------------------------------------
-- current_tenant_key() agora devolve o id da empresa. É o valor guardado em
-- tenant_key pelas 31 tabelas, então nenhuma delas precisa mudar.
CREATE OR REPLACE FUNCTION public.current_tenant_key()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT p.company_id::text FROM public.profiles p WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_branch_ids()
RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(ub.branch_id), '{}'::uuid[])
    FROM public.user_branches ub
   WHERE ub.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_is_company_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'master'
       AND p.company_id = public.current_company_id()
       AND p.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(p_role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT p_role IN ('master', 'gestor')
$$;

-- Plataforma: quem administra o sistema comercial.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid())
$$;

COMMENT ON FUNCTION public.current_branch_ids() IS
  'Filiais que o usuário autenticado pode acessar. A Fase 2 usa isto para filtrar dados por filial.';
COMMENT ON FUNCTION public.is_platform_admin() IS
  'Administrador da plataforma (o vendedor): vê e gerencia todas as empresas, sem pertencer a nenhuma.';


-- -----------------------------------------------------------------------------
-- Predicados de autorização, agora por empresa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_master()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.current_is_company_admin()
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.role IN ('master', 'gestor')
       AND p.company_id = public.current_company_id()
       AND p.status = 'active'
  )
$$;

-- Substitui profile_tenant_key(company, id), que comparava rótulos de texto.
CREATE OR REPLACE FUNCTION public.profile_in_current_company(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = p_id AND p.company_id = public.current_company_id()
  )
$$;

-- A policy de DELETE do profile_tenant_key antigo dependia do id como texto;
-- este wrapper mantém a assinatura para não quebrar chamadas existentes.
CREATE OR REPLACE FUNCTION public.profile_tenant_key(p_company text, p_id uuid)
RETURNS text
LANGUAGE sql STABLE
AS $$
  -- Mantido apenas para compatibilidade: devolve o rótulo atual do perfil.
  SELECT p.company FROM public.profiles p WHERE p.id = p_id
$$;


-- -----------------------------------------------------------------------------
-- handle_new_user: empresa + filial + master, numa transação só
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  nome_empresa text;
  doc_empresa  text := '';
  nova_empresa uuid;
  nova_filial  uuid;
  eh_primeiro  boolean;
BEGIN
  -- Serializa os cadastros: um único primeiro master e slugs sem colisão.
  PERFORM pg_advisory_xact_lock(hashtext('herbilog:cadastro'));

  nome_empresa := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'company_name'), ''), 'Minha Empresa');
  doc_empresa  := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'document'), ''), '');

  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE p.company_id IS NOT NULL
  ) INTO eh_primeiro;

  INSERT INTO public.companies (name, slug, document, status)
  VALUES (
    nome_empresa,
    public.unique_company_slug(nome_empresa),
    doc_empresa,
    -- Empresa nova nasce como teste. O vendedor libera em /plataforma.
    CASE WHEN eh_primeiro THEN 'active' ELSE 'trial' END
  )
  RETURNING id INTO nova_empresa;

  INSERT INTO public.branches (company_id, name, code, is_hq)
  VALUES (nova_empresa, 'Matriz', 'MTZ', true)
  RETURNING id INTO nova_filial;

  INSERT INTO public.profiles (id, full_name, company, company_id, phone, role, status, created_at, updated_at)
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
  'Cadastro self-service: cria a empresa, a filial Matriz e o master que vai administrá-las.';


-- -----------------------------------------------------------------------------
-- Espelho: renomear a empresa atualiza o rótulo em todos os perfis
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_company_label()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.profiles SET company = NEW.name, updated_at = now() WHERE company_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS companies_sync_label ON public.companies;
CREATE TRIGGER companies_sync_label
  AFTER UPDATE OF name ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.sync_company_label();


-- -----------------------------------------------------------------------------
-- link_user_to_tenant: vincula à empresa de quem chamou
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_user_to_tenant(
  target uuid,
  p_full_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'operador'
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  meu_company  uuid;
  minha_filial uuid;
BEGIN
  IF NOT public.is_tenant_admin() THEN
    RAISE EXCEPTION 'Apenas administradores da empresa podem criar acessos';
  END IF;

  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('master', 'gestor', 'operador', 'motorista') THEN
    RAISE EXCEPTION 'Função inválida: %', p_role;
  END IF;

  IF NOT public.current_is_company_admin() AND p_role IN ('master', 'gestor') THEN
    RAISE EXCEPTION 'Apenas o administrador master pode atribuir a função de administrador';
  END IF;

  meu_company := public.current_company_id();
  IF meu_company IS NULL THEN
    RAISE EXCEPTION 'Sua conta ainda não está vinculada a uma empresa';
  END IF;

  IF NOT public.profile_in_current_company(target) THEN
    -- Aceita apenas quem ainda não pertence a empresa alguma (conta órfã
    -- criada pelo cadastro público antes desta migração).
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target AND company_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Este usuário já pertence a outra empresa';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target) THEN
      RAISE EXCEPTION 'Usuário não encontrado';
    END IF;
  END IF;

  SELECT id INTO minha_filial FROM public.branches
   WHERE company_id = meu_company AND is_hq LIMIT 1;

  UPDATE public.profiles
     SET company_id = meu_company,
         company    = (SELECT c.name FROM public.companies c WHERE c.id = meu_company),
         role       = p_role,
         full_name  = COALESCE(p_full_name, full_name),
         phone      = COALESCE(p_phone, phone),
         status     = 'active',
         updated_at = now()
   WHERE id = target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falha ao vincular o usuário à empresa';
  END IF;

  IF minha_filial IS NOT NULL THEN
    INSERT INTO public.user_branches (user_id, branch_id)
    VALUES (target, minha_filial)
    ON CONFLICT DO NOTHING;
  END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- delete_user: exige que o alvo esteja na mesma empresa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas administradores master da empresa podem excluir acessos';
  END IF;

  IF target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir seu próprio acesso';
  END IF;

  IF target IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF NOT public.profile_in_current_company(target) THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;

  DELETE FROM auth.users WHERE id = target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- set_user_role / set_user_status / set_user_modules sobre company_id
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_role(target uuid, p_role text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode alterar funções';
  END IF;
  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode alterar a própria função';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('master', 'gestor', 'operador', 'motorista') THEN
    RAISE EXCEPTION 'Função inválida: %', p_role;
  END IF;

  UPDATE public.profiles SET role = p_role, updated_at = now()
   WHERE id = target AND company_id = public.current_company_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_user_status(target uuid, p_status text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode bloquear ou liberar acessos';
  END IF;
  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode alterar o próprio status';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('active', 'blocked') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  UPDATE public.profiles SET status = p_status, updated_at = now()
   WHERE id = target AND company_id = public.current_company_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_user_modules(target uuid, p_modules jsonb)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode editar módulos';
  END IF;
  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode editar os próprios módulos';
  END IF;

  UPDATE public.profiles SET modules = p_modules, updated_at = now()
   WHERE id = target AND company_id = public.current_company_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- profiles: policies por company_id
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  p text;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', p);
  END LOOP;
END
$$;

CREATE POLICY "Tenant can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Tenant master can update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (company_id = public.current_company_id() AND public.current_is_company_admin())
  WITH CHECK (company_id = public.current_company_id());

CREATE POLICY "Tenant master can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() <> id
         AND company_id = public.current_company_id()
         AND public.current_is_company_admin());


-- -----------------------------------------------------------------------------
-- Numeradores por empresa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_company_counter(p_kind text)
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
  valor   bigint;
BEGIN
  IF empresa IS NULL THEN
    RAISE EXCEPTION 'Sua conta não está vinculada a uma empresa';
  END IF;

  INSERT INTO public.company_counters AS cc (company_id, kind, next_value)
  VALUES (empresa, p_kind, 1)
  ON CONFLICT (company_id, kind)
  DO UPDATE SET next_value = cc.next_value + 1, updated_at = now()
  RETURNING next_value INTO valor;

  RETURN valor;
END
$$;

-- company_counters só é escrita por RPC; o INSERT direto fica bloqueado.
CREATE POLICY "No direct counter inserts" ON public.company_counters
  FOR INSERT TO authenticated
  WITH CHECK (false);
CREATE POLICY "No direct counter updates" ON public.company_counters
  FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

-- Inicia os sequenciais acima do maior número já emitido na empresa, para não
-- recomeçar a contagem e gerar comprovante duplicado.
DO $$
DECLARE
  empresa uuid;
  m       numeric;
BEGIN
  FOR empresa IN SELECT id FROM public.companies LOOP

    SELECT max(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::bigint)
      INTO m FROM public.financial_receivables
     WHERE tenant_key = empresa::text;
    IF m IS NOT NULL AND m > 0 THEN
      INSERT INTO public.company_counters (company_id, kind, next_value)
      VALUES (empresa, 'receivable', m + 1)
      ON CONFLICT (company_id, kind)
      DO UPDATE SET next_value = GREATEST(public.company_counters.next_value, EXCLUDED.next_value);
    END IF;

    SELECT max(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::bigint)
      INTO m FROM public.financial_payables
     WHERE tenant_key = empresa::text;
    IF m IS NOT NULL AND m > 0 THEN
      INSERT INTO public.company_counters (company_id, kind, next_value)
      VALUES (empresa, 'payable', m + 1)
      ON CONFLICT (company_id, kind)
      DO UPDATE SET next_value = GREATEST(public.company_counters.next_value, EXCLUDED.next_value);
    END IF;

  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.next_receivable_numero()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT lpad(public.next_company_counter('receivable')::text, 4, '0')
$$;

CREATE OR REPLACE FUNCTION public.next_payable_numero()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT lpad(public.next_company_counter('payable')::text, 4, '0')
$$;

COMMENT ON FUNCTION public.next_company_counter(text) IS
  'Sequencial por empresa. Evita que dois clientes imprimam o mesmo número de título.';

REVOKE ALL ON FUNCTION public.next_company_counter(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unique_company_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unique_tenant_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_in_current_company(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_is_company_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_branch_ids() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.unique_company_slug(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unique_tenant_slug(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_in_current_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_is_company_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_branch_ids() TO authenticated;