-- =============================================================================
-- FASE 0 — isolamento de profiles, delete_user e papéis
-- =============================================================================
-- Vulnerabilidades corrigidas aqui:
--
--   1. `profiles` tinha SELECT `USING (true)`: qualquer usuário logado lia o
--      diretório completo de usuários, com empresa e papel, de todos os
--      clientes do sistema.
--   2. `profiles` tinha UPDATE `(auth.uid() = id) OR master`: o primeiro lado
--      permitia que QUALQUER usuário fizesse `update({ role: 'master' })` na
--      própria linha e se auto-promovesse.
--   3. `delete_user` checava apenas `role = 'master'`, sem comparar a empresa:
--      o master de uma empresa apagava usuários de outra.
--   4. O papel vinha de `raw_user_meta_data.role`, campo gravável pelo próprio
--      usuário no cadastro. Passar a vir do banco.
--
-- Regra adotada: empresa nunca é um rótulo digitável. A empresa de um usuário é
-- derivada por `profile_tenant_key(company, id)`, a mesma expressão usada por
-- `current_tenant_key()`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tenant de um perfil — espelha exatamente current_tenant_key()
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_tenant_key(p_company text, p_id uuid)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(btrim(COALESCE(p_company, '')), ''), p_id::text)
$$;

COMMENT ON FUNCTION public.profile_tenant_key(text, uuid) IS
  'Empresa de um perfil: o rótulo informado no cadastro, ou o próprio id quando vazio.';


-- -----------------------------------------------------------------------------
-- Predicados de autorização
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tenant_master()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.role = 'master'
       AND p.status = 'active'
       AND public.profile_tenant_key(p.company, p.id) = public.current_tenant_key()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.role IN ('master', 'gestor')
       AND p.status = 'active'
       AND public.profile_tenant_key(p.company, p.id) = public.current_tenant_key()
  )
$$;

-- Um usuário é sempre administrador da própria empresa, mesmo recem-criado
-- (ainda sem empresa atribuída, o tenant dele é o próprio id).
REVOKE ALL ON FUNCTION public.is_tenant_master() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_tenant_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tenant_master() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin() TO authenticated;


-- -----------------------------------------------------------------------------
-- Profiles: SELECT e UPDATE passam a respeitar a empresa
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

-- Leitura: apenas o diretório da própria empresa.
CREATE POLICY "Tenant can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.profile_tenant_key(company, id) = public.current_tenant_key());

-- Escrita: apenas master da mesma empresa, e sem conseguir mover o usuário
-- para outra empresa (o WITH CHECK impede).
CREATE POLICY "Tenant master can update profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.profile_tenant_key(company, id) = public.current_tenant_key()
         AND public.is_tenant_master())
  WITH CHECK (public.profile_tenant_key(company, id) = public.current_tenant_key());

CREATE POLICY "Tenant master can delete profiles"
  ON public.profiles FOR DELETE TO authenticated
  USING (auth.uid() <> id
         AND public.profile_tenant_key(company, id) = public.current_tenant_key()
         AND public.is_tenant_master());

-- INSERT continua restrito ao trigger handle_new_user (SECURITY DEFINER):
-- nenhum cliente pode criar linha de perfil diretamente.


-- -----------------------------------------------------------------------------
-- RPC: usuário edita a si mesmo sem poder mexer em papel/empresa/status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_my_profile(p_full_name text, p_phone text)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada';
  END IF;

  UPDATE public.profiles
     SET full_name = COALESCE(p_full_name, full_name),
         phone      = COALESCE(p_phone, phone),
         updated_at = now()
   WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- RPC: o administrador vincula à empresa um usuário recém-criado
-- -----------------------------------------------------------------------------
-- Substitui o envio de `role` e `company` por raw_user_meta_data. O papel e a
-- empresa passam a ser decididos aqui, no banco, a partir de quem chamou.
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
  meu_tenant  text;
  alvo_company text;
BEGIN
  -- Um admin da própria empresa é sempre aceito: enquanto o usuário ainda não tem
  -- empresa atribuída, o tenant dele é o próprio id e ele já é master dele mesmo.
  IF NOT public.is_tenant_admin() THEN
    RAISE EXCEPTION 'Apenas administradores da empresa podem criar acessos';
  END IF;

  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('master', 'gestor', 'operador', 'motorista') THEN
    RAISE EXCEPTION 'Função inválida: %', p_role;
  END IF;

  -- Gestor não pode criar nem promover master.
  IF NOT public.is_tenant_master() AND p_role IN ('master', 'gestor') THEN
    RAISE EXCEPTION 'Apenas o administrador master pode atribuir a função de administrador';
  END IF;

  SELECT public.current_tenant_key() INTO meu_tenant;

  SELECT company INTO alvo_company FROM public.profiles WHERE id = target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- O usuário já está vinculado a outra empresa? Não aceita.
  IF public.profile_tenant_key(alvo_company, target) <> meu_tenant THEN
    RAISE EXCEPTION 'Este usuário já pertence a outra empresa';
  END IF;

  UPDATE public.profiles
     SET company    = meu_tenant,
         role       = p_role,
         full_name  = COALESCE(p_full_name, full_name),
         phone      = COALESCE(p_phone, phone),
         status     = 'active',
         updated_at = now()
   WHERE id = target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falha ao vincular o usuário à empresa';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.link_user_to_tenant(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_user_to_tenant(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.link_user_to_tenant(uuid, text, text, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- delete_user: passa a exigir que o alvo seja da mesma empresa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  meu_tenant text;
BEGIN
  IF NOT public.is_tenant_master() THEN
    RAISE EXCEPTION 'Apenas administradores master da empresa podem excluir acessos';
  END IF;

  IF target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir seu próprio acesso';
  END IF;

  IF target IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  SELECT public.current_tenant_key() INTO meu_tenant;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = target
       AND public.profile_tenant_key(company, id) = meu_tenant
  ) THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;

  DELETE FROM auth.users WHERE id = target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.delete_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_user(uuid) IS
  'Exclui um acesso da mesma empresa. Antes permitia apagar usuários de qualquer empresa.';