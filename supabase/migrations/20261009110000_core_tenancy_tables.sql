-- =============================================================================
-- FASE 1 — Núcleo do tenancy
-- =============================================================================
-- Até aqui a empresa era um rótulo de texto solto em profiles.company, usado
-- como chave de tenant. Isso funciona para isolar, mas não serve para vender:
-- não há registro da empresa, não há filiais, não há como suspender um cliente
-- e não há como numerar documentos por empresa.
--
-- Este arquivo cria as entidades que dão estrutura ao tenancy. A próxima
-- migração move os dados existentes para cá; a seguinte passa as funções de
-- sessão a lerem company_id em vez do rótulo.
--
-- Nada é lido pelo aplicativo ainda — a troca de chave é a Fase 2.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles.company_id — a qual empresa o usuário pertence
-- -----------------------------------------------------------------------------
-- Fica vazio até a migração seguinte, que faz o backfill a partir do rótulo
-- atual em profiles.company. Um perfil sem empresa não acessa nada.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid;
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- -----------------------------------------------------------------------------
-- companies — o tenant
-- -----------------------------------------------------------------------------
-- `status` permite suspender um cliente sem apagar nada: as políticas de RLS
-- passam a exigir companies.status = 'active' com o usuário autenticado, então
-- suspender corta o acesso na hora.
CREATE TABLE IF NOT EXISTS public.companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  document    text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('trial', 'active', 'suspended')),
  plan        text NOT NULL DEFAULT 'standard',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.companies IS
  'Empresas clientes do sistema. Uma linha por cliente; o isolamento de dados é derivado daqui.';
COMMENT ON COLUMN public.companies.status IS
  'trial: cadastro novo · active: liberado · suspended: acesso cortado pela RLS.';

CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);

-- -----------------------------------------------------------------------------
-- branches — filiais
-- -----------------------------------------------------------------------------
-- Uma empresa tem no mínimo uma filial. `is_hq` marca a Matriz, que nasce
-- junto com a empresa e sempre existe: é onde os dados existentes vão ficar.
CREATE TABLE IF NOT EXISTS public.branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  code        text NOT NULL DEFAULT '',
  is_hq       boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_company ON public.branches(company_id);

-- Uma Matriz por empresa, no máximo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_branch_hq_per_company
  ON public.branches(company_id) WHERE is_hq;

-- Código de filial único dentro da empresa, quando informado.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_branch_code_per_company
  ON public.branches(company_id, code) WHERE code <> '';

-- -----------------------------------------------------------------------------
-- user_branches — a quem a filial dá acesso
-- -----------------------------------------------------------------------------
-- Tabela de vínculo em vez de uma coluna no perfil: um gestor pode cobrir
-- várias filiais, e um operador fica restrito à dele. Root da hierarquia
-- empresa → filial.
CREATE TABLE IF NOT EXISTS public.user_branches (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id   uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON public.user_branches(branch_id);

COMMENT ON TABLE public.user_branches IS
  'Filiais que cada usuário pode acessar. Empresa e filial são o eixo do isolamento.';

-- -----------------------------------------------------------------------------
-- platform_admins — o vendedor
-- -----------------------------------------------------------------------------
-- Quem administra o sistema comercial: cria empresas, suspende clientes. Fica
-- fora do modelo de empresa de propósito — um admin de plataforma não pertence
-- a nenhuma empresa cliente e por isso não enxerga os dados de nenhuma.
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_admins IS
  'Administradores da plataforma (o vendedor). Não pertencem a nenhuma empresa cliente.';

-- -----------------------------------------------------------------------------
-- invites — criação de acesso sem confiar no navegador
-- -----------------------------------------------------------------------------
-- Hoje o administrador cria a conta pelo signUp e depois chama
-- link_user_to_tenant. Há uma janela entre os dois passos em que a conta existe
-- sem empresa. Com convite, empresa, função e filiais vêm de uma linha do banco,
-- nunca dos metadados que o próprio usuário escreve.
CREATE TABLE IF NOT EXISTS public.invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email       text NOT NULL DEFAULT '',
  role        text NOT NULL DEFAULT 'operador'
                CHECK (role IN ('master', 'gestor', 'operador', 'motorista')),
  token       text NOT NULL UNIQUE,
  used_at     timestamptz,
  used_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_company ON public.invites(company_id);
CREATE INDEX IF NOT EXISTS idx_invites_token   ON public.invites(token);

-- -----------------------------------------------------------------------------
-- company_counters — numeração sequencial por empresa
-- -----------------------------------------------------------------------------
-- Hoje os títulos a receber e a pagar usam sequences globais: duas empresas
-- receberiam o mesmo "0001" no mesmo dia. Uma linha por empresa+tipo resolve,
-- e o ON CONFLICT DO UPDATE do PostgreSQL já dá a atomicidade necessária sem o
-- custo de uma sequence.
CREATE TABLE IF NOT EXISTS public.company_counters (
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  next_value  bigint NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, kind)
);

COMMENT ON TABLE public.company_counters IS
  'Sequenciais por empresa. Evita que dois clientes imprimam o mesmo número de título.';


-- -----------------------------------------------------------------------------
-- RLS das novas tabelas
-- -----------------------------------------------------------------------------
-- companies / branches / user_branches / invites: a empresa sai de profiles,
-- então a policy precisa evitar recursão infinita. Usamos uma função
-- SECURITY DEFINER que lê o perfil do solicitante, o que resolve o problema e
-- ainda é mais barato do que a policy ler profiles a cada linha.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_company_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
     WHERE c.id = public.current_company_id() AND c.status <> 'suspended'
  )
$$;

REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_company_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_active() TO authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies', 'branches', 'user_branches', 'invites', 'company_counters']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    FOR t IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policyname, t);
    END LOOP;
  END LOOP;
END
$$;

CREATE POLICY "Tenant can read own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.current_company_id() AND public.current_company_active());

-- O nome da empresa precisa ser exibido no menu mesmo com a empresa suspensa,
-- para o usuário entender por que perdeu o acesso.
CREATE POLICY "Suspended tenant can read own company name" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.current_company_id());

CREATE POLICY "Platform admin can read all companies" ON public.companies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins p WHERE p.user_id = auth.uid()));

CREATE POLICY "Tenant can manage own branches" ON public.branches
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id() AND public.current_company_active());

CREATE POLICY "Tenant can read own branch grants" ON public.user_branches
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.branches b
     WHERE b.id = user_branches.branch_id
       AND b.company_id = public.current_company_id()
  ));

CREATE POLICY "Tenant can manage own invites" ON public.invites
  FOR ALL TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id() AND public.current_company_active());

CREATE POLICY "Tenant can read own counters" ON public.company_counters
  FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());

-- Um admin de plataforma só enxerga a si mesmo nesta tabela.
CREATE POLICY "Platform admin reads self" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());