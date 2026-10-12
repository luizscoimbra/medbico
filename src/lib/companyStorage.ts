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
  razao_social: string;
  nome_fantasia: string;
  ie: string;
  im: string;
  regime_tributario: string;
  cnae: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
}

export interface Branch {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  is_hq: boolean;
  status: "active" | "inactive";
  ie: string;
  car: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  responsavel: string;
}

/** Campos fiscais/endereço compartilhados pela Matriz e pelas filiais. */
export interface FiscalFields {
  ie: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
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

/** Dados fiscais completos da Matriz, usados pela tela de cadastro da empresa. */
export interface CompanyFiscalInput {
  document: string;
  razao_social: string;
  nome_fantasia: string;
  ie: string;
  im: string;
  regime_tributario: string;
  cnae: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
}

/**
 * Grava o cadastro fiscal da Matriz.
 *
 * A gravação acontece via RPC (`update_company_fiscal`) porque `companies` não
 * tem policy de UPDATE: só o administrador master da empresa pode alterar, e a
 * guarda é feita no servidor com `current_is_company_admin()`.
 */
export async function saveCompanyFiscal(input: CompanyFiscalInput): Promise<void> {
  const { error } = await supabase.rpc("update_company_fiscal", {
    p_document: input.document,
    p_razao_social: input.razao_social,
    p_nome_fantasia: input.nome_fantasia,
    p_ie: input.ie,
    p_im: input.im,
    p_regime_tributario: input.regime_tributario,
    p_cnae: input.cnae,
    p_logradouro: input.logradouro,
    p_numero: input.numero,
    p_complemento: input.complemento,
    p_bairro: input.bairro,
    p_municipio: input.municipio,
    p_uf: input.uf,
    p_cep: input.cep,
    p_telefone: input.telefone,
    p_email: input.email,
  });

  if (error) {
    throw new Error(error.message);
  }
}