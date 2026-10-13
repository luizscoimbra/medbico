/**
 * Boleto bancário brasileiro — código de barras e linha digitável (FEBRABAN).
 *
 * Estrutura do código de barras (44 posições):
 *   1-3  código do banco (3 dígitos)
 *   4    código da moeda (9 = Real)
 *   5    dígito verificador geral (módulo 11)
 *   6-9  fator de vencimento (4 dígitos)
 *   10-19 valor (10 dígitos, em centavos)
 *   20-44 campo livre (25 dígitos — layout definido pelo banco)
 *
 * A linha digitável tem 47 dígitos, dividida em 5 campos, cada um com seu
 * próprio DV em módulo 10 (o 4º campo é o DV geral do código de barras).
 *
 * O campo livre é o único trecho que muda de banco para banco; aqui ele é
 * montado no layout padrão (`montarCampoLivre`) e deve ser conferido na
 * homologação junto à instituição.
 */

const MOEDA_REAL = "9";
const DIA_BASE_FATOR = Date.UTC(1997, 9, 7); // 07/10/1997
const DIA_REINICIO_FATOR = Date.UTC(2025, 1, 21); // fator 9999
const DIA_NOVO_FATOR = Date.UTC(2025, 1, 22); // volta a 1000

function paraMillis(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, (mes || 1) - 1, dia || 1);
}

/** Fator de vencimento de 4 dígitos, com o reinício de 22/02/2025 da FEBRABAN. */
export function fatorVencimento(vencimento: string): string {
  const alvo = paraMillis(vencimento);
  let dias: number;
  if (alvo > DIA_REINICIO_FATOR) {
    dias = Math.round((alvo - DIA_NOVO_FATOR) / 86_400_000) + 1000;
  } else {
    dias = Math.round((alvo - DIA_BASE_FATOR) / 86_400_000);
  }
  const fator = Math.max(0, Math.min(9999, dias));
  return String(fator).padStart(4, "0");
}

/** Valor em centavos, sempre com 10 dígitos. */
export function valorEmDezDigitos(valor: number): string {
  const centavos = Math.round((Number(valor) || 0) * 100);
  return String(Math.max(0, centavos)).padStart(10, "0");
}

/** DV módulo 10 — usado nos campos da linha digitável. */
export function modulo10(numero: string): number {
  let peso = 2;
  let soma = 0;
  for (let i = numero.length - 1; i >= 0; i--) {
    let mult = Number(numero[i]) * peso;
    if (mult > 9) mult = Math.floor(mult / 10) + (mult % 10);
    soma += mult;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/** DV módulo 11 dos 43 dígitos do código de barras (posição 5). */
export function modulo11CodigoBarras(base: string): number {
  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 10 || dv === 11 ? 0 : dv;
}

/**
 * Campo livre (25 dígitos) — layout padrão:
 *   convênio (9) + nosso número (13) + código da carteira (3)
 *
 * Bancos diferentes impõem outro encaixe; troque aqui quando a instituição
 * informar o layout deles.
 */
export function montarCampoLivre(p: {
  nossoNumero: string;
  carteira: string;
  convenio?: string;
}): string {
  const limpar = (v: string, tamanho: number) =>
    (v || "").replace(/\D/g, "").padStart(tamanho, "0").slice(-tamanho);

  return (
    limpar(p.convenio || "", 9) +
    limpar(p.nossoNumero, 13) +
    limpar(p.carteira, 3)
  );
}

export interface BoletoInput {
  banco: string;
  valor: number;
  vencimento: string;
  campoLivre: string;
}

/** Monta os 44 dígitos do código de barras. */
export function montarCodigoBarras(input: BoletoInput): string {
  const banco = (input.banco || "").replace(/\D/g, "").padStart(3, "0").slice(-3);
  const fator = fatorVencimento(input.vencimento);
  const valor = valorEmDezDigitos(input.valor);
  const campoLivre = (input.campoLivre || "")
    .replace(/\D/g, "")
    .padStart(25, "0")
    .slice(-25);

  const base = `${banco}${MOEDA_REAL}${fator}${valor}${campoLivre}`; // 43
  const dv = modulo11CodigoBarras(base);
  return `${base.slice(0, 4)}${dv}${base.slice(4)}`;
}

/** Gera a linha digitável (47 dígitos) a partir dos 44 do código de barras. */
export function linhaDigitavel(codigoBarras: string): string {
  const cod = (codigoBarras || "").replace(/\D/g, "");
  if (cod.length !== 44) {
    throw new Error("Código de barras deve ter 44 dígitos.");
  }

  const bancoMoeda = cod.slice(0, 4);
  const dvGeral = cod.slice(4, 5);
  const fatorValor = cod.slice(5, 19);
  const campoLivre = cod.slice(19, 44);

  const campo1 = bancoMoeda + campoLivre.slice(0, 5);
  const campo2 = campoLivre.slice(5, 15);
  const campo3 = campoLivre.slice(15, 25);

  const f1 = `${campo1}${modulo10(campo1)}`;
  const f2 = `${campo2}${modulo10(campo2)}`;
  const f3 = `${campo3}${modulo10(campo3)}`;

  return [
    `${f1.slice(0, 5)}.${f1.slice(5)}`,
    `${f2.slice(0, 5)}.${f2.slice(5)}`,
    `${f3.slice(0, 5)}.${f3.slice(5)}`,
    dvGeral,
    fatorValor,
  ].join(" ");
}

/** Monta tudo de uma vez para exibição/impressão do boleto. */
export function gerarBoleto(input: BoletoInput): {
  codigoBarras: string;
  linhaDigitavel: string;
} {
  const codigoBarras = montarCodigoBarras(input);
  return { codigoBarras, linhaDigitavel: linhaDigitavel(codigoBarras) };
}

/** Normaliza nosso número para 13 dígitos (armazenamento e campo livre). */
export function normalizarNossoNumero(nossoNumero: string): string {
  return (nossoNumero || "").replace(/\D/g, "").padStart(13, "0").slice(-13);
}
