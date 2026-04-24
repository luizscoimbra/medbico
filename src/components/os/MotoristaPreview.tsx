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
              const concentracao = volumeCaldaHa > 0 ? dose / volumeCaldaHa : 0;
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
        };
      });
  }, [apontamentos, os.talhoes, volumeCaldaHa, tratoresSelecionados]);

  // Aggregated data for the selected tractors
  const aggregateData = useMemo(() => {
    let totalArea = 0;
    const produtoMap = new Map<string, { unit: string; packageSize: number; totalAplicado: number }>();

    enrichedApontamentos.forEach((c) => {
      totalArea += c.areaAplicada;

      const equipment = equipments.find(e => e.fleet_number === c.tratorFrota);
      const tankCapacity = equipment?.tank_capacity || 0;
      
      const hectaresMixed = volumeCaldaHa > 0 
        ? ((c.bombasCheias * tankCapacity) + c.cargaParcial) / volumeCaldaHa 
        : 0;

      c.produtosCalc.forEach((pc) => {
        const existing = produtoMap.get(pc.produto);
        const amountMixed = pc.dose * hectaresMixed;

        if (existing) {
          existing.totalAplicado += amountMixed;
        } else {
          produtoMap.set(pc.produto, { 
            unit: pc.unit, 
            packageSize: pc.packageSize,
            totalAplicado: amountMixed 
          });
        }
      });
    });

    return { totalArea, produtoMap };
  }, [enrichedApontamentos, equipments, volumeCaldaHa]);

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto print-area" id="motorista-print">
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
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Propriedade</p>
          <p className="font-medium">{os.propriedade}</p>
        </div>
        <div className="border border-gray-300 rounded p-3">
          <p className="text-xs text-gray-500 uppercase font-semibold">Tratores Selecionados</p>
          <p className="font-medium">{tratoresSelecionados.join(", ")}</p>
        </div>
      </div>

      {/* Relatório de Embalagens */}
      <div className="mb-8 border border-gray-300 rounded overflow-hidden break-inside-avoid">
        <div className="bg-gray-100 p-3 border-b border-gray-300 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold uppercase text-gray-800">Resumo de Aplicação</h2>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Área Total Aplicada</p>
            <p className="text-sm font-bold text-green-700">{aggregateData.totalArea.toFixed(2)} ha</p>
          </div>
        </div>

        {aggregateData.produtoMap.size > 0 ? (
          <div className="p-4">
            <div className="break-inside-avoid">
              <p className="text-sm font-bold text-gray-700 uppercase mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full" />
                Produtos Utilizados (Fechamento Embalagem)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from(aggregateData.produtoMap.entries()).map(([nome, val], pIdx) => {
                  const roundedTotal = Math.round(val.totalAplicado * 2) / 2;
                  const totalPackages = val.packageSize > 0 ? Math.ceil(roundedTotal / val.packageSize) : 0;
                  const packageLabel = val.unit === "KG" ? "Pacote(s)" : "Galão(ões)";
                  
                  // Calculate remainder in the opened package
                  let partialLeftover = 0;
                  if (val.packageSize > 0) {
                    const remainder = roundedTotal % val.packageSize;
                    // Ensure we don't show leftovers for perfectly divisible amounts (handling small float precision issues)
                    if (remainder > 0.05 && (val.packageSize - remainder) > 0.05) {
                      partialLeftover = val.packageSize - remainder;
                    }
                  }
                  
                  return (
                    <div key={pIdx} className="bg-amber-50/50 border border-amber-200 rounded p-4 flex flex-col justify-center items-center text-center">
                      <span className="text-sm text-amber-800 uppercase font-bold mb-2">{nome}</span>
                      <div className="flex flex-col items-center">
                        <div className="text-2xl font-black text-amber-900 leading-tight">
                          {roundedTotal.toFixed(1).replace('.0', '')} <span className="text-xs font-bold uppercase">{val.unit}</span>
                        </div>
                        <div className="text-xl font-bold text-amber-700 leading-tight mt-1">
                          {totalPackages} <span className="text-xs font-medium uppercase">{packageLabel}</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-600/70 mt-2 block">
                        (Embalagem: {val.packageSize}{val.unit})
                      </span>
                      {partialLeftover > 0 && (
                        <div className="mt-2 pt-2 border-t border-amber-200/50 w-full text-center">
                          <span className="text-xs font-bold text-red-600 block">
                            Sobra na Embalagem Aberta:
                          </span>
                          <span className="text-sm font-black text-red-700">
                            {partialLeftover.toFixed(1)} {val.unit}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Nenhum produto aplicado pelos tratores selecionados até o momento.
          </div>
        )}
      </div>

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
