import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Save, Eye, AlertTriangle, Droplets, Clock, Settings, AlertCircle, History as HistoryIcon, ArrowRightLeft, CheckCircle2, Search, FlaskConical, Trash2, Plus, Pencil } from "lucide-react";
import type { OrdemServico, ApontamentoTalhao, MotivoParada, ProdutoDose, ServicoOS } from "@/lib/osStorage";
import { saveOS, MOTIVO_PARADA_LABELS } from "@/lib/osStorage";
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

interface ItemFinanceiro {
  id: string;
  tipo: "produto" | "servico";
  codigo: string;
  nome: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
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
  const [interruptionPrompt, setInterruptionPrompt] = useState<{
    globalIdx: number;
  } | null>(null);
  const [continuationPrompt, setContinuationPrompt] = useState<{ globalIdx: number; showTalhaoSelect: boolean } | null>(null);
  const [motivoParada, setMotivoParada] = useState<MotivoParada>("fim_turno");
  const [paradaDetalhe, setParadaDetalhe] = useState("");
  const [destinoTransferencia, setDestinoTransferencia] = useState("");
  const [historyTalhao, setHistoryTalhao] = useState<number | null>(null);
  const [highlightIncomplete, setHighlightIncomplete] = useState(false);
  const [showCloseOSDialog, setShowCloseOSDialog] = useState(false);
  const [editingProdutos, setEditingProdutos] = useState<{ globalIdx: number; produtos: ProdutoDose[] } | null>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [registeredProducts, setRegisteredProducts] = useState<any[]>([]);
  const [itensFinanceiro, setItensFinanceiro] = useState<ItemFinanceiro[]>([]);
  const [valorHerbicidas, setValorHerbicidas] = useState(os.valorHerbicidas?.toString() || "");
  const [valorServico, setValorServico] = useState(os.valorServico?.toString() || "");

  useEffect(() => {
    getAllOperadores().then(setOperadores);
    getAllEquipments().then(setEquipamentos);
    supabase.from("products").select("*").order("name").then(({ data }) => {
      if (data) setAllProducts(data);
    });
    supabase.from("registered_products").select("commercial_name, unit, package_size, preco_unitario").then(({ data }) => {
      if (data) setRegisteredProducts(data);
    });
  }, []);

  function createEmptyApontamento(i: number): ApontamentoTalhao {
    return {
      talhaoIndex: i,
      areaAplicada: "",
      caldaRestante: "",
      sobraUtilizada: "",
      bombasCheias: "",
      cargaParcial: "",
      aplicador: "",
      tratorFrota: "",
      dataApontamento: new Date().toISOString().slice(0, 10),
      horaRegistro: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      observacoes: "",
      statusRegistro: "em_andamento",
    };
  }

  const volumeCaldaHa = parseFloat(os.volumeCaldaHa || "0") || 0;

  const updateApontamentoByIndex = (globalIdx: number, field: keyof ApontamentoTalhao, value: string) => {
    const updated = [...apontamentos];
    let newAp = { ...updated[globalIdx], [field]: value };
    
    if (field === "tratorFrota" && value) {
      const previousWithSobra = apontamentos
        .map((ap, idx) => ({ ...ap, originalIdx: idx }))
        .filter((ap, idx) => 
          idx < globalIdx && ap.tratorFrota === value && (parseFloat(ap.caldaRestante) || 0) > 0
        );
      
      const transferPending = apontamentos
        .map((ap, idx) => ({ ...ap, originalIdx: idx }))
        .filter((ap) => 
          ap.statusRegistro === "interrompido" && 
          ap.motivoParada === "quebra_equipamento" && 
          ap.equipamentoDestino === value &&
          (parseFloat(ap.caldaRestante) || 0) > 0
        );
      
      if (transferPending.length > 0) {
        const lastTransfer = transferPending[transferPending.length - 1];
        setSobraPrompt({
          globalIdx,
          amount: parseFloat(lastTransfer.caldaRestante),
          fromTalhao: `Transferencia de ${lastTransfer.tratorFrota} (Quebra)`,
          fromPlotIndex: lastTransfer.talhaoIndex,
          fromGlobalIdx: lastTransfer.originalIdx
        });
      } else if (previousWithSobra.length > 0) {
        const lastAp = previousWithSobra[previousWithSobra.length - 1];
        setSobraPrompt({
          globalIdx,
          amount: parseFloat(lastAp.caldaRestante),
          fromTalhao: os.talhoes[lastAp.talhaoIndex].nome || `Talhao ${lastAp.talhaoIndex + 1}`,
          fromPlotIndex: lastAp.talhaoIndex,
          fromGlobalIdx: lastAp.originalIdx
        });
      }
    }

    const isAutoTriggerField = ["areaAplicada", "bombasCheias", "cargaParcial", "tratorFrota", "sobraUtilizada"].includes(field);
    
    if (isAutoTriggerField) {
      const equipment = equipamentos.find(e => e.fleet_number === newAp.tratorFrota);
      const area = parseFloat(newAp.areaAplicada) || 0;
      const pumps = parseInt(newAp.bombasCheias || "0") || 0;
      const parcial = parseFloat(newAp.cargaParcial || "0") || 0;
      const usedSobra = parseFloat(newAp.sobraUtilizada || "0") || 0;
      const tankCapacity = equipment?.tank_capacity || 0;

      if (volumeCaldaHa > 0) {
        const appliedVolume = area * volumeCaldaHa;
        const supplyVolume = (pumps * tankCapacity) + parcial + usedSobra;
        const leftover = supplyVolume - appliedVolume;
        
        if (newAp.areaAplicada || newAp.bombasCheias || newAp.cargaParcial || newAp.sobraUtilizada) {
          newAp.caldaRestante = Math.max(0, leftover).toFixed(3);
        }
      }
    }
    
    updated[globalIdx] = newAp;
    setApontamentos(updated);
  };

  const handleConfirmSobra = () => {
    if (!sobraPrompt) return;
    const { globalIdx, amount, fromGlobalIdx } = sobraPrompt;
    const targetTalhaoIdx = apontamentos[globalIdx].talhaoIndex;
    const areaPlanejada = parseFloat(os.talhoes[targetTalhaoIdx].area) || 0;
    
    setApontamentos(prev => {
      const updated = [...prev];
      const ap = { ...updated[globalIdx] };
      const sourceAp = { ...updated[fromGlobalIdx] };
      
      ap.sobraUtilizada = amount.toString();
      
      if (volumeCaldaHa > 0) {
        const areaFromSobra = amount / volumeCaldaHa;
        const caldaNecessaria = areaPlanejada * volumeCaldaHa;
        
        if (amount > caldaNecessaria) {
          ap.areaAplicada = areaPlanejada.toFixed(2);
          ap.caldaRestante = (amount - caldaNecessaria).toFixed(3);
        } else {
          ap.areaAplicada = areaFromSobra.toFixed(2);
          ap.caldaRestante = "0";
        }
      }
      
      const targetEquipment = equipamentos.find(e => e.fleet_number === ap.tratorFrota);
      const targetPumps = parseInt(ap.bombasCheias || "0") || 0;
      const targetTankCapacity = targetEquipment?.tank_capacity || 0;
      if (volumeCaldaHa > 0 && targetPumps > 0) {
        const targetArea = parseFloat(ap.areaAplicada) || 0;
        const appliedVolume = targetArea * volumeCaldaHa;
        const supplyVolume = (targetPumps * targetTankCapacity) + amount;
        ap.caldaRestante = Math.max(0, supplyVolume - appliedVolume).toFixed(3);
      }
      
      ap.observacoes = `${ap.observacoes || ""}\n[Sobra] Recebida de: ${sobraPrompt.fromTalhao}`.trim();
      sourceAp.caldaRestante = "0.0";
      sourceAp.observacoes = `${sourceAp.observacoes || ""}\n[Sobra] Calda enviada para talhão: ${os.talhoes[targetTalhaoIdx].nome || `Talhao ${targetTalhaoIdx + 1}`}`.trim();
      
      updated[globalIdx] = ap;
      updated[fromGlobalIdx] = sourceAp;
      return updated;
    });

    toast.success(`Sobra de ${amount}L aplicada!`);
    setSobraPrompt(null);
  };

  const handleInterrupcao = () => {
    if (!interruptionPrompt) return;
    const { globalIdx } = interruptionPrompt;
    const updated = [...apontamentos];
    const ap = updated[globalIdx];
    
    updated[globalIdx] = {
      ...ap,
      statusRegistro: "interrompido",
      motivoParada,
      motivoParadaDetalhe: paradaDetalhe,
      equipamentoDestino: motivoParada === "quebra_equipamento" ? destinoTransferencia : undefined,
      observacoes: `${ap.observacoes || ""}\n[INTERRUPCAO: ${MOTIVO_PARADA_LABELS[motivoParada]}] ${paradaDetalhe}${motivoParada === "quebra_equipamento" ? " - Calda transferida para: " + destinoTransferencia : ""}`.trim(),
    };
    
    setApontamentos(updated);
    setInterruptionPrompt(null);
    setParadaDetalhe("");
    setDestinoTransferencia("");
    toast.warning("Aplicacao interrompida!");
  };

  const handleContinuacao = (oldGlobalIdx: number) => {
    const oldAp = apontamentos[oldGlobalIdx];
    if (oldAp.motivoParada === "quebra_equipamento") {
      setContinuationPrompt({ globalIdx: oldGlobalIdx, showTalhaoSelect: false });
    } else {
      executeContinuacao(oldGlobalIdx, oldAp.talhaoIndex);
    }
  };

  const executeContinuacao = (oldGlobalIdx: number, targetTalhaoIdx: number) => {
    const oldAp = apontamentos[oldGlobalIdx];
    const calcTarget = calculosTotais[targetTalhaoIdx];
    
    const newAp: ApontamentoTalhao = {
      ...createEmptyApontamento(targetTalhaoIdx),
      sobraUtilizada: oldAp.caldaRestante || "",
      registroAnteriorIdx: oldGlobalIdx,
      equipamentoOrigem: oldAp.tratorFrota,
      tratorFrota: oldAp.tratorFrota || "",
      aplicador: oldAp.aplicador || "",
      areaAplicada: targetTalhaoIdx === oldAp.talhaoIndex ? calcTarget.areaFaltante.toFixed(2) : "",
      observacoes: `Continuacao do registro #${oldGlobalIdx + 1} (${targetTalhaoIdx === oldAp.talhaoIndex ? "Mesmo Talhão" : "Novo Talhão: " + (os.talhoes[targetTalhaoIdx].nome || `T-${targetTalhaoIdx + 1}`)}).`.trim(),
    };
    
    setApontamentos(prev => {
      const updated = [...prev];
      updated[oldGlobalIdx] = {
        ...updated[oldGlobalIdx],
        statusRegistro: "reparado",
        observacoes: `${updated[oldGlobalIdx].observacoes || ""}\n[Equipamento Reparado] Continuado no Registro #${updated.length + 1}`.trim()
      };
      return [...updated, newAp];
    });
    
    setContinuationPrompt(null);
    toast.success("Equipamento Reparado! Novo registro criado.");
  };

  const addTrator = (talhaoIndex: number) => {
    const calc = calculosTotais[talhaoIndex];
    const newAp = createEmptyApontamento(talhaoIndex);
    
    if (calc.areaFaltante > 0) {
      newAp.areaAplicada = calc.areaFaltante.toFixed(2);
      toast.info(`Preenchendo área restante: ${newAp.areaAplicada} ha`);
    }
    
    setApontamentos([...apontamentos, newAp]);
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

  const calcularItensFinanceiro = () => {
    const itens: ItemFinanceiro[] = [];

    // Calcular total de cada produto utilizado na OS
    const produtosTotais = new Map<string, { total: number; unit: string }>();
    os.talhoes.forEach((t, i) => {
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
        const existing = produtosTotais.get(key);
        if (existing) {
          existing.total += dose * appliedArea;
        } else {
          produtosTotais.set(key, { total: dose * appliedArea, unit: p.unit || "L" });
        }
      });
    });

    // Mapear para itens financeiros com preços do cadastro
    let idx = 0;
    produtosTotais.forEach((v, nome) => {
      const prod = registeredProducts.find(p => p.commercial_name === nome);
      const preco = prod?.preco_unitario || 0;
      itens.push({
        id: `prod-${idx++}`,
        tipo: "produto",
        codigo: "",
        nome,
        quantidade: v.total,
        unidade: v.unit,
        valorUnitario: preco,
        valorTotal: v.total * preco,
      });
    });

    // Adicionar serviços da OS
    if (os.servicos && os.servicos.length > 0) {
      os.servicos.forEach((s) => {
        itens.push({
          id: `srv-${idx++}`,
          tipo: "servico",
          codigo: s.codigo,
          nome: s.descricao,
          quantidade: s.quantidade,
          unidade: "UN",
          valorUnitario: s.valorUnitario,
          valorTotal: s.valorTotal,
        });
      });
    }

    setItensFinanceiro(itens);

    // Atualizar valores herbicidas/serviço baseado no calculado
    const totalProdutos = itens.filter(i => i.tipo === "produto").reduce((s, i) => s + i.valorTotal, 0);
    const totalServicos = itens.filter(i => i.tipo === "servico").reduce((s, i) => s + i.valorTotal, 0);
    if (totalProdutos > 0) setValorHerbicidas(totalProdutos.toFixed(2));
    if (totalServicos > 0) setValorServico(totalServicos.toFixed(2));
  };

  const atualizarItemFinanceiro = (id: string, field: keyof ItemFinanceiro, value: any) => {
    setItensFinanceiro(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantidade" || field === "valorUnitario") {
        updated.valorTotal = updated.quantidade * updated.valorUnitario;
      }
      return updated;
    }));
  };

  const subtotalProdutos = itensFinanceiro.filter(i => i.tipo === "produto").reduce((s, i) => s + i.valorTotal, 0);
  const subtotalServicos = itensFinanceiro.filter(i => i.tipo === "servico").reduce((s, i) => s + i.valorTotal, 0);
  const totalGeral = subtotalProdutos + subtotalServicos;

  const handleSave = async () => {
    const updatedOS: OrdemServico = {
      ...os,
      apontamentos,
      status: totalAreaFaltante <= 0 ? "concluida" : "em_andamento",
      valorHerbicidas: parseFloat(valorHerbicidas) || os.valorHerbicidas,
      valorServico: parseFloat(valorServico) || os.valorServico,
      valorTotal: ((parseFloat(valorHerbicidas) || 0) + (parseFloat(valorServico) || 0)) || os.valorTotal,
    };
    await saveOS(updatedOS);
    toast.success("Apontamento salvo!");
    onSaved(updatedOS);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Apontamento - OS {os.id}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {os.propriedade} - {os.talhoes.length} talhões - {os.volumeCaldaHa || "N/I"} L/ha
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setHighlightIncomplete(true);
                if (totalAreaFaltante > 0.01) {
                  toast.error(`Atenção: Ainda restam ${totalAreaFaltante.toFixed(2)} ha!`, {
                    description: "Talhões pendentes destacados."
                  });
                } else {
                  toast.success("Tudo certo! Área 100% aplicada.");
                  setHighlightIncomplete(false);
                }
              }} 
              className="border-amber-500 text-amber-700 hover:bg-amber-50 h-9"
            >
              <Search className="h-4 w-4 mr-2" /> Verificar
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave} className="h-9">
              <Save className="h-4 w-4 mr-2" /> Salvar
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={async () => {
                await handleSave();
                onViewReport();
              }} 
              className="h-9"
            >
              <Eye className="h-4 w-4 mr-2" /> Relatório
            </Button>
            <Button 
              size="sm"
              onClick={() => setShowCloseOSDialog(true)} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Encerrar OS
            </Button>
          </div>
        </CardHeader>
      </Card>

      {os.talhoes.map((t, i) => {
        if (t.testemunho) return null;
        const aps = apontamentos.map((ap, globalIdx) => ({ ...ap, globalIdx })).filter(a => a.talhaoIndex === i);
        const calcTalhao = calculosTotais[i];
        const isPending = calcTalhao.areaFaltante > 0.01;
        const highlightClass = highlightIncomplete && isPending ? "border-red-500 bg-red-50/50 shadow-[0_0_15px_rgba(239,68,68,0.1)] shadow-red-500/10" : "border-border";

        return (
          <Card key={i} className={`transition-all duration-300 ${highlightClass}`}>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-heading font-semibold text-base text-primary">
                  {t.nome || `Talhao ${i + 1}`} - Planejado: {t.area} ha
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setHistoryTalhao(i)} className="text-muted-foreground hover:text-primary h-8 px-2">
                    <HistoryIcon className="h-3.5 w-3.5 mr-1" /> Histórico
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addTrator(i)} className="h-8">
                    + Trator/Aplicação
                  </Button>
                </div>
              </div>

              {aps.map((ap, localIdx) => (
                <div key={ap.globalIdx} className="border border-input rounded-md p-4 space-y-4 relative bg-card/50">
                  <div className="font-semibold text-xs text-muted-foreground mb-2 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span>Registro #{localIdx + 1}</span>
                      {ap.statusRegistro === "interrompido" ? (
                        <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <AlertCircle className="h-3 w-3" /> INTERROMPIDO
                        </span>
                      ) : ap.statusRegistro === "reparado" ? (
                        <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="h-3 w-3" /> EQUIPAMENTO REPARADO
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <Clock className="h-3 w-3" /> EM ANDAMENTO
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {ap.statusRegistro !== "interrompido" && ap.statusRegistro !== "reparado" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-amber-600 border-amber-200 hover:bg-amber-50"
                          onClick={() => setInterruptionPrompt({ globalIdx: ap.globalIdx })}
                        >
                          <AlertTriangle className="h-3 w-3 mr-1" /> Interromper
                        </Button>
                      )}
                      {ap.statusRegistro === "interrompido" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => handleContinuacao(ap.globalIdx)}
                        >
                          <HistoryIcon className="h-3 w-3 mr-1" /> Continuar
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-2"
                        onClick={() => setEditingProdutos({ 
                          globalIdx: ap.globalIdx, 
                          produtos: ap.produtosSubstitutos ? ap.produtosSubstitutos.map(p => ({...p})) : os.talhoes[ap.talhaoIndex].produtos.map(p => ({...p}))
                        })}
                      >
                        <FlaskConical className="h-3 w-3 mr-1" /> Alterar Insumos
                      </Button>
                      {aps.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-7 text-destructive px-2" onClick={() => removeTrator(ap.globalIdx)}>
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {ap.registroAnteriorIdx !== undefined && (
                    <div className="bg-blue-50/50 border border-blue-100 rounded p-2 mb-3 text-[11px] flex items-center gap-2 text-blue-700">
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      <span>
                        Continuacao do Registro #{ap.registroAnteriorIdx + 1} 
                        {ap.equipamentoOrigem && ` (Equipamento de origem: ${ap.equipamentoOrigem})`}
                      </span>
                    </div>
                  )}

                  {ap.statusRegistro === "interrompido" && ap.motivoParada && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 mb-3 text-[11px] text-amber-800">
                      <p className="font-bold uppercase flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" /> Motivo da Parada: {MOTIVO_PARADA_LABELS[ap.motivoParada]}
                      </p>
                      {ap.motivoParadaDetalhe && <p className="italic">"{ap.motivoParadaDetalhe}"</p>}
                    </div>
                  )}
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
                      <Label className="text-xs">Codigo Frota Trator</Label>
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
                      <Label className="text-xs">Area Aplicada (ha)</Label>
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
                      <Label className="text-xs">Carga Parcial (L)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={ap.cargaParcial || ""}
                        onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "cargaParcial", e.target.value)}
                        placeholder="Volume parcial em litros"
                        className={ap.cargaParcial && parseFloat(ap.cargaParcial) > 0 ? "border-blue-500 bg-blue-50" : ""}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Volume Total Calda (L)</Label>
                      <Input
                        type="number"
                        readOnly
                        value={((parseInt(ap.bombasCheias || "0") || 0) * (equipamentos.find(e => e.fleet_number === ap.tratorFrota)?.tank_capacity || 0)) + (parseFloat(ap.cargaParcial || "0") || 0) + (parseFloat(ap.sobraUtilizada || "0") || 0)}
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

                  {(() => {
                    const equipment = equipamentos.find(e => e.fleet_number === ap.tratorFrota);
                    const tankCapacity = equipment?.tank_capacity || 0;
                    const areaDigitada = parseFloat(ap.areaAplicada || "0") || 0;
                    const usedSobra = parseFloat(ap.sobraUtilizada || "0") || 0;
                    const pumps = parseInt(ap.bombasCheias || "0") || 0;
                    const parcial = parseFloat(ap.cargaParcial || "0") || 0;
                    
                    if (!equipment || volumeCaldaHa <= 0 || tankCapacity <= 0 || areaDigitada <= 0) return null;
                    if (pumps > 0 || parcial > 0) return null;
                    
                    const caldaTotal = areaDigitada * volumeCaldaHa;
                    const caldaNecessaria = Math.max(0, caldaTotal - usedSobra);
                    if (caldaNecessaria <= 0) return null;
                    
                    const bombasNecessarias = Math.ceil(caldaNecessaria / tankCapacity);
                    const volumeBombaCheia = bombasNecessarias * tankCapacity;
                    const sobraBombaCheia = volumeBombaCheia - caldaNecessaria;
                    const restoParcial = caldaNecessaria % tankCapacity;
                    const bombasInteiras = Math.floor(caldaNecessaria / tankCapacity);
                    const temParcial = restoParcial > 0;
                    
                    return (
                      <div className="rounded-lg p-3 mt-2 border bg-blue-50 border-blue-300">
                        <div className="flex items-start gap-2">
                          <Droplets className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-800">
                              Sugestao de Carga para {areaDigitada.toFixed(2)} ha
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              Volume necessario: <strong>{(caldaNecessaria % 1 === 0 ? caldaNecessaria.toFixed(0) : caldaNecessaria.toFixed(3))}L</strong> — Tanque: <strong>{tankCapacity}L</strong>
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-green-400 text-green-800 hover:bg-green-100"
                                onClick={() => {
                                  const updated = [...apontamentos];
                                  const updatedAp = { ...updated[ap.globalIdx] };
                                  updatedAp.bombasCheias = bombasInteiras.toString();
                                  updatedAp.cargaParcial = temParcial ? restoParcial.toFixed(3) : "";
                                  updatedAp.caldaRestante = "0";
                                  const nota = `Dosagem parcial: ${bombasInteiras} bombas + ${(restoParcial % 1 === 0 ? restoParcial.toFixed(0) : restoParcial.toFixed(3))}L (sem sobra).`;
                                  updatedAp.observacoes = (updatedAp.observacoes || "") + "\n" + nota;
                                  updated[ap.globalIdx] = updatedAp;
                                  setApontamentos(updated);
                                  toast.success("Dosagem exata aplicada!");
                                }}
                              >
                                {temParcial ? `${bombasInteiras} bombas + ${(restoParcial % 1 === 0 ? restoParcial.toFixed(0) : restoParcial.toFixed(3))}L` : `${bombasInteiras} bombas exatas`} (Sobra: 0L)
                              </Button>
                              
                              {sobraBombaCheia > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-amber-400 text-amber-800 hover:bg-amber-100"
                                  onClick={() => {
                                    const updated = [...apontamentos];
                                    const updatedAp = { ...updated[ap.globalIdx] };
                                    updatedAp.bombasCheias = bombasNecessarias.toString();
                                    updatedAp.cargaParcial = "";
                                    updatedAp.caldaRestante = sobraBombaCheia.toFixed(3);
                                    const nota = `${bombasNecessarias} bombas cheias - sobra de ${(sobraBombaCheia % 1 === 0 ? sobraBombaCheia.toFixed(0) : sobraBombaCheia.toFixed(3))}L.`;
                                    updatedAp.observacoes = (updatedAp.observacoes || "") + "\n" + nota;
                                    updated[ap.globalIdx] = updatedAp;
                                    setApontamentos(updated);
                                    toast.success("Bomba cheia aplicada!");
                                  }}
                                >
                                  {bombasNecessarias} bombas cheias (Sobra: {(sobraBombaCheia % 1 === 0 ? sobraBombaCheia.toFixed(0) : sobraBombaCheia.toFixed(3))}L)
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <Label className="text-xs">Observacoes</Label>
                    <Textarea
                      value={ap.observacoes}
                      onChange={(e) => updateApontamentoByIndex(ap.globalIdx, "observacoes", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              ))}

              {calcTalhao.areaAplicada > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1 mt-4">
                  <p className="font-semibold text-xs uppercase text-muted-foreground mb-2">Resumo do Talhao</p>
                  <p>Area Faltante: <strong>{calcTalhao.areaFaltante.toFixed(2)} ha</strong></p>
                  <p>Area Total Aplicada: <strong>{calcTalhao.areaAplicada.toFixed(2)} ha</strong></p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-primary/30">
        <CardContent className="pt-4">
          <h3 className="font-heading font-semibold text-sm mb-3">Resumo Geral</h3>
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Area Planejada</p>
              <p className="font-bold text-lg">{totalAreaPlanejada.toFixed(2)} ha</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Area Aplicada</p>
              <p className="font-bold text-lg text-green-700">{totalAreaAplicada.toFixed(2)} ha</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Area Faltante</p>
              <p className={`font-bold text-lg ${totalAreaFaltante > 0 ? "text-orange-600" : "text-green-700"}`}>
                {totalAreaFaltante.toFixed(2)} ha
              </p>
            </div>
          </div>
        </CardContent>
      </Card>



      <Dialog open={!!interruptionPrompt} onOpenChange={(open) => !open && setInterruptionPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Interromper Aplicacao</DialogTitle>
            <DialogDescription>
              Informe o motivo da interrupcao. A calda restante sera registrada para continuidade posterior.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Select value={motivoParada} onValueChange={(val: MotivoParada) => setMotivoParada(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MOTIVO_PARADA_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Detalhes / Observacoes</Label>
              <Textarea 
                placeholder="Descreva o problema..." 
                value={paradaDetalhe}
                onChange={(e) => setParadaDetalhe(e.target.value)}
              />
            </div>
            {motivoParada === "quebra_equipamento" && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-100 p-3 rounded-md">
                  <p className="text-xs text-red-700 font-semibold flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Atencao: Quebra detectada
                  </p>
                  <p className="text-[10px] text-red-600 mt-1">
                    Selecione o equipamento que ira receber a calda restante.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Equipamento de Destino</Label>
                  <Select value={destinoTransferencia} onValueChange={setDestinoTransferencia}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o trator..." />
                    </SelectTrigger>
                    <SelectContent>
                      {interruptionPrompt && equipamentos
                        .filter(e => e.fleet_number !== apontamentos[interruptionPrompt.globalIdx].tratorFrota)
                        .map((eq) => (
                          <SelectItem key={eq.id} value={eq.fleet_number}>
                            {eq.fleet_number} - {eq.equipment_model}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterruptionPrompt(null)}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={handleInterrupcao}
              disabled={motivoParada === "quebra_equipamento" && !destinoTransferencia}
            >
              Confirmar Interrupcao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!sobraPrompt} onOpenChange={(open) => !open && setSobraPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Utilizar Sobra de Calda?</DialogTitle>
            <DialogDescription>
              Identificamos uma sobra de {sobraPrompt?.amount} Litros no {sobraPrompt?.fromTalhao}. 
              Deseja aplicar esta sobra no talhao atual?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setSobraPrompt(null)}>Nao, descartar</Button>
            <Button onClick={handleConfirmSobra}>Sim, utilizar sobra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={historyTalhao !== null} onOpenChange={(open) => !open && setHistoryTalhao(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Histórico de Aplicação: {historyTalhao !== null && (os.talhoes[historyTalhao]?.nome || `Talhão ${historyTalhao + 1}`)}
            </DialogTitle>
            <DialogDescription>
              Resumo detalhado de todos os registros realizados neste talhão.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {historyTalhao !== null && apontamentos
              .filter(ap => ap.talhaoIndex === historyTalhao)
              .map((ap, idx) => {
                const talhao = os.talhoes[historyTalhao];
                return (
                  <div key={idx} className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                    <div className="flex justify-between items-start border-b border-border pb-2">
                      <div>
                        <p className="text-sm font-bold text-primary">Registro #{idx + 1}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {ap.dataApontamento} às {ap.horaRegistro}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{ap.tratorFrota || "Trator N/I"}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{ap.aplicador || "Operador N/I"}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="bg-white p-2 rounded border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase">Área</p>
                        <p className="font-bold">{ap.areaAplicada || "0.00"} ha</p>
                      </div>
                      <div className="bg-white p-2 rounded border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase">Bombas</p>
                        <p className="font-bold">{ap.bombasCheias || "0"}{ap.cargaParcial ? ` + ${ap.cargaParcial}L` : ""}</p>
                      </div>
                      <div className="bg-white p-2 rounded border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase">Utilizou Sobra</p>
                        <p className="font-bold text-green-600">{ap.sobraUtilizada || "0"} L</p>
                      </div>
                      <div className="bg-white p-2 rounded border border-border">
                        <p className="text-[10px] text-muted-foreground uppercase">Gerou Sobra</p>
                        <p className="font-bold text-amber-600">{ap.caldaRestante || "0"} L</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Produtos/Dosagens:</p>
                      <div className="flex flex-wrap gap-2">
                        {talhao.produtos.map((p, pIdx) => {
                          const dose = parseFloat(p.dose) || 0;
                          const total = dose * (parseFloat(ap.areaAplicada) || 0);
                          return (
                            <span key={pIdx} className="bg-blue-50 text-blue-800 text-[10px] px-2 py-0.5 rounded border border-blue-100">
                              {p.produto}: <strong>{(total % 1 === 0 ? total.toFixed(0) : total.toFixed(3))}{p.unit}</strong> ({p.dose}{p.unit}/ha)
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {ap.observacoes && (
                      <div className="text-[11px] text-gray-600 bg-gray-100 p-2 rounded italic">
                        <strong>Notas:</strong> {ap.observacoes}
                      </div>
                    )}
                    
                    {ap.statusRegistro === "interrompido" && (
                      <div className="text-[11px] bg-red-50 text-red-700 p-2 rounded border border-red-100 font-medium">
                        ⚠ Interrompido por {ap.motivoParada && MOTIVO_PARADA_LABELS[ap.motivoParada]}
                        {ap.equipamentoDestino && ` - Calda transferida para: ${ap.equipamentoDestino}`}
                      </div>
                    )}
                  </div>
                );
              })}
            
            {historyTalhao !== null && apontamentos.filter(ap => ap.talhaoIndex === historyTalhao).length === 0 && (
              <div className="text-center py-8 text-muted-foreground italic">
                Nenhum registro encontrado para este talhão.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setHistoryTalhao(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!continuationPrompt} onOpenChange={(open) => !open && setContinuationPrompt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Continuar Aplicação</DialogTitle>
            <DialogDescription>
              O equipamento anterior foi interrompido por quebra. Deseja continuar no mesmo talhão?
            </DialogDescription>
          </DialogHeader>

          {continuationPrompt && (
            <div className="space-y-4 py-4">
              {!continuationPrompt.showTalhaoSelect ? (
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    className="border-emerald-200 hover:bg-emerald-50 h-auto py-4 flex flex-col gap-2"
                    onClick={() => executeContinuacao(continuationPrompt.globalIdx, apontamentos[continuationPrompt.globalIdx].talhaoIndex)}
                  >
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    <div className="text-center">
                      <p className="font-bold text-sm text-emerald-700">Sim</p>
                      <p className="text-[10px] text-emerald-600">No mesmo talhão</p>
                    </div>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-blue-200 hover:bg-blue-50 h-auto py-4 flex flex-col gap-2"
                    onClick={() => setContinuationPrompt({ ...continuationPrompt, showTalhaoSelect: true })}
                  >
                    <ArrowRightLeft className="h-6 w-6 text-blue-500" />
                    <div className="text-center">
                      <p className="font-bold text-sm text-blue-700">Não</p>
                      <p className="text-[10px] text-blue-600">Em outro talhão</p>
                    </div>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Selecione o Novo Talhão</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {os.talhoes.map((talhao, idx) => {
                      const calc = calculosTotais[idx];
                      const isSame = idx === apontamentos[continuationPrompt.globalIdx].talhaoIndex;
                      if (isSame) return null;

                      return (
                        <Button
                          key={idx}
                          variant="ghost"
                          className="justify-between h-auto py-3 border hover:bg-accent"
                          onClick={() => executeContinuacao(continuationPrompt.globalIdx, idx)}
                        >
                          <div className="text-left">
                            <p className="font-bold text-sm">{talhao.nome || `Talhão ${idx + 1}`}</p>
                            <p className="text-[10px] text-muted-foreground">{talhao.area} ha — Faltante: {calc.areaFaltante.toFixed(2)} ha</p>
                          </div>
                          {calc.areaFaltante > 0 ? (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          )}
                        </Button>
                      );
                    })}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-[10px]" onClick={() => setContinuationPrompt({ ...continuationPrompt, showTalhaoSelect: false })}>
                    Voltar
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setContinuationPrompt(null)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCloseOSDialog} onOpenChange={(open) => {
        setShowCloseOSDialog(open);
        if (open) calcularItensFinanceiro();
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              Encerrar Ordem de Serviço {os.id}
            </DialogTitle>
            <DialogDescription>
              {totalAreaFaltante > 0.01 
                ? "Atenção: Existem talhões com área pendente. Verifique os detalhes abaixo antes de encerrar." 
                : "Toda a área planejada foi coberta. Deseja confirmar o encerramento desta OS?"}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {totalAreaFaltante > 0.01 && (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-bold text-red-800 uppercase mb-2">Talhões Incompletos</p>
                  <div className="space-y-2">
                    {os.talhoes.map((t, idx) => {
                      const calc = calculosTotais[idx];
                      if (calc.areaFaltante <= 0.01) return null;
                      return (
                        <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-red-100 shadow-sm">
                          <span className="font-medium text-gray-700">{t.nome || `Talhão ${idx + 1}`}</span>
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground mr-2">Falta:</span>
                            <span className="font-bold text-red-600">{calc.areaFaltante.toFixed(2)} ha</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Tabela de Itens Financeiros */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                <p className="text-xs font-bold text-gray-700 uppercase">Detalhamento de Custos</p>
              </div>

              {/* Produtos */}
              {itensFinanceiro.filter(i => i.tipo === "produto").length > 0 && (
                <div>
                  <div className="bg-green-50 px-3 py-1.5 border-b border-gray-200">
                    <p className="text-[10px] font-bold text-green-800 uppercase flex items-center gap-1">
                      <FlaskConical className="h-3 w-3" /> Insumos / Produtos
                    </p>
                  </div>
                  <table className="w-full text-xs" style={{ fontSize: "11px" }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-1.5 text-left font-semibold">Produto</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Qtd Total</th>
                        <th className="px-3 py-1.5 text-center font-semibold">Unid.</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Valor Unit.</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensFinanceiro.filter(i => i.tipo === "produto").map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-medium">{item.nome}</td>
                          <td className="px-3 py-1.5 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.quantidade || ""}
                              onChange={(e) => atualizarItemFinanceiro(item.id, "quantidade", parseFloat(e.target.value) || 0)}
                              className="h-6 w-20 text-right text-[11px] inline-block"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center text-muted-foreground">{item.unidade}</td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-muted-foreground text-[10px]">R$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.valorUnitario || ""}
                                onChange={(e) => atualizarItemFinanceiro(item.id, "valorUnitario", parseFloat(e.target.value) || 0)}
                                className="h-6 w-20 text-right text-[11px] inline-block"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-green-700">
                            R$ {item.valorTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-green-50/50 border-t border-green-200 font-bold">
                        <td colSpan={4} className="px-3 py-1.5 text-right text-green-800">Subtotal Insumos:</td>
                        <td className="px-3 py-1.5 text-right text-green-800">R$ {subtotalProdutos.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Serviços */}
              {itensFinanceiro.filter(i => i.tipo === "servico").length > 0 && (
                <div>
                  <div className="bg-blue-50 px-3 py-1.5 border-b border-gray-200">
                    <p className="text-[10px] font-bold text-blue-800 uppercase">Serviços</p>
                  </div>
                  <table className="w-full text-xs" style={{ fontSize: "11px" }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-1.5 text-left font-semibold">Código</th>
                        <th className="px-3 py-1.5 text-left font-semibold">Descrição</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Qtd</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Valor Unit.</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensFinanceiro.filter(i => i.tipo === "servico").map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-muted-foreground">{item.codigo}</td>
                          <td className="px-3 py-1.5 font-medium">{item.nome}</td>
                          <td className="px-3 py-1.5 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.quantidade || ""}
                              onChange={(e) => atualizarItemFinanceiro(item.id, "quantidade", parseFloat(e.target.value) || 0)}
                              className="h-6 w-16 text-right text-[11px] inline-block"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-muted-foreground text-[10px]">R$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.valorUnitario || ""}
                                onChange={(e) => atualizarItemFinanceiro(item.id, "valorUnitario", parseFloat(e.target.value) || 0)}
                                className="h-6 w-20 text-right text-[11px] inline-block"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right font-semibold text-blue-700">
                            R$ {item.valorTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50/50 border-t border-blue-200 font-bold">
                        <td colSpan={4} className="px-3 py-1.5 text-right text-blue-800">Subtotal Serviços:</td>
                        <td className="px-3 py-1.5 text-right text-blue-800">R$ {subtotalServicos.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {itensFinanceiro.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground italic">
                  Nenhum insumo ou serviço registrado nesta OS.
                </div>
              )}

              {/* Total Geral */}
              <div className="bg-gray-100 px-3 py-2 border-t border-gray-300 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-800">VALOR TOTAL:</span>
                <span className="text-lg font-heading text-emerald-700">
                  R$ {totalGeral.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setShowCloseOSDialog(false)}>
              Voltar
            </Button>
            <Button 
              className={totalAreaFaltante > 0.01 ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}
              onClick={async () => {
                const updatedOS: OrdemServico = {
                  ...os,
                  apontamentos,
                  status: "concluida",
                  servicos: os.servicos,
                  valorHerbicidas: subtotalProdutos || undefined,
                  valorServico: subtotalServicos || undefined,
                  valorTotal: totalGeral || undefined,
                };
                await saveOS(updatedOS);
                toast.success("Ordem de Serviço encerrada com sucesso!");
                setShowCloseOSDialog(false);
                onSaved(updatedOS);
              }}
            >
              Confirmar Encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProdutos} onOpenChange={(open) => !open && setEditingProdutos(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Substituir Insumos (Registro #{editingProdutos ? apontamentos[editingProdutos.globalIdx].talhaoIndex + 1 : ''})
            </DialogTitle>
            <DialogDescription>
              Atenção: As alterações feitas aqui serão aplicadas APENAS a este registro específico, preservando a recomendação original da OS nos relatórios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingProdutos && editingProdutos.produtos.map((p, idx) => (
              <div key={idx} className="flex gap-2 items-start border p-3 rounded-lg bg-muted/20 relative">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Produto</Label>
                      <Select 
                        value={p.produto || undefined}
                        onValueChange={val => {
                          const novo = [...editingProdutos.produtos];
                          novo[idx].produto = val;
                          const registered = allProducts.find(pr => pr.name === val);
                          if (registered) {
                             novo[idx].unit = registered.unit || "L";
                             novo[idx].packageSize = registered.package_size || 0;
                          }
                          setEditingProdutos({...editingProdutos, produtos: novo});
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione o produto"/></SelectTrigger>
                        <SelectContent>
                          {allProducts.map(pr => (
                            <SelectItem key={pr.id} value={pr.name}>{pr.name}</SelectItem>
                          ))}
                          {p.produto && !allProducts.find(pr => pr.name === p.produto) && (
                            <SelectItem value={p.produto}>{p.produto}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Dose (por ha)</Label>
                      <Input 
                        type="number"
                        step="0.01"
                        value={p.dose}
                        onChange={e => {
                          const novo = [...editingProdutos.produtos];
                          novo[idx].dose = e.target.value;
                          setEditingProdutos({...editingProdutos, produtos: novo});
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Unidade</Label>
                      <Select 
                        value={p.unit || "L"}
                        onValueChange={val => {
                          const novo = [...editingProdutos.produtos];
                          novo[idx].unit = val;
                          setEditingProdutos({...editingProdutos, produtos: novo});
                        }}
                      >
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">Litros (L)</SelectItem>
                          <SelectItem value="KG">Quilos (KG)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tamanho da Embalagem</Label>
                      <Input 
                        type="number"
                        value={p.packageSize || ""}
                        onChange={e => {
                          const novo = [...editingProdutos.produtos];
                          novo[idx].packageSize = parseFloat(e.target.value) || 0;
                          setEditingProdutos({...editingProdutos, produtos: novo});
                        }}
                      />
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive h-8 w-8 absolute top-2 right-2"
                  onClick={() => {
                    const novo = editingProdutos.produtos.filter((_, i) => i !== idx);
                    setEditingProdutos({...editingProdutos, produtos: novo});
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button 
              variant="outline" 
              className="w-full border-dashed"
              onClick={() => {
                if (!editingProdutos) return;
                setEditingProdutos({
                  ...editingProdutos,
                  produtos: [...editingProdutos.produtos, { produto: "", dose: "", unit: "L", packageSize: 0 }]
                });
              }}
            >
              <Plus className="h-4 w-4 mr-2" /> Adicionar Insumo
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingProdutos(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (!editingProdutos) return;
              const updated = [...apontamentos];
              updated[editingProdutos.globalIdx].produtosSubstitutos = editingProdutos.produtos;
              setApontamentos(updated);
              setEditingProdutos(null);
              toast.success("Insumos deste registro foram alterados com sucesso!");
            }}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
