import { supabase } from "@/integrations/supabase/client";

/**
 * Empresa e filiais do usuário autenticado.
 *
 * A empresa é quem decide o que a pessoa enxerga: as políticas de RLS do
 * PostgreSQL comparam `company_id` com o valor derivado daqui, de modo que
 * nenhuma consulta da interface consegue alcançar dados de outro cliente.
 *
 * A lista de filiais existe desde a Fase 1 e é usada pela Fase 2 para filtrar
 * os dados por filial; por enquanto a única filial é a Matriz.
 */

export interface Company {
  id: string;
  name: string;
  slug: string;
  document: string | null;
  status: "trial" | "active" | "suspended";
  plan: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  is_hq: boolean;
  status: "active" | "inactive";
}

export interface CompanyContext {
  company: Company | null;
  branches: Branch[];
  /** Ramo permitido ao usuário autenticado; false = administrador da empresa. */
  isPlatformAdmin: boolean;
  loading: boolean;
}

export const EMPTY_COMPANY_CONTEXT: CompanyContext = {
  company: null,
  branches: [],
  isPlatformAdmin: false,
  loading: true,
};

export async function fetchCompanyContext(userId: string): Promise<CompanyContext> {
  // A policy só devolve a empresa do próprio usuário, então a consulta já vem
  // filtrada — não é necessário mandar company_id no where.
  const [empresa, filiais, plataforma] = await Promise.all([
    supabase.from("companies").select("*").maybeSingle<Company>(),
    supabase.from("branches").select("*").order("is_hq", { ascending: false }),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);

  if (empresa.error) {
    throw new Error(`Falha ao carregar a empresa: ${empresa.error.message}`);
  }

  return {
    company: empresa.data ?? null,
    branches: (filiais.data ?? []) as Branch[],
    isPlatformAdmin: !!plataforma.data,
    loading: false,
  };
}