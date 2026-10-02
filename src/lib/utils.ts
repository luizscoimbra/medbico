import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return "R$ 0,00";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Extrai os centavos do texto mascarado "R$ 0.000,00". */
export function moedaParaCentavos(texto: string): number {
  const limpo = texto.replace(/\D/g, "");
  return limpo ? parseInt(limpo, 10) : 0;
}

/** Converte os dígitos digitados (centavos) para o texto "R$ 0.000,00". */
export function digitosParaMoeda(digitos: string): string {
  const limpo = digitos.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!limpo) return "";
  return formatBRL((parseInt(limpo, 10) || 0) / 100);
}
