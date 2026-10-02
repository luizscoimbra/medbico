-- Gestão de Abastecimento (Frota Terrestre)
-- Registro de abastecimentos por equipamento com leitura de horímetro.

CREATE TABLE IF NOT EXISTS public.equipment_fuel_refuelings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text NOT NULL,
  fleet_number text NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horimetro numeric NOT NULL,
  litros numeric NOT NULL CHECK (litros > 0),
  tipo_combustivel text DEFAULT 'Diesel',
  valor_total numeric DEFAULT 0,
  posto_fornecedor text DEFAULT '',
  observacao text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_eqf_refuelings_equipment_id ON public.equipment_fuel_refuelings(equipment_id);
CREATE INDEX IF NOT EXISTS idx_eqf_refuelings_data ON public.equipment_fuel_refuelings(data);

-- RLS
ALTER TABLE public.equipment_fuel_refuelings ENABLE ROW LEVEL SECURITY;

-- Policies: tudo para todos os autenticados (empresa única, mesmo padrão do módulo de drones/manutenção)
CREATE POLICY "Authenticated users can manage equipment_fuel_refuelings" ON public.equipment_fuel_refuelings FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_equipment_fuel_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_eqf_refuelings_updated_at BEFORE UPDATE ON public.equipment_fuel_refuelings FOR EACH ROW EXECUTE FUNCTION update_equipment_fuel_updated_at();
