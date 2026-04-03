import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save, Eye } from "lucide-react";
import type { OrdemServico, ApontamentoTalhao } from "@/lib/osStorage";
import { saveOS } from "@/lib/osStorage";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllOperadores, Operador } from "@/lib/operatorStorage";
import { getAllEquipments, Equipment } from "@/lib/equipmentStorage";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface OSApontamentoProps {
  os: OrdemServico;
  onSaved: (os: OrdemServico) => void;
  onViewReport: () => void;
}

export function OSApontamento({ os, onSaved, onViewReport }: OSApontamentoProps) {
  const [apontamentos, setApontamentos] = useState<ApontamentoTalhao[]>(
    os.apontamentos?.length ? os.apontamentos : os.talhoes.map((_, i) => createEmptyApontamento(i))
  );
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipment[]>([]);
  const [sobraPrompt, setSobraPrompt] = useState<{
    globalIdx: number;
    amount: number;
    fromTalhao: string;
    fromPlotIndex: number;
    fromGlobalIdx: number;
  } | null>(null);

  useEffect(() => {
    getAllOperadores().then(setOperadores);
    getAllEquipments().then(setEquipamentos);
  }, []);

  function createEmptyApontamento(i: number): ApontamentoTalhao {
    return {
      talhaoIndex: i,
      areaAplicada: "",
      caldaRestante: "",
      sobraUtilizada: "",
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
    let newAp = { ...updated[globalIdx], [field]: value };
    
    // Check for leftover from previous talhões on same equipment
    if (field === "tratorFrota" && value) {
      const previousWithSobra = apontamentos
        .map((ap, idx) => ({ ...ap, originalIdx: idx }))
        .filter((ap, idx) => 
          idx < globalIdx && ap.tratorFrota === value && (parseFloat(ap.caldaRestante) || 0) > 0
        );
      
      if (previousWithSobra.length > 0) {
        const lastAp = previousWithSobra[previousWithSobra.length - 1];
        setSobraPrompt({
          globalIdx,
          amount: parseFloat(lastAp.caldaRestante),
          fromTalhao: os.talhoes[lastAp.talhaoIndex].nome || `Talhão ${lastAp.talhaoIndex + 1}`,
          fromPlotIndex: lastAp.talhaoIndex,
          fromGlobalIdx: lastAp.originalIdx
        });
      }
    }

    // Auto-calculate leftover mixture (sobra de calda)
    // Formula: ((Pumps * Capacity) + SobraUtilizada) - (Area * Rate)
    const isAutoTriggerField = ["areaAplicada", "bombasCheias", "tratorFrota", "sobraUtilizada"].includes(field);
    
    if (isAutoTriggerField) {
      const equipment = equipamentos.find(e => e.fleet_number === newAp.tratorFrota);
      const area = parseFloat(newAp.areaAplicada) || 0;
      const pumps = parseInt(newAp.bombasCheias || "0") || 0;
      const usedSobra = parseFloat(newAp.sobraUtilizada || "0") || 0;
      const tankCapacity = equipment?.tank_capacity || 0;

      if (volumeCaldaHa > 0) {
        const appliedVolume = area * volumeCaldaHa;
        const supplyVolume = (pumps * tankCapacity) + usedSobra;
        const leftover = supplyVolume - appliedVolume;
        
        // Only update if there is some basis for calculation
        if (newAp.areaAplicada || newAp.bombasCheias || newAp.sobraUtilizada) {
          newAp.caldaRestante = Math.max(0, leftover).toFixed(1);
        }
      }
    }
    
    updated[globalIdx] = newAp;
    setApontamentos(updated);
  };

  const handleConfirmSobra = () => {
    if (!sobraPrompt) return;
    const { globalIdx, amount, fromGlobalIdx } = sobraPrompt;
    const targetTalhaoName = os.talhoes[apontamentos[globalIdx].talhaoIndex].nome || `Talhão ${apontamentos[globalIdx].talhaoIndex + 1}`;
    
    // Update target reused sobra
    updateApontamentoByIndex(globalIdx, "sobraUtilizada", amount.toString());
    
    // Calculate area coverage from this sobra: Area = Amount / Rate
    if (volumeCaldaHa > 0) {
      const areaFromSobra = amount / volumeCaldaHa;
      updateApontamentoByIndex(globalIdx, "areaAplicada", areaFromSobra.toFixed(2));
    }
    
    // Update source with note
    const note = `Sobra de ${amount}L enviada para o talhão ${targetTalhaoName}.`;
    const oldNotes = apontamentos[fromGlobalIdx].observacoes || "";
    const newNotes = oldNotes ? `${oldNotes}\n${note}` : note;
    updateApontamentoByIndex(fromGlobalIdx, "observacoes", newNotes);
    
    setSobraPrompt(null);
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
                      <Select
                        value={ap.aplicador || ""}
                        onValueChange={(val) => updateApontamentoByIndex(ap.globalIdx, "aplicador", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o operador..." />
                        </SelectTrigger>
                        <SelectContent>
                          {operadores.map((o) => (
                            <SelectItem key={o.id} value={o.nome}>
                              {o.nome} {o.cracha ? `(${o.cracha})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Código Frota Trator</Label>
                      <Select
                        value={ap.tratorFrota || ""}
                        onValueChange={(val) => updateApontamentoByIndex(ap.globalIdx, "tratorFrota", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o trator..." />
                        </SelectTrigger>
                        <SelectContent>
                          {equipamentos.map((eq) => (
                            <SelectItem key={eq.id} value={eq.fleet_number}>
                              {eq.fleet_number} - {eq.equipment_model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Label className="text-xs">Sobra Utilizada (L)</Label>
                      <Input
                        type="number"
                        value={ap.sobraUtilizada || ""}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "sobraUtilizada", e.target.value)}
                        placeholder="Ex: 250"
                        className={ap.sobraUtilizada && parseFloat(ap.sobraUtilizada) > 0 ? "border-green-500 bg-green-50" : ""}
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
                      <Label className="text-xs">Volume Total Bomba (L)</Label>
                      <Input
                        type="number"
                        readOnly
                        value={((parseInt(ap.bombasCheias || "0") || 0) * (equipamentos.find(e => e.fleet_number === ap.tratorFrota)?.tank_capacity || 0)) + (parseFloat(ap.sobraUtilizada || "0") || 0)}
                        className="bg-muted font-semibold"
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <Label className="text-xs font-semibold text-primary">Sobra Calda Gerada (L)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={ap.caldaRestante}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "caldaRestante", e.target.value)}
                        placeholder="0.0"
                        className={parseFloat(ap.caldaRestante || "0") > 0 ? "border-primary bg-primary/5 font-bold text-primary" : ""}
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

      <Dialog open={!!sobraPrompt} onOpenChange={(open) => !open && setSobraPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Utilizar Sobra de Calda?</DialogTitle>
            <DialogDescription>
              Identificamos uma sobra de <strong>{sobraPrompt?.amount} Litros</strong> no <strong>{sobraPrompt?.fromTalhao}</strong> para este equipamento. 
              Deseja aplicar esta sobra no talhão atual?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSobraPrompt(null)}>Não, descartar</Button>
            <Button onClick={handleConfirmSobra}>Sim, utilizar sobra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
