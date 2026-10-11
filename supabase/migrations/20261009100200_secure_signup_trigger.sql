-- =============================================================================
-- FASE 0 — handle_new_user sem confiança em raw_user_meta_data
-- =============================================================================
-- O trigger lia `company` e `role` de raw_user_meta_data, que é um campo
-- gravável pelo próprio usuário no momento do signUp. Qualquer pessoa podia se
-- cadastrar informando o nome de outra empresa e, com isso, cair dentro do
-- tenant dela — vendo clientes, financeiro e frota de um concorrente.
--
-- Nova regra:
--   * O trigger NUNCA lê empresa nem papel dos metadados.
--   * Todo usuário nasce `operador`, ativo, sem empresa (tenant = próprio id):
--     uma empresa privada e vazia, sem acesso a nada.
--   * A empresa e o papel passam a ser atribuídos por
--     public.link_user_to_tenant(), chamada pelo administrador da empresa.
--
-- Exceção de bootstrap: o primeiro usuário do sistema continua nascendo master,
-- porque não existe ninguém para concede-lo acesso. A trava de advisory lock
-- elimina a corrida em que dois cadastros simultâneos se declaravam master.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  eh_primeiro  boolean;
  nome_empresa text;
BEGIN
  -- Serializa cadastros simultâneos para que apenas o primeiro seja master.
  PERFORM pg_advisory_xact_lock(hashtext('herbilog:primeiro_usuario'));

  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE id <> NEW.id) INTO eh_primeiro;

  -- Só o primeiro usuário pode dar o nome da própria empresa. Para todos os
  -- outros, o rótulo fica vazio de propósito: sem empresa, sem dados.
  IF eh_primeiro THEN
    nome_empresa := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'company_name'), ''), '');
  ELSE
    nome_empresa := '';
  END IF;

  INSERT INTO public.profiles (id, full_name, company, phone, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), ''),
    nome_empresa,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    CASE WHEN eh_primeiro THEN 'master' ELSE 'operador' END,
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria o perfil no cadastro. Ignora empresa e papel dos metadados do usuário.';


-- -----------------------------------------------------------------------------
-- Rede de segurança: garante que o gatilho está instalado
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;