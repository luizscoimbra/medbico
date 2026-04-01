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
    };
  });

  const totalAreaPlanejada = calculos.reduce((s, c) => s + c.areaPlanejada, 0);
  const totalAreaAplicada = calculos.reduce((s, c) => s + c.areaAplicada, 0);
  const totalAreaFaltante = calculos.reduce((s, c) => s + c.areaFaltante, 0);

  // Aggregate products
  const produtoMap = new Map<string, { unit: string; totalPlanejado: number; restante: number; paraFinalizar: number }>();
  calculos.forEach((c) => {
    c.produtosCalc.forEach((pc) => {
      const existing = produtoMap.get(pc.produto);
      if (existing) {
        existing.totalPlanejado += pc.totalPlanejado;
        existing.restante += pc.produtoRestante;
        existing.paraFinalizar += pc.produtoParaFinalizar;
      } else {
        produtoMap.set(pc.produto, {
          unit: pc.unit,
          totalPlanejado: pc.totalPlanejado,
          restante: pc.produtoRestante,
          paraFinalizar: pc.produtoParaFinalizar,
        });
      }
    });
  });

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
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Responsável Técnico</p>
          <p className="font-medium">{os.responsavelTecnico}</p>
        </div>
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Aplicador</p>
          <p className="font-medium">{os.aplicador}</p>
        </div>
      </div>

      {/* Tabela de Apontamento por Talhão */}
      <div className="mb-6" style={{ breakInside: "avoid" }}>
        <h2 className="text-sm font-bold uppercase mb-2 text-gray-700">Apontamento por Talhão</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-2 text-left">Talhão</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Planejada (ha)</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Aplicada (ha)</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Faltante (ha)</th>
              <th className="border border-gray-300 px-2 py-2 text-right">Calda Rest. (L)</th>
              <th className="border border-gray-300 px-2 py-2 text-left">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {calculos.map((c, i) => (
              <tr key={i} className={c.testemunho ? "bg-yellow-50" : ""}>
                <td className="border border-gray-300 px-2 py-2">{c.nome}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{c.areaPlanejada.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{c.testemunho ? "—" : c.areaAplicada.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{c.testemunho ? "—" : c.areaFaltante.toFixed(2)}</td>
                <td className="border border-gray-300 px-2 py-2 text-right">{c.testemunho ? "—" : c.caldaRestante.toFixed(1)}</td>
                <td className="border border-gray-300 px-2 py-2 text-xs">{c.testemunho ? "Testemunho" : c.observacoes || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-gray-50">
              <td className="border border-gray-300 px-2 py-2">TOTAL</td>
              <td className="border border-gray-300 px-2 py-2 text-right">{totalAreaPlanejada.toFixed(2)}</td>
              <td className="border border-gray-300 px-2 py-2 text-right">{totalAreaAplicada.toFixed(2)}</td>
              <td className="border border-gray-300 px-2 py-2 text-right">{totalAreaFaltante.toFixed(2)}</td>
              <td colSpan={2} className="border border-gray-300 px-2 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Tabela de Produtos */}
      {produtoMap.size > 0 && (
        <div className="mb-6" style={{ breakInside: "avoid" }}>
          <h2 className="text-sm font-bold uppercase mb-2 text-gray-700">Balanço de Produtos</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-50">
                <th className="border border-gray-300 px-2 py-2 text-left">Produto</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Total Planejado</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Restante na Bomba</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Necessário p/ Finalizar</th>
                <th className="border border-gray-300 px-2 py-2 text-center">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(produtoMap.entries()).map(([nome, v], idx) => (
                <tr key={idx}>
                  <td className="border border-gray-300 px-2 py-2">{nome}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right">{v.totalPlanejado.toFixed(2)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right">{v.restante.toFixed(2)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right font-semibold">{v.paraFinalizar.toFixed(2)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center">{v.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assinaturas */}
      <div className="grid grid-cols-2 gap-12 mt-16">
        <div className="text-center">
          <div className="border-t border-black pt-2">
            <p className="text-sm font-medium">Responsável Técnico</p>
            <p className="text-xs text-gray-500">{os.responsavelTecnico}</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-black pt-2">
            <p className="text-sm font-medium">Aplicador</p>
            <p className="text-xs text-gray-500">{os.aplicador}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-8">
        Relatório de Apontamento gerado por SprayCheck em {new Date().toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
});

OSApontamentoPreview.displayName = "OSApontamentoPreview";
