import { forwardRef } from "react";
import type { TituloDocumento } from "@/lib/tituloDocumento";
import { formatBRL } from "@/lib/utils";

const fmtData = (value?: string) => {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

const docTitulo = (t: TituloDocumento): string => {
  if (t.origem === "pagar") {
    if (t.status === "pago") return "Comprovante de Pagamento";
    if (t.status === "aberto") return "2ª Via da Conta a Pagar";
    return "Comprovante de Cancelamento";
  }
  if (t.status === "pago") return "Comprovante de Recebimento";
  if (t.status === "aberto") return "2ª Via do Título a Receber";
  return "Comprovante de Cancelamento";
};

const statusLabel = (t: TituloDocumento): string => {
  if (t.status === "aberto") return "Em aberto";
  if (t.status === "cancelado") return "Cancelado";
  return t.origem === "pagar" ? "Pago" : "Recebido";
};

const statusClass = (t: TituloDocumento): string => {
  if (t.status === "aberto") return "border-amber-600 text-amber-700";
  if (t.status === "cancelado") return "border-red-700 text-red-700";
  return "border-emerald-700 text-emerald-700";
};

const Campo = ({ label, valor, span }: { label: string; valor: string; span?: boolean }) => (
  <div className={span ? "col-span-2" : undefined}>
    <p className="text-[9px] text-gray-500 uppercase font-semibold">{label}</p>
    <p className="font-medium text-[11px] break-words">{valor}</p>
  </div>
);

export const ComprovanteTitulo = forwardRef<HTMLDivElement, { titulo: TituloDocumento }>(
  ({ titulo: t }, ref) => {
    const pagar = t.origem === "pagar";

    const resumo =
      t.status === "pago"
        ? `${pagar ? "Pagamento" : "Recebimento"} realizado em ${fmtData(t.dataPagamento)}${
            t.formaPagamento ? ` via ${t.formaPagamento}` : ""
          }.`
        : t.status === "cancelado"
          ? pagar
            ? "Título cancelado — este documento não representa valor a pagar."
            : "Título cancelado — este documento não representa valor a receber."
          : `Título em aberto${t.dataVencimento ? `, com vencimento em ${fmtData(t.dataVencimento)}` : ""}.`;

    return (
      <>
        <style>{`
          @media print {
            #root { display: none !important; }
            body * { visibility: hidden !important; }
            .comprovante-print, .comprovante-print * { visibility: visible !important; }
            .comprovante-dialog {
              position: static !important;
              inset: auto !important;
              transform: none !important;
              display: block !important;
              width: 100% !important;
              max-width: none !important;
              max-height: none !important;
              overflow: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              gap: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: transparent !important;
            }
            .comprovante-print {
              position: static !important;
              width: 100% !important;
              max-width: 210mm !important;
              margin: 0 !important;
              padding: 10mm !important;
              border: none !important;
              box-shadow: none !important;
            }
            .no-print { display: none !important; }
          }
        `}</style>

        <div
          ref={ref}
          id="comprovante-print"
          className="comprovante-print print-area bg-white text-black p-4 sm:p-6 w-full mx-auto border border-gray-200 shadow-sm break-inside-avoid"
          style={{ fontSize: "11px", lineHeight: "1.3" }}
        >
          {/* Cabeçalho */}
          <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3 gap-3">
            <img
              src="/herbilog_logo.png"
              alt="HerbiLog"
              className="h-9 w-auto object-contain"
            />
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold">
                HerbiLog — Módulo Financeiro
              </p>
              <p className="text-sm font-bold uppercase leading-tight">{docTitulo(t)}</p>
              <p className="text-xs font-mono">Título nº {t.numero}</p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 text-[9px] font-bold uppercase border rounded-full ${statusClass(t)}`}
              >
                {statusLabel(t)}
              </span>
            </div>
          </div>

          {/* Dados do título */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 mb-3 border border-gray-300 rounded p-2">
            <Campo label={pagar ? "Fornecedor" : "Cliente"} valor={t.contraparte || ""} span />
            <Campo label="Descrição" valor={t.descricao || "—"} span />
            <Campo label={pagar ? "Categoria" : "OS vinculada"} valor={t.referencia || ""} />
            <Campo label="Emissão" valor={fmtData(t.dataEmissao)} />
            <Campo label="Vencimento" valor={fmtData(t.dataVencimento)} />
            <Campo label="Data do pagamento" valor={fmtData(t.dataPagamento)} />
          </div>

          {/* Valor + forma de pagamento */}
          <div className="flex items-center justify-between border border-black rounded p-2 mb-3">
            <div>
              <p className="text-[9px] text-gray-500 uppercase font-semibold">Valor</p>
              <p className="text-lg font-bold font-mono leading-tight">
                {formatBRL(t.valor)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-500 uppercase font-semibold">
                Forma de pagamento
              </p>
              <p className="text-[11px] font-medium">{t.formaPagamento || ""}</p>
            </div>
          </div>

          {/* Situação */}
          <div className="border border-gray-300 rounded bg-gray-50 p-2 mb-3">
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Situação</p>
            <p className="text-[11px] font-medium">{resumo}</p>
            {t.observacao && (
              <p className="text-[10px] text-gray-600 mt-1">Obs.: {t.observacao}</p>
            )}
          </div>

          {/* Assinaturas */}
          <div className="flex justify-between gap-8 mt-6 pt-2 break-inside-avoid">
            <div className="text-center flex-1" style={{ minWidth: "160px" }}>
              <div className="border-t border-black pt-1">
                <p className="text-[10px] font-medium">{pagar ? "Fornecedor" : "Cliente / Pagador"}</p>
                <p className="text-[9px] text-gray-500">{t.contraparte || ""}</p>
              </div>
            </div>
            <div className="text-center flex-1" style={{ minWidth: "160px" }}>
              <div className="border-t border-black pt-1">
                <p className="text-[10px] font-medium">Responsável</p>
                <p className="text-[9px] text-gray-500">&nbsp;</p>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex items-end justify-between mt-4 pt-2 border-t border-gray-200">
            <p className="text-[8px] text-gray-400">
              Doc. gerado por HerbiLog em {new Date().toLocaleString("pt-BR")}
            </p>
            <p className="text-[8px] text-gray-400 font-mono">ID {t.id}</p>
          </div>
        </div>
      </>
    );
  }
);

ComprovanteTitulo.displayName = "ComprovanteTitulo";
