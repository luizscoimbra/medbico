-- =============================================================================
-- Habilita a RLS de public.platform_admins
-- =============================================================================
-- A tabela foi criada em 20261009110000_core_tenancy_tables.sql com a política
-- "Platform admin reads self", mas o laço que roda ALTER TABLE ... ENABLE ROW
-- LEVEL SECURITY (linha 184 daquele arquivo) lista apenas companies, branches,
-- user_branches, invites e company_counters. Política sem RLS habilitada não
-- filtra nada: bastava qualquer sessão autenticada ler a tabela inteira e
-- descobrir quem administra a plataforma.
--
-- Esta migração só liga a RLS; a política existente já é a correta e é
-- reaplicada aqui para deixar o arquivo autossuficiente caso seja aplicado
-- isoladamente.
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin reads self" ON public.platform_admins;

CREATE POLICY "Platform admin reads self" ON public.platform_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Ninguém concede acesso de plataforma pelo navegador: a inserção acontece em
-- SQL administrativo, não pela aplicação. Sem esta policy de negação, um
-- usuário poderia se promover a administrador de plataforma com um insert.
REVOKE INSERT, UPDATE, DELETE ON public.platform_admins FROM authenticated;