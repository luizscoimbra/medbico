import { forwardRef } from "react";
import type { TituloDocumento } from "@/lib/tituloDocumento";
import { type RelFiltros } from "@/lib/relatorioFinanceiro";
import { formatBRL } from "@/lib/utils";

const fmtData = (value?: string) => {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

const periodoTexto = (f: RelFiltros) => {
  if (!f.de && !f.ate) return "Período: sem filtro (tudo)";
  if (f.de && f.ate) return `Período: ${fmtData(f.de)} a ${fmtData(f.ate)}`;
  if (f.de) return `Período: a partir de ${fmtData(f.de)}`;
  return `Período: até ${fmtData(f.ate)}`;
};

const origemSubtitulo = (origem: RelFiltros["origem"]) =>
  origem === "receber"
    ? "Contas a Receber"
    : origem === "pagar"
      ? "Contas a Pagar"
      : "Contas a Receber e a Pagar";

const operacaoLabel = (f: RelFiltros) => {
  if (f.tipo === "todos") return "Todas as operações";
  if (f.tipo === "cancelamentos") return "Cancelamentos";
  if (f.tipo === "abertos") return "Em aberto";
  // liquidados (status "pago")
  return f.origem === "pagar"
    ? "Pagamentos"
    : f.origem === "receber"
      ? "Recebimentos"
      : "Recebimentos e Pagamentos";
};

const statusSelecaoLabel = (f: RelFiltros) => {
  if (f.status === "todos") return "Todos os status";
  if (f.status === "aberto") return "Em aberto";
  if (f.status === "cancelado") return "Cancelado";
  return f.origem === "pagar" ? "Pago" : f.origem === "receber" ? "Recebido" : "Recebido/Pago";
};

const referenciaLabel = (origem: RelFiltros["origem"]) =>
  origem === "pagar" ? "Categoria" : origem === "receber" ? "OS" : "Referência";

const statusLinha = (t: TituloDocumento) => {
  if (t.status === "aberto") return "Em aberto";
  if (t.status === "cancelado") return "Cancelado";
  return t.origem === "pagar" ? "Pago" : "Recebido";
};

const TotalBloco = ({
  label,
  qtd,
  valor,
  cor,
}: {
  label: string;
  qtd: number;
  valor: number;
  cor: string;
}) => (
  <div className="border border-gray-300 rounded p-2 flex-1 min-w-[120px]">
    <p className="text-[9px] text-gray-500 uppercase font-semibold">{label}</p>
    <p className={`text-[13px] font-bold font-mono ${cor}`}>{formatBRL(valor)}</p>
    <p className="text-[9px] text-gray-500">{qtd} título(s)</p>
  </div>
);

export const RelatorioMovimentacoes = forwardRef<
  HTMLDivElement,
  { titulos: TituloDocumento[]; filtros: RelFiltros }
>(({ titulos, filtros }, ref) => {
  const mostrarOrigem = filtros.origem === "todos";

  const soma = (status: TituloDocumento["status"]) =>
    titulos.filter((t) => t.status === status);
  const totalDe = (lista: TituloDocumento[]) =>
    lista.reduce((s, t) => s + (t.valor || 0), 0);

  const listaAberto = soma("aberto");
  const listaPago = soma("pago");
  const listaCancelado = soma("cancelado");
  const totalGeral = totalDe(titulos);

  const listaReceber = titulos.filter((t) => t.origem === "receber");
  const listaPagar = titulos.filter((t) => t.origem === "pagar");

  const pagoLabel =
    filtros.origem === "pagar"
      ? "Pagos"
      : filtros.origem === "receber"
        ? "Recebidos"
        : "Recebidos/Pagos";

  const refLabel = referenciaLabel(filtros.origem);
  const colunasExtras = mostrarOrigem ? 1 : 0;

  return (
    <>
      <style>{`
        @media print {
          #root { display: none !important; }
          body * { visibility: hidden !important; }
          .relatorio-print, .relatorio-print * { visibility: visible !important; }
          .relatorio-dialog {
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
          .relatorio-print {
            position: static !important;
            width: 100% !important;
            max-width: 210mm !important;
            margin: 0 !important;
            padding: 10mm !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .relatorio-print thead { display: table-header-group !important; }
          .relatorio-print tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          .relatorio-preview {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        ref={ref}
        id="relatorio-print"
        className="relatorio-print print-area bg-white text-black p-4 sm:p-6 w-full mx-auto border border-gray-200 shadow-sm"
        style={{ fontSize: "11px", lineHeight: "1.35" }}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3 gap-3">
          <img src="/herbilog_logo.png" alt="HerbiLog" className="h-9 w-auto object-contain" />
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold">
              HerbiLog — Módulo Financeiro
            </p>
            <p className="text-sm font-bold uppercase leading-tight">
              Relatório de Movimentações
            </p>
            <p className="text-[10px] text-gray-600">{origemSubtitulo(filtros.origem)}</p>
          </div>
        </div>

        {/* Filtros aplicados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 mb-3 border border-gray-300 rounded p-2">
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Origem</p>
            <p className="font-medium text-[11px]">
              {filtros.origem === "todos"
                ? "A receber e a pagar"
                : filtros.origem === "receber"
                  ? "A receber"
                  : "A pagar"}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Operação</p>
            <p className="font-medium text-[11px]">{operacaoLabel(filtros)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Status</p>
            <p className="font-medium text-[11px]">{statusSelecaoLabel(filtros)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Período</p>
            <p className="font-medium text-[11px]">{periodoTexto(filtros)}</p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Gerado em</p>
            <p className="font-medium text-[11px]">{new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>

        {/* Totais */}
        <div className="flex flex-wrap gap-2 mb-3">
          <TotalBloco
            label="Em aberto"
            qtd={listaAberto.length}
            valor={totalDe(listaAberto)}
            cor="text-amber-700"
          />
          <TotalBloco
            label={pagoLabel}
            qtd={listaPago.length}
            valor={totalDe(listaPago)}
            cor="text-emerald-700"
          />
          <TotalBloco
            label="Cancelados"
            qtd={listaCancelado.length}
            valor={totalDe(listaCancelado)}
            cor="text-red-700"
          />
          {mostrarOrigem && (
            <>
              <TotalBloco
                label="A receber"
                qtd={listaReceber.length}
                valor={totalDe(listaReceber)}
                cor="text-blue-700"
              />
              <TotalBloco
                label="A pagar"
                qtd={listaPagar.length}
                valor={totalDe(listaPagar)}
                cor="text-violet-700"
              />
            </>
          )}
          <div className="border-2 border-black rounded p-2 flex-1 min-w-[140px] bg-gray-50">
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Total geral</p>
            <p className="text-[14px] font-bold font-mono">{formatBRL(totalGeral)}</p>
            <p className="text-[9px] text-gray-500">{titulos.length} título(s)</p>
          </div>
        </div>

        {/* Tabela */}
        {titulos.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded p-6 text-center text-gray-500 text-[11px]">
            Nenhuma movimentação para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-visible">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">Nº</th>
                  {mostrarOrigem && (
                    <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">
                      Origem
                    </th>
                  )}
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">
                    {filtros.origem === "pagar" ? "Fornecedor" : "Cliente / Fornecedor"}
                  </th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">Descrição</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">{refLabel}</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">Emissão</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">Vencim.</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">Pagto.</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">Forma</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-right font-bold">Valor</th>
                  <th className="border border-gray-400 px-1.5 py-1 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {titulos.map((t) => (
                  <tr key={`${t.origem}-${t.id}`}>
                    <td className="border border-gray-400 px-1.5 py-1 font-mono">{t.numero}</td>
                    {mostrarOrigem && (
                      <td className="border border-gray-400 px-1.5 py-1 whitespace-nowrap">
                        {t.origem === "pagar" ? "A pagar" : "A receber"}
                      </td>
                    )}
                    <td className="border border-gray-400 px-1.5 py-1">
                      {t.contraparte || ""}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 break-words">
                      {t.descricao || ""}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 font-mono">
                      {t.referencia || ""}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 whitespace-nowrap">
                      {fmtData(t.dataEmissao)}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 whitespace-nowrap">
                      {fmtData(t.dataVencimento)}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 whitespace-nowrap">
                      {fmtData(t.dataPagamento)}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 whitespace-nowrap">
                      {t.formaPagamento || ""}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 text-right font-mono whitespace-nowrap">
                      {formatBRL(t.valor)}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 text-center whitespace-nowrap font-semibold">
                      {statusLinha(t)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-400 px-1.5 py-1" colSpan={4 + colunasExtras}>
                    Total ({titulos.length} título(s))
                  </td>
                  <td className="border border-gray-400 px-1.5 py-1" colSpan={4} />
                  <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                    {formatBRL(totalGeral)}
                  </td>
                  <td className="border border-gray-400 px-1.5 py-1" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Assinatura + rodapé */}
        <div className="flex justify-between gap-8 mt-6 pt-2 break-inside-avoid">
          <div className="text-center flex-1" style={{ minWidth: "160px" }}>
            <div className="border-t border-black pt-1">
              <p className="text-[10px] font-medium">Responsável</p>
              <p className="text-[9px] text-gray-500">&nbsp;</p>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between mt-4 pt-2 border-t border-gray-200">
          <p className="text-[8px] text-gray-400">
            Doc. gerado por HerbiLog em {new Date().toLocaleString("pt-BR")}
          </p>
          <p className="text-[8px] text-gray-400">
            Relatório de Movimentações — {origemSubtitulo(filtros.origem)}
          </p>
        </div>
      </div>
    </>
  );
});

RelatorioMovimentacoes.displayName = "RelatorioMovimentacoes";
