import type { TituloReceber } from "./financeiroStorage";
import type { TituloPagar } from "./contasPagarStorage";
import type { StatusTitulo } from "./financeiroStorage";

export type OrigemTitulo = "receber" | "pagar";

/**
 * Forma unificada de um título para os documentos (comprovante e relatório),
 * permitindo que os dois módulos usem os mesmos componentes de impressão.
 */
export interface TituloDocumento {
  id: string;
  numero: string;
  origem: OrigemTitulo;
  contraparte: string;   // cliente (receber) ou fornecedor (pagar)
  descricao: string;
  referencia?: string;   // OS (receber) ou categoria (pagar)
  dataEmissao: string;
  dataVencimento?: string;
  dataPagamento?: string;
  formaPagamento?: string;
  valor: number;
  status: StatusTitulo;
  observacao?: string;
}

export const toDocumentoReceber = (t: TituloReceber): TituloDocumento => ({
  id: t.id,
  numero: t.numero,
  origem: "receber",
  contraparte: t.clienteNome,
  descricao: t.descricao,
  referencia: t.osId,
  dataEmissao: t.dataEmissao,
  dataVencimento: t.dataVencimento,
  dataPagamento: t.dataPagamento,
  formaPagamento: t.formaPagamento,
  valor: t.valor,
  status: t.status,
  observacao: t.observacao,
});

export const toDocumentoPagar = (t: TituloPagar): TituloDocumento => ({
  id: t.id,
  numero: t.numero,
  origem: "pagar",
  contraparte: t.fornecedorNome,
  descricao: t.descricao,
  referencia: t.categoria,
  dataEmissao: t.dataEmissao,
  dataVencimento: t.dataVencimento,
  dataPagamento: t.dataPagamento,
  formaPagamento: t.formaPagamento,
  valor: t.valor,
  status: t.status,
  observacao: t.observacao,
});
