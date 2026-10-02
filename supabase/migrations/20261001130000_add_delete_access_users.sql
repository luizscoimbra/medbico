-- Política de DELETE em profiles: apenas masters podem excluir acessos de terceiros
DROP POLICY IF EXISTS "Masters can delete profiles" ON public.profiles;
CREATE POLICY "Masters can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  auth.uid() <> id
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'master'
  )
);

-- Exclui a conta inteira (auth.users) e, por cascata, o profile
CREATE OR REPLACE FUNCTION public.delete_user(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Apenas usuários master podem excluir acessos';
  END IF;

  IF target = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir seu próprio acesso';
  END IF;

  DELETE FROM auth.users WHERE id = target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO authenticated;
