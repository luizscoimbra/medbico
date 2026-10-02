-- Permissões por módulo, por usuário.
-- NULL = usar o padrão do papel (role). Objeto = exceções { "modulo": true|false }.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS modules jsonb;
