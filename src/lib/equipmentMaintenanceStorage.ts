import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { Equipment } from "./equipmentStorage";

// ============================================
// TYPES
// ============================================

export type TipoItemManutencao = "servico" | "peca" | "produto";

export interface ItemManutencao {
  id: string;
  tipo: TipoItemManutencao;
  nome: string;
  categoria: string;
  unidade: string;
  custo: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramaManutencao {
  id: string;
  equipment_id: string;
  fleet_number: string;
  equipamento_modelo: string;
  categoria: string;
  titulo: string;
  descricao: string;
  intervalo_horas: number;
  intervalo_dias: number;
  checklist: string[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type ItemRegistro = {
  itemId?: string;
  tipo: TipoItemManutencao;
  nome: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
  subtotal: number;
};

export interface RegistroManutencao {
  id: string;
  equipment_id: string;
  fleet_number: string;
  schedule_id: string | null;
  data: string;
  horas_registradas: number;
  categoria: string;
  titulo: string;
  descricao: string;
  itens: ItemRegistro[];
  custo_mao_obra: number;
  custo_total: number;
  fornecedor_id: string;
  fornecedor_nome: string;
  responsavel: string;
  observacao: string;
  titulo_pagar_id: string;
  created_at: string;
  updated_at: string;
}

export const CATEGORIAS_MANUTENCAO = [
  "Borracharia",
  "Mecânica",
  "Preventiva",
  "Troca de óleo e fluidos",
  "Filtros e lubrificação",
  "Peças",
  "Corretiva",
  "Outros",
] as const;

export const TIPOS_ITEM_LABEL: Record<TipoItemManutencao, string> = {
  servico: "Serviço",
  peca: "Peça",
  produto: "Produto",
};

// ============================================
// CADASTROS (serviços, peças e produtos)
// ============================================

export async function getAllItens(tipo?: TipoItemManutencao): Promise<ItemManutencao[]> {
  let query = supabase.from("equipment_maintenance_items").select("*").eq("ativo", true);
  if (tipo) query = query.eq("tipo", tipo);
  const { data, error } = await query.order("nome");
  if (error) throw error;
  return (data || []) as ItemManutencao[];
}

export async function createItem(
  item: Omit<ItemManutencao, "id" | "created_at" | "updated_at">
): Promise<ItemManutencao> {
  const { data, error } = await supabase
    .from("equipment_maintenance_items")
    .insert(item)
    .select()
    .single();
  if (error) throw error;
  return data as ItemManutencao;
}

export async function updateItem(id: string, updates: Partial<ItemManutencao>): Promise<void> {
  const { error } = await supabase
    .from("equipment_maintenance_items")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("equipment_maintenance_items").delete().eq("id", id);
  if (error) throw error;
}

// ============================================
// PROGRAMAS DE MANUTENÇÃO
// ============================================

export async function getAllProgramas(equipmentId?: string): Promise<ProgramaManutencao[]> {
  let query = supabase.from("equipment_maintenance_schedules").select("*").eq("ativo", true);
  if (equipmentId) query = query.eq("equipment_id", equipmentId);
  const { data, error } = await query.order("intervalo_horas", { ascending: false });
  if (error) throw error;
  return (data || []) as ProgramaManutencao[];
}

export async function createPrograma(
  prog: Omit<ProgramaManutencao, "id" | "created_at" | "updated_at">
): Promise<ProgramaManutencao> {
  const { data, error } = await supabase
    .from("equipment_maintenance_schedules")
    .insert(prog)
    .select()
    .single();
  if (error) throw error;
  return data as ProgramaManutencao;
}

export async function updatePrograma(
  id: string,
  updates: Partial<ProgramaManutencao>
): Promise<void> {
  const { error } = await supabase
    .from("equipment_maintenance_schedules")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function deletePrograma(id: string): Promise<void> {
  const { error } = await supabase
    .from("equipment_maintenance_schedules")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// REGISTROS (histórico)
// ============================================

export async function getAllRegistros(equipmentId?: string): Promise<RegistroManutencao[]> {
  let query = supabase.from("equipment_maintenance_records").select("*");
  if (equipmentId) query = query.eq("equipment_id", equipmentId);
  const { data, error } = await query.order("data", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    ...r,
    itens: (r.itens || []) as unknown as ItemRegistro[],
  })) as RegistroManutencao[];
}

export async function createRegistro(
  rec: Omit<RegistroManutencao, "id" | "created_at" | "updated_at">
): Promise<RegistroManutencao> {
  const { data, error } = await supabase
    .from("equipment_maintenance_records")
    .insert({ ...rec, itens: rec.itens as unknown as Json })
    .select()
    .single();
  if (error) throw error;
  return { ...data, itens: (data.itens || []) as unknown as ItemRegistro[] } as RegistroManutencao;
}

export async function updateRegistro(
  id: string,
  updates: Partial<RegistroManutencao>
): Promise<void> {
  const { itens, ...rest } = updates;
  const payload: Database["public"]["Tables"]["equipment_maintenance_records"]["Update"] = {
    ...rest,
  };
  if (itens) payload.itens = itens as unknown as Json;
  const { error } = await supabase
    .from("equipment_maintenance_records")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRegistro(id: string): Promise<void> {
  const { error } = await supabase
    .from("equipment_maintenance_records")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// AGENDA (cálculo puro)
// ============================================

export type Urgencia = "critico" | "alta" | "media" | "ok" | "sem_base";

export interface ItemAgenda {
  programa: ProgramaManutencao;
  horasAtuais: number;
  horasRestantes: number | null;
  diasRestantes: number | null;
  base: "horas" | "dias" | "sem_base";
  urgencia: Urgencia;
  ultimaManutencao?: RegistroManutencao;
  horasDecorridas: number;
  diasDecorridos: number;
  proximaHoras?: number;
  proximaData?: string;
}

const ORDEM_URGENCIA: Record<Urgencia, number> = {
  critico: 0,
  alta: 1,
  media: 2,
  ok: 3,
  sem_base: 4,
};

function urgenciaDe(restante: number | null): Urgencia {
  if (restante === null) return "sem_base";
  if (restante <= 0) return "critico";
  if (restante <= 10) return "alta";
  if (restante <= 25) return "media";
  return "ok";
}

function diasEntre(inicio: string, fim: string): number {
  const a = new Date(`${inicio.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${fim.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

/** Horas de trabalho por equipamento (id -> horas). */
export function mapaHorasEquipamentos(equipments: Equipment[]): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const eq of equipments) mapa[eq.id] = eq.horas_acumuladas || 0;
  return mapa;
}

/**
 * Calcula a agenda dos programas de manutenção.
 * Base em horas de trabalho quando o programa tem intervalo_horas;
 * caso contrário usa o intervalo em dias desde a última manutenção
 * (ou desde a criação do programa quando nunca foi feita).
 */
export function calcularAgenda(params: {
  programas: ProgramaManutencao[];
  registros: RegistroManutencao[];
  horasPorEquipamento: Record<string, number>;
  hoje?: string;
}): ItemAgenda[] {
  const hoje = params.hoje || new Date().toISOString().slice(0, 10);

  const itens: ItemAgenda[] = params.programas.map((programa) => {
    const horasAtuais = params.horasPorEquipamento[programa.equipment_id] || 0;

    const registrosDoPrograma = params.registros
      .filter((r) => r.schedule_id === programa.id)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const ultimo = registrosDoPrograma[0];

    const horasUltimo = ultimo?.horas_registradas ?? 0;
    const horasDecorridas = Math.max(0, horasAtuais - horasUltimo);
    const diasDecorridos = Math.max(
      0,
      diasEntre(ultimo?.data || programa.created_at, hoje)
    );

    const usaHoras = programa.intervalo_horas > 0;
    const usaDias = !usaHoras && programa.intervalo_dias > 0;

    const horasRestantes = usaHoras
      ? Math.round((programa.intervalo_horas - horasDecorridas) * 10) / 10
      : null;
    const diasRestantes = usaDias ? programa.intervalo_dias - diasDecorridos : null;

    const base: ItemAgenda["base"] = usaHoras ? "horas" : usaDias ? "dias" : "sem_base";
    const restanteRef = base === "horas" ? horasRestantes : base === "dias" ? diasRestantes : null;

    let proximaData: string | undefined;
    if (base === "dias" && programa.intervalo_dias > 0) {
      const baseData = ultimo?.data || programa.created_at;
      const d = new Date(`${baseData.slice(0, 10)}T00:00:00`);
      d.setDate(d.getDate() + programa.intervalo_dias);
      proximaData = d.toISOString().slice(0, 10);
    }

    return {
      programa,
      horasAtuais,
      horasRestantes,
      diasRestantes,
      base,
      urgencia: urgenciaDe(restanteRef),
      ultimaManutencao: ultimo,
      horasDecorridas,
      diasDecorridos,
      proximaHoras: usaHoras ? horasUltimo + programa.intervalo_horas : undefined,
      proximaData,
    };
  });

  return itens.sort((a, b) => {
    const porUrgencia = ORDEM_URGENCIA[a.urgencia] - ORDEM_URGENCIA[b.urgencia];
    if (porUrgencia !== 0) return porUrgencia;
    const ra = a.horasRestantes ?? a.diasRestantes ?? Number.MAX_SAFE_INTEGER;
    const rb = b.horasRestantes ?? b.diasRestantes ?? Number.MAX_SAFE_INTEGER;
    return ra - rb;
  });
}
