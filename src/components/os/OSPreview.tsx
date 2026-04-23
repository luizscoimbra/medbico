import { forwardRef, useMemo } from "react";
import type { OrdemServico } from "@/lib/osStorage";
import { MapPin } from "lucide-react";

interface OSPreviewProps {
  os: OrdemServico;
}

interface InsumoResumo {
  produto: string;
  totalNecessario: number;
  unit: string;
  packageSize: number;
  qtdEmbalagens: number;
}

export const OSPreview = forwardRef<HTMLDivElement, OSPreviewProps>(({ os }, ref) => {
  const areaTotal = os.talhoes.reduce((sum, t) => sum + (parseFloat(t.area) || 0), 0);

  const resumoInsumos = useMemo(() => {
    const map = new Map<string, { total: number; unit: string; packageSize: number }>();
    os.talhoes.forEach((t) => {
      const totalArea = parseFloat(t.area) || 0;
      let appliedArea = totalArea;
      if (t.testemunho) {
        if (t.testemunhoArea) {
          appliedArea = Math.max(0, totalArea - (parseFloat(t.testemunhoArea) / 10000));
        } else {
          appliedArea = 0; // se marcou mas deixou vazio, assume testemunho total
        }
      }

      if (appliedArea <= 0) return;

      t.produtos.forEach((p) => {
        if (!p.produto || !p.dose) return;
        const dose = parseFloat(p.dose) || 0;
        const key = p.produto;
        const existing = map.get(key);
        if (existing) {
          existing.total += dose * appliedArea;
        } else {
          map.set(key, {
            total: dose * appliedArea,
            unit: p.unit || "L",
            packageSize: p.packageSize || 0,
          });
        }
      });
    });

    const result: InsumoResumo[] = [];
    map.forEach((v, k) => {
      result.push({
        produto: k,
        totalNecessario: v.total,
        unit: v.unit,
        packageSize: v.packageSize,
        qtdEmbalagens: v.packageSize > 0 ? Math.ceil(v.total / v.packageSize) : 0,
      });
    });
    return result;
  }, [os]);

  return (
    <div ref={ref} className="bg-white text-black p-8 max-w-[210mm] mx-auto print-area" id="os-print">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-6">
        <div className="flex items-center">
          <img src="/herbilog_logo.png" alt="HerbiLog" className="h-12 w-auto object-contain" />
        </div>
        <div className="text-right">
          <p className="text-lg font-bold font-mono">OS nº {os.id}</p>
          {os.osExterna && <p className="text-sm font-semibold text-gray-700">OS Externa: {os.osExterna}</p>}
          <p className="text-sm text-gray-600">{new Date(os.data).toLocaleDateString("pt-BR")}</p>
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
        {os.tipoAplicacao && (
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs text-gray-500 uppercase font-semibold">Tipo de Aplicação</p>
            <p className="font-medium">{os.tipoAplicacao}</p>
          </div>
        )}
        {os.codigoAplicacao && (
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs text-gray-500 uppercase font-semibold">Código da Aplicação</p>
            <p className="font-medium">{os.codigoAplicacao}</p>
          </div>
        )}
        {os.volumeCaldaHa && (
          <div className={`border border-gray-300 rounded p-3 ${os.coordenadas ? "" : "col-span-2"}`}>
            <p className="text-xs text-gray-500 uppercase font-semibold">Volume de Calda</p>
            <p className="font-medium">{os.volumeCaldaHa} L/ha</p>
          </div>
        )}
        {os.coordenadas && (
          <div className={`border border-gray-300 rounded p-3 ${!os.volumeCaldaHa ? "col-span-2" : ""}`}>
            <p className="text-xs text-gray-500 uppercase font-semibold">Coordenadas</p>
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm truncate mr-2" title={os.coordenadas}>{os.coordenadas}</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(os.coordenadas)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-2 py-1 bg-green-600 text-white font-semibold text-xs rounded hover:bg-green-700 transition-colors no-print shrink-0"
              >
                <MapPin className="h-3 w-3 mr-1" /> Ver Rota
              </a>
            </div>
          </div>
        )}
        {os.equipamentos && os.equipamentos.length > 0 && (
          <div className="border border-gray-300 rounded p-3 col-span-2">
            <p className="text-xs text-gray-500 uppercase font-semibold">Equipamentos Vinculados</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {os.equipamentos.map((eq, idx) => (
                <span key={idx} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded border border-gray-200 font-medium">
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Talhões */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase mb-2 text-gray-700">Detalhamento por Talhão</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left">Talhão</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Área (ha)</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Produto(s)</th>
              <th className="border border-gray-300 px-3 py-2 text-right">Dose (L/ha)</th>
              <th className="border border-gray-300 px-3 py-2 text-left">Observações</th>
            </tr>
          </thead>
          <tbody>
            {os.talhoes.map((t, i) => {
              const rowSpan = Math.max(t.produtos.length, 1);
              
              let observacao = [];
              if (t.testemunho) {
                observacao.push(t.testemunhoArea ? `Testemunho: ${t.testemunhoArea}m² s/ aplic.` : "Testemunho Total");
              }
              if (t.testeProduto) {
                observacao.push(`Teste: ${t.produtoTeste} (${t.produtoTesteQtd || "—"})`);
              }
              const obsText = observacao.length > 0 ? observacao.join(" | ") : "—";
              
              const isTestemunhoTotal = t.testemunho && (!t.testemunhoArea || parseFloat(t.testemunhoArea) / 10000 >= (parseFloat(t.area) || 0));

              return isTestemunhoTotal && (!t.produtos || t.produtos.length === 0 || !t.produtos[0].produto) ? (
                <tr key={i} className="bg-yellow-50">
                  <td className="border border-gray-300 px-3 py-2">{t.nome || `T-${i + 1}`}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{t.area || "—"}</td>
                  <td className="border border-gray-300 px-3 py-2">—</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">0</td>
                  <td className="border border-gray-300 px-3 py-2 text-xs">{obsText}</td>
                </tr>
              ) : (
                t.produtos.map((p, j) => (
                  <tr key={`${i}-${j}`} className={t.testemunho ? "bg-yellow-50/30" : ""}>
                    {j === 0 && (
                      <>
                        <td className="border border-gray-300 px-3 py-2" rowSpan={rowSpan}>
                          {t.nome || `T-${i + 1}`}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-right" rowSpan={rowSpan}>
                          {t.area || "—"}
                        </td>
                      </>
                    )}
                    <td className="border border-gray-300 px-3 py-2">{p.produto || "—"}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right">{p.dose || "—"}</td>
                    {j === 0 && (
                      <td className="border border-gray-300 px-3 py-2 text-xs" rowSpan={rowSpan}>
                        {obsText}
                      </td>
                    )}
                  </tr>
                ))
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-gray-50">
              <td className="border border-gray-300 px-3 py-2">TOTAL</td>
              <td className="border border-gray-300 px-3 py-2 text-right">{areaTotal.toFixed(2)}</td>
              <td colSpan={3} className="border border-gray-300 px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Resumo de Insumos */}
      {resumoInsumos.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold uppercase mb-2 text-gray-700">Resumo de Insumos</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-50">
                <th className="border border-gray-300 px-3 py-2 text-left">Produto</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Total Necessário</th>
                <th className="border border-gray-300 px-3 py-2 text-center">Unidade</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Embalagem</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Qtd Embalagens</th>
              </tr>
            </thead>
            <tbody>
              {resumoInsumos.map((item, idx) => (
                <tr key={idx}>
                  <td className="border border-gray-300 px-3 py-2">{item.produto}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">{item.totalNecessario.toFixed(2)}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{item.unit}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {item.packageSize > 0 ? `${item.packageSize} ${item.unit}` : "—"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-semibold">
                    {item.qtdEmbalagens > 0 ? item.qtdEmbalagens : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assinaturas */}
      <div className="grid grid-cols-1 gap-12 mt-16 max-w-sm mx-auto">
        <div className="text-center">
          <div className="border-t border-black pt-2">
            <p className="text-sm font-medium">Responsável Técnico</p>
            <p className="text-xs text-gray-500">{os.responsavelTecnico}</p>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-gray-400 mt-8">
        Documento gerado por HerbiLog em {new Date().toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
});

OSPreview.displayName = "OSPreview";
