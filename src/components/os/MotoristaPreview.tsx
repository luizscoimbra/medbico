import { forwardRef, useState, useEffect, useMemo } from "react";
import type { OrdemServico } from "@/lib/osStorage";
import { getAllEquipments, Equipment } from "@/lib/equipmentStorage";

interface Props {
  os: OrdemServico;
  tratoresSelecionados: string[];
  equipments?: Equipment[];
}

export const MotoristaPreview = forwardRef<HTMLDivElement, Props>(({ os, tratoresSelecionados, equipments: propsEquipments }, ref) => {
  const [internalEquipments, setInternalEquipments] = useState<Equipment[]>([]);
  const volumeCaldaHa = parseFloat(os.volumeCaldaHa || "0") || 0;
  const apontamentos = os.apontamentos || [];

  useEffect(() => {
    if (!propsEquipments) {
      getAllEquipments().then(setInternalEquipments);
    }
  }, [propsEquipments]);

  const equipments = propsEquipments || internalEquipments;

  const enrichedApontamentos = useMemo(() => {
    return apontamentos
      .filter(ap => tratoresSelecionados.includes(ap.tratorFrota || ""))
      .map((ap) => {
        const t = os.talhoes[ap.talhaoIndex];
        const areaPlanejada = parseFloat(t.area) || 0;
        const areaAplicada = parseFloat(ap.areaAplicada || "0") || 0;
        const caldaRestante = parseFloat(ap.caldaRestante || "0") || 0;
        
        const produtosBase = ap.produtosSubstitutos && ap.produtosSubstitutos.length > 0 ? ap.produtosSubstitutos : t.produtos;
        
        const produtosCalc = t.testemunho
          ? []
          : produtosBase.map((p) => {
              const dose = parseFloat(p.dose) || 0;
              const totalPlanejado = dose * areaPlanejada;
              return {
                produto: p.produto,
                dose,
                unit: p.unit || "L",
                packageSize: p.packageSize || 0,
                totalPlanejado,
              };
            });

        return {
          nome: t.nome || `T-${ap.talhaoIndex + 1}`,
          areaAplicada,
          produtosCalc,
          tratorFrota: ap.tratorFrota || "Não Informado",
          bombasCheias: parseInt(ap.bombasCheias || "0", 10) || 0,
          cargaParcial: parseFloat(ap.cargaParcial || "0") || 0,
          caldaRestante,
        };
      });
  }, [apontamentos, os.talhoes, volumeCaldaHa, tratoresSelecionados]);

  // Aggregated data for the selected tractors
  const aggregateData = useMemo(() => {
    const tractorData = new Map<string, {
      tankCapacity: number;
      totalArea: number;
      bombasCheias: number;
      bombasParciaisCount: number;
      caldaRestanteTotal: number;
      produtoMap: Map<string, { 
        unit: string; 
        packageSize: number; 
        totalAplicado: number;
        dose: number;
      }>;
    }>();

    let globalTotalArea = 0;

    enrichedApontamentos.forEach((c) => {
      globalTotalArea += c.areaAplicada;

      const equipment = equipments.find(e => e.fleet_number === c.tratorFrota);
      const tankCapacity = equipment?.tank_capacity || 0;
      
      if (!tractorData.has(c.tratorFrota)) {
         tractorData.set(c.tratorFrota, {
            tankCapacity,
            totalArea: 0,
            bombasCheias: 0,
            bombasParciaisCount: 0,
            caldaRestanteTotal: 0,
            produtoMap: new Map()
         });
      }

      const tData = tractorData.get(c.tratorFrota)!;
      tData.totalArea += c.areaAplicada;
      tData.bombasCheias += c.bombasCheias;
      if (c.cargaParcial > 0) tData.bombasParciaisCount += 1;
      tData.caldaRestanteTotal += c.caldaRestante;

      const hectaresMixed = volumeCaldaHa > 0 
        ? ((c.bombasCheias * tankCapacity) + c.cargaParcial) / volumeCaldaHa 
        : 0;

      c.produtosCalc.forEach((pc) => {
        const existing = tData.produtoMap.get(pc.produto);
        const amountMixed = pc.dose * hectaresMixed;

        if (existing) {
          existing.totalAplicado += amountMixed;
        } else {
          tData.produtoMap.set(pc.produto, { 
            unit: pc.unit, 
            packageSize: pc.packageSize,
            totalAplicado: amountMixed,
            dose: pc.dose
          });
        }
      });
    });

    return { tractorData, globalTotalArea };
  }, [enrichedApontamentos, equipments, volumeCaldaHa]);

  return (
    <div ref={ref} className="bg-white text-black p-4 sm:p-8 w-full lg:max-w-[210mm] mx-auto print-area" id="motorista-print">
      <style>{`
        @media print {
          .print-area {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center">
          <img src="/herbilog_logo.png" alt="HerbiLog" className="h-12 w-auto object-contain" />
        </div>
        <div className="text-right">
          <p className="text-lg font-bold font-mono">OS nº {os.id}</p>
          <span className="inline-block text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
            FECHAMENTO MOTORISTA
          </span>
        </div>
      </div>

      {/* Dados da Propriedade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Propriedade</p>
          <p className="font-medium">{os.propriedade}</p>
        </div>
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Tratores Selecionados</p>
          <p className="font-medium">{tratoresSelecionados.join(", ")}</p>
        </div>
      </div>

      {/* Relatório por Trator */}
      {aggregateData.tractorData.size > 0 ? (
        Array.from(aggregateData.tractorData.entries()).map(([frota, tData], tIdx) => (
          <div key={tIdx} className="mb-8 border border-gray-300 rounded overflow-hidden break-inside-avoid bg-white">
            <div className="bg-slate-800 p-4 border-b border-gray-300 flex justify-between items-center text-white">
              <div>
                <h2 className="text-lg font-bold uppercase">Trator: {frota}</h2>
                <p className="text-sm text-slate-300 font-medium">Capacidade do Tanque: {tData.tankCapacity} L</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-400">Área Aplicada</p>
                <p className="text-lg font-bold text-emerald-400">{tData.totalArea.toFixed(2)} ha</p>
              </div>
            </div>

            {/* Resumo de Bombas */}
            <div className="p-4 bg-slate-50 border-b border-gray-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Bombas Cheias</p>
                <p className="text-2xl font-black text-blue-600">{tData.bombasCheias}</p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Bombas Parciais</p>
                <p className="text-2xl font-black text-orange-500">{tData.bombasParciaisCount}</p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Dosadas</p>
                <p className="text-2xl font-black text-purple-600">{tData.bombasCheias + tData.bombasParciaisCount}</p>
              </div>
              <div className="bg-white p-3 rounded shadow-sm border border-gray-100">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Volume de Calda Restante</p>
                <p className="text-2xl font-black text-red-500">{tData.caldaRestanteTotal.toFixed(0)} <span className="text-sm">L</span></p>
              </div>
            </div>

            {/* Consumo de Produtos */}
            {tData.produtoMap.size > 0 && (
              <div className="p-5">
                <p className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                  Consumo de Produtos
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from(tData.produtoMap.entries()).map(([nome, val], pIdx) => {
                    const consumoBombaCheia = volumeCaldaHa > 0 ? val.dose * (tData.tankCapacity / volumeCaldaHa) : 0;
                    const sobraProduto = volumeCaldaHa > 0 ? (tData.caldaRestanteTotal * val.dose) / volumeCaldaHa : 0;
                    
                    const roundedTotal = Math.round(val.totalAplicado * 2) / 2;
                    const totalPackages = val.packageSize > 0 ? Math.ceil(roundedTotal / val.packageSize) : 0;
                    const packageLabel = val.unit === "KG" ? "Pct" : "Gal";

                    return (
                      <div key={pIdx} className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
                        <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                          <span className="text-sm text-gray-800 font-bold uppercase truncate block">{nome}</span>
                        </div>
                        
                        <div className="p-3 flex flex-col gap-2 flex-grow">
                          <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded">
                            <span className="text-xs text-gray-600 font-medium">Por Bomba Cheia:</span>
                            <span className="font-bold text-blue-700">{consumoBombaCheia.toFixed(2)} {val.unit}</span>
                          </div>
                          
                          <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span className="text-xs text-gray-600 font-medium">Total Utilizado:</span>
                            <span className="font-bold text-gray-900">{val.totalAplicado.toFixed(2)} {val.unit}</span>
                          </div>

                          <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span className="text-xs text-gray-600 font-medium">Embalagens ({val.packageSize}{val.unit}):</span>
                            <span className="font-bold text-gray-900">{totalPackages} {packageLabel}</span>
                          </div>

                          {sobraProduto > 0 && (
                            <div className="mt-auto pt-2 border-t border-red-100">
                              <div className="flex justify-between items-center bg-red-50 p-2 rounded border border-red-100">
                                <span className="text-xs font-bold text-red-600">Sobra (Ñ Finalizada):</span>
                                <span className="font-black text-red-700">{sobraProduto.toFixed(2)} {val.unit}</span>
                              </div>
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
        ))
      ) : (
        <div className="p-8 text-center text-gray-500 border border-gray-300 rounded">
          Nenhum produto aplicado pelos tratores selecionados até o momento.
        </div>
      )}

      <div className="mt-16 text-center border-t border-black pt-2 max-w-xs mx-auto break-inside-avoid">
        <p className="text-sm font-medium">Assinatura do Motorista/Aplicador</p>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-8 mb-4">
        Fechamento de Embalagem gerado por HerbiLog em {new Date().toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
});

MotoristaPreview.displayName = "MotoristaPreview";

