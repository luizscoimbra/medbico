-- Importação de XML de NF-e no cadastro de produtos
-- Adiciona código de barras (GTIN/cEAN) e preço de custo ao catálogo comercial

ALTER TABLE public.registered_products
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT DEFAULT '';

ALTER TABLE public.registered_products
  ADD COLUMN IF NOT EXISTS preco_custo NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.registered_products.codigo_barras IS
  'GTIN/EAN lido do campo cEAN de itens de NF-e importados';

COMMENT ON COLUMN public.registered_products.preco_custo IS
  'Preço de custo (R$ por unidade de medida: L/KG) corrigido a partir da nota fiscal';

CREATE INDEX IF NOT EXISTS idx_registered_products_codigo_barras
  ON public.registered_products (codigo_barras)
  WHERE codigo_barras IS NOT NULL AND codigo_barras <> '';
