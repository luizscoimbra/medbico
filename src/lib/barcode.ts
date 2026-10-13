import bwipjs from "bwip-js";

/**
 * Código de barras do boleto em Interleaved 2 of 5 (ITF), o padrão exigido
 * pela FEBRABAN. Devolve o SVG pronto para ser injetado na tela/PDF do boleto.
 *
 * bwip-js roda no navegador (campo `browser` do pacote), então não há chamada
 * de sistema nem dependência de canvas aqui.
 */
export function codigoBarrasSvg(
  codigo: string,
  opcoes: { altura?: number; escala?: number } = {}
): string {
  const digitos = (codigo || "").replace(/\D/g, "");
  if (digitos.length < 6) return "";

  // ITF codifica dígitos em pares: se o tamanho for ímpar, completa com zero.
  const texto = digitos.length % 2 === 1 ? `0${digitos}` : digitos;

  return bwipjs.toSVG({
    bcid: "interleaved2of5",
    text: texto,
    scale: opcoes.escala ?? 2,
    height: opcoes.altura ?? 56,
    margin: 10,
    barcolor: "000000",
    backgroundcolor: "FFFFFF",
  });
}
