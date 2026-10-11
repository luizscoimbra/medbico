import { supabase } from "@/integrations/supabase/client";
import { requireUserId, storageError, toJson } from "@/lib/db";

/**
 * Preferências de cadastro que antes viviam em `localStorage` (caminhões pipa,
 * formulações personalizadas). Agora ficam em `app_settings`, no PostgreSQL,
 * para que o caminhão cadastrado no escritório apareça no celular do gerente.
 *
 * A chave é única por tenant: `PRIMARY KEY (tenant_key, key)`.
 */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw storageError(`Falha ao carregar a configuração "${key}"`, error);
  return data ? (data.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("app_settings").upsert(
    { key, user_id: userId, value: toJson(value) },
    { onConflict: "tenant_key,key" }
  );
  if (error) throw storageError(`Falha ao salvar a configuração "${key}"`, error);
}

export const SETTINGS_KEYS = {
  waterTrucks: "waterTrucks",
  customFormulations: "customFormulations",
} as const;