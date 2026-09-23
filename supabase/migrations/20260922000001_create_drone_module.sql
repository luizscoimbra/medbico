-- ============================================
-- MÓDULO DE CONTROLE E GESTÃO DE FROTAS DE DRONES AGRÍCOLAS
-- ============================================

-- 1. Cadastro de Drones
CREATE TABLE IF NOT EXISTS public.drones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modelo text NOT NULL,
  marca text DEFAULT '',
  numero_serie text NOT NULL,
  registro_anac text DEFAULT '',
  registro_anatel text DEFAULT '',
  mtow numeric DEFAULT 0,
  apolice_seguro text DEFAULT '',
  data_vencimento_seguro date,
  horas_voo_total numeric DEFAULT 0,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'manutencao', 'inativo')),
  imagem_url text DEFAULT '',
  observacoes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Componentes e Acessórios dos Drones
CREATE TABLE IF NOT EXISTS public.drone_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id uuid NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('bateria', 'tanque', 'bico', 'sensor', 'carregador', 'camera', 'helice', 'outro')),
  modelo text NOT NULL,
  numero_serie text DEFAULT '',
  especificacoes jsonb DEFAULT '{}',
  ciclo_maximo integer DEFAULT 0,
  horas_voo_total numeric DEFAULT 0,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'desgastado', 'danificado', 'substituido')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Logbook de Voo
CREATE TABLE IF NOT EXISTS public.flight_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id uuid NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio time,
  hora_fim time,
  area_nome text DEFAULT '',
  talhao text DEFAULT '',
  cliente_nome text DEFAULT '',
  cultura text DEFAULT '',
  piloto text DEFAULT '',
  operador_apoio text DEFAULT '',
  tempo_voo_min numeric DEFAULT 0,
  hectares_pulverizados numeric DEFAULT 0,
  volume_aplicado_l numeric DEFAULT 0,
  produtos_aplicados jsonb DEFAULT '[]',
  ciclos_bateria integer DEFAULT 0,
  combustivel_gerador_l numeric DEFAULT 0,
  condicoes_climaticas text DEFAULT '',
  vento_kmh numeric DEFAULT 0,
  temperatura_c numeric DEFAULT 0,
  observacoes text DEFAULT '',
  os_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Histórico de Ciclos de Bateria
CREATE TABLE IF NOT EXISTS public.battery_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id uuid NOT NULL REFERENCES public.drone_components(id) ON DELETE CASCADE,
  flight_log_id uuid REFERENCES public.flight_logs(id) ON DELETE SET NULL,
  ciclo_numero integer NOT NULL,
  voltagem_inicio numeric DEFAULT 0,
  voltagem_fim numeric DEFAULT 0,
  soh numeric DEFAULT 100,
  temperatura_operacao numeric DEFAULT 0,
  data_carga timestamptz,
  tempo_carga_min numeric DEFAULT 0,
  avarias text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 5. Regras de Manutenção por Modelo
CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_modelo text NOT NULL,
  tipo_manutencao text NOT NULL CHECK (tipo_manutencao IN ('diaria', '50h', '100h', '200h', 'corretiva')),
  titulo text NOT NULL,
  descricao text NOT NULL,
  intervalo_horas numeric DEFAULT 0,
  intervalo_dias integer DEFAULT 0,
  checklist text[] DEFAULT '{}',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 6. Registros de Manutenção Realizada
CREATE TABLE IF NOT EXISTS public.maintenance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id uuid NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  horas_voo_registradas numeric DEFAULT 0,
  tipo text NOT NULL CHECK (tipo IN ('preventiva', 'corretiva')),
  titulo text NOT NULL,
  descricao text NOT NULL,
  componentes_trocados jsonb DEFAULT '[]',
  custo numeric DEFAULT 0,
  responsavel text DEFAULT '',
  fotos_url text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Alertas de Documentos
CREATE TABLE IF NOT EXISTS public.document_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_id uuid NOT NULL REFERENCES public.drones(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('seguro', 'rancho', 'licenca_piloto', 'inspecao', 'outro')),
  titulo text NOT NULL,
  data_vencimento date NOT NULL,
  alertar_dias_antes integer DEFAULT 30,
  notificado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 8. Pilotos/Licenças
CREATE TABLE IF NOT EXISTS public.pilots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  licenca_anac text DEFAULT '',
  data_vencimento_licenca date,
  telefone text DEFAULT '',
  email text DEFAULT '',
  horas_voo_total numeric DEFAULT 0,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_drones_user_id ON public.drones(user_id);
CREATE INDEX IF NOT EXISTS idx_drone_components_drone_id ON public.drone_components(drone_id);
CREATE INDEX IF NOT EXISTS idx_flight_logs_drone_id ON public.flight_logs(drone_id);
CREATE INDEX IF NOT EXISTS idx_flight_logs_data ON public.flight_logs(data);
CREATE INDEX IF NOT EXISTS idx_flight_logs_user_id ON public.flight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_battery_cycles_component_id ON public.battery_cycles(component_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_drone_id ON public.maintenance_records(drone_id);
CREATE INDEX IF NOT EXISTS idx_document_alerts_drone_id ON public.document_alerts(drone_id);
CREATE INDEX IF NOT EXISTS idx_pilots_user_id ON public.pilots(user_id);

-- RLS (Row Level Security)
ALTER TABLE public.drones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drone_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battery_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilots ENABLE ROW LEVEL SECURITY;

-- Policies: tudo para todos os autenticados (empresa única)
CREATE POLICY "Authenticated users can manage drones" ON public.drones FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage drone_components" ON public.drone_components FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage flight_logs" ON public.flight_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage battery_cycles" ON public.battery_cycles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage maintenance_schedules" ON public.maintenance_schedules FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage maintenance_records" ON public.maintenance_records FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage document_alerts" ON public.document_alerts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage pilots" ON public.pilots FOR ALL USING (auth.role() = 'authenticated');

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_drone_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_drones_updated_at BEFORE UPDATE ON public.drones FOR EACH ROW EXECUTE FUNCTION update_drone_updated_at();
CREATE TRIGGER trigger_drone_components_updated_at BEFORE UPDATE ON public.drone_components FOR EACH ROW EXECUTE FUNCTION update_drone_updated_at();
CREATE TRIGGER trigger_flight_logs_updated_at BEFORE UPDATE ON public.flight_logs FOR EACH ROW EXECUTE FUNCTION update_drone_updated_at();
CREATE TRIGGER trigger_maintenance_records_updated_at BEFORE UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION update_drone_updated_at();
CREATE TRIGGER trigger_pilots_updated_at BEFORE UPDATE ON public.pilots FOR EACH ROW EXECUTE FUNCTION update_drone_updated_at();
