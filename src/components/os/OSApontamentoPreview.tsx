import { forwardRef } from "react";
import type { OrdemServico } from "@/lib/osStorage";
import { Droplets } from "lucide-react";

interface Props {
  os: OrdemServico;
}

export const OSApontamentoPreview = forwardRef<HTMLDivElement, Props>(({ os }, ref) => {
  const volumeCaldaHa = parseFloat(os.volumeCaldaHa || "0") || 0;
  const apontamentos = os.apontamentos || [];

  const calculos = os.talhoes.map((t, i) => {
    const ap = apontamentos[i];
    const areaPlanejada = parseFloat(t.area) || 0;
    const areaAplicada = parseFloat(ap?.areaAplicada || "0") || 0;
    const caldaRestante = parseFloat(ap?.caldaRestante || "0") || 0;
    const areaFaltante = Math.max(0, areaPlanejada - areaAplicada);

    const produtosCalc = t.testemunho
      ? []
      : t.produtos.map((p) => {
          const dose = parseFloat(p.dose) || 0;
          const concentracao = volumeCaldaHa > 0 ? dose / volumeCaldaHa : 0;
          const produtoRestante = caldaRestante * concentracao;
          const produtoParaFinalizar = dose * areaFaltante;
          const totalPlanejado = dose * areaPlanejada;
          return {
            produto: p.produto,
            dose,
            unit: p.unit || "L",
            totalPlanejado,
            produtoRestante,
            produtoParaFinalizar,
          };
        });

    return {
      nome: t.nome || `T-${i + 1}`,
      areaPlanejada,
      areaAplicada,
      areaFaltante,
      caldaRestante,
      observacoes: ap?.observacoes || "",
      dataApontamento: ap?.dataApontamento || "",
      produtosCalc,
      testemunho: t.testemunho,
      tratorFrota: ap?.tratorFrota || "Não Informado",
      aplicador: ap?.aplicador || "Não Informado",
      bombasCheias: parseInt(ap?.bombasCheias || "0", 10) || 0,
    };
  });

  // Agrupar apontamentos por trator
  const agrupadoPorTrator = Array.from(
    calculos.reduce((acc, c) => {
      const key = c.tratorFrota;
      if (!acc.has(key)) acc.set(key, { aplicador: c.aplicador, talhoes: [], bombasCheias: 0, caldaRestante: 0, produtoMap: new Map() });
      const group = acc.get(key)!;
      group.talhoes.push(c);
      group.bombasCheias += c.bombasCheias;
      group.caldaRestante += c.caldaRestante;
      if (c.aplicador !== "Não Informado" && group.aplicador === "Não Informado") group.aplicador = c.aplicador;
      
      c.produtosCalc.forEach((pc) => {
        const pMap = group.produtoMap;
        const existing = pMap.get(pc.produto);
        if (existing) {
          existing.totalAplicado += (pc.dose * c.areaAplicada);
        } else {
          pMap.set(pc.produto, { unit: pc.unit, totalAplicado: (pc.dose * c.areaAplicada) });
        }
      });
      return acc;
    }, new Map<string, { aplicador: string; talhoes: typeof calculos; bombasCheias: number; caldaRestante: number; produtoMap: Map<string, { unit: string; totalAplicado: number }> }>())
  );

  const statusLabel = os.status === "concluida" ? "CONCLUÍDA" : os.status === "em_andamento" ? "EM ANDAMENTO" : "ABERTA";
  const statusColor = os.status === "concluida" ? "bg-green-100 text-green-800" : os.status === "em_andamento" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800";

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto print-area" id="apontamento-print">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-700 text-white flex items-center justify-center">
            <Droplets className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">SprayCheck</h1>
            <p className="text-xs text-gray-600">Relatório de Apontamento</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold font-mono">OS nº {os.id}</p>
          <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${statusColor}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Dados da Propriedade */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Propriedade</p>
          <p className="font-medium">{os.propriedade}</p>
        </div>
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Código da Área</p>
          <p className="font-medium">{os.codigoArea}</p>
        </div>
        <div className="border border-gray-300 rounded p-3 col-span-2">
          <p className="text-xs text-gray-500 uppercase font-semibold">Responsável Técnico</p>
          <p className="font-medium">{os.responsavelTecnico}</p>
        </div>
      </div>

      {/* Relatório Agrupado por Trator */}
      {agrupadoPorTrator.map(([trator, dados], idx) => {
        const areaAplicadaTrator = dados.talhoes.reduce((sum, t) => sum + t.areaAplicada, 0);

        return (
          <div key={idx} className="mb-8 border border-gray-300 rounded overflow-hidden" style={{ breakInside: "avoid" }}>
            <div className="bg-gray-100 p-3 border-b border-gray-300 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold uppercase text-gray-800">Trator/Frota: {trator}</h2>
                <p className="text-xs text-gray-600">Operador: <span className="font-semibold">{dados.aplicador}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600">Área Aplicada Total</p>
                <p className="text-sm font-bold text-green-700">{areaAplicadaTrator.toFixed(2)} ha</p>
              </div>
            </div>

            <div className="p-0">
              <table className="w-full border-collapse text-sm mb-4">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-3 py-2 text-left text-xs text-gray-500">Talhão</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right text-xs text-gray-500">Área Aplicada</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right text-xs text-gray-500">Bombas Cheias</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right text-xs text-gray-500">Sobra (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.talhoes.map((t, i) => (
                    <tr key={i} className={t.testemunho ? "bg-yellow-50/50 text-gray-400" : ""}>
                      <td className="border-b border-gray-100 px-3 py-2">{t.nome}</td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">{t.testemunho ? "—" : t.areaAplicada.toFixed(2)} ha</td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">{t.testemunho ? "—" : t.bombasCheias}</td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">{t.testemunho ? "—" : t.caldaRestante.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t border-gray-300">
                    <td className="px-3 py-2 text-right text-xs text-gray-600">TOTAIS DESTE TRATOR:</td>
                    <td className="px-3 py-2 text-right text-green-700">{areaAplicadaTrator.toFixed(2)} ha</td>
                    <td className="px-3 py-2 text-right">{dados.bombasCheias}</td>
                    <td className="px-3 py-2 text-right">{dados.caldaRestante.toFixed(1)} L</td>
                  </tr>
                </tfoot>
              </table>

              {dados.produtoMap.size > 0 && (
                <div className="px-3 pb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Produtos Utilizados</p>
                  <div className="grid grid-cols-2 gap-2 text-sm border border-gray-200 rounded p-2 bg-gray-50">
                    {Array.from(dados.produtoMap.entries()).map(([nome, val], pIdx) => (
                      <div key={pIdx} className="flex justify-between border-b border-gray-200 pb-1 last:border-0 last:pb-0">
                        <span>{nome}</span>
                        <span className="font-semibold text-gray-800">{val.totalAplicado.toFixed(2)} {val.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Assinaturas */}
      <div className="grid grid-cols-1 gap-12 mt-16 max-w-sm mx-auto">
        <div className="text-center">
          <div className="border-t border-black pt-2">
            <p className="text-sm font-medium">Responsável Técnico</p>
            <p className="text-xs text-gray-500">{os.responsavelTecnico}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-8 mb-4">
        Relatório de Apontamento gerado por SprayCheck em {new Date().toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
});

OSApontamentoPreview.displayName = "OSApontamentoPreview";
