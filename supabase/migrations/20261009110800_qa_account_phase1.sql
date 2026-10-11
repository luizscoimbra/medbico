-- Conta de QA para validar a Fase 1 ponta a ponta (cadastro self-service ->
-- empresa -> filial -> master -> RLS). Removida na migração de limpeza.
DO $$
DECLARE
  v_email text := 'qa.fase1@exemplo.invalido';
  v_senha text := 'QaFase1!Trocar';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'Conta de QA da Fase 1 já existe.';
    RETURN;
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    v_email,
    extensions.crypt(v_senha, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"QA Fase 1","phone":"11900000000","company_name":"Fazenda Beta"}',
    now(), now(), '', '', '', ''
  );
END
$$;