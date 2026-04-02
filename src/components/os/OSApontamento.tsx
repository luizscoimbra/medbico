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
    os.apontamentos?.length ? os.apontamentos : os.talhoes.map((_, i) => createEmptyApontamento(i))
  );

  function createEmptyApontamento(i: number): ApontamentoTalhao {
    return {
      talhaoIndex: i,
      areaAplicada: "",
      caldaRestante: "",
      bombasCheias: "",
      aplicador: "",
      tratorFrota: "",
      dataApontamento: new Date().toISOString().slice(0, 10),
      observacoes: "",
    };
  }

  const volumeCaldaHa = parseFloat(os.volumeCaldaHa || "0") || 0;

  const updateApontamentoByIndex = (globalIdx: number, field: keyof ApontamentoTalhao, value: string) => {
    const updated = [...apontamentos];
    updated[globalIdx] = { ...updated[globalIdx], [field]: value };
    setApontamentos(updated);
  };

  const addTrator = (talhaoIndex: number) => {
    setApontamentos([...apontamentos, createEmptyApontamento(talhaoIndex)]);
  };

  const removeTrator = (globalIdx: number) => {
    setApontamentos(apontamentos.filter((_, idx) => idx !== globalIdx));
  };

  const calculosTotais = os.talhoes.map((t, i) => {
    const aps = apontamentos.filter(a => a.talhaoIndex === i);
    const areaPlanejada = parseFloat(t.area) || 0;
    const areaAplicada = aps.reduce((sum, ap) => sum + (parseFloat(ap.areaAplicada || "0") || 0), 0);
    const areaFaltante = Math.max(0, areaPlanejada - areaAplicada);
    return { areaPlanejada, areaAplicada, areaFaltante };
  });
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

  const totalAreaPlanejada = calculosTotais.reduce((s, c) => s + c.areaPlanejada, 0);
  const totalAreaAplicada = calculosTotais.reduce((s, c) => s + c.areaAplicada, 0);
  const totalAreaFaltante = calculosTotais.reduce((s, c) => s + c.areaFaltante, 0);

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
        const aps = apontamentos.map((ap, globalIdx) => ({ ...ap, globalIdx })).filter(a => a.talhaoIndex === i);
        const calcTalhao = calculosTotais[i];

        return (
          <Card key={i} className="border-border">
            <CardContent className="pt-4 space-y-4">
               <div className="flex items-center justify-between">
                <span className="font-heading font-semibold text-base text-primary">
                  {t.nome || `Talhão ${i + 1}`} — Planejado: {t.area} ha
                </span>
                <Button variant="outline" size="sm" onClick={() => addTrator(i)}>
                  + Trator/Aplicação
                </Button>
              </div>

              {aps.map((ap, localIdx) => (
                <div key={ap.globalIdx} className="border border-input rounded-md p-4 space-y-4 relative bg-card/50">
                  <div className="font-semibold text-xs text-muted-foreground mb-2 flex justify-between">
                    <span>Registro #{localIdx + 1}</span>
                    {aps.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 text-destructive px-2" onClick={() => removeTrator(ap.globalIdx)}>
                        Remover
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Aplicador</Label>
                      <Input
                        value={ap.aplicador || ""}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "aplicador", e.target.value)}
                        placeholder="Nome do aplicador"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Código Frota Trator</Label>
                      <Input
                        value={ap.tratorFrota || ""}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "tratorFrota", e.target.value)}
                        placeholder="Ex: TR-01"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data</Label>
                      <Input
                        type="date"
                        value={ap.dataApontamento}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "dataApontamento", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Área Aplicada (ha)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={ap.areaAplicada}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "areaAplicada", e.target.value)}
                        placeholder={t.area}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Bombas Cheias</Label>
                      <Input
                        type="number"
                        step="1"
                        value={ap.bombasCheias || ""}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "bombasCheias", e.target.value)}
                        placeholder="Ex: 5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Sobra de Calda (L)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={ap.caldaRestante}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "caldaRestante", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Observações</Label>
                    <Textarea
                      value={ap.observacoes}
                      onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "observacoes", e.target.value)}
                      rows={2}
                      placeholder="Condições climáticas, problemas..."
                    />
                  </div>
                </div>
              ))}

              {/* Resultados calculados */}
              {calcTalhao.areaAplicada > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1 mt-4">
                  <p className="font-semibold text-xs uppercase text-muted-foreground mb-2">Resumo do Talhão</p>
                  <p>Área Faltante: <strong>{calcTalhao.areaFaltante.toFixed(2)} ha</strong></p>
                  <p>Área Total Aplicada: <strong>{calcTalhao.areaAplicada.toFixed(2)} ha</strong></p>
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
