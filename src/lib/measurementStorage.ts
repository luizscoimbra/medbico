import { supabase } from "@/integrations/supabase/client";
import { requireScope, storageError, toJson } from "@/lib/db";
import type { Json } from "@/integrations/supabase/types";
import type { MeasurementData } from "./nozzleData";

/**
 * Mediҧҵes de bicos (mҳdulo MedBico).
 *
 * Viviam em `localStorage` sob a chave "measurements", o que as prendia a um
 * Һnico navegador. Agora ficam em `nozzle_measurements`, no PostgreSQL.
 *
 * `measurementDate` ҩ serializado como string ISO e reidratado como `Date` na
 * leitura, para manter inalterada a forma usada pelas telas.
 */

interface MeasurementRow {
  id: string;
  payload: Json;
  created_at: string;
}

function revive(payload: Json): MeasurementData {
  const bruto = payload as unknown as Omit<MeasurementData, "measurementDate" | "id"> & {
    measurementDate: string;
  };
  return {
    ...bruto,
    id: undefined,
    measurementDate: new Date(bruto.measurementDate),
  };
}

function serialize(measurement: MeasurementData): Json {
  const { measurementDate, id: _id, ...rest } = measurement;
  return toJson({ ...rest, measurementDate: new Date(measurementDate).toISOString() });
}

export async function getAllMeasurements(): Promise<MeasurementData[]> {
  const { data, error } = await supabase
    .from("nozzle_measurements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw storageError("Falha ao carregar o histҳrico de mediҧҵes", error);
  return (data as MeasurementRow[]).map((row) => ({ ...revive(row.payload), id: row.id }));
}

export async function saveMeasurement(measurement: MeasurementData): Promise<MeasurementData> {
  const { userId, branchId } = await requireScope();
  const id = measurement.id ?? crypto.randomUUID();

  const { error } = await supabase.from("nozzle_measurements").upsert(
    { id, user_id: userId, branch_id: branchId, payload: serialize(measurement) },
    { onConflict: "id" }
  );

  if (error) throw storageError("Falha ao salvar a mediҧңo", error);
  return { ...measurement, id };
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { error } = await supabase.from("nozzle_measurements").delete().eq("id", id);
  if (error) throw storageError("Falha ao excluir a mediҧңo", error);
}