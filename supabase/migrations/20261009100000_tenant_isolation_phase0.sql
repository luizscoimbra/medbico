-- =============================================================================
-- FASE 0 — isolamento de tenant nas tabelas que não tinham NENHUMA proteção
-- =============================================================================
-- Diagnóstico: 14 tabelas de negócio não filtravam por empresa.
--
--   * 8 tabelas do módulo de drones usavam a policy
--     `USING (auth.role() = 'authenticated')` — sem qualquer coluna de tenant.
--     Qualquer usuário logado lia e apagava a frota de drones de todos.
--   * 3 tabelas de manutenção de equipamentos, idem.
--   * products, registered_products e services usavam `auth.uid() = user_id`,
--     o que impede dois usuários da mesma empresa de ver o mesmo cadastro —
--     invertido do que um SaaS precisa.
--
-- Aqui todas passam a usar exatamente o mesmo mecanismo já em produção nas
-- demais tabelas: coluna `tenant_key` + policy
--
--   USING (tenant_key = public.current_tenant_key())
--
-- Nenhuma tabela perde dado: as linhas existentes recebem o tenant do dono
-- original (deduzido por user_id ou pela linha-pai), e só as linhas órfãs de
-- catálogo — que antes eram visíveis para qualquer pessoa autenticada — recebem
-- o tenant do administrador mais antigo, com NOTICE Reporting o total.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tenant padrão para linhas de catálogo sem dono identificável.
-- Catálogos (programas de manutenção por modelo de drone, itens de peça/serviço)
-- não pertencem a um usuário nem a um equipamento. Como até aqui eram globais,
-- adotámos o tenant do master mais antigo, que é o dono natural do catálogo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.legacy_tenant_default()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
      FROM public.profiles p
      WHERE p.role = 'master'
      ORDER BY p.created_at ASC
      LIMIT 1
    ),
    'legacy'
  )
$$;

-- -----------------------------------------------------------------------------
-- 1) Colunas
-- -----------------------------------------------------------------------------
ALTER TABLE public.products                       ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.registered_products           ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.services                      ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.drones                        ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.drone_components              ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.flight_logs                   ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.battery_cycles                ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.maintenance_schedules         ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.maintenance_records           ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.document_alerts               ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.pilots                        ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.equipment_maintenance_items     ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.equipment_maintenance_schedules ADD COLUMN IF NOT EXISTS tenant_key text;
ALTER TABLE public.equipment_maintenance_records   ADD COLUMN IF NOT EXISTS tenant_key text;


-- -----------------------------------------------------------------------------
-- 2) Backfill — dono original de cada linha
-- -----------------------------------------------------------------------------

-- a) Tabelas com user_id: o tenant é o do dono da linha.
UPDATE public.products o
   SET tenant_key = COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
  FROM public.profiles p WHERE p.id = o.user_id AND o.tenant_key IS NULL;

UPDATE public.registered_products o
   SET tenant_key = COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
  FROM public.profiles p WHERE p.id = o.user_id AND o.tenant_key IS NULL;

UPDATE public.services o
   SET tenant_key = COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
  FROM public.profiles p WHERE p.id = o.user_id AND o.tenant_key IS NULL;

UPDATE public.drones o
   SET tenant_key = COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
  FROM public.profiles p WHERE p.id = o.user_id AND o.tenant_key IS NULL;

UPDATE public.flight_logs o
   SET tenant_key = COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
  FROM public.profiles p WHERE p.id = o.user_id AND o.tenant_key IS NULL;

UPDATE public.pilots o
   SET tenant_key = COALESCE(NULLIF(btrim(p.company), ''), p.id::text)
  FROM public.profiles p WHERE p.id = o.user_id AND o.tenant_key IS NULL;

-- b) Subárvore de drones: herdam o tenant do drone-pai.
UPDATE public.drone_components c
   SET tenant_key = d.tenant_key
  FROM public.drones d WHERE d.id = c.drone_id AND c.tenant_key IS NULL;

UPDATE public.maintenance_records r
   SET tenant_key = d.tenant_key
  FROM public.drones d WHERE d.id = r.drone_id AND r.tenant_key IS NULL;

UPDATE public.document_alerts a
   SET tenant_key = d.tenant_key
  FROM public.drones d WHERE d.id = a.drone_id AND a.tenant_key IS NULL;

-- battery_cycles chega por dois caminhos: componente (bateria) ou log de voo.
UPDATE public.battery_cycles b
   SET tenant_key = COALESCE(
         (SELECT d.tenant_key
            FROM public.drone_components c
            JOIN public.drones d ON d.id = c.drone_id
           WHERE c.id = b.component_id),
         (SELECT d.tenant_key
            FROM public.flight_logs f
            JOIN public.drones d ON d.id = f.drone_id
           WHERE f.id = b.flight_log_id)
       )
 WHERE b.tenant_key IS NULL;

-- c) Manutenção terrestre: equipment_id é texto e referencia equipment.id.
UPDATE public.equipment_maintenance_schedules s
   SET tenant_key = e.tenant_key
  FROM public.equipment e WHERE e.id = s.equipment_id AND s.tenant_key IS NULL;

UPDATE public.equipment_maintenance_records r
   SET tenant_key = e.tenant_key
  FROM public.equipment e WHERE e.id = r.equipment_id AND r.tenant_key IS NULL;

-- d) Catálogos órfãos (não têm usuário nem equipamento).
UPDATE public.maintenance_schedules s
   SET tenant_key = public.legacy_tenant_default()
 WHERE s.tenant_key IS NULL;

UPDATE public.equipment_maintenance_items i
   SET tenant_key = public.legacy_tenant_default()
 WHERE i.tenant_key IS NULL;


-- -----------------------------------------------------------------------------
-- 3) Linhas que sobraram sem tenant resolvido
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  faltando bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM public.products                        WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.registered_products            WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.services                       WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.drones                         WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.drone_components               WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.flight_logs                    WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.battery_cycles                 WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.maintenance_schedules          WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.maintenance_records            WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.document_alerts                WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.pilots                         WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.equipment_maintenance_items     WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.equipment_maintenance_schedules WHERE tenant_key IS NULL) +
    (SELECT count(*) FROM public.equipment_maintenance_records   WHERE tenant_key IS NULL)
  INTO faltando;

  IF faltando > 0 THEN
    RAISE WARNING 'Fase 0: % linha(s) sem tenant resolvido. Revisar e reatribuir.', faltando;
  ELSE
    RAISE NOTICE 'Fase 0: todas as linhas herdaram o tenant do dono original.';
  END IF;
END
$$;


-- -----------------------------------------------------------------------------
-- 4) Defaults + índices
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'registered_products', 'services',
    'drones', 'drone_components', 'flight_logs', 'battery_cycles',
    'maintenance_schedules', 'maintenance_records', 'document_alerts', 'pilots',
    'equipment_maintenance_items', 'equipment_maintenance_schedules',
    'equipment_maintenance_records'
  ]
  LOOP
    EXECUTE format('UPDATE public.%I SET tenant_key = ''legacy'' WHERE tenant_key IS NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_key SET DEFAULT public.current_tenant_key()', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_key SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_key)', 'idx_' || t || '_tenant_key', t);
  END LOOP;
END
$$;


-- -----------------------------------------------------------------------------
-- 5) Policies — mesmo padrão das demais tabelas
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  t       text;
  antiga  text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products', 'registered_products', 'services',
    'drones', 'drone_components', 'flight_logs', 'battery_cycles',
    'maintenance_schedules', 'maintenance_records', 'document_alerts', 'pilots',
    'equipment_maintenance_items', 'equipment_maintenance_schedules',
    'equipment_maintenance_records'
  ]
  LOOP
    -- Remove as policies antigas (per-user ou "qualquer autenticado").
    FOR antiga IN
      SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', antiga, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (tenant_key = public.current_tenant_key()) WITH CHECK (tenant_key = public.current_tenant_key())',
      'Tenant can manage ' || t, t
    );
  END LOOP;
END
$$;

COMMENT ON FUNCTION public.legacy_tenant_default() IS
  'Tenant usado para linhas de catálogo sem dono identificável (programas de manutenção, itens de peça/serviço).';