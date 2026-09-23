import { supabase } from "@/integrations/supabase/client";

// ============================================
// TYPES
// ============================================

export interface Drone {
  id: string;
  user_id: string;
  modelo: string;
  marca: string;
  numero_serie: string;
  registro_anac: string;
  registro_anatel: string;
  mtow: number;
  apolice_seguro: string;
  data_vencimento_seguro: string | null;
  horas_voo_total: number;
  status: "ativo" | "manutencao" | "inativo";
  imagem_url: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

export interface DroneComponent {
  id: string;
  drone_id: string;
  tipo: "bateria" | "tanque" | "bico" | "sensor" | "carregador" | "camera" | "helice" | "outro";
  modelo: string;
  numero_serie: string;
  especificacoes: Record<string, any>;
  ciclo_maximo: number;
  horas_voo_total: number;
  status: "ativo" | "desgastado" | "danificado" | "substituido";
  created_at: string;
  updated_at: string;
}

export interface FlightLog {
  id: string;
  drone_id: string;
  user_id: string;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  area_nome: string;
  talhao: string;
  cliente_nome: string;
  cultura: string;
  piloto: string;
  operador_apoio: string;
  tempo_voo_min: number;
  hectares_pulverizados: number;
  volume_aplicado_l: number;
  produtos_aplicados: Array<{ nome: string; dose: number; unidade: string }>;
  ciclos_bateria: number;
  combustivel_gerador_l: number;
  condicoes_climaticas: string;
  vento_kmh: number;
  temperatura_c: number;
  observacoes: string;
  os_id: string;
  created_at: string;
  updated_at: string;
}

export interface BatteryCycle {
  id: string;
  component_id: string;
  flight_log_id: string | null;
  ciclo_numero: number;
  voltagem_inicio: number;
  voltagem_fim: number;
  soh: number;
  temperatura_operacao: number;
  data_carga: string | null;
  tempo_carga_min: number;
  avarias: string[];
  created_at: string;
}

export interface MaintenanceSchedule {
  id: string;
  drone_modelo: string;
  tipo_manutencao: "diaria" | "50h" | "100h" | "200h" | "corretiva";
  titulo: string;
  descricao: string;
  intervalo_horas: number;
  intervalo_dias: number;
  checklist: string[];
  ativo: boolean;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  drone_id: string;
  schedule_id: string | null;
  data: string;
  horas_voo_registradas: number;
  tipo: "preventiva" | "corretiva";
  titulo: string;
  descricao: string;
  componentes_trocados: Array<{ nome: string; modelo: string; custo?: number }>;
  custo: number;
  responsavel: string;
  fotos_url: string[];
  created_at: string;
  updated_at: string;
}

export interface DocumentAlert {
  id: string;
  drone_id: string;
  tipo: "seguro" | "rancho" | "licenca_piloto" | "inspecao" | "outro";
  titulo: string;
  data_vencimento: string;
  alertar_dias_antes: number;
  notificado: boolean;
  created_at: string;
}

export interface Pilot {
  id: string;
  user_id: string;
  nome: string;
  licenca_anac: string;
  data_vencimento_licenca: string | null;
  telefone: string;
  email: string;
  horas_voo_total: number;
  status: "ativo" | "inativo";
  created_at: string;
  updated_at: string;
}

// ============================================
// DRONES CRUD
// ============================================

export async function getAllDrones(): Promise<Drone[]> {
  const { data, error } = await supabase
    .from("drones")
    .select("*")
    .order("modelo");
  if (error) throw error;
  return (data || []) as Drone[];
}

export async function getDrone(id: string): Promise<Drone | null> {
  const { data, error } = await supabase
    .from("drones")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Drone;
}

export async function createDrone(drone: Omit<Drone, "id" | "created_at" | "updated_at" | "horas_voo_total">): Promise<Drone> {
  const { data, error } = await supabase
    .from("drones")
    .insert(drone)
    .select()
    .single();
  if (error) throw error;
  return data as Drone;
}

export async function updateDrone(id: string, updates: Partial<Drone>): Promise<void> {
  const { error } = await supabase
    .from("drones")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDrone(id: string): Promise<void> {
  const { error } = await supabase
    .from("drones")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// DRONE COMPONENTS CRUD
// ============================================

export async function getDroneComponents(droneId: string): Promise<DroneComponent[]> {
  const { data, error } = await supabase
    .from("drone_components")
    .select("*")
    .eq("drone_id", droneId)
    .order("tipo");
  if (error) throw error;
  return (data || []) as DroneComponent[];
}

export async function getAllDroneComponents(): Promise<DroneComponent[]> {
  const { data, error } = await supabase
    .from("drone_components")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as DroneComponent[];
}

export async function createDroneComponent(comp: Omit<DroneComponent, "id" | "created_at" | "updated_at" | "horas_voo_total">): Promise<DroneComponent> {
  const { data, error } = await supabase
    .from("drone_components")
    .insert(comp)
    .select()
    .single();
  if (error) throw error;
  return data as DroneComponent;
}

export async function updateDroneComponent(id: string, updates: Partial<DroneComponent>): Promise<void> {
  const { error } = await supabase
    .from("drone_components")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDroneComponent(id: string): Promise<void> {
  const { error } = await supabase
    .from("drone_components")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// FLIGHT LOGS CRUD
// ============================================

export async function getAllFlightLogs(): Promise<FlightLog[]> {
  const { data, error } = await supabase
    .from("flight_logs")
    .select("*")
    .order("data", { ascending: false });
  if (error) throw error;
  return (data || []) as FlightLog[];
}

export async function getFlightLogsByDrone(droneId: string): Promise<FlightLog[]> {
  const { data, error } = await supabase
    .from("flight_logs")
    .select("*")
    .eq("drone_id", droneId)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data || []) as FlightLog[];
}

export async function getFlightLogsByDateRange(start: string, end: string): Promise<FlightLog[]> {
  const { data, error } = await supabase
    .from("flight_logs")
    .select("*")
    .gte("data", start)
    .lte("data", end)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data || []) as FlightLog[];
}

export async function createFlightLog(log: Omit<FlightLog, "id" | "created_at" | "updated_at">): Promise<FlightLog> {
  const { data, error } = await supabase
    .from("flight_logs")
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  return data as FlightLog;
}

export async function updateFlightLog(id: string, updates: Partial<FlightLog>): Promise<void> {
  const { error } = await supabase
    .from("flight_logs")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFlightLog(id: string): Promise<void> {
  const { error } = await supabase
    .from("flight_logs")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// BATTERY CYCLES CRUD
// ============================================

export async function getBatteryCycles(componentId: string): Promise<BatteryCycle[]> {
  const { data, error } = await supabase
    .from("battery_cycles")
    .select("*")
    .eq("component_id", componentId)
    .order("ciclo_numero", { ascending: false });
  if (error) throw error;
  return (data || []) as BatteryCycle[];
}

export async function createBatteryCycle(cycle: Omit<BatteryCycle, "id" | "created_at">): Promise<BatteryCycle> {
  const { data, error } = await supabase
    .from("battery_cycles")
    .insert(cycle)
    .select()
    .single();
  if (error) throw error;
  return data as BatteryCycle;
}

export async function updateBatteryCycle(id: string, updates: Partial<BatteryCycle>): Promise<void> {
  const { error } = await supabase
    .from("battery_cycles")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBatteryCycle(id: string): Promise<void> {
  const { error } = await supabase
    .from("battery_cycles")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// MAINTENANCE SCHEDULES
// ============================================

export async function getMaintenanceSchedules(droneModelo?: string): Promise<MaintenanceSchedule[]> {
  let query = supabase.from("maintenance_schedules").select("*").eq("ativo", true);
  if (droneModelo) query = query.eq("drone_modelo", droneModelo);
  const { data, error } = await query.order("intervalo_horas");
  if (error) throw error;
  return (data || []) as MaintenanceSchedule[];
}

export async function createMaintenanceSchedule(sched: Omit<MaintenanceSchedule, "id" | "created_at">): Promise<MaintenanceSchedule> {
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .insert(sched)
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceSchedule;
}

export async function updateMaintenanceSchedule(id: string, updates: Partial<MaintenanceSchedule>): Promise<void> {
  const { error } = await supabase
    .from("maintenance_schedules")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMaintenanceSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from("maintenance_schedules")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// MAINTENANCE RECORDS
// ============================================

export async function getMaintenanceRecords(droneId?: string): Promise<MaintenanceRecord[]> {
  let query = supabase.from("maintenance_records").select("*");
  if (droneId) query = query.eq("drone_id", droneId);
  const { data, error } = await query.order("data", { ascending: false });
  if (error) throw error;
  return (data || []) as MaintenanceRecord[];
}

export async function createMaintenanceRecord(rec: Omit<MaintenanceRecord, "id" | "created_at" | "updated_at">): Promise<MaintenanceRecord> {
  const { data, error } = await supabase
    .from("maintenance_records")
    .insert(rec)
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceRecord;
}

export async function updateMaintenanceRecord(id: string, updates: Partial<MaintenanceRecord>): Promise<void> {
  const { error } = await supabase
    .from("maintenance_records")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMaintenanceRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from("maintenance_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// DOCUMENT ALERTS
// ============================================

export async function getDocumentAlerts(droneId?: string): Promise<DocumentAlert[]> {
  let query = supabase.from("document_alerts").select("*");
  if (droneId) query = query.eq("drone_id", droneId);
  const { data, error } = await query.order("data_vencimento");
  if (error) throw error;
  return (data || []) as DocumentAlert[];
}

export async function createDocumentAlert(alert: Omit<DocumentAlert, "id" | "created_at">): Promise<DocumentAlert> {
  const { data, error } = await supabase
    .from("document_alerts")
    .insert(alert)
    .select()
    .single();
  if (error) throw error;
  return data as DocumentAlert;
}

export async function updateDocumentAlert(id: string, updates: Partial<DocumentAlert>): Promise<void> {
  const { error } = await supabase
    .from("document_alerts")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDocumentAlert(id: string): Promise<void> {
  const { error } = await supabase
    .from("document_alerts")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function getExpiringDocuments(diasAntes: number = 30): Promise<DocumentAlert[]> {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() + diasAntes);
  const { data, error } = await supabase
    .from("document_alerts")
    .select("*")
    .lte("data_vencimento", dataLimite.toISOString().split("T")[0])
    .eq("notificado", false)
    .order("data_vencimento");
  if (error) throw error;
  return (data || []) as DocumentAlert[];
}

// ============================================
// PILOTS CRUD
// ============================================

export async function getAllPilots(): Promise<Pilot[]> {
  const { data, error } = await supabase
    .from("pilots")
    .select("*")
    .order("nome");
  if (error) throw error;
  return (data || []) as Pilot[];
}

export async function createPilot(pilot: Omit<Pilot, "id" | "created_at" | "updated_at" | "horas_voo_total">): Promise<Pilot> {
  const { data, error } = await supabase
    .from("pilots")
    .insert(pilot)
    .select()
    .single();
  if (error) throw error;
  return data as Pilot;
}

export async function updatePilot(id: string, updates: Partial<Pilot>): Promise<void> {
  const { error } = await supabase
    .from("pilots")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePilot(id: string): Promise<void> {
  const { error } = await supabase
    .from("pilots")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// DASHBOARD / KPIs
// ============================================

export async function getDroneKPIs(droneId: string) {
  const [logs, components, records] = await Promise.all([
    getFlightLogsByDrone(droneId),
    getDroneComponents(droneId),
    getMaintenanceRecords(droneId),
  ]);

  const totalHorasVoo = logs.reduce((acc, l) => acc + (l.tempo_voo_min || 0), 0) / 60;
  const totalHectares = logs.reduce((acc, l) => acc + (l.hectares_pulverizados || 0), 0);
  const totalLitros = logs.reduce((acc, l) => acc + (l.volume_aplicado_l || 0), 0);
  const totalVoos = logs.length;
  const eficienciaHaH = totalHorasVoo > 0 ? totalHectares / totalHorasVoo : 0;

  const baterias = components.filter(c => c.tipo === "bateria");
  const totalCiclosBaterias = baterias.reduce((acc, b) => acc + (b.ciclo_maximo || 0), 0);

  const manutencaoPendente = records.filter(r => {
    const diasDesde = (Date.now() - new Date(r.data).getTime()) / (1000 * 60 * 60 * 24);
    return diasDesde > 30;
  }).length;

  return {
    totalHorasVoo: Math.round(totalHorasVoo * 10) / 10,
    totalHectares: Math.round(totalHectares * 100) / 100,
    totalLitros: Math.round(totalLitros),
    totalVoos,
    eficienciaHaH: Math.round(eficienciaHaH * 10) / 10,
    totalBaterias: baterias.length,
    totalCiclosBaterias,
    manutencaoPendente,
  };
}

export async function getFleetSummary() {
  const [drones, logs, components] = await Promise.all([
    getAllDrones(),
    getAllFlightLogs(),
    getAllDroneComponents(),
  ]);

  const dronesAtivos = drones.filter(d => d.status === "ativo").length;
  const dronesManutencao = drones.filter(d => d.status === "manutencao").length;
  const totalHorasVoo = drones.reduce((acc, d) => acc + (d.horas_voo_total || 0), 0);

  const voosHoje = logs.filter(l => l.data === new Date().toISOString().split("T")[0]).length;
  const voosMes = logs.filter(l => {
    const d = new Date(l.data);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const baterias = components.filter(c => c.tipo === "bateria");
  const bateriasAlerta = baterias.filter(b => b.ciclo_maximo > 280).length;

  return {
    totalDrones: drones.length,
    dronesAtivos,
    dronesManutencao,
    totalHorasVoo: Math.round(totalHorasVoo),
    voosHoje,
    voosMes,
    totalBaterias: baterias.length,
    bateriasAlerta,
  };
}
