/**
 * Leitor de extrato bancário no formato OFX (SGML 1.x e XML 2.0).
 *
 * O internet banking exporta o extrato em OFX; o sistema importa aqui para
 * depois conciliar com os títulos lançados. Nada de dependência externa: o
 * formato é texto com tags `<TAG>valor`.
 */

export interface OfxTransacao {
  /** ID estável do lançamento no banco — usado para não importar duas vezes. */
  fitid?: string;
  trntype?: string;
  /** Data de lançamento (yyyy-mm-dd). */
  dtposted: string;
  trnamt: number;
  memo?: string;
  refnum?: string;
  chknum?: string;
  /** Número do documento/ofício quando o banco informa. */
  doc?: string;
}

export interface OfxArquivo {
  bankid?: string;
  branchid?: string;
  acctid?: string;
  accttype?: string;
  moeda?: string;
  /** Saldo disponível informado no rodapé do extrato. */
  saldo?: number;
  saldoData?: string;
  transacoes: OfxTransacao[];
}

const VAZIO: OfxArquivo = { transacoes: [] };

/** Converte `20260131`, `20260131120000` ou `20260131120000.000[-03:00]`. */
function paraData(valor: string): string {
  const m = (valor || "").match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function paraNumero(valor: string): number {
  const n = Number.parseFloat((valor || "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Extrai o conteúdo de uma tag, com ou sem tag de fechamento (OFX 1.x/2.0). */
function campo(bloco: string, tag: string): string {
  const fechado = bloco.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  if (fechado) return fechado[1].trim();
  const aberto = bloco.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
  return aberto ? aberto[1].trim() : "";
}

export function parseOfx(texto: string): OfxArquivo {
  if (!texto || !/<OFX/i.test(texto)) {
    throw new Error("Arquivo não parece ser um OFX válido (tag <OFX> não encontrada).");
  }

  const corpo = texto.slice(texto.search(/<OFX/i));

  const resultado: OfxArquivo = {
    bankid: campo(corpo, "BANKID") || undefined,
    branchid: campo(corpo, "BRANCHID") || undefined,
    acctid: campo(corpo, "ACCTID") || undefined,
    accttype: campo(corpo, "ACCTTYPE") || undefined,
    moeda: campo(corpo, "CURDEF") || undefined,
    transacoes: [],
  };

  const saldo = campo(corpo, "BALAMT");
  if (saldo) {
    resultado.saldo = paraNumero(saldo);
    const dataSaldo = campo(corpo, "DTASOF");
    if (dataSaldo) resultado.saldoData = paraData(dataSaldo) || undefined;
  }

  const blocos = corpo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  for (const bloco of blocos) {
    const dtposted = paraData(campo(bloco, "DTPOSTED"));
    const trnamt = paraNumero(campo(bloco, "TRNAMT"));
    if (!dtposted) continue;

    const fitid = campo(bloco, "FITID") || undefined;
    const memo = campo(bloco, "MEMO") || undefined;
    const refnum = campo(bloco, "REFNUM") || undefined;
    const chknum = campo(bloco, "CHKNUM") || undefined;

    resultado.transacoes.push({
      fitid,
      trntype: campo(bloco, "TRNTYPE") || undefined,
      dtposted,
      trnamt,
      memo,
      refnum,
      chknum,
      doc: campo(bloco, "DOC") || refnum || chknum || undefined,
    });
  }

  if (resultado.transacoes.length === 0) {
    return { ...VAZIO, ...resultado, transacoes: [] };
  }

  return resultado;
}

/** Assinatura do arquivo para impedir reimportação da mesma base. */
export function hashOfx(texto: string): string {
  const normalizado = texto.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < normalizado.length; i++) {
    const c = normalizado.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}${normalizado.length.toString(16)}`;
}

/**
 * Tenta adivinhar a forma de pagamento a partir do histórico — o mesmo
 * cruzamento é refeito depois pelas regras de categorização.
 */
export function sugestaoFormaPagamento(trn: OfxTransacao): string {
  const texto = `${trn.memo || ""} ${trn.trntype || ""}`.toUpperCase();
  if (texto.includes("PIX")) return "Pix";
  if (texto.includes("TED") || texto.includes("DOC")) return "Transferência";
  if (texto.includes("BOLETO") || texto.includes("BOL ")) return "Boleto";
  if (texto.includes("CART") || texto.includes("DEBITO AUTOMATICO")) return "Cartão";
  if (texto.includes("CHEQUE") || trn.chknum) return "Cheque";
  return "";
}
