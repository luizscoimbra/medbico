import { supabase } from "@/integrations/supabase/client";
import { asArray, storageError } from "@/lib/db";

/**
 * Leitura do histórico de sincronização da base Agrofit/MAPA.
 *
 * Toda execução do sync diário (scripts/agrofit-sync.mjs) grava uma linha em
 * `agrofit_sync_history` com as contagens exatas do diff e amostras do que
 * mudou — esta lib expõe essa trilha de auditoria para a tela de histórico.
 */

export type SyncStatus = "sem_alteracoes" | "aplicado" | "falha";
export type SyncOrigem = "rotina_diaria" | "manual" | "importacao_inicial";

export interface SyncAmostra {
  registro: string;
  marca: string;
  cultura?: string | null;
  praga?: string | null;
}

export interface SyncCampoDiff {
  campo: string;
  de: unknown;
  para: unknown;
}

export interface SyncModificado extends SyncAmostra {
  campos: SyncCampoDiff[];
}

export interface SyncCadastroDiff {
  produto: string;
  de: { registro: string; formulacao: string; ingredientes: string };
  para: { registro: string; formulacao: string; ingredientes: string };
}

export interface SyncDetalhes {
  adicionados: SyncAmostra[];
  removidos: SyncAmostra[];
  modificados: SyncModificado[];
  cadastro: SyncCadastroDiff[];
  fonte_modified?: string;
}

export interface SyncExecucao {
  id: string;
  executadoEm: string;
  origem: SyncOrigem;
  status: SyncStatus;
  fonteAlterada: boolean;
  totalFinal: number;
  adicionados: number;
  modificados: number;
  removidos: number;
  cadastroAtualizados: number;
  mensagem: string;
  detalhes: SyncDetalhes;
}

const CAMPO_LABELS: Record<string, string> = {
  nr_registro: "Registro MAPA",
  marca_comercial: "Marca comercial",
  formulacao: "Formulação",
  ingrediente_ativo: "Ingrediente ativo",
  titular: "Titular",
  classe: "Classe",
  modo_de_acao: "Modo de ação",
  cultura: "Cultura",
  praga_cientifico: "Praga (científico)",
  praga_comum: "Praga (comum)",
  classe_toxicologica: "Classe toxicológica",
  classe_ambiental: "Classe ambiental",
  organicos: "Orgânicos",
  situacao: "Situação",
};

export function labelCampoAgrofit(campo: string): string {
  return CAMPO_LABELS[campo] ?? campo;
}

function detalhesFromJson(valor: unknown): SyncDetalhes {
  const obj = (valor ?? {}) as Record<string, unknown>;
  const amostras = (chave: string): SyncAmostra[] =>
    asArray<SyncAmostra>(obj[chave]);
  return {
    adicionados: amostras("adicionados"),
    removidos: amostras("removidos"),
    modificados: asArray<SyncModificado>(obj.modificados),
    cadastro: asArray<SyncCadastroDiff>(obj.cadastro),
    fonte_modified: typeof obj.fonte_modified === "string" ? obj.fonte_modified : undefined,
  };
}

interface SyncRow {
  id: string;
  executado_em: string;
  origem: string;
  status: string;
  fonte_alterada: boolean;
  total_final: number;
  adicionados: number;
  modificados: number;
  removidos: number;
  cadastro_atualizados: number;
  mensagem: string;
  detalhes: unknown;
}

function fromRow(row: SyncRow): SyncExecucao {
  return {
    id: row.id,
    executadoEm: row.executado_em,
    origem: (row.origem as SyncOrigem) ?? "rotina_diaria",
    status: row.status as SyncStatus,
    fonteAlterada: row.fonte_alterada,
    totalFinal: row.total_final,
    adicionados: row.adicionados,
    modificados: row.modificados,
    removidos: row.removidos,
    cadastroAtualizados: row.cadastro_atualizados,
    mensagem: row.mensagem,
    detalhes: detalhesFromJson(row.detalhes),
  };
}

export async function listarExecucoesSync(limite = 120): Promise<SyncExecucao[]> {
  const { data, error } = await supabase
    .from("agrofit_sync_history")
    .select("*")
    .order("executado_em", { ascending: false })
    .limit(limite);

  if (error) throw storageError("Falha ao carregar o histórico do Agrofit", error);
  return (data as SyncRow[]).map(fromRow);
}
