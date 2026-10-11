-- =============================================================================
-- Self-service: cada cadastro cria a própria empresa e nasce master dela
-- =============================================================================
-- Com a Fase 0, o cadastro público produzia um operador sem empresa — uma
-- conta vazia, sem acesso a nada. Para um produto comercializável, quem se
-- cadastra precisa entrar como administrador da empresa que acabou de criar.
--
-- Aqui o cadastro público passa a gerar uma empresa isolada cujo master é quem
-- se cadastrou. O isolamento continua vindo do mesmo
-- current_tenant_key(): nada é visível entre empresas.
--
-- O "primeiro usuário do sistema" continua nascendo master com o nome que ele
-- digitou. A trava de advisory lock impede dois cadastros simultâneos de
-- disputarem o mesmo nome de empresa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Nome de empresa único e legível
-- -----------------------------------------------------------------------------
-- "Agro Cana S/A" e "Agro Cana" viram "agro-cana" e "agro-cana-1". Prefere
-- determinístico a aleatório: o rótulo aparece nos backups e fica fácil
-- identificar a empresa quando algo precisa ser corrigido à mão.
CREATE OR REPLACE FUNCTION public.unique_tenant_slug(p_name text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  base  text;
  slug  text;
  n     integer := 0;
BEGIN
  base := lower(regexp_replace(btrim(COALESCE(p_name, '')), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' FROM base);
  IF base = '' THEN
    base := 'empresa';
  END IF;
  base := left(base, 40);

  slug := base;
  WHILE EXISTS (
    SELECT 1 FROM public.profiles
     WHERE public.profile_tenant_key(company, id) = slug
  ) LOOP
    n := n + 1;
    slug := left(base, 44) || '-' || n::text;
  END LOOP;

  RETURN slug;
END
$$;

COMMENT ON FUNCTION public.unique_tenant_slug(text) IS
  'Converte o nome informado no cadastro em uma chave de empresa única e legável.';


-- -----------------------------------------------------------------------------
-- handle_new_user
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  eh_primeiro   boolean;
  nome_empresa  text;
BEGIN
  -- Serializa os cadastros: garante um único primeiro master e impede que dois
  -- cadastros simultâneos escolham o mesmo nome de empresa.
  PERFORM pg_advisory_xact_lock(hashtext('herbilog:cadastro'));

  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO eh_primeiro;

  IF eh_primeiro THEN
    -- Primeiro usuário do sistema: usa o nome digitado.
    nome_empresa := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'company_name'), ''), '');
  ELSE
    -- Auto-cadastro: nasce uma empresa nova, isolada, com quem se cadastrou
    -- como administrador master dela.
    nome_empresa := public.unique_tenant_slug(NEW.raw_user_meta_data ->> 'company_name');
  END IF;

  INSERT INTO public.profiles (id, full_name, company, phone, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), ''),
    nome_empresa,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    'master',
    'active',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Cria o perfil no cadastro. Empresa e função são decididas aqui, nunca nos metadados do usuário.';