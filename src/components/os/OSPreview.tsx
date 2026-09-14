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
          appliedArea = 0;
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

  const temValores = (os.valorHerbicidas || 0) + (os.valorServico || 0) > 0;

  return (
    <div ref={ref} className="bg-white text-black p-4 sm:p-6 w-full lg:max-w-[210mm] mx-auto print-area" id="os-print" style={{ fontSize: "11px", lineHeight: "1.3" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
        <div className="flex items-center">
          <img src="/herbilog_logo.png" alt="HerbiLog" className="h-8 w-auto object-contain" />
        </div>
        <div className="text-right">
          <p className="text-base font-bold font-mono">OS nº {os.id}</p>
          {os.osExterna && <p className="text-xs font-semibold text-gray-700">OS Externa: {os.osExterna}</p>}
          <p className="text-xs text-gray-600">{new Date(os.data).toLocaleDateString("pt-BR")}</p>
        </div>
      </div>

      {/* Dados Compactos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1.5 mb-3 border border-gray-300 rounded p-2">
        {os.clienteNome && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Cliente</p>
            <p className="font-medium text-[11px]">{os.clienteNome}</p>
          </div>
        )}
        <div>
          <p className="text-[9px] text-gray-500 uppercase font-semibold">Propriedade</p>
          <p className="font-medium text-[11px]">{os.propriedade}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-500 uppercase font-semibold">Código Área</p>
          <p className="font-medium text-[11px]">{os.codigoArea || "—"}</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-500 uppercase font-semibold">Resp. Técnico</p>
          <p className="font-medium text-[11px]">{os.responsavelTecnico}</p>
        </div>
        {os.tipoAplicacao && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Tipo Aplicação</p>
            <p className="font-medium text-[11px]">{os.tipoAplicacao}</p>
          </div>
        )}
        {os.codigoAplicacao && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Cód. Aplicação</p>
            <p className="font-medium text-[11px]">{os.codigoAplicacao}</p>
          </div>
        )}
        {os.volumeCaldaHa && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Volume Calda</p>
            <p className="font-medium text-[11px]">{os.volumeCaldaHa} L/ha</p>
          </div>
        )}
        {os.equipamentos && os.equipamentos.length > 0 && (
          <div className={os.coordenadas ? "" : "col-span-2 sm:col-span-4"}>
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Equipamentos</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {os.equipamentos.map((eq, idx) => (
                <span key={idx} className="bg-gray-100 text-gray-800 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 font-medium">
                  {eq}
                </span>
              ))}
            </div>
          </div>
        )}
        {os.coordenadas && (
          <div className="col-span-2 sm:col-span-4">
            <p className="text-[9px] text-gray-500 uppercase font-semibold">Coordenadas</p>
            <div className="flex items-center gap-2">
              <p className="font-medium text-[11px] truncate">{os.coordenadas}</p>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(os.coordenadas)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-1.5 py-0.5 bg-green-600 text-white font-semibold text-[9px] rounded no-print shrink-0"
              >
                <MapPin className="h-2.5 w-2.5 mr-0.5" /> Rota
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Tabela de Talhões */}
      <div className="mb-3">
        <h2 className="text-[11px] font-bold uppercase mb-1 text-gray-700">Detalhamento por Talhão</h2>
        <table className="w-full border-collapse" style={{ fontSize: "10px" }}>
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-1.5 py-1 text-left" style={{ width: "60px" }}>Talhão</th>
              <th className="border border-gray-300 px-1.5 py-1 text-right" style={{ width: "50px" }}>Área (ha)</th>
              <th className="border border-gray-300 px-1.5 py-1 text-left">Produto(s)</th>
              <th className="border border-gray-300 px-1.5 py-1 text-right" style={{ width: "55px" }}>Dose</th>
              <th className="border border-gray-300 px-1.5 py-1 text-left">Obs</th>
            </tr>
          </thead>
          <tbody>
            {os.talhoes.map((t, i) => {
              const rowSpan = Math.max(t.produtos.length, 1);
              
              let observacao = [];
              if (t.testemunho) {
                observacao.push(t.testemunhoArea ? `Test. ${t.testemunhoArea}m²` : "Test. Total");
              }
              if (t.testeProduto) {
                observacao.push(`Teste: ${t.produtoTeste} (${t.produtoTesteQtd || "—"})`);
              }
              const obsText = observacao.length > 0 ? observacao.join(" | ") : "—";
              
              const isTestemunhoTotal = t.testemunho && (!t.testemunhoArea || parseFloat(t.testemunhoArea) / 10000 >= (parseFloat(t.area) || 0));

              return isTestemunhoTotal && (!t.produtos || t.produtos.length === 0 || !t.produtos[0].produto) ? (
                <tr key={i} className="bg-yellow-50">
                  <td className="border border-gray-300 px-1.5 py-1">{t.nome || `T-${i + 1}`}</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right">{t.area || "—"}</td>
                  <td className="border border-gray-300 px-1.5 py-1">—</td>
                  <td className="border border-gray-300 px-1.5 py-1 text-right">0</td>
                  <td className="border border-gray-300 px-1.5 py-1">{obsText}</td>
                </tr>
              ) : (
                t.produtos.map((p, j) => (
                  <tr key={`${i}-${j}`} className={t.testemunho ? "bg-yellow-50/30" : ""}>
                    {j === 0 && (
                      <>
                        <td className="border border-gray-300 px-1.5 py-1 font-medium" rowSpan={rowSpan}>
                          {t.nome || `T-${i + 1}`}
                        </td>
                        <td className="border border-gray-300 px-1.5 py-1 text-right" rowSpan={rowSpan}>
                          {t.area || "—"}
                        </td>
                      </>
                    )}
                    <td className="border border-gray-300 px-1.5 py-1">{p.produto || "—"}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{p.dose || "—"}{p.unit ? ` ${p.unit}` : ""}</td>
                    {j === 0 && (
                      <td className="border border-gray-300 px-1.5 py-1" rowSpan={rowSpan}>
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
              <td className="border border-gray-300 px-1.5 py-1">TOTAL</td>
              <td className="border border-gray-300 px-1.5 py-1 text-right">{areaTotal.toFixed(2)}</td>
              <td colSpan={3} className="border border-gray-300 px-1.5 py-1"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Resumo de Insumos + Financeiro lado a lado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {/* Insumos - ocupa 2 colunas */}
        {resumoInsumos.length > 0 && (
          <div className="sm:col-span-2">
            <h2 className="text-[11px] font-bold uppercase mb-1 text-gray-700">Resumo de Insumos</h2>
            <table className="w-full border-collapse" style={{ fontSize: "10px" }}>
              <thead>
                <tr className="bg-green-50">
                  <th className="border border-gray-300 px-1.5 py-1 text-left">Produto</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right">Total</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-center">Unid.</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right">Embal.</th>
                  <th className="border border-gray-300 px-1.5 py-1 text-right">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {resumoInsumos.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-300 px-1.5 py-1">{item.produto}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">{(item.totalNecessario % 1 === 0 ? item.totalNecessario.toFixed(0) : item.totalNecessario.toFixed(3))}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-center">{item.unit}</td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right">
                      {item.packageSize > 0 ? `${item.packageSize} ${item.unit}` : "—"}
                    </td>
                    <td className="border border-gray-300 px-1.5 py-1 text-right font-semibold">
                      {item.qtdEmbalagens > 0 ? item.qtdEmbalagens : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumo Financeiro */}
        {temValores && (
          <div>
            <h2 className="text-[11px] font-bold uppercase mb-1 text-gray-700">Resumo Financeiro</h2>
            <div className="border border-gray-300 rounded p-2 h-full">
              {os.valorHerbicidas ? (
                <div className="flex justify-between py-0.5" style={{ fontSize: "10px" }}>
                  <span className="text-gray-600">Insumos:</span>
                  <span className="font-medium">R$ {os.valorHerbicidas.toFixed(2)}</span>
                </div>
              ) : null}
              {os.valorServico ? (
                <div className="flex justify-between py-0.5" style={{ fontSize: "10px" }}>
                  <span className="text-gray-600">Serviço:</span>
                  <span className="font-medium">R$ {os.valorServico.toFixed(2)}</span>
                </div>
              ) : null}
              <div className="flex justify-between py-0.5 border-t border-gray-300 mt-1 pt-1" style={{ fontSize: "11px" }}>
                <span className="font-bold text-gray-800">TOTAL:</span>
                <span className="font-bold text-gray-800">
                  R$ {((os.valorHerbicidas || 0) + (os.valorServico || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Assinatura + Rodapé */}
      <div className="flex items-end justify-between mt-4 pt-2">
        <p className="text-[8px] text-gray-400">
          Doc. gerado por HerbiLog em {new Date().toLocaleDateString("pt-BR")}
        </p>
        <div className="text-center" style={{ minWidth: "180px" }}>
          <div className="border-t border-black pt-1">
            <p className="text-[10px] font-medium">Responsável Técnico</p>
            <p className="text-[9px] text-gray-500">{os.responsavelTecnico}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

OSPreview.displayName = "OSPreview";
