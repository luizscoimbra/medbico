import { forwardRef, useMemo } from "react";
import type { Equipment } from "@/lib/equipmentStorage";
import type { LinhaHistorico } from "@/lib/equipmentFuelStorage";
import { formatBRL } from "@/lib/utils";

const fmtData = (value?: string) => {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

const periodoTexto = (f: { de: string; ate: string }) => {
  if (!f.de && !f.ate) return "Período: sem filtro (tudo)";
  if (f.de && f.ate) return `Período: ${fmtData(f.de)} a ${fmtData(f.ate)}`;
  if (f.de) return `Período: a partir de ${fmtData(f.de)}`;
  return `Período: até ${fmtData(f.ate)}`;
};

interface ResumoEquipamento {
  equipment_id: string;
  fleet_number: string;
  modelo: string;
  linhas: LinhaHistorico[];
  litros: number;
  horas: number;
  semBaseline: number;
  mediaLph: number | null;
  valorTotal: number;
}

const TotalBloco = ({
  label,
  valor,
  sub,
  destaque = false,
}: {
  label: string;
  valor: string;
  sub: string;
  destaque?: boolean;
}) => (
  <div
    className={`rounded p-2 flex-1 min-w-[120px] ${
      destaque ? "border-2 border-black bg-gray-50" : "border border-gray-300"
    }`}
  >
    <p className="text-[9px] text-gray-500 uppercase font-semibold">{label}</p>
    <p className="text-[13px] font-bold font-mono">{valor}</p>
    <p className="text-[9px] text-gray-500">{sub}</p>
  </div>
);

export const RelatorioAbastecimento = forwardRef<
  HTMLDivElement,
  {
    abastecimentos: LinhaHistorico[];
    equipamentos: Equipment[];
    selecionados: string[];
    filtros: { de: string; ate: string };
  }
>(({ abastecimentos, equipamentos, selecionados, filtros }, ref) => {
  const resumos = useMemo<ResumoEquipamento[]>(() => {
    const porId = new Map<string, LinhaHistorico[]>();
    for (const a of abastecimentos) {
      const lista = porId.get(a.equipment_id) || [];
      lista.push(a);
      porId.set(a.equipment_id, lista);
    }

    const ordem = equipamentos
      .filter((e) => porId.has(e.id))
      .map((e) => e.id);
    for (const id of porId.keys()) {
      if (!ordem.includes(id)) ordem.push(id);
    }

    return ordem.map((id) => {
      const linhas = (porId.get(id) || []).slice().sort((a, b) =>
        a.data === b.data ? b.horimetro - a.horimetro : b.data.localeCompare(a.data)
      );
      const eq = equipamentos.find((e) => e.id === id);
      const litros = linhas.reduce((s, l) => s + l.litros, 0);
      let horas = 0;
      let semBaseline = 0;
      for (const l of linhas) {
        if (l.horasDesdeUltimo != null) horas += l.horasDesdeUltimo;
        else semBaseline += 1;
      }
      const valorTotal = linhas.reduce((s, l) => s + (l.valor_total || 0), 0);
      return {
        equipment_id: id,
        fleet_number: linhas[linhas.length - 1]?.fleet_number || eq?.fleet_number || "",
        modelo: eq ? eq.equipment_model || eq.tractor_model || "" : "Equipamento removido",
        linhas,
        litros: Math.round(litros * 100) / 100,
        horas: Math.round(horas * 10) / 10,
        semBaseline,
        mediaLph: horas > 0 ? Math.round((litros / horas) * 100) / 100 : null,
        valorTotal: Math.round(valorTotal * 100) / 100,
      };
    });
  }, [abastecimentos, equipamentos]);

  const totais = useMemo(() => {
    const litros = resumos.reduce((s, r) => s + r.litros, 0);
    const horas = resumos.reduce((s, r) => s + r.horas, 0);
    const valorTotal = resumos.reduce((s, r) => s + r.valorTotal, 0);
    const qtd = resumos.reduce((s, r) => s + r.linhas.length, 0);
    return {
      litros: Math.round(litros * 100) / 100,
      horas: Math.round(horas * 10) / 10,
      valorTotal: Math.round(valorTotal * 100) / 100,
      qtd,
      mediaLph: horas > 0 ? Math.round((litros / horas) * 100) / 100 : null,
    };
  }, [resumos]);

  const equipamentosTexto =
    selecionados.length === equipamentos.length && equipamentos.length > 0
      ? `Todos os equipamentos (${equipamentos.length})`
      : equipamentos
          .filter((e) => selecionados.includes(e.id))
          .map((e) => e.fleet_number)
          .join(", ") || "";

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
          .relatorio-print section { break-inside: auto !important; }
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
        id="relatorio-abastecimento-print"
        className="relatorio-print print-area bg-white text-black p-4 sm:p-6 w-full mx-auto border border-gray-200 shadow-sm"
        style={{ fontSize: "11px", lineHeight: "1.35" }}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b-2 border-black pb-2 mb-3 gap-3">
          <img src="/herbilog_logo.png" alt="HerbiLog" className="h-9 w-auto object-contain" />
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wide text-gray-500 font-semibold">
              HerbiLog — Gestão de Frotas
            </p>
            <p className="text-sm font-bold uppercase leading-tight">
              Relatório de Abastecimento
            </p>
            <p className="text-[10px] text-gray-600">Consumo de combustível por equipamento</p>
          </div>
        </div>

        {/* Filtros aplicados */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 mb-3 border border-gray-300 rounded p-2">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Equipamento(s)</p>
            <p className="font-medium text-[11px] break-words">{equipamentosTexto}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Período</p>
            <p className="font-medium text-[11px]">{periodoTexto(filtros)}</p>
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Gerado em</p>
            <p className="font-medium text-[11px]">{new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>

        {/* Totais gerais */}
        <div className="flex flex-wrap gap-2 mb-3">
          <TotalBloco
            label="Litros"
            valor={`${totais.litros.toLocaleString("pt-BR")} L`}
            sub={`${totais.qtd} abastecimento(s)`}
            destaque
          />
          <TotalBloco
            label="Horas trabalhadas"
            valor={`${totais.horas} h`}
            sub="somatório no período"
          />
          <TotalBloco
            label="Média de gasto"
            valor={totais.mediaLph != null ? `${totais.mediaLph} L/h` : ""}
            sub="litros ÷ horas"
          />
          <TotalBloco
            label="Valor total"
            valor={formatBRL(totais.valorTotal)}
            sub={`${resumos.length} equipamento(s)`}
          />
        </div>

        {/* Seções por equipamento */}
        {resumos.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded p-6 text-center text-gray-500 text-[11px]">
            Nenhum abastecimento para os equipamentos e período selecionados.
          </div>
        ) : (
          resumos.map((r) => (
            <section key={r.equipment_id} className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border border-gray-400 bg-gray-100 rounded px-2 py-1.5 mb-1.5">
                <p className="font-bold text-[11px] uppercase">
                  {r.fleet_number}  {r.modelo}
                </p>
                <p className="text-[10px] font-medium">
                  {r.linhas.length} registro(s) · {r.litros.toLocaleString("pt-BR")} L ·{" "}
                  {r.horas} h ·{" "}
                  <span className="font-bold">
                    {r.mediaLph != null ? `${r.mediaLph} L/h` : "média —"}
                  </span>{" "}
                  · {formatBRL(r.valorTotal)}
                  {r.semBaseline > 0 && (
                    <span className="text-gray-500">
                      {" "}
                      ({r.semBaseline} sem base de horas)
                    </span>
                  )}
                </p>
              </div>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">Data</th>
                    <th className="border border-gray-400 px-1.5 py-1 text-right font-bold">
                      Horímetro
                    </th>
                    <th className="border border-gray-400 px-1.5 py-1 text-right font-bold">
                      Litros
                    </th>
                    <th className="border border-gray-400 px-1.5 py-1 text-right font-bold">
                      Horas desde o último
                    </th>
                    <th className="border border-gray-400 px-1.5 py-1 text-right font-bold">
                      Gasto/hora
                    </th>
                    <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">
                      Tipo
                    </th>
                    <th className="border border-gray-400 px-1.5 py-1 text-right font-bold">
                      Valor
                    </th>
                    <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">
                      Posto
                    </th>
                    <th className="border border-gray-400 px-1.5 py-1 text-left font-bold">
                      OS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {r.linhas.map((l) => (
                    <tr key={l.id}>
                      <td className="border border-gray-400 px-1.5 py-1 whitespace-nowrap">
                        {fmtData(l.data)}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                        {l.horimetro} h
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                        {l.litros.toLocaleString("pt-BR")} L
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                        {l.horasDesdeUltimo != null ? `${l.horasDesdeUltimo} h` : ""}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                        {l.consumoLph != null ? `${l.consumoLph} L/h` : ""}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1 whitespace-nowrap">
                        {l.tipo_combustivel || ""}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1 text-right font-mono whitespace-nowrap">
                        {l.valor_total > 0 ? formatBRL(l.valor_total) : ""}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1">
                        {l.posto_fornecedor || ""}
                      </td>
                      <td className="border border-gray-400 px-1.5 py-1 font-mono whitespace-nowrap">
                        {l.os_id || ""}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border border-gray-400 px-1.5 py-1" colSpan={2}>
                      Subtotal
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                      {r.litros.toLocaleString("pt-BR")} L
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                      {r.horas} h
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
                      {r.mediaLph != null ? `${r.mediaLph} L/h` : ""}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1" colSpan={2}>
                      {formatBRL(r.valorTotal)}
                    </td>
                    <td className="border border-gray-400 px-1.5 py-1" colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </section>
          ))
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
          <p className="text-[8px] text-gray-400">Relatório de Abastecimento — Gestão de Frotas</p>
        </div>
      </div>
    </>
  );
});

RelatorioAbastecimento.displayName = "RelatorioAbastecimento";
