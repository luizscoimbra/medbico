import { forwardRef } from "react";
import type { OrdemServico } from "@/lib/osStorage";
import { MOTIVO_PARADA_LABELS } from "@/lib/osStorage";

interface Props {
  os: OrdemServico;
}

export const OSApontamentoPreview = forwardRef<HTMLDivElement, Props>(({ os }, ref) => {
  const volumeCaldaHa = parseFloat(os.volumeCaldaHa || "0") || 0;
  const apontamentos = os.apontamentos || [];

  const enrichedApontamentos = apontamentos.map((ap, apIdx) => {
    const t = os.talhoes[ap.talhaoIndex];
    const areaPlanejada = parseFloat(t.area) || 0;
    const areaAplicada = parseFloat(ap.areaAplicada || "0") || 0;
    const caldaRestante = parseFloat(ap.caldaRestante || "0") || 0;
    
    const produtosCalc = t.testemunho
      ? []
      : t.produtos.map((p) => {
          const dose = parseFloat(p.dose) || 0;
          const concentracao = volumeCaldaHa > 0 ? dose / volumeCaldaHa : 0;
          const produtoRestante = caldaRestante * concentracao;
          const totalPlanejado = dose * areaPlanejada;
          return {
            produto: p.produto,
            dose,
            unit: p.unit || "L",
            packageSize: p.packageSize || 0,
            totalPlanejado,
            produtoRestante,
          };
        });

    return {
      nome: t.nome || `T-${ap.talhaoIndex + 1}`,
      areaPlanejada,
      areaAplicada,
      caldaRestante,
      observacoes: ap.observacoes || "",
      dataApontamento: ap.dataApontamento || "",
      horaRegistro: ap.horaRegistro || "",
      produtosCalc,
      testemunho: t.testemunho,
      tratorFrota: ap.tratorFrota || "Não Informado",
      aplicador: ap.aplicador || "Não Informado",
      bombasCheias: parseInt(ap.bombasCheias || "0", 10) || 0,
      cargaParcial: parseFloat(ap.cargaParcial || "0") || 0,
      statusRegistro: ap.statusRegistro,
      motivoParada: ap.motivoParada,
      motivoParadaDetalhe: ap.motivoParadaDetalhe,
      registroAnteriorIdx: ap.registroAnteriorIdx,
      equipamentoOrigem: ap.equipamentoOrigem,
    };
  });

  const calculos = enrichedApontamentos;

  // Agrupar apontamentos por trator
  const agrupadoPorTrator = Array.from(
    calculos.reduce((acc, c) => {
      const key = c.tratorFrota;
      if (!acc.has(key)) acc.set(key, { aplicador: c.aplicador, talhoes: [], bombasCheias: 0, cargaParcial: 0, caldaRestante: 0, produtoMap: new Map() });
      const group = acc.get(key)!;
      group.talhoes.push(c);
      group.bombasCheias += c.bombasCheias;
      group.cargaParcial += c.cargaParcial;
      group.caldaRestante += c.caldaRestante;
      if (c.aplicador !== "Não Informado" && group.aplicador === "Não Informado") group.aplicador = c.aplicador;
      
      c.produtosCalc.forEach((pc) => {
        const pMap = group.produtoMap;
        const existing = pMap.get(pc.produto);
        if (existing) {
          existing.totalAplicado += (pc.dose * c.areaAplicada);
        } else {
          pMap.set(pc.produto, { 
            unit: pc.unit, 
            packageSize: pc.packageSize,
            totalAplicado: (pc.dose * c.areaAplicada) 
          });
        }
      });
      return acc;
    }, new Map<string, { aplicador: string; talhoes: typeof calculos; bombasCheias: number; cargaParcial: number; caldaRestante: number; produtoMap: Map<string, { unit: string; packageSize: number; totalAplicado: number }> }>())
  );

  const statusLabel = os.status === "concluida" ? "CONCLUÍDA" : os.status === "em_andamento" ? "EM ANDAMENTO" : "ABERTA";
  const statusColor = os.status === "concluida" ? "bg-green-100 text-green-800" : os.status === "em_andamento" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-800";

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto print-area" id="apontamento-print">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center">
          <img src="/herbilog_logo.png" alt="HerbiLog" className="h-12 w-auto object-contain" />
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
        const uniqueTalhoes = new Set(dados.talhoes.map(t => t.nome)).size;

        return (
          <div key={idx} className="mb-8 border border-gray-300 rounded overflow-hidden" style={{ breakInside: "avoid" }}>
            <div className="bg-gray-100 p-3 border-b border-gray-300 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold uppercase text-gray-800">Trator/Frota: {trator}</h2>
                <p className="text-xs text-gray-600">Operador: <span className="font-semibold">{dados.aplicador}</span></p>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Talhões</p>
                  <p className="text-sm font-bold text-gray-800">{uniqueTalhoes}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">Área Total</p>
                  <p className="text-sm font-bold text-green-700">{areaAplicadaTrator.toFixed(2)} ha</p>
                </div>
              </div>
            </div>

            <div className="p-0">
              <table className="w-full border-collapse text-sm mb-4">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border-b border-gray-200 px-3 py-2 text-left text-xs text-gray-500">Talhão / Histórico</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right text-xs text-gray-500">Área Aplicada</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right text-xs text-gray-500">Bombas</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right text-xs text-gray-500">Parcial (L)</th>
                    <th className="border-b border-gray-200 px-3 py-2 text-right text-xs text-gray-500">Sobra (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.talhoes.map((t, i) => (
                    <tr key={i} className={`${t.testemunho ? "bg-yellow-50/50 text-gray-400" : ""} ${t.statusRegistro === "interrompido" ? "bg-red-50/30" : ""}`}>
                      <td className="border-b border-gray-100 px-3 py-2">
                        <div className="font-medium">{t.nome}</div>
                        {t.statusRegistro === "interrompido" && (
                          <div className="text-[10px] text-red-600 font-bold uppercase mt-1">
                            ⚠ INTERROMPIDO: {t.motivoParada ? MOTIVO_PARADA_LABELS[t.motivoParada] : "Desconhecido"}
                          </div>
                        )}
                        {t.registroAnteriorIdx !== undefined && (
                          <div className="text-[10px] text-blue-600 font-bold mt-1 flex items-center gap-1">
                            ↪ RECEBIDO: Cont. do Reg #{t.registroAnteriorIdx + 1} 
                            {t.equipamentoOrigem && <span className="font-normal italic"> (Origem: {t.equipamentoOrigem})</span>}
                          </div>
                        )}
                        {t.observacoes && (
                          <div className="text-[10px] text-gray-500 mt-1 italic border-l-2 border-gray-200 pl-2 py-0.5">
                            {t.observacoes}
                          </div>
                        )}
                      </td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">{t.testemunho ? "—" : t.areaAplicada.toFixed(2)} ha</td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">{t.testemunho ? "—" : t.bombasCheias}</td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right">{t.testemunho ? "—" : (t.cargaParcial > 0 ? t.cargaParcial.toFixed(0) : "—")}</td>
                      <td className="border-b border-gray-100 px-3 py-2 text-right font-bold text-gray-700">{t.testemunho ? "—" : t.caldaRestante.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t border-gray-300">
                    <td className="px-3 py-2 text-right text-xs text-gray-600 uppercase">Totais Trator {trator}:</td>
                    <td className="px-3 py-2 text-right text-green-700">{areaAplicadaTrator.toFixed(2)} ha</td>
                    <td className="px-3 py-2 text-right">{dados.bombasCheias}</td>
                    <td className="px-3 py-2 text-right">{dados.cargaParcial > 0 ? `${dados.cargaParcial.toFixed(0)}` : "—"}</td>
                    <td className="px-3 py-2 text-right font-bold">{dados.caldaRestante.toFixed(1)} L</td>
                  </tr>
                </tfoot>
              </table>

              {dados.produtoMap.size > 0 && (
                <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    Resumo de Insumos (Trator {trator})
                  </p>
                  <div className="flex flex-col gap-2 bg-gray-50/80 rounded p-3 border border-gray-200">
                    {Array.from(dados.produtoMap.entries()).map(([nome, val], pIdx) => {
                      const packages = val.packageSize > 0 ? val.totalAplicado / val.packageSize : 0;
                      const packageLabel = val.unit === "KG" ? "Pacotes" : "Galões";
                      
                      return (
                        <div key={pIdx} className="grid grid-cols-2 gap-4 border-b border-gray-200/50 pb-2 last:border-0 last:pb-0">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800">{nome}</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-tight">Utilizado nesta aplicação</span>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-primary">{val.totalAplicado.toFixed(2)} {val.unit}</div>
                            {packages > 0 && (
                              <div className="text-[11px] font-medium text-amber-700 flex items-center justify-end gap-1">
                                📦 {packages.toFixed(2)} {packageLabel} <span className="text-[9px] text-gray-400 font-normal">({val.packageSize}{val.unit}/un)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
        Relatório de Apontamento gerado por HerbiLog em {new Date().toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
});

OSApontamentoPreview.displayName = "OSApontamentoPreview";
