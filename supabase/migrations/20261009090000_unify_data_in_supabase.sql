-- =============================================================================
-- FASE 2 — Unificação da persistência no Supabase (PostgreSQL)
-- =============================================================================
-- Elimina a dualidade de armazenamento (IndexedDB no navegador vs. nuvem).
-- Todas as entidades que viviam apenas no cliente passam a residir no PostgreSQL,
-- com isolamento por tenant (empresa) aplicado via Row Level Security.
--
-- Decisões de projeto:
--   * Chaves primárias são TEXT, não UUID. O aplicativo já gera os ids no cliente
--     (crypto.randomUUID(), "20260101-001", "tr-...", "tp-...", "for-..."), e esses
--     ids são referenciados por outras tabelas (equipment_fuel_refuelings.os_id,
--     stock_settings.item_key, equipment_maintenance_records.equipment_id).
--     Preservar o id original evita qualquer necessidade de remapeamento.
--   * Campos aninhados e já indexados pelo aplicativo (talhoes, apontamentos,
--     servicos, itens, coletas, produtos) permanecem em JSONB. Normalizá-los em
--     tabelas filhas quebraria as referências posicionais usadas no código
--     (talhaoIndex, registroAnteriorIdx) sem ganho funcional.
--   * O isolamento é por EMPRESA (tenant), não por usuário isolado: o-application
--     precisa que motorista, operador e gestor vejam as mesmas OS. Usuários de
--     empresas diferentes ficam isolados uns dos outros.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Chave do tenant corrente
-- -----------------------------------------------------------------------------
-- Usa profiles.company (obrigatório no cadastro). Perfis sem empresa caem no
-- próprio id do usuário, mantendo o isolamento sem vazar dados.
CREATE OR REPLACE FUNCTION public.current_tenant_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_tenant_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_key() TO anon, authenticated;

COMMENT ON FUNCTION public.current_tenant_key() IS
  'Chave de tenant (empresa) do usuário autenticado. Base de todas as políticas de RLS.';


-- -----------------------------------------------------------------------------
-- equipment: uuid -> text + colunas que faltavam + tenant
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'equipment'
      AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.equipment DROP CONSTRAINT IF EXISTS equipment_pkey;
    ALTER TABLE public.equipment ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE public.equipment ALTER COLUMN id TYPE text USING id::text;
    ALTER TABLE public.equipment ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);
  END IF;
END
$$;

ALTER TABLE public.equipment ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS nozzle_spacing numeric;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS working_speed numeric;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS application_rate numeric;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS horas_acumuladas numeric NOT NULL DEFAULT 0;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS data_ultima_leitura date;
ALTER TABLE public.equipment ADD COLUMN IF NOT EXISTS tenant_key text;

-- auth.uid() é NULL fora do contexto de requisição, então linhas pré-existentes
-- caem no bucket 'legacy' e podem ser reatribuídas pela empresa que as claiming.
UPDATE public.equipment
   SET tenant_key = COALESCE(public.current_tenant_key(), 'legacy')
 WHERE tenant_key IS NULL;

ALTER TABLE public.equipment ALTER COLUMN tenant_key SET DEFAULT public.current_tenant_key();
ALTER TABLE public.equipment ALTER COLUMN tenant_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_tenant_key ON public.equipment(tenant_key);

DROP POLICY IF EXISTS "Users can view their own equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can create their own equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can update their own equipment" ON public.equipment;
DROP POLICY IF EXISTS "Users can delete their own equipment" ON public.equipment;

CREATE POLICY "Tenant can manage equipment" ON public.equipment
  FOR ALL
  USING (tenant_key = public.current_tenant_key())
  WITH CHECK (tenant_key = public.current_tenant_key());


-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id              text PRIMARY KEY,
  tenant_key      text NOT NULL DEFAULT public.current_tenant_key(),
  user_id         uuid NOT NULL DEFAULT auth.uid(),
  tipo            text NOT NULL DEFAULT 'pessoa_fisica'
                    CHECK (tipo IN ('pessoa_fisica', 'pessoa_juridica')),
  nome_completo   text DEFAULT '',
  cpf             text DEFAULT '',
  razao_social    text DEFAULT '',
  nome_fantasia   text DEFAULT '',
  cnpj            text DEFAULT '',
  telefone        text DEFAULT '',
  email           text DEFAULT '',
  endereco        text DEFAULT '',
  cidade          text DEFAULT '',
  estado          text DEFAULT '',
  observacoes     text DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- operators
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operators (
  id          text PRIMARY KEY,
  tenant_key  text NOT NULL DEFAULT public.current_tenant_key(),
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  nome        text NOT NULL DEFAULT '',
  cracha      text NOT NULL DEFAULT '',
  funcao      text NOT NULL DEFAULT 'Operador'
                CHECK (funcao IN ('Operador', 'Motorista', 'Gestor')),
  setor       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- service_areas (áreas / talhões de aplicação)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_areas (
  id                 text PRIMARY KEY,
  tenant_key         text NOT NULL DEFAULT public.current_tenant_key(),
  user_id            uuid NOT NULL DEFAULT auth.uid(),
  nome               text NOT NULL DEFAULT '',
  codigo             text DEFAULT '',
  coordenadas        text NOT NULL DEFAULT '',
  quantidade_talhoes integer NOT NULL DEFAULT 0,
  talhoes            jsonb NOT NULL DEFAULT '[]'::jsonb,
  area_carreador     numeric,
  municipio          text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- application_types
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_types (
  id          text PRIMARY KEY,
  tenant_key  text NOT NULL DEFAULT public.current_tenant_key(),
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  nome        text NOT NULL DEFAULT '',
  codigo      text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- suppliers
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id          text PRIMARY KEY,
  tenant_key  text NOT NULL DEFAULT public.current_tenant_key(),
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  nome        text NOT NULL DEFAULT '',
  documento   text DEFAULT '',
  telefone    text DEFAULT '',
  email       text DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- component_catalog (componentes de drone / acessórios)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.component_catalog (
  id           text PRIMARY KEY,
  tenant_key   text NOT NULL DEFAULT public.current_tenant_key(),
  user_id      uuid NOT NULL DEFAULT auth.uid(),
  nome         text NOT NULL DEFAULT '',
  numero_serie text NOT NULL DEFAULT '',
  marca        text NOT NULL DEFAULT '',
  modelo       text NOT NULL DEFAULT '',
  custo        numeric NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- orders_of_service
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders_of_service (
  id                 text PRIMARY KEY,
  tenant_key         text NOT NULL DEFAULT public.current_tenant_key(),
  user_id            uuid NOT NULL DEFAULT auth.uid(),
  os_externa         text,
  data               text NOT NULL DEFAULT '',
  propriedade        text NOT NULL DEFAULT '',
  codigo_area        text DEFAULT '',
  responsavel_tecnico text DEFAULT '',
  aplicador          text DEFAULT '',
  talhoes            jsonb NOT NULL DEFAULT '[]'::jsonb,
  volume_calda_ha    text DEFAULT '',
  coordenadas        text DEFAULT '',
  tipo_aplicacao     text DEFAULT '',
  codigo_aplicacao   text DEFAULT '',
  apontamentos       jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text CHECK (status IN ('aberta', 'em_andamento', 'concluida')),
  equipamentos       jsonb NOT NULL DEFAULT '[]'::jsonb,
  cliente_id         text,
  cliente_nome       text,
  servicos           jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor_herbicidas   numeric,
  valor_servico      numeric,
  valor_total        numeric,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- spray_calibrations (aferições de vazão — módulo MedBico)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spray_calibrations (
  id               text PRIMARY KEY,
  tenant_key       text NOT NULL DEFAULT public.current_tenant_key(),
  user_id          uuid NOT NULL DEFAULT auth.uid(),
  data_hora        text NOT NULL DEFAULT '',
  modelo_trator    text DEFAULT '',
  frota            text DEFAULT '',
  tipo_implemento  text DEFAULT '',
  numero_bicos     integer NOT NULL DEFAULT 0,
  local_coleta     text DEFAULT '',
  operador         text DEFAULT '',
  turno            text DEFAULT '',
  taxa_desejada    numeric NOT NULL DEFAULT 0,
  velocidade       numeric NOT NULL DEFAULT 0,
  espacamento      numeric NOT NULL DEFAULT 0,
  vazao_teorica    numeric NOT NULL DEFAULT 0,
  media_real       numeric NOT NULL DEFAULT 0,
  desvio_percent   numeric NOT NULL DEFAULT 0,
  status_geral     text NOT NULL DEFAULT 'calibrado'
                     CHECK (status_geral IN ('calibrado', 'ajustar', 'trocar')),
  coletas          jsonb NOT NULL DEFAULT '[]'::jsonb,
  modo             text CHECK (modo IS NULL OR modo IN ('terrestre', 'drone')),
  material         text CHECK (material IS NULL OR material IN ('liquido', 'solido')),
  metodo           text CHECK (metodo IS NULL OR metodo IN ('volumetrico', 'sensor', 'bancada', 'app')),
  faixa_util       numeric,
  tempo_coleta     numeric,
  massa_coletada   numeric,
  vazao_max_sistema numeric,
  comporta_atual   numeric,
  comporta_ideal   numeric,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- spray_mix_recipes (histórico de cálculo de calda)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spray_mix_recipes (
  id                   text PRIMARY KEY,
  tenant_key           text NOT NULL DEFAULT public.current_tenant_key(),
  user_id              uuid NOT NULL DEFAULT auth.uid(),
  data                 text NOT NULL DEFAULT '',
  talhao               text DEFAULT '',
  area_talhao          numeric NOT NULL DEFAULT 0,
  vazao_trabalho       numeric NOT NULL DEFAULT 0,
  capacidade_tanque    numeric NOT NULL DEFAULT 0,
  produtos             jsonb NOT NULL DEFAULT '[]'::jsonb,
  volume_total_calda   numeric NOT NULL DEFAULT 0,
  tanques_cheios       integer NOT NULL DEFAULT 0,
  volume_restante      numeric NOT NULL DEFAULT 0,
  tanques_necessarios  integer NOT NULL DEFAULT 0,
  frota                text DEFAULT '',
  trator               text DEFAULT '',
  modo                 text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- financial_receivables (contas a receber)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_receivables (
  id               text PRIMARY KEY,
  tenant_key       text NOT NULL DEFAULT public.current_tenant_key(),
  user_id          uuid NOT NULL DEFAULT auth.uid(),
  numero           text NOT NULL DEFAULT '',
  data_emissao     date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento  date,
  cliente_id       text,
  cliente_nome     text NOT NULL DEFAULT '',
  descricao        text NOT NULL DEFAULT '',
  os_id            text,
  valor            numeric NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'aberto'
                     CHECK (status IN ('aberto', 'pago', 'cancelado')),
  data_pagamento   date,
  forma_pagamento  text,
  observacao       text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- financial_payables (contas a pagar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_payables (
  id               text PRIMARY KEY,
  tenant_key       text NOT NULL DEFAULT public.current_tenant_key(),
  user_id          uuid NOT NULL DEFAULT auth.uid(),
  numero           text NOT NULL DEFAULT '',
  data_emissao     date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento  date,
  fornecedor_id    text,
  fornecedor_nome  text NOT NULL DEFAULT '',
  categoria        text NOT NULL DEFAULT 'Outros',
  descricao        text NOT NULL DEFAULT '',
  manutencao_id    text,
  drone_id         text,
  equipment_id     text,
  valor            numeric NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'aberto'
                     CHECK (status IN ('aberto', 'pago', 'cancelado')),
  data_pagamento   date,
  forma_pagamento  text,
  observacao       text,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- nozzle_measurements (medições do MedBico antes de virarem aferição)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nozzle_measurements (
  id          text PRIMARY KEY,
  tenant_key  text NOT NULL DEFAULT public.current_tenant_key(),
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- app_settings (preferências de cadastro que viviam em localStorage)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text NOT NULL,
  tenant_key  text NOT NULL DEFAULT public.current_tenant_key(),
  user_id     uuid NOT NULL DEFAULT auth.uid(),
  value       jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_key, key)
);

-- -----------------------------------------------------------------------------
-- Sequences para numeração sequencial de títulos (era um contador no navegador,
-- que reiniciava e colidia entre dispositivos)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.financial_receivables_numero_seq;
CREATE SEQUENCE IF NOT EXISTS public.financial_payables_numero_seq;

CREATE OR REPLACE FUNCTION public.next_receivable_numero()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT lpad(nextval('public.financial_receivables_numero_seq')::text, 4, '0')
$$;

CREATE OR REPLACE FUNCTION public.next_payable_numero()
RETURNS text
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT lpad(nextval('public.financial_payables_numero_seq')::text, 4, '0')
$$;

REVOKE ALL ON FUNCTION public.next_receivable_numero() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_payable_numero() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_receivable_numero() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_payable_numero() TO authenticated;

-- Sincroniza as sequences com o que já existir na base.
SELECT setval('public.financial_receivables_numero_seq',
              GREATEST(COALESCE((SELECT MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::bigint)
                                 FROM public.financial_receivables), 0), 1));
SELECT setval('public.financial_payables_numero_seq',
              GREATEST(COALESCE((SELECT MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::bigint)
                                 FROM public.financial_payables), 0), 1));


-- -----------------------------------------------------------------------------
-- Índices
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_clients_tenant            ON public.clients(tenant_key);
CREATE INDEX IF NOT EXISTS idx_operators_tenant           ON public.operators(tenant_key);
CREATE INDEX IF NOT EXISTS idx_service_areas_tenant       ON public.service_areas(tenant_key);
CREATE INDEX IF NOT EXISTS idx_application_types_tenant   ON public.application_types(tenant_key);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant           ON public.suppliers(tenant_key);
CREATE INDEX IF NOT EXISTS idx_component_catalog_tenant  ON public.component_catalog(tenant_key);
CREATE INDEX IF NOT EXISTS idx_os_tenant                  ON public.orders_of_service(tenant_key);
CREATE INDEX IF NOT EXISTS idx_os_cliente                 ON public.orders_of_service(cliente_id);
CREATE INDEX IF NOT EXISTS idx_os_status                  ON public.orders_of_service(status);
CREATE INDEX IF NOT EXISTS idx_calibrations_tenant       ON public.spray_calibrations(tenant_key);
CREATE INDEX IF NOT EXISTS idx_calibrations_data         ON public.spray_calibrations(data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_tenant            ON public.spray_mix_recipes(tenant_key);
CREATE INDEX IF NOT EXISTS idx_receivables_tenant         ON public.financial_receivables(tenant_key);
CREATE INDEX IF NOT EXISTS idx_receivables_os             ON public.financial_receivables(os_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status         ON public.financial_receivables(status);
CREATE INDEX IF NOT EXISTS idx_payables_tenant            ON public.financial_payables(tenant_key);
CREATE INDEX IF NOT EXISTS idx_payables_manutencao        ON public.financial_payables(manutencao_id);
CREATE INDEX IF NOT EXISTS idx_payables_status            ON public.financial_payables(status);
CREATE INDEX IF NOT EXISTS idx_measurements_tenant        ON public.nozzle_measurements(tenant_key);


-- -----------------------------------------------------------------------------
-- Row Level Security — isolamento por tenant em todas as tabelas novas
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'operators', 'service_areas', 'application_types', 'suppliers',
    'component_catalog', 'orders_of_service', 'spray_calibrations',
    'spray_mix_recipes', 'financial_receivables', 'financial_payables',
    'nozzle_measurements', 'app_settings'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Tenant can manage ' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (tenant_key = public.current_tenant_key()) WITH CHECK (tenant_key = public.current_tenant_key())',
      'Tenant can manage ' || t, t
    );
  END LOOP;
END
$$;


-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clients', 'operators', 'service_areas', 'application_types', 'suppliers',
    'component_catalog', 'orders_of_service', 'spray_calibrations',
    'spray_mix_recipes', 'financial_receivables', 'financial_payables',
    'nozzle_measurements'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'touch_' || t || '_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      'touch_' || t || '_updated_at', t
    );
  END LOOP;
END
$$;