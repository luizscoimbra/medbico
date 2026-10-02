-- Módulo de Estoque (Produtos, Peças, Acessórios e Combustível)
-- Entradas manuais (compras) + saídas derivadas dos módulos correspondentes.

CREATE TABLE IF NOT EXISTS public.stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN ('produto', 'peca', 'acessorio', 'combustivel')),
  item_key text NOT NULL,
  item_nome text NOT NULL,
  quantidade numeric NOT NULL CHECK (quantidade > 0),
  valor_total numeric DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  fornecedor text DEFAULT '',
  observacao text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_settings (
  item_key text PRIMARY KEY,
  categoria text NOT NULL CHECK (categoria IN ('produto', 'peca', 'acessorio', 'combustivel')),
  minimo numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_stock_entries_categoria ON public.stock_entries(categoria);
CREATE INDEX IF NOT EXISTS idx_stock_entries_item_key ON public.stock_entries(item_key);
CREATE INDEX IF NOT EXISTS idx_stock_entries_data ON public.stock_entries(data);

-- RLS
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_settings ENABLE ROW LEVEL SECURITY;

-- Policies: tudo para todos os autenticados (empresa única, mesmo padrão dos demais módulos)
CREATE POLICY "Authenticated users can manage stock_entries" ON public.stock_entries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage stock_settings" ON public.stock_settings FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at (reaproveita a função já existente do módulo de abastecimento)
CREATE TRIGGER trigger_stock_entries_updated_at BEFORE UPDATE ON public.stock_entries FOR EACH ROW EXECUTE FUNCTION update_equipment_fuel_updated_at();
CREATE TRIGGER trigger_stock_settings_updated_at BEFORE UPDATE ON public.stock_settings FOR EACH ROW EXECUTE FUNCTION update_equipment_fuel_updated_at();
