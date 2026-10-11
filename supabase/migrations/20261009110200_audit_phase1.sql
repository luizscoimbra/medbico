-- Auditoria temporária da Fase 1: empresas, filiais, vínculos e perfis.
CREATE OR REPLACE FUNCTION public.__audit_phase1()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN jsonb_build_object(
    'empresas', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('nome', c.name, 'slug', c.slug, 'status', c.status, 'id', c.id) AS x
          FROM public.companies c ORDER BY c.created_at
      ) t
    ),
    'filiais', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('empresa', b.company_id, 'nome', b.name, 'hq', b.is_hq) AS x
          FROM public.branches b ORDER BY b.created_at
      ) t
    ),
    'perfis', (
      SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('id', left(p.id::text,8), 'role', p.role,
               'empresa_id', p.company_id, 'empresa_nome', p.company) AS x
          FROM public.profiles p ORDER BY p.created_at
      ) t
    ),
    'vinculos', (SELECT count(*) FROM public.user_branches)
  );
END
$$;