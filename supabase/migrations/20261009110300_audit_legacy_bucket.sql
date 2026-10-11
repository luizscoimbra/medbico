-- Diagnóstico: o que sobrou no bucket 'legacy' (empresa sem membros).
CREATE OR REPLACE FUNCTION public.__audit_legacy_bucket()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  tabelas text[] := ARRAY[
    'app_settings','application_types','battery_cycles','clients','component_catalog',
    'document_alerts','drone_components','drones','equipment','equipment_fuel_refuelings',
    'equipment_maintenance_items','equipment_maintenance_records','equipment_maintenance_schedules',
    'financial_payables','financial_receivables','flight_logs','maintenance_records',
    'maintenance_schedules','nozzle_measurements','operators','orders_of_service','pilots',
    'products','registered_products','service_areas','services','spray_calibrations',
    'spray_mix_recipes','stock_entries','stock_settings','suppliers'
  ];
  alvo text;
  t text;
  c bigint;
  achados jsonb := '[]'::jsonb;
BEGIN
  SELECT c.id::text INTO alvo
    FROM public.companies c WHERE c.slug = 'dados-anteriores-identifica-o-de-empresa';

  IF alvo IS NULL THEN
    RETURN jsonb_build_object('erro', 'empresa do bucket legacy nao encontrada');
  END IF;

  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE tenant_key = $1', t) INTO c USING alvo;
    IF c > 0 THEN
      achados := achados || jsonb_build_object('tabela', t, 'linhas', c);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('empresa_id', alvo, 'conteudo', achados);
END
$$;