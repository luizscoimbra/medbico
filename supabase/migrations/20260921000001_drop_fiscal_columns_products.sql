DROP FUNCTION IF EXISTS public.insert_product;
DROP FUNCTION IF EXISTS public.update_product;
DROP FUNCTION IF EXISTS public.reload_schema;

ALTER TABLE public.registered_products
  DROP COLUMN IF EXISTS aliquota_cofins,
  DROP COLUMN IF EXISTS aliquota_icms,
  DROP COLUMN IF EXISTS aliquota_ipi,
  DROP COLUMN IF EXISTS aliquota_pis,
  DROP COLUMN IF EXISTS cest,
  DROP COLUMN IF EXISTS cfop,
  DROP COLUMN IF EXISTS codigo,
  DROP COLUMN IF EXISTS cst_csosn,
  DROP COLUMN IF EXISTS descricao,
  DROP COLUMN IF EXISTS enquadramento_ipi,
  DROP COLUMN IF EXISTS ncm,
  DROP COLUMN IF EXISTS origem;
