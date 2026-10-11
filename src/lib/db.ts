import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Helpers compartilhados pela camada de persistência.
 *
 * Antes, cada módulo em `src/lib/*Storage.ts` gravava no IndexedDB do
 * navegador. Isso desligava o sistema da nuvem: os dados se perdiam ao limpar
 * o histórico e não existiam nos outros dispositivos. Todos esses módulos
 * agora falam com o PostgreSQL do Supabase, usando estes utilitários para
 * resolver o usuário autenticado e expor erros de forma consistente.
 */

let cachedUserId: string | null = null;

/** Id do usuário autenticado. Lança se não houver sessão válida. */
export async function requireUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  cachedUserId = data.user.id;
  return cachedUserId;
}

/** Id do usuário autenticado ou `null` (para fluxos que não exigem sessão). */
export async function optionalUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;

  const { data } = await supabase.auth.getUser();
  cachedUserId = data?.user?.id ?? null;
  return cachedUserId;
}

/** Limpa o cache de usuário — chamar ao trocar de sessão. */
export function clearUserCache(): void {
  cachedUserId = null;
  cachedBranchId = null;
}

// ============================================================================
// ESCOPO: EMPRESA E FILIAL
// ============================================================================
// A empresa é aplicada pelo próprio banco (DEFAULT current_tenant_key() nas
// colunas tenant_key). A filial não pode ser: ela depende de qual filial o
// operador está trabalhando no momento, que é um estado da interface. Por isso
// os módulos de storage carimbam branch_id a partir daqui.

let cachedBranchId: string | null = null;

/** Filial em que o usuário está trabalhando. null = dado compartilhado. */
export function setActiveBranch(branchId: string | null): void {
  cachedBranchId = branchId;
}

export function activeBranch(): string | null {
  return cachedBranchId;
}

export interface WriteScope {
  userId: string;
  branchId: string | null;
}

/** Escopo de escrita: usuário + filial ativa. */
export async function requireScope(): Promise<WriteScope> {
  return { userId: await requireUserId(), branchId: cachedBranchId };
}

/** Converte erro do PostgREST em Error legível. */
export function storageError(context: string, error: { message: string; code?: string } | null): Error {
  if (!error) return new Error(`${context}: erro desconhecido do banco de dados.`);
  return new Error(`${context}: ${error.message}`);
}

/** Número seguro vindo do Postgres (numeric pode chegar como string). */
export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Garante array mesmo quando a coluna JSONB veio nulo ou em formato inesperado. */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Converte string vazia em `null`, para colunas opcionais do Postgres. */
export function orNull(value: string | undefined | null): string | null {
  return value ? value : null;
}

/**
 * Normaliza um valor para `Json` antes de gravá-lo em coluna JSONB.
 * Evita tanto `undefined` (que vira `null`) quanto valores `undefined` aninhados,
 * que o Postgres rejeitaria.
 */
export function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

/** `asArray` com o tipo que o Postgres espera em uma coluna JSONB. */
export function asJsonArray<T>(value: unknown): Json {
  return toJson(Array.isArray(value) ? value : []);
}

/**
 * Consulta sem tipagem estrita, para operações que escolhem a tabela em tempo
 * de execução (exportação e restauração de backup).
 */
export interface ConsultaDinamica {
  select(colunas: string): Promise<{
    data: Record<string, unknown>[] | null;
    error: { message: string; code?: string } | null;
  }>;
  upsert(
    valores: Record<string, unknown>[],
    opcoes: { onConflict: string; ignoreDuplicates?: boolean }
  ): Promise<{ error: { message: string; code?: string } | null }>;
  delete(): { neq(coluna: string, valor: string): Promise<{ error: { message: string } | null }> };
}

export function tabelaDynamic(nome: string): ConsultaDinamica {
  return (supabase.from as unknown as (tabela: string) => ConsultaDinamica)(nome);
}