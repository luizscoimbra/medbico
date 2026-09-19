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

-- 2. Criar tabela de serviços (caso não exista)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
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
  END IF;
END $$;

-- 3. Habilitar RLS na tabela services
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'services') THEN
    ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 4. Policies para services
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own services' AND tablename = 'services') THEN
    CREATE POLICY "Users can view their own services" ON public.services FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create their own services' AND tablename = 'services') THEN
    CREATE POLICY "Users can create their own services" ON public.services FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own services' AND tablename = 'services') THEN
    CREATE POLICY "Users can update their own services" ON public.services FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own services' AND tablename = 'services') THEN
    CREATE POLICY "Users can delete their own services" ON public.services FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Trigger para updated_at na tabela services
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_services_updated_at') THEN
    CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
