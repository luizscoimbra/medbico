-- Cenário de QA da Fase 2: empresa com duas filiais e um operador restrito a
-- uma delas. Permite verificar o isolamento entre filiais e a transferência
-- de estoque de ponta a ponta.
DO $$
DECLARE
  v_email   text := 'qa.fase2@exemplo.invalido';
  v_senha   text := 'QaFase2!Trocar';
  e         uuid;
  mtz       uuid;
  interior  uuid;
  u_master  uuid;
  u_op      uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'Cenário de QA da Fase 2 já existe.';
    RETURN;
  END IF;

  -- Cadastro público cria empresa, Matriz e master.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', v_email,
    extensions.crypt(v_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"QA Fase 2","company_name":"Grupo Gamma"}',
    now(), now(), '', '', '', ''
  )
  RETURNING id INTO u_master;

  SELECT company_id INTO e FROM public.profiles WHERE id = u_master;
  SELECT id INTO mtz FROM public.branches WHERE company_id = e AND is_hq;

  INSERT INTO public.branches (company_id, name, code, is_hq)
  VALUES (e, 'Filial Interior', 'INT', false)
  RETURNING id INTO interior;

  -- Operador criado direto, restrito à filial Interior.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', 'qa.fase2.interior@exemplo.invalido',
    extensions.crypt(v_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"QA Interior","company_name":"Grupo Gamma"}',
    now(), now(), '', '', '', ''
  )
  RETURNING id INTO u_op;

  -- Reaproveita a empresa já criada em vez de gerar outra.
  UPDATE public.profiles
     SET company_id = e, company = (SELECT name FROM public.companies WHERE id = e),
         role = 'operador', status = 'active'
   WHERE id = u_op;

  DELETE FROM public.branches WHERE company_id NOT IN (SELECT company_id FROM public.profiles);

  INSERT INTO public.user_branches (user_id, branch_id) VALUES (u_op, interior);

  RAISE NOTICE 'Cenário QA: empresa=%, matriz=%, interior=%, operador=%.',
    e, mtz, interior, u_op;
END
$$;