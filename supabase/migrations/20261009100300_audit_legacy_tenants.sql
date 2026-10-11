-- Diagnóstico temporário: onde ficaram as linhas sem dono resolvido na Fase 0.
-- Retorna jsonb e captura o erro, para não virar um 400 sem mensagem.
CREATE OR REPLACE FUNCTION public.__audit_legacy_tenants()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  nomes text[];
  n     text;
  c     bigint;
  out   jsonb := '[]'::jsonb;
BEGIN
  nomes := ARRAY[
    'drones', 'drone_components', 'flight_logs', 'battery_cycles',
    'maintenance_schedules', 'maintenance_records', 'document_alerts', 'pilots',
    'equipment_maintenance_items', 'equipment_maintenance_schedules',
    'equipment_maintenance_records', 'products', 'registered_products', 'services'
  ];

  FOREACH n IN ARRAY nomes LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_key = ''legacy''', n) INTO c;
    IF c > 0 THEN
      out := out || jsonb_build_object(n, c);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'por_tabela', out);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'erro', SQLERRM);
END
$$;

GRANT EXECUTE ON FUNCTION public.__audit_legacy_tenants() TO authenticated;