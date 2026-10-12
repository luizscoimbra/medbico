import { supabase } from "@/integrations/supabase/client";

/**
 * Central de Tributação — perfis fiscais por empresa.
 *
 * Em vez de preencher NCM/CFOP/alíquotas em cada produto, a empresa cadastra
 * os perfis uma vez aqui e cada produto referencia um perfil de saída (venda)
 * e um de entrada (compra). A gravação passa por RPC porque a gestão do
 * catálogo é restrita ao administrador master (RLS de SELECT para todos os
 * membros, gerenciamento só via upsert_tax_profile/delete_tax_profile).
 */

export interface TaxProfile {
  id: string;
  company_id: string;
  name: string;
  descricao: string;
  ncm: string;
  cest: string;
  cfop: string;
  cst_csosn: string;
  origem: string;
  aliquota_icms: number;
  aliquota_ipi: number;
  enquadramento_ipi: string;
  aliquota_pis: number;
  aliquota_cofins: number;
  /** Reforma (01/01/2027): CBS substitui PIS/COFINS. 0 = alíquota vigente do regime. */
  aliquota_cbs: number;
  /** Reforma (01/01/2027): IBS substitui ICMS/ISS aos poucos. 0 = alíquota vigente do ente. */
  aliquota_ibs: number;
  /** CST IBS/CBS exigido na NF-e (ex.: 000 = tributação integral). */
  cst_ibs_cbs: string;
  /** Código de classificação tributária dos anexos da LC 214/2025. */
  cclasstrib: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxProfileInput {
  id?: string;
  name: string;
  descricao: string;
  ncm: string;
  cest: string;
  cfop: string;
  cst_csosn: string;
  origem: string;
  aliquota_icms: number;
  aliquota_ipi: number;
  enquadramento_ipi: string;
  aliquota_pis: number;
  aliquota_cofins: number;
  aliquota_cbs: number;
  aliquota_ibs: number;
  cst_ibs_cbs: string;
  cclasstrib: string;
  ativo: boolean;
}

export const TAX_PROFILE_VAZIO: TaxProfileInput = {
  name: "",
  descricao: "",
  ncm: "",
  cest: "",
  cfop: "",
  cst_csosn: "",
  origem: "0",
  aliquota_icms: 0,
  aliquota_ipi: 0,
  enquadramento_ipi: "",
  aliquota_pis: 0,
  aliquota_cofins: 0,
  aliquota_cbs: 0,
  aliquota_ibs: 0,
  cst_ibs_cbs: "000",
  cclasstrib: "",
  ativo: true,
};

export async function fetchTaxProfiles(): Promise<TaxProfile[]> {
  const { data, error } = await supabase
    .from("tax_profiles")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(`Falha ao carregar a tributação: ${error.message}`);
  }
  return (data ?? []) as TaxProfile[];
}

export async function saveTaxProfile(input: TaxProfileInput): Promise<string> {
  const { data, error } = await supabase.rpc("upsert_tax_profile", {
    p_id: input.id ?? null,
    p_name: input.name,
    p_descricao: input.descricao,
    p_ncm: input.ncm,
    p_cest: input.cest,
    p_cfop: input.cfop,
    p_cst_csosn: input.cst_csosn,
    p_origem: input.origem,
    p_aliquota_icms: input.aliquota_icms,
    p_aliquota_ipi: input.aliquota_ipi,
    p_enquadramento_ipi: input.enquadramento_ipi,
    p_aliquota_pis: input.aliquota_pis,
    p_aliquota_cofins: input.aliquota_cofins,
    p_ativo: input.ativo,
    p_aliquota_cbs: input.aliquota_cbs,
    p_aliquota_ibs: input.aliquota_ibs,
    p_cst_ibs_cbs: input.cst_ibs_cbs,
    p_cclasstrib: input.cclasstrib,
  });

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function deleteTaxProfile(id: string): Promise<void> {
  const { error } = await supabase.rpc("delete_tax_profile", { p_id: id });
  if (error) {
    throw new Error(error.message);
  }
}
