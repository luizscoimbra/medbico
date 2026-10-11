-- Conta de QA criada por SQL, sem passar pelo envio de e-mail (que tem limite
-- por hora no plano). Serve para validar de ponta a ponta a cadeia:
-- cadastro -> empresa isolada -> master -> RLS.
-- Este arquivo é removido junto com a conta ao final do teste.
DO $$
DECLARE
  v_email text := 'qa.fase0@exemplo.invalido';
  v_senha text := 'QaFase0!Trocar';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'Conta de QA já existe.';
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
    '{"full_name":"QA Fase 0","phone":"11900000000","company_name":"Agro Cana S/A"}',
    now(), now(), '', '', '', ''
  );
END
$$;