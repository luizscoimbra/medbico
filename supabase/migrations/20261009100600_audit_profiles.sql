-- Diagnóstico temporário: estado atual dos perfis (sem PII).
CREATE OR REPLACE FUNCTION public.__audit_profiles()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.profiles),
    'por_role', (
      SELECT COALESCE(jsonb_object_agg(role, n), '{}'::jsonb)
      FROM (SELECT COALESCE(role,'(null)') AS role, count(*) AS n
              FROM public.profiles GROUP BY 1) g
    ),
    'perfis', (
      SELECT COALESCE(jsonb_agg(p), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
                 'id', left(p.id::text, 8),
                 'role', p.role,
                 'status', p.status,
                 'empresa', COALESCE(NULLIF(btrim(p.company), ''), '(vazia)'),
                 'criado_em', p.created_at
               ) AS p
          FROM public.profiles p
         ORDER BY p.created_at ASC
         LIMIT 10
      ) t
    )
  )
$$;