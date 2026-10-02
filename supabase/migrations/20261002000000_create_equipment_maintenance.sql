-- Manutenção de Equipamentos (Gestão de Frotas)
-- 3 tabelas: cadastros (serviços/peças/produtos), programas e registros.

-- 1. Cadastros (serviços, peças e produtos) em tabela única com tipo
CREATE TABLE IF NOT EXISTS public.equipment_maintenance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('servico', 'peca', 'produto')),
  nome text NOT NULL,
  categoria text DEFAULT '',
  unidade text DEFAULT 'un',
  custo numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Programas de manutenção vinculados a um equipamento (intervalo em horas/dias)
CREATE TABLE IF NOT EXISTS public.equipment_maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text NOT NULL,
  fleet_number text NOT NULL,
  equipamento_modelo text DEFAULT '',
  categoria text NOT NULL,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  intervalo_horas numeric DEFAULT 0,
  intervalo_dias integer DEFAULT 0,
  checklist text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Registros de manutenção executada (histórico)
CREATE TABLE IF NOT EXISTS public.equipment_maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id text NOT NULL,
  fleet_number text NOT NULL,
  schedule_id uuid REFERENCES public.equipment_maintenance_schedules(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horas_registradas numeric DEFAULT 0,
  categoria text NOT NULL,
  titulo text NOT NULL,
  descricao text DEFAULT '',
  itens jsonb DEFAULT '[]',
  custo_mao_obra numeric DEFAULT 0,
  custo_total numeric DEFAULT 0,
  fornecedor_id text DEFAULT '',
  fornecedor_nome text DEFAULT '',
  responsavel text DEFAULT '',
  observacao text DEFAULT '',
  titulo_pagar_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_eqm_items_tipo ON public.equipment_maintenance_items(tipo);
CREATE INDEX IF NOT EXISTS idx_eqm_schedules_equipment_id ON public.equipment_maintenance_schedules(equipment_id);
CREATE INDEX IF NOT EXISTS idx_eqm_records_equipment_id ON public.equipment_maintenance_records(equipment_id);
CREATE INDEX IF NOT EXISTS idx_eqm_records_data ON public.equipment_maintenance_records(data);

-- RLS
ALTER TABLE public.equipment_maintenance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance_records ENABLE ROW LEVEL SECURITY;

-- Policies: tudo para todos os autenticados (empresa única, mesmo padrão do módulo de drones)
CREATE POLICY "Authenticated users can manage equipment_maintenance_items" ON public.equipment_maintenance_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage equipment_maintenance_schedules" ON public.equipment_maintenance_schedules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage equipment_maintenance_records" ON public.equipment_maintenance_records FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_equipment_maintenance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_eqm_items_updated_at BEFORE UPDATE ON public.equipment_maintenance_items FOR EACH ROW EXECUTE FUNCTION update_equipment_maintenance_updated_at();
CREATE TRIGGER trigger_eqm_schedules_updated_at BEFORE UPDATE ON public.equipment_maintenance_schedules FOR EACH ROW EXECUTE FUNCTION update_equipment_maintenance_updated_at();
CREATE TRIGGER trigger_eqm_records_updated_at BEFORE UPDATE ON public.equipment_maintenance_records FOR EACH ROW EXECUTE FUNCTION update_equipment_maintenance_updated_at();
