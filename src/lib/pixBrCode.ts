/**
 * BR Code (Pix Copia e Cola) — padrão EMV® do Banco Central.
 *
 * Payload usado no QR Code do boleto híbrido. O QR "estático" é montado aqui
 * a partir da chave Pix da conta emissora; o QR "dinâmico" vem da API do banco
 * (não passa por aqui) — por isso o campo aceita os dois modos.
 *
 * Referência: Manual de Padrões para Iniciação do Pix (BACEN).
 */

/** CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF) exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acento, quebra caracteres fora do conjunto aceito e limita o tamanho. */
function normalizar(valor: string, max: number): string {
  return (valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .,\-/@%]/g, "")
    .trim()
    .slice(0, max);
}

function tlv(id: string, valor: string): string {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

export interface BrCodeInput {
  chave: string;
  /** Nome do beneficiário (razão social), máximo 25 caracteres. */
  nome: string;
  /** Cidade do beneficiário, máximo 15 caracteres. */
  cidade: string;
  /** Valor em reais. Zero ou omitido gera QR sem valor (cliente digita). */
  valor?: number;
  /** Identificador da transação (até 25 dígitos alfanuméricos). */
  txid?: string;
  descricao?: string;
}

export function gerarBrCode(input: BrCodeInput): string {
  const chave = (input.chave || "").trim();
  if (!chave) throw new Error("Informe a chave Pix vinculada à conta emissora.");

  const nome = normalizar(input.nome, 25);
  const cidade = normalizar(input.cidade, 15);
  if (!nome) throw new Error("Informe o nome do beneficiário para o QR Code.");
  if (!cidade) throw new Error("Informe a cidade do beneficiário para o QR Code.");

  const contaPix = [tlv("00", "br.gov.bcb.pix"), tlv("01", chave)]
    .concat(input.descricao ? [tlv("02", normalizar(input.descricao, 40))] : [])
    .join("");

  const txid = (input.txid || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 25) || "***";

  const partes = [
    tlv("00", "01"), // Payload Format Indicator
    tlv("01", "11"), // Point of Initiation: 11 = QR reutilizável (estático)
    tlv("26", contaPix), // Merchant Account Information — Pix
    tlv("52", "0000"), // Merchant Category Code
    tlv("53", "986"), // Transaction Currency — BRL
  ];

  const valor = Number(input.valor) || 0;
  if (valor > 0) {
    partes.push(tlv("54", valor.toFixed(2)));
  }

  partes.push(
    tlv("58", "BR"),
    tlv("59", nome),
    tlv("60", cidade),
    tlv("62", tlv("05", txid)) // Additional Data Field — txid
  );

  const base = partes.join("");
  return `${base}6304${crc16(base)}`;
}

/**
 * Gera o BR Code de um documento de cobrança, ou devolve o payload dinâmico
 * recebido da API do banco quando ele existir.
 */
export function brCodeDoBoleto(params: {
  payloadDinamico?: string;
  chave: string;
  nome: string;
  cidade: string;
  valor: number;
  txid?: string;
}): string {
  if (params.payloadDinamico?.trim()) return params.payloadDinamico.trim();
  return gerarBrCode({
    chave: params.chave,
    nome: params.nome,
    cidade: params.cidade,
    valor: params.valor,
    txid: params.txid,
  });
}
