-- Create RPC function to update product fields bypassing PostgREST schema cache
CREATE OR REPLACE FUNCTION public.update_product(
  p_id uuid,
  p_commercial_name text DEFAULT NULL,
  p_formulation text DEFAULT NULL,
  p_unit text DEFAULT NULL,
  p_package_size numeric DEFAULT NULL,
  p_preco_unitario numeric DEFAULT NULL,
  p_codigo text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_ncm text DEFAULT NULL,
  p_cfop text DEFAULT NULL,
  p_cst_csosn text DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_cest text DEFAULT NULL,
  p_aliquota_icms numeric DEFAULT NULL,
  p_aliquota_ipi numeric DEFAULT NULL,
  p_enquadramento_ipi text DEFAULT NULL,
  p_aliquota_pis numeric DEFAULT NULL,
  p_aliquota_cofins numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.registered_products SET
    commercial_name = COALESCE(p_commercial_name, commercial_name),
    formulation = COALESCE(p_formulation, formulation),
    unit = COALESCE(p_unit, unit),
    package_size = COALESCE(p_package_size, package_size),
    preco_unitario = COALESCE(p_preco_unitario, preco_unitario),
    codigo = COALESCE(p_codigo, codigo),
    descricao = COALESCE(p_descricao, descricao),
    ncm = COALESCE(p_ncm, ncm),
    cfop = COALESCE(p_cfop, cfop),
    cst_csosn = COALESCE(p_cst_csosn, cst_csosn),
    origem = COALESCE(p_origem, origem),
    cest = COALESCE(p_cest, cest),
    aliquota_icms = COALESCE(p_aliquota_icms, aliquota_icms),
    aliquota_ipi = COALESCE(p_aliquota_ipi, aliquota_ipi),
    enquadramento_ipi = COALESCE(p_enquadramento_ipi, enquadramento_ipi),
    aliquota_pis = COALESCE(p_aliquota_pis, aliquota_pis),
    aliquota_cofins = COALESCE(p_aliquota_cofins, aliquota_cofins)
  WHERE id = p_id AND auth.uid() = user_id;

  RETURN json_build_object('success', TRUE);
END;
$$;

-- Create RPC function to insert product bypassing PostgREST schema cache
CREATE OR REPLACE FUNCTION public.insert_product(
  p_user_id uuid,
  p_commercial_name text,
  p_formulation text DEFAULT 'SL',
  p_unit text DEFAULT 'L',
  p_package_size numeric DEFAULT 1,
  p_preco_unitario numeric DEFAULT 0,
  p_codigo text DEFAULT '',
  p_descricao text DEFAULT '',
  p_ncm text DEFAULT '',
  p_cfop text DEFAULT '',
  p_cst_csosn text DEFAULT '',
  p_origem text DEFAULT '0',
  p_cest text DEFAULT '',
  p_aliquota_icms numeric DEFAULT 0,
  p_aliquota_ipi numeric DEFAULT 0,
  p_enquadramento_ipi text DEFAULT '',
  p_aliquota_pis numeric DEFAULT 0,
  p_aliquota_cofins numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.registered_products (
    user_id, commercial_name, formulation, unit, package_size,
    preco_unitario, codigo, descricao, ncm, cfop, cst_csosn,
    origem, cest, aliquota_icms, aliquota_ipi, enquadramento_ipi,
    aliquota_pis, aliquota_cofins
  ) VALUES (
    p_user_id, p_commercial_name, p_formulation, p_unit, p_package_size,
    p_preco_unitario, p_codigo, p_descricao, p_ncm, p_cfop, p_cst_csosn,
    p_origem, p_cest, p_aliquota_icms, p_aliquota_ipi, p_enquadramento_ipi,
    p_aliquota_pis, p_aliquota_cofins
  ) RETURNING id INTO new_id;

  RETURN json_build_object('success', TRUE, 'id', new_id);
END;
$$;
