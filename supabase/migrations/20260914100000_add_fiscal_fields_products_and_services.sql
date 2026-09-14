-- Migration: Adicionar campos fiscais NF-e a registered_products + criar tabela services

-- 1. Adicionar colunas fiscais na tabela registered_products
ALTER TABLE public.registered_products
ADD COLUMN IF NOT EXISTS codigo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS ncm TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS cfop TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS cst_csosn TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT '0',
ADD COLUMN IF NOT EXISTS cest TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS preco_unitario NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aliquota_ipi NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS enquadramento_ipi TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS aliquota_pis NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS aliquota_cofins NUMERIC DEFAULT 0;

-- 2. Criar tabela de serviços
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text NOT NULL DEFAULT 'UN',
  preco_unitario numeric NOT NULL DEFAULT 0,
  cnae text DEFAULT '',
  item_lista_servico text DEFAULT '',
  cod_tributacao text DEFAULT '',
  aliquota_iss numeric DEFAULT 0,
  base_calculo_iss numeric DEFAULT 0,
  aliquota_pis numeric DEFAULT 0,
  aliquota_cofins numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS na tabela services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own services" ON public.services FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own services" ON public.services FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own services" ON public.services FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own services" ON public.services FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
