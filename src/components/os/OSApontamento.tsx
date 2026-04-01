import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save, Eye } from "lucide-react";
import type { OrdemServico, ApontamentoTalhao } from "@/lib/osStorage";
import { saveOS } from "@/lib/osStorage";
import { toast } from "sonner";

interface OSApontamentoProps {
  os: OrdemServico;
  onSaved: (os: OrdemServico) => void;
  onViewReport: () => void;
}

export function OSApontamento({ os, onSaved, onViewReport }: OSApontamentoProps) {
  const [apontamentos, setApontamentos] = useState<ApontamentoTalhao[]>(
    os.apontamentos ??
      os.talhoes.map((_, i) => ({
        talhaoIndex: i,
        areaAplicada: "",
        caldaRestante: "",
        dataApontamento: new Date().toISOString().slice(0, 10),
        observacoes: "",
      }))
  );

  const volumeCaldaHa = parseFloat(os.volumeCaldaHa || "0") || 0;

  const updateApontamento = (idx: number, field: keyof ApontamentoTalhao, value: string) => {
    const updated = [...apontamentos];
    updated[idx] = { ...updated[idx], [field]: value };
    setApontamentos(updated);
  };

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
          return {
            produto: p.produto,
            dose,
            unit: p.unit || "L",
            produtoRestante,
            produtoParaFinalizar,
          };
        });

    return { areaPlanejada, areaAplicada, areaFaltante, caldaRestante, produtosCalc };
  });

  const totalAreaPlanejada = calculos.reduce((s, c) => s + c.areaPlanejada, 0);
  const totalAreaAplicada = calculos.reduce((s, c) => s + c.areaAplicada, 0);
  const totalAreaFaltante = calculos.reduce((s, c) => s + c.areaFaltante, 0);

  const handleSave = async () => {
    const updatedOS: OrdemServico = {
      ...os,
      apontamentos,
      status: totalAreaFaltante <= 0 ? "concluida" : "em_andamento",
    };
    await saveOS(updatedOS);
    toast.success("Apontamento salvo!");
    onSaved(updatedOS);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Apontamento — OS {os.id}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{os.propriedade} — {os.talhoes.length} talhões — Volume calda: {os.volumeCaldaHa || "N/I"} L/ha</p>
        </CardContent>
      </Card>

      {os.talhoes.map((t, i) => {
        if (t.testemunho) return null;
        const calc = calculos[i];
        const ap = apontamentos[i];

        return (
          <Card key={i} className="border-border">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-heading font-semibold text-sm">
                  {t.nome || `Talhão ${i + 1}`} — {t.area} ha
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Área Aplicada (ha)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={ap.areaAplicada}
                    onChange={(e) => updateApontamento(i, "areaAplicada", e.target.value)}
                    placeholder={t.area}
                  />
                </div>
                <div>
                  <Label className="text-xs">Calda Restante (L)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={ap.caldaRestante}
                    onChange={(e) => updateApontamento(i, "caldaRestante", e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={ap.dataApontamento}
                    onChange={(e) => updateApontamento(i, "dataApontamento", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={ap.observacoes}
                  onChange={(e) => updateApontamento(i, "observacoes", e.target.value)}
                  rows={2}
                  placeholder="Condições climáticas, problemas..."
                />
              </div>

              {/* Resultados calculados */}
              {calc.areaAplicada > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-semibold text-xs uppercase text-muted-foreground mb-2">Resultados</p>
                  <p>Área faltante: <strong>{calc.areaFaltante.toFixed(2)} ha</strong></p>
                  {calc.produtosCalc.map((pc, j) => (
                    <div key={j} className="ml-2 border-l-2 border-primary/30 pl-2">
                      <p className="font-medium">{pc.produto}</p>
                      <p>Restante na bomba: {pc.produtoRestante.toFixed(2)} {pc.unit}</p>
                      <p>Necessário para finalizar: {pc.produtoParaFinalizar.toFixed(2)} {pc.unit}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Totais */}
      <Card className="border-primary/30">
        <CardContent className="pt-4">
          <h3 className="font-heading font-semibold text-sm mb-3">Resumo Geral</h3>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Área Planejada</p>
              <p className="font-bold text-lg">{totalAreaPlanejada.toFixed(2)} ha</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Área Aplicada</p>
              <p className="font-bold text-lg text-green-700">{totalAreaAplicada.toFixed(2)} ha</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Área Faltante</p>
              <p className={`font-bold text-lg ${totalAreaFaltante > 0 ? "text-orange-600" : "text-green-700"}`}>
                {totalAreaFaltante.toFixed(2)} ha
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} className="flex-1">
          <Save className="h-4 w-4 mr-2" /> Salvar Apontamento
        </Button>
        <Button onClick={onViewReport} variant="outline">
          <Eye className="h-4 w-4 mr-2" /> Relatório
        </Button>
      </div>
    </div>
  );
}
