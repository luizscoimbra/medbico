-- Sonda de diagnóstico: executa cada etapa de stock_snapshot isoladamente e
-- devolve o primeiro erro. Temporária — remover depois do diagnóstico.
CREATE OR REPLACE FUNCTION public.__probe_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  t text;
  n bigint;
  resultado jsonb := '[]'::jsonb;
BEGIN
  t := public.current_tenant_key();

  BEGIN
    SELECT count(*) INTO n FROM public.stock_entries WHERE tenant_key = t;
    resultado := resultado || jsonb_build_object('etapa','entradas','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','entradas','erro',SQLERRM);
  END;

  BEGIN
    SELECT count(*) INTO n
    FROM public.orders_of_service os
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(os.apontamentos) = 'array' THEN os.apontamentos ELSE '[]'::jsonb END
    ) AS ap(val)
    WHERE os.tenant_key = t;
    resultado := resultado || jsonb_build_object('etapa','apontamentos','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','apontamentos','erro',SQLERRM);
  END;

  BEGIN
    SELECT count(*) INTO n
    FROM public.orders_of_service os
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(os.apontamentos) = 'array' THEN os.apontamentos ELSE '[]'::jsonb END
    ) AS ap(val)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(ap.val->'produtosSubstitutos') = 'array'
             AND jsonb_array_length(ap.val->'produtosSubstitutos') > 0
          THEN ap.val->'produtosSubstitutos'
        ELSE COALESCE(
               (os.talhoes -> public.to_num(ap.val->>'talhaoIndex')::int) -> 'produtos',
               '[]'::jsonb
             )
      END
    ) AS p(val);
    resultado := resultado || jsonb_build_object('etapa','produtos_os','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','produtos_os','erro',SQLERRM);
  END;

  BEGIN
    SELECT count(*) INTO n
    FROM public.equipment_maintenance_records mr
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(mr.itens) = 'array' THEN mr.itens ELSE '[]'::jsonb END
    ) AS it(val);
    resultado := resultado || jsonb_build_object('etapa','itens_manutencao','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','itens_manutencao','erro',SQLERRM);
  END;

  BEGIN
    SELECT count(*) INTO n
    FROM public.maintenance_records dr
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(dr.componentes_trocados) = 'array'
           THEN dr.componentes_trocados ELSE '[]'::jsonb END
    ) AS cp(val);
    resultado := resultado || jsonb_build_object('etapa','componentes_drone','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','componentes_drone','erro',SQLERRM);
  END;

  BEGIN
    SELECT count(*) INTO n
    FROM public.equipment_maintenance_items mi
    WHERE mi.ativo AND mi.tipo = 'peca';
    resultado := resultado || jsonb_build_object('etapa','itens_peca','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','itens_peca','erro',SQLERRM);
  END;

  BEGIN
    SELECT count(*) INTO n
    FROM public.equipment_fuel_refuelings cb
    WHERE cb.tenant_key = t AND public.norm_key(cb.tipo_combustivel) <> '';
    resultado := resultado || jsonb_build_object('etapa','combustivel','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','combustivel','erro',SQLERRM);
  END;

  BEGIN
    SELECT count(*) INTO n FROM public.component_catalog cc WHERE cc.tenant_key = t;
    resultado := resultado || jsonb_build_object('etapa','componentes','ok',true,'n',n);
  EXCEPTION WHEN OTHERS THEN
    RETURN resultado || jsonb_build_object('etapa','componentes','erro',SQLERRM);
  END;

  RETURN resultado;
END
$$;

REVOKE ALL ON FUNCTION public.__probe_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__probe_snapshot() TO authenticated;