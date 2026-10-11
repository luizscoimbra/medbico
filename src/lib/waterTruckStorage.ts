import { supabase } from "@/integrations/supabase/client";
import { num, requireScope, storageError } from "@/lib/db";

/**
 * Caminhões pipa de apoio.
 *
 * Antes viviam em `app_settings` (JSONB sem chave estrangeira, sem índice e
 * sem filial). A migration `20261009120400_water_trucks_table.sql` criou a
 * tabela `water_trucks` e copiou o JSON legado; a partir daqui o cadastro
 * grava direto nela, com branch_id como todo o resto do operacional.
 */

export interface WaterTruck {
  id: string;
  fleet_number: string;
  model: string;
  capacity: number;
}

interface WaterTruckRow {
  id: string;
  fleet_number: string;
  model: string;
  capacity: number;
  created_at: string;
}

const fromRow = (row: WaterTruckRow): WaterTruck => ({
  id: row.id,
  fleet_number: row.fleet_number,
  model: row.model,
  capacity: num(row.capacity),
});

export const saveWaterTruck = async (truck: WaterTruck): Promise<void> => {
  const { branchId } = await requireScope();
  const { error } = await supabase
    .from("water_trucks")
    .upsert(
      {
        id: truck.id,
        branch_id: branchId,
        fleet_number: truck.fleet_number,
        model: truck.model,
        capacity: truck.capacity,
      },
      { onConflict: "id" }
    );
  if (error) throw storageError("Falha ao salvar o caminhão pipa", error);
};

export const getAllWaterTrucks = async (): Promise<WaterTruck[]> => {
  const { data, error } = await supabase
    .from("water_trucks")
    .select("*")
    .order("fleet_number", { ascending: true });
  if (error) throw storageError("Falha ao carregar os caminhões pipa", error);
  return (data as WaterTruckRow[]).map(fromRow);
};

export const deleteWaterTruck = async (id: string): Promise<void> => {
  const { error } = await supabase.from("water_trucks").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir o caminhão pipa", error);
};
