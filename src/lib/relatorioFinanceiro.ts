export type OrigemFiltro = "todos" | "receber" | "pagar";

export type RelFiltros = {
  origem: OrigemFiltro;
  tipo: "todos" | "recebimentos" | "cancelamentos" | "abertos";
  status: "todos" | "aberto" | "pago" | "cancelado";
  de: string;
  ate: string;
};

export const REL_FILTROS_PADRAO: RelFiltros = {
  origem: "todos",
  tipo: "todos",
  status: "todos",
  de: "",
  ate: "",
};

/** Data usada no filtro de período do relatório: pagamento quando existe, senão emissão. */
export const dataReferencia = (t: {
  dataPagamento?: string;
  dataEmissao: string;
}): string => (t.dataPagamento || t.dataEmissao || "").slice(0, 10);
