/**
 * Leitor de XML de NF-e (portal nacional) sem dependências externas.
 *
 * Aceita tanto o arquivo autorizado (`<nfeProc><NFe><infNFe>`) quanto o XML puro
 * (`<NFe><infNFe>`), que é o formato exportado por many emissores.
 * A leitura usa `getElementsByTagNameNS("*", ...)` para ignorar namespaces.
 */

export interface NfeEmitente {
  nome: string;
  fantasia: string;
  cnpj: string;
  ie: string;
  cidade: string;
  uf: string;
}

export interface NfeItem {
  numero: number;
  codigoFornecedor: string;
  descricao: string;
  ncm: string;
  ean: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  desconto: number;
}

export interface NfeDocumento {
  chave: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  natureza: string;
  emitente: NfeEmitente;
  destinatario: string;
  valorProdutos: number;
  valorDesconto: number;
  valorTotal: number;
  itens: NfeItem[];
  arquivoNome: string;
}

function elementos(raiz: Element | Document, tag: string): Element[] {
  return Array.from(raiz.getElementsByTagNameNS("*", tag));
}

function primeiro(raiz: Element | Document | null, tag: string): Element | null {
  if (!raiz) return null;
  return raiz.getElementsByTagNameNS("*", tag)[0] ?? null;
}

function texto(raiz: Element | Document | null, tag: string): string {
  return primeiro(raiz, tag)?.textContent?.trim() ?? "";
}

function numero(valor: string): number {
  const limpo = (valor || "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? n : 0;
}

function dataIso(bruto: string): string {
  if (!bruto) return new Date().toISOString().slice(0, 10);
  const m = bruto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(bruto);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function localidade(ender: Element | null): { cidade: string; uf: string } {
  return { cidade: texto(ender, "xMun"), uf: texto(ender, "UF") };
}

/** Normaliza o GTIN: "SEM GTIN", "0" e strings vazias viram `null`. */
export function limparEan(bruto: string): string | null {
  const semEspacos = (bruto || "").toUpperCase().replace(/\s+/g, "");
  if (!semEspacos || semEspacos === "SEM GTIN" || /^0+$/.test(semEspacos)) return null;
  const digitos = semEspacos.replace(/\D/g, "");
  if (!digitos || /^0+$/.test(digitos)) return null;
  return digitos;
}

export function lerXmlNfe(xml: string, arquivoNome: string): NfeDocumento {
  const erro = (msg: string): never => {
    throw new Error(msg);
  };

  if (!xml || !xml.trim()) erro("O arquivo está vazio.");

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const falha = doc.getElementsByTagName("parsererror")[0];
  if (falha) erro("Não foi possível interpretar o XML. Verifique se é um arquivo de NF-e válido.");

  const infNFe = primeiro(doc, "infNFe");
  if (!infNFe) erro("XML não contém os dados de uma NF-e (tag infNFe ausente).");

  const ide = primeiro(infNFe, "ide");
  const emit = primeiro(infNFe, "emit");
  const dest = primeiro(infNFe, "dest");
  const total = primeiro(infNFe, "ICMSTot");

  const idAttr = infNFe.getAttribute("Id") || "";
  const chaveProt = texto(primeiro(doc, "infProt"), "chNFe");
  const chave = (idAttr.replace(/^NFe/i, "") || chaveProt).replace(/\D/g, "");

  const emitente: NfeEmitente = {
    nome: texto(emit, "xNome"),
    fantasia: texto(emit, "xFant"),
    cnpj: texto(emit, "CNPJ"),
    ie: texto(emit, "IE"),
    ...localidade(primeiro(emit, "enderEmit")),
  };

  const itens: NfeItem[] = elementos(infNFe, "det").map((det, indice) => {
    const prod = primeiro(det, "prod");
    const quantidade = numero(texto(prod, "qCom"));
    const valorTotal = numero(texto(prod, "vProd"));
    const ean = limparEan(texto(prod, "cEAN")) ?? limparEan(texto(prod, "cEANTrib"));
    const numeroItem = Number.parseInt(det.getAttribute("nItem") || "", 10);
    return {
      numero: Number.isFinite(numeroItem) ? numeroItem : indice + 1,
      codigoFornecedor: texto(prod, "cProd"),
      descricao: texto(prod, "xProd"),
      ncm: texto(prod, "NCM"),
      ean: ean ?? "",
      unidade: (texto(prod, "uCom") || "").toUpperCase(),
      quantidade,
      valorUnitario: numero(texto(prod, "vUnCom")),
      valorTotal,
      desconto: numero(texto(prod, "vDesc")),
    };
  });

  if (!itens.length) erro("A NF-e não possui itens de produto.");

  return {
    chave,
    numero: texto(ide, "nNF"),
    serie: texto(ide, "serie"),
    dataEmissao: dataIso(texto(ide, "dhEmi") || texto(ide, "dEmi")),
    natureza: texto(ide, "natOp"),
    emitente,
    destinatario: texto(dest, "xNome"),
    valorProdutos: numero(texto(total, "vProd")),
    valorDesconto: numero(texto(total, "vDesc")),
    valorTotal: numero(texto(total, "vNF")),
    itens,
    arquivoNome,
  };
}
