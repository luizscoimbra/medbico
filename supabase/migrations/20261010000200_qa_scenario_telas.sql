-- Cenário de QA das telas: empresa com duas filiais e um administrador de
-- plataforma, para exercitar branch_overview, create_branch, set_user_branches,
-- transfer_targets, platform_companies e platform_set_company_status.
DO $$
DECLARE
  v_email   text := 'qa.telas@exemplo.invalido';
  v_senha   text := 'QaTelas!Trocar';
  e         uuid;
  mtz       uuid;
  interior  uuid;
  u_master  uuid;
  u_plat    uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'Cenário de telas já existe.';
    RETURN;
  END IF;

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
    '{"full_name":"QA Telas","company_name":"Agro Delta"}',
    now(), now(), '', '', '', ''
  )
  RETURNING id INTO u_master;

  SELECT company_id INTO e FROM public.profiles WHERE id = u_master;
  SELECT id INTO mtz FROM public.branches WHERE company_id = e AND is_hq;

  -- Administrador da plataforma: mesma empresa, mas com acesso de vendedor.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', 'qa.plataforma@exemplo.invalido',
    extensions.crypt(v_senha, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"QA Plataforma","company_name":"Agro Delta"}',
    now(), now(), '', '', '', ''
  )
  RETURNING id INTO u_plat;

  UPDATE public.profiles
     SET company_id = e,
         company = (SELECT name FROM public.companies WHERE id = e),
         role = 'master'
   WHERE id = u_plat;

  DELETE FROM public.branches WHERE company_id NOT IN (SELECT company_id FROM public.profiles);
  INSERT INTO public.user_branches (user_id, branch_id) VALUES (u_plat, mtz);

  INSERT INTO public.platform_admins (user_id) VALUES (u_plat);

  RAISE NOTICE 'Cenário de telas pronto. empresa=%, matriz=%.', e, mtz;
END
$$;