import { supabase } from "@/integrations/supabase/client";
import { num, orNull, requireScope, storageError } from "@/lib/db";

export interface Equipment {
  id: string;
  equipment_model: string;
  tractor_model: string;
  fleet_number: string;
  total_nozzles: number;
  tank_capacity: number;
  nozzle_spacing?: number;
  working_speed?: number;
  application_rate?: number;
  /** Horímetro: horas de trabalho acumuladas do equipamento. */
  horas_acumuladas?: number;
  /** Data (yyyy-mm-dd) da última leitura do horímetro. */
  data_ultima_leitura?: string;
  createdAt: string;
}

interface EquipmentRow {
  id: string;
  equipment_model: string;
  tractor_model: string | null;
  fleet_number: string;
  total_nozzles: number;
  tank_capacity: number | string | null;
  nozzle_spacing: number | string | null;
  working_speed: number | string | null;
  application_rate: number | string | null;
  horas_acumuladas: number | string | null;
  data_ultima_leitura: string | null;
  created_at: string;
}

const fromRow = (row: EquipmentRow): Equipment => ({
  id: row.id,
  equipment_model: row.equipment_model,
  tractor_model: row.tractor_model ?? "",
  fleet_number: row.fleet_number,
  total_nozzles: row.total_nozzles,
  tank_capacity: num(row.tank_capacity),
  nozzle_spacing: row.nozzle_spacing == null ? undefined : num(row.nozzle_spacing),
  working_speed: row.working_speed == null ? undefined : num(row.working_speed),
  application_rate: row.application_rate == null ? undefined : num(row.application_rate),
  horas_acumuladas: num(row.horas_acumuladas),
  data_ultima_leitura: row.data_ultima_leitura ?? undefined,
  createdAt: row.created_at,
});

export const saveEquipment = async (equipment: Equipment): Promise<void> => {
  const { userId, branchId } = await requireScope();
  const { error } = await supabase.from("equipment").upsert(
    {
      id: equipment.id,
      user_id: userId,
      branch_id: branchId,
      equipment_model: equipment.equipment_model,
      tractor_model: equipment.tractor_model,
      fleet_number: equipment.fleet_number,
      total_nozzles: equipment.total_nozzles,
      tank_capacity: equipment.tank_capacity,
      nozzle_spacing: equipment.nozzle_spacing ?? null,
      working_speed: equipment.working_speed ?? null,
      application_rate: equipment.application_rate ?? null,
      horas_acumuladas: equipment.horas_acumuladas ?? 0,
      data_ultima_leitura: orNull(equipment.data_ultima_leitura),
      created_at: equipment.createdAt,
    },
    { onConflict: "id" }
  );
  if (error) throw storageError("Falha ao salvar o equipamento", error);
};

export const getAllEquipments = async (): Promise<Equipment[]> => {
  const { data, error } = await supabase.from("equipment").select("*").order("fleet_number");
  if (error) throw storageError("Falha ao carregar os equipamentos", error);
  return (data as EquipmentRow[]).map(fromRow);
};

export const getEquipmentById = async (id: string): Promise<Equipment | undefined> => {
  const { data, error } = await supabase.from("equipment").select("*").eq("id", id).maybeSingle();
  if (error) throw storageError("Falha ao carregar o equipamento", error);
  return data ? fromRow(data as EquipmentRow) : undefined;
};

export const deleteEquipment = async (id: string): Promise<void> => {
  const { error } = await supabase.from("equipment").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o equipamento", error);
};