-- Diagnóstico temporário: o que as contas órfãs (empresa vazia) chegaram a criar?
CREATE OR REPLACE FUNCTION public.__audit_orphan_accounts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  tabelas text[];
  t text;
  u record;
  achados jsonb := '[]'::jsonb;
  c bigint;
BEGIN
  tabelas := ARRAY[
    'app_settings','application_types','battery_cycles','clients','component_catalog',
    'document_alerts','drone_components','drones','equipment','equipment_fuel_refuelings',
    'equipment_maintenance_items','equipment_maintenance_records','equipment_maintenance_schedules',
    'financial_payables','financial_receivables','flight_logs','maintenance_records',
    'maintenance_schedules','nozzle_measurements','operators','orders_of_service','pilots',
    'products','registered_products','service_areas','services','spray_calibrations',
    'spray_mix_recipes','stock_entries','stock_settings','suppliers'
  ];

  FOR u IN
    SELECT id, left(id::text, 8) AS id_curto, created_at
      FROM public.profiles
     WHERE COALESCE(NULLIF(btrim(company), ''), '') = ''
     ORDER BY created_at
  LOOP
    FOR t IN SELECT unnest(tabelas) LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_key = $1', t) INTO c USING u.id::text;
      IF c > 0 THEN
        achados := achados || jsonb_build_object('perfil', u.id_curto, 'tabela', t, 'linhas', c);
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'contas_orfas', (SELECT count(*) FROM public.profiles WHERE COALESCE(NULLIF(btrim(company), ''), '') = ''),
    'dados_encontrados', achados
  );
END
$$;