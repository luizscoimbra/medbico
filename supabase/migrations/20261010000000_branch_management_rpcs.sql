-- =============================================================================
-- Gestão de filiais
-- =============================================================================
-- A Fase 2 criou as tabelas e o isolamento, mas não a interface. Estas funções
-- concentram as regras para que a tela não precise reproduzi-las:
--   * só o administrador master da empresa cria, renomeia ou desativa filiais;
--   * a Matriz não pode ser desativada nem receber código duplicado;
--   * desativar uma filial não apaga dado nenhum — os registros continuam lá e
--     voltam a aparecer se a filial for reativada.
--
-- A exclusão física fica de fora de propósito: um usuário atribuído à filial
-- não pode simplesmente sumir. O caminho é desativar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Criar filial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_branch(p_name text, p_code text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
  nova    uuid;
  limpo   text;
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

  IF btrim(COALESCE(p_code, '')) <> '' AND EXISTS (
    SELECT 1 FROM public.branches b
     WHERE b.company_id = empresa AND b.code = btrim(p_code)
  ) THEN
    RAISE EXCEPTION 'Já existe uma filial com o código %', btrim(p_code);
  END IF;

  INSERT INTO public.branches (company_id, name, code, is_hq)
  VALUES (empresa, limpo, btrim(COALESCE(p_code, '')), false)
  RETURNING id INTO nova;

  RETURN nova;
END
$$;


-- -----------------------------------------------------------------------------
-- Alterar filial
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_branch(
  p_branch uuid,
  p_name   text,
  p_code   text DEFAULT '',
  p_status text DEFAULT 'active'
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
  atual   public.branches%ROWTYPE;
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

  IF btrim(COALESCE(p_code, '')) <> '' AND EXISTS (
    SELECT 1 FROM public.branches b
     WHERE b.company_id = empresa AND b.code = btrim(p_code) AND b.id <> p_branch
  ) THEN
    RAISE EXCEPTION 'Já existe uma filial com o código %', btrim(p_code);
  END IF;

  UPDATE public.branches
     SET name = btrim(COALESCE(p_name, name)),
         code = btrim(COALESCE(p_code, '')),
         status = p_status,
         updated_at = now()
   WHERE id = p_branch;
END
$$;


-- -----------------------------------------------------------------------------
-- Definir quais filiais um usuário acessa
-- -----------------------------------------------------------------------------
-- Substitui o conjunto inteiro. Um usuário sem nenhuma filial não enxerga dado
-- operacional nenhum (o compartilhado continua visível).
CREATE OR REPLACE FUNCTION public.set_user_branches(p_target uuid, p_branches uuid[])
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  empresa uuid := public.current_company_id();
  n       integer;
BEGIN
  IF NOT public.current_is_company_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador master da empresa pode editar acessos de filial';
  END IF;

  IF p_target IS NULL OR NOT public.profile_in_current_company(p_target) THEN
    RAISE EXCEPTION 'Usuário não pertence à sua empresa';
  END IF;

  -- Rejeita filial de outra empresa em vez de ignorar em silêncio.
  SELECT count(*) INTO n
    FROM public.branches b
   WHERE b.id = ANY(COALESCE(p_branches, '{}'::uuid[]))
     AND b.company_id <> empresa;
  IF n > 0 THEN
    RAISE EXCEPTION 'Uma ou mais filiais pertencem a outra empresa';
  END IF;

  DELETE FROM public.user_branches ub WHERE ub.user_id = p_target;

  INSERT INTO public.user_branches (user_id, branch_id)
  SELECT p_target, unnest(COALESCE(p_branches, '{}'::uuid[]))
  ON CONFLICT DO NOTHING;
END
$$;


-- -----------------------------------------------------------------------------
-- Resumo por filial, para a tela
-- -----------------------------------------------------------------------------
-- Quantos usuários e quantos registros operacionais cada filial acumula.
CREATE OR REPLACE FUNCTION public.branch_overview()
RETURNS TABLE (
  branch_id    uuid,
  nome         text,
  codigo       text,
  is_hq        boolean,
  status       text,
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
    (SELECT count(*) FROM public.user_branches ub WHERE ub.branch_id = b.id),
    (SELECT count(*) FROM public.orders_of_service o
      WHERE o.branch_id = b.id AND o.tenant_key = (SELECT id::text FROM empresa)),
    (SELECT count(DISTINCT se.item_key) FROM public.stock_entries se
      WHERE se.branch_id = b.id AND se.tenant_key = (SELECT id::text FROM empresa))
  FROM public.branches b
  WHERE b.company_id = (SELECT id FROM empresa)
  ORDER BY b.is_hq DESC, b.name
$$;

REVOKE ALL ON FUNCTION public.create_branch(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_branch(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_branches(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.branch_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_branch(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_branch(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_branches(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.branch_overview() TO authenticated;


-- -----------------------------------------------------------------------------
-- Transferência: a filial de destino precisa ser conhecida na tela
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_targets(p_de uuid)
RETURNS TABLE (branch_id uuid, nome text, codigo text, saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT b.id, b.name, b.code, public.stock_balance(b.id::text)
    FROM public.branches b
   WHERE b.company_id::text = public.current_tenant_key()
     AND b.status = 'active'
     AND b.id <> p_de
     AND b.id = ANY(public.current_branch_ids())
   ORDER BY b.name
$$;

REVOKE ALL ON FUNCTION public.transfer_targets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_targets(uuid) TO authenticated;