-- =============================================================================
-- Gestão de usuários: recusas explícitas em vez de sucesso silencioso
-- =============================================================================
-- Um UPDATE que a RLS filtra não gera erro: o PostgREST encontra zero linhas e
-- responde 204 No Content. Testado na prática — um usuário sem permissão recebia
-- "função atualizada" no toast, recarregava a tela e o valor continuava igual.
--
-- Estas funções conferem a permissão, aplicam a mudança e levantam exceção
-- quando nada foi alterado, para que a interface consiga explicar a recusa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Alterar função
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_role(target uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  atual text;
BEGIN
  IF NOT public.is_tenant_master() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode alterar funções';
  END IF;

  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode alterar a própria função';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('master', 'gestor', 'operador', 'motorista') THEN
    RAISE EXCEPTION 'Função inválida: %', p_role;
  END IF;

  SELECT role INTO atual FROM public.profiles WHERE id = target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  IF atual = p_role THEN
    RETURN;
  END IF;

  UPDATE public.profiles
     SET role = p_role, updated_at = now()
   WHERE id = target
     AND public.profile_tenant_key(company, id) = public.current_tenant_key();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Alterar status (bloquear / liberar)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_status(target uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_tenant_master() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode bloquear ou liberar acessos';
  END IF;

  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode alterar o próprio status';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('active', 'blocked') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;

  UPDATE public.profiles
     SET status = p_status, updated_at = now()
   WHERE id = target
     AND public.profile_tenant_key(company, id) = public.current_tenant_key();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- Ajustar módulos permitidos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_modules(target uuid, p_modules jsonb)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_tenant_master() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode editar módulos';
  END IF;

  IF target IS NULL OR target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode editar os próprios módulos';
  END IF;

  UPDATE public.profiles
     SET modules = p_modules, updated_at = now()
   WHERE id = target
     AND public.profile_tenant_key(company, id) = public.current_tenant_key();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_status(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_modules(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_modules(uuid, jsonb) TO authenticated;