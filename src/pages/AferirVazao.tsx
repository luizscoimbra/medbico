import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Gauge,
  Settings,
  Tractor,
  Hash,
  MapPin,
  User,
  Clock,
  Calculator,
  FileText,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Plus,
  RotateCcw,
  Search,
  History,
  Calendar,
  Beaker,
} from "lucide-react";
import { toast } from "sonner";
import { getAllEquipments, Equipment as EquipmentRecord } from "@/lib/equipmentStorage";
import { getAllOperadores, Operador } from "@/lib/operatorStorage";
import { saveAfericao, getAllAfericoes, deleteAfericao, AfericaoVazaoRecord } from "@/lib/vazaoStorage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2 as TrashIcon, Save, Share2 } from "lucide-react";


interface Measurement {
  nozzleNumber: number;
  measuredValue: number;
  status: "ok" | "cleaning" | "replacement";
  action: string;
}

interface MeasurementData {
  equipmentModel: string;
  tractorModel?: string;
  fleetNumber?: string;
  measurementDate: Date;
  workingPressure: number;
  totalNozzles: number;
  technicianName?: string;
  readings: Measurement[];
}

interface DiagnosisSummary {
  totalOk: number;
  totalCleaning: number;
  totalReplacement: number;
  percentageAbove: number;
  needsFullReplacement: boolean;
}

interface Nozzle {
  id: string;
  name: string;
  color: string;
  litersPerMin: number;
  pressureRange: [number, number];
  flowRateVariance: number;
}

interface NozzleStatus {
  min: number;
  max: number;
  status: "ok" | "cleaning" | "replacement";
}

interface NozzleCollect {
  nozzleNumber: number;
  value: number;
}

type CalibrationStatus = "calibrado" | "ajustar" | "trocar";

function getStatus(desvioPercent: number): CalibrationStatus {
  const abs = Math.abs(desvioPercent);
  if (abs <= 5) return "calibrado";
  if (abs <= 10) return "ajustar";
  return "trocar";
}

function getStatusConfig(status: CalibrationStatus) {
  switch (status) {
    case "calibrado":
      return { label: "Calibrado", icon: CheckCircle2, className: "bg-success/10 text-success border-success/30" };
    case "ajustar":
      return { label: "Ajustar Pressão", icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/30" };
    case "trocar":
      return { label: "Trocar Pontas", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" };
    default:
      return { label: "Desconhecido", icon: AlertTriangle, className: "bg-muted text-muted-foreground border-muted" };
  }
}

function getNozzleStatus(value: number, mediaReal: number) {
  if (mediaReal === 0) return null;
  const desvio = Math.abs((value - mediaReal) / mediaReal) * 100;
  if (desvio > 10) return "alerta";
  return "ok";
}

export default function AferirVazao() {
  const [step, setStep] = useState<"config" | "coleta" | "resultado">("config");
  const [historico, setHistorico] = useState<AfericaoVazaoRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [modeloTrator, setModeloTrator] = useState("");
  const [frota, setFrota] = useState("");
  const [tipoImplemento, setTipoImplemento] = useState("");
  const [numeroBicos, setNumeroBicos] = useState("");
  const [localColeta, setLocalColeta] = useState("");
  const [operador, setOperador] = useState("");
  const [turno, setTurno] = useState("");
  const dataHora = useMemo(() => new Date(), []);

  // Fleet search
  const [equipments, setEquipments] = useState<EquipmentRecord[]>([]);
  const [showFleetSuggestions, setShowFleetSuggestions] = useState(false);
  const [fleetNotFound, setFleetNotFound] = useState(false);
  const fleetInputRef = useRef<HTMLInputElement>(null);
  const fleetSuggestionsRef = useRef<HTMLDivElement>(null);
  
  // Operator search
  const [operadoresList, setOperadoresList] = useState<Operador[]>([]);
  const [showOperadorSuggestions, setShowOperadorSuggestions] = useState(false);
  const operadorInputRef = useRef<HTMLInputElement>(null);
  const operadorSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [eqs, ops, hist] = await Promise.all([
        getAllEquipments(),
        getAllOperadores(),
        getAllAfericoes()
      ]);
      setEquipments(eqs);
      setOperadoresList(ops);
      setHistorico(hist);
    };
    fetchData();
  }, []);

  const loadHistory = async () => {
    const data = await getAllAfericoes();
    setHistorico(data);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fleetSuggestionsRef.current && !fleetSuggestionsRef.current.contains(e.target as Node) &&
          fleetInputRef.current && !fleetInputRef.current.contains(e.target as Node)) {
        setShowFleetSuggestions(false);
      }
      if (operadorSuggestionsRef.current && !operadorSuggestionsRef.current.contains(e.target as Node) &&
          operadorInputRef.current && !operadorInputRef.current.contains(e.target as Node)) {
        setShowOperadorSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredFleets = useMemo(() => {
    if (!frota.trim()) return equipments;
    return equipments.filter((eq) =>
      eq.fleet_number.toLowerCase().includes(frota.toLowerCase())
    );
  }, [frota, equipments]);

  const filteredOperadores = useMemo(() => {
    if (!operador.trim()) return operadoresList;
    return operadoresList.filter((op) =>
      op.nome.toLowerCase().includes(operador.toLowerCase())
    );
  }, [operador, operadoresList]);

  const handleFrotaChange = (value: string) => {
    setFrota(value);
    setFleetNotFound(false);
    if (value.trim().length > 0) {
      const matches = equipments.filter((eq) =>
        eq.fleet_number.toLowerCase().includes(value.toLowerCase())
      );
      setShowFleetSuggestions(true);
      if (matches.length === 0 && value.trim().length >= 2) {
        setFleetNotFound(true);
      }
    } else {
      setShowFleetSuggestions(false);
    }
  };

  const handleSelectFleet = (eq: EquipmentRecord) => {
    setFrota(eq.fleet_number);
    setModeloTrator(eq.tractor_model || "");
    setTipoImplemento((eq.equipment_model || "").toLowerCase());
    setNumeroBicos(String(eq.total_nozzles));
    
    // Consumir dados adicionais se disponíveis
    if (eq.application_rate) setTaxaDesejada(String(eq.application_rate));
    if (eq.working_speed) setVelocidade(String(eq.working_speed));
    if (eq.nozzle_spacing) setEspacamento(String(eq.nozzle_spacing));
    
    setShowFleetSuggestions(false);
    setFleetNotFound(false);
    toast.success(`Frota ${eq.fleet_number} carregada!`);
  };

  const [taxaDesejada, setTaxaDesejada] = useState("");
  const [velocidade, setVelocidade] = useState("");
  const [espacamento, setEspacamento] = useState("");

  const [coletas, setColetas] = useState<NozzleCollect[]>([]);

  const nBicos = parseInt(numeroBicos) || 0;
  const T = parseFloat(taxaDesejada) || 0;
  const V = parseFloat(velocidade) || 0;
  const E = parseFloat(espacamento) || 0;

  const vazaoTeorica = useMemo(() => {
    if (T > 0 && V > 0 && E > 0) {
      return (T * V * E) / 60000;
    }
    return 0;
  }, [T, V, E]);

  const mediaReal = useMemo(() => {
    if (coletas.length === 0) return 0;
    const soma = coletas.reduce((acc, c) => acc + c.value, 0);
    return soma / coletas.length;
  }, [coletas]);

  const desvioPercent = useMemo(() => {
    if (vazaoTeorica === 0) return 0;
    return ((mediaReal - vazaoTeorica) / vazaoTeorica) * 100;
  }, [mediaReal, vazaoTeorica]);

  const statusGeral = useMemo(() => getStatus(desvioPercent), [desvioPercent]);

  const handleStartColeta = (e: React.FormEvent) => {
    e.preventDefault();

    if (!modeloTrator.trim()) {
      toast.error("Informe o modelo do trator");
      return;
    }
    if (nBicos < 1 || nBicos > 200) {
      toast.error("Número de bicos deve ser entre 1 e 200");
      return;
    }
    if (T <= 0 || V <= 0 || E <= 0) {
      toast.error("Preencha todos os parâmetros de cálculo");
      return;
    }

    setColetas(
      Array.from({ length: nBicos }, (_, i) => ({
        nozzleNumber: i + 1,
        value: 0,
      }))
    );
    setStep("coleta");
    toast.success("Configuração salva! Informe as coletas de cada bico.");
  };

  const handleColetaChange = (index: number, val: string) => {
    setColetas((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: parseFloat(val) || 0 };
      return updated;
    });
  };

  const handleCalcular = () => {
    const allFilled = coletas.every((c) => c.value > 0);
    if (!allFilled) {
      toast.error("Preencha todas as coletas antes de calcular");
      return;
    }
    setStep("resultado");
    toast.success("Cálculo concluído!");
  };

  const handleImprimir = () => {
    window.print();
  };



  // Step 1: Configuration
  const handleReset = () => {
    setStep("config");
    setColetas([]);
    toast.info("Formulário reiniciado");
  };

  const handleSave = async () => {
    if (step !== "resultado") return;
    setIsSaving(true);
    try {
      const record: AfericaoVazaoRecord = {
        id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        dataHora: dataHora.toISOString(),
        modeloTrator,
        frota,
        tipoImplemento,
        numeroBicos: nBicos,
        localColeta,
        operador,
        turno,
        taxaDesejada: T,
        velocidade: V,
        espacamento: E,
        vazaoTeorica,
        mediaReal,
        desvioPercent,
        statusGeral,
        coletas,
      };
      await saveAfericao(record);
      await loadHistory();
      toast.success("Aferição salva com sucesso!");
    } catch (error) {
      toast.error("Erro ao salvar aferição");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta aferição?")) {
      await deleteAfericao(id);
      await loadHistory();
      toast.success("Aferição excluída");
    }
  };

  const [viewHistoryRecord, setViewHistoryRecord] = useState<AfericaoVazaoRecord | null>(null);
  const [searchHistory, setSearchHistory] = useState("");

  const filteredHistory = useMemo(() => {
    if (!searchHistory.trim()) return historico;
    const s = searchHistory.toLowerCase();
    return historico.filter(h => 
      h.frota.toLowerCase().includes(s) || 
      h.modeloTrator.toLowerCase().includes(s) ||
      h.operador.toLowerCase().includes(s) ||
      h.localColeta.toLowerCase().includes(s)
    );
  }, [historico, searchHistory]);

  const handleViewFromHistory = (record: AfericaoVazaoRecord) => {
    // Para visualizar, podemos abrir um dialog com o relatório
    setViewHistoryRecord(record);
  };

  const handleShare = (record: AfericaoVazaoRecord) => {
    const statusLabel = getStatusConfig(record.statusGeral).label;
    const bicosAlerta = record.coletas.filter(c => {
      const vt = record.vazaoTeorica || 0;
      return vt > 0 && Math.abs((c.value - vt) / vt) * 100 > 10;
    }).length;

    const texto = `*Relatório de Aferição de Vazão* 🚜\n----------------------------------\n📍 *Local:* ${record.localColeta || "-"}\n🚜 *Equipamento:* Frota ${record.frota} (${record.modeloTrator})\n👤 *Operador:* ${record.operador || "-"}\n📅 *Data:* ${new Date(record.dataHora).toLocaleString("pt-BR")}\n\n📊 *Resultado:* ${statusLabel.toUpperCase()}\n📉 *Desvio Geral:* ${record.desvioPercent >= 0 ? "+" : ""}${record.desvioPercent.toFixed(2)}%\n⚠️ *Bicos em Alerta:* ${bicosAlerta} de ${record.numeroBicos}\n\n⚙️ *Parâmetros:*\n- Taxa Alvo: ${record.taxaDesejada} L/ha\n- Velocidade: ${record.velocidade} km/h\n- Vazão Teórica: ${record.vazaoTeorica.toFixed(3)} L/min\n- Média Real: ${record.mediaReal.toFixed(3)} L/min\n\n_Gerado pelo sistema MedBico_`;

    const encodedText = encodeURIComponent(texto);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, "_blank");
  };

  const statusConfig = getStatusConfig(statusGeral);
  const StatusIcon = statusConfig.icon;

  const bicosAlerta = coletas.filter((c) => getNozzleStatus(c.value, mediaReal) === "alerta");
  const turnoLabel = turno === "manha" ? "Manhã" : turno === "tarde" ? "Tarde" : turno === "noite" ? "Noite" : "-";
  const implementoLabel = tipoImplemento === "barra" ? "Barra" : tipoImplemento === "turbo" ? "Turbo" : tipoImplemento === "costal" ? "Costal" : "-";

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8 no-print">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Gauge className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-heading text-foreground tracking-tight">Aferir Vazão</h1>
            <p className="text-muted-foreground text-sm font-medium">Calibração precisa de bicos e pulverizadores</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="nova" className="no-print mb-8">
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto h-12 p-1 bg-muted/50">
          <TabsTrigger value="nova" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Aferição
          </TabsTrigger>
          <TabsTrigger value="historico" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <History className="h-4 w-4 mr-2" />
            Aferições realizadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nova" className="mt-6">
          <div className="space-y-8">
            {/* Steps - Navigation */}
            <div className="flex items-center justify-center mb-8 no-print">
              <div className="flex items-center w-full max-w-2xl px-4">
                {/* Step 1: Config */}
                <div className="flex flex-col items-center flex-1 relative">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    step === "config" ? "bg-primary border-primary text-white scale-110 shadow-lg" : "bg-background border-border text-muted-foreground"
                  }`}>
                    <Settings className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${step === "config" ? "text-primary" : "text-muted-foreground"}`}>Configuração</span>
                  <div className="absolute top-5 left-[calc(50%+25px)] w-[calc(100%-50px)] h-0.5 bg-border -z-10" />
                </div>

                {/* Step 2: Coleta */}
                <div className="flex flex-col items-center flex-1 relative">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    step === "coleta" ? "bg-primary border-primary text-white scale-110 shadow-lg" : 
                    step === "resultado" ? "bg-primary/20 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground"
                  }`}>
                    <Beaker className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${step === "coleta" ? "text-primary" : "text-muted-foreground"}`}>Coleta Bicos</span>
                  <div className="absolute top-5 left-[calc(50%+25px)] w-[calc(100%-50px)] h-0.5 bg-border -z-10" />
                </div>

                {/* Step 3: Resultado */}
                <div className="flex flex-col items-center flex-1">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    step === "resultado" ? "bg-primary border-primary text-white scale-110 shadow-lg" : "bg-background border-border text-muted-foreground"
                  }`}>
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] mt-2 font-bold uppercase tracking-wider ${step === "resultado" ? "text-primary" : "text-muted-foreground"}`}>Relatório</span>
                </div>
              </div>
            </div>

            {/* Step Content */}
            {step === "config" && (
              <Card className="shadow-xl border-t-4 border-t-primary animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-visible">
                <CardHeader className="border-b border-border/50 bg-muted/10">
                  <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                    <Tractor className="h-5 w-5 text-primary" />
                    Identificação e Parâmetros
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <form onSubmit={handleStartColeta} className="space-y-8">
                    {/* Grid 1: Identificação */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="space-y-2 relative">
                        <Label htmlFor="frota" className="text-sm font-semibold flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-primary" /> Frota / Número do Trator
                        </Label>
                        <Input
                          id="frota"
                          ref={fleetInputRef}
                          placeholder="Ex: T-01"
                          value={frota}
                          onChange={(e) => handleFrotaChange(e.target.value)}
                          onFocus={() => frota.length > 0 && setShowFleetSuggestions(true)}
                          className={`h-11 ${fleetNotFound ? "border-amber-300 bg-amber-50" : ""}`}
                        />
                        {showFleetSuggestions && (
                          <div
                            ref={fleetSuggestionsRef}
                            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-2xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                          >
                            {filteredFleets.length > 0 ? (
                              filteredFleets.map((eq) => (
                                <button
                                  key={eq.id}
                                  type="button"
                                  className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-center justify-between border-b border-border/50 last:border-0"
                                  onClick={() => handleSelectFleet(eq)}
                                >
                                  <div>
                                    <p className="font-bold text-foreground text-sm">{eq.fleet_number}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{eq.equipment_model}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-primary">{eq.total_nozzles} bicos</p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-muted-foreground italic">Nenhum equipamento encontrado</div>
                            )}
                          </div>
                        )}
                        {fleetNotFound && (
                          <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" /> Frota não cadastrada. Preencha manualmente abaixo.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="modelo" className="text-sm font-semibold flex items-center gap-2">
                          <Tractor className="h-3.5 w-3.5 text-primary" /> Modelo do Trator
                        </Label>
                        <Input
                          id="modelo"
                          placeholder="Ex: John Deere 6125J"
                          value={modeloTrator}
                          onChange={(e) => setModeloTrator(e.target.value)}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="implemento" className="text-sm font-semibold">Tipo de Implemento</Label>
                        <Select value={tipoImplemento} onValueChange={setTipoImplemento}>
                          <SelectTrigger id="implemento" className="h-11">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="barra">Barra</SelectItem>
                            <SelectItem value="turbo">Turbo</SelectItem>
                            <SelectItem value="costal">Costal</SelectItem>
                            <SelectItem value="pulverizador_tracionado">Pulverizador Tracionado</SelectItem>
                            <SelectItem value="pulverizador_autopropelido">Pulverizador Autopropelido</SelectItem>
                            <SelectItem value="pulverizador_montado">Pulverizador Montado</SelectItem>
                            <SelectItem value="outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="bicos" className="text-sm font-semibold flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-primary" /> Quantidade de Bicos
                        </Label>
                        <Input
                          id="bicos"
                          type="number"
                          placeholder="60"
                          value={numeroBicos}
                          onChange={(e) => setNumeroBicos(e.target.value)}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="local" className="text-sm font-semibold flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> Local da Coleta / Talhão
                        </Label>
                        <Input
                          id="local"
                          placeholder="Ex: Talhão 04"
                          value={localColeta}
                          onChange={(e) => setLocalColeta(e.target.value)}
                          className="h-11"
                        />
                      </div>

                      <div className="space-y-2 relative">
                        <Label htmlFor="operador" className="text-sm font-semibold flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-primary" /> Operador
                        </Label>
                        <Input
                          id="operador"
                          ref={operadorInputRef}
                          placeholder="Nome do operador"
                          value={operador}
                          onChange={(e) => {
                            setOperador(e.target.value);
                            setShowOperadorSuggestions(true);
                          }}
                          onFocus={() => setShowOperadorSuggestions(true)}
                          className="h-11"
                        />
                        {showOperadorSuggestions && (
                          <div
                            ref={operadorSuggestionsRef}
                            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-2xl max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                          >
                            {filteredOperadores.length > 0 ? (
                              filteredOperadores.map((op) => (
                                <button
                                  key={op.id}
                                  type="button"
                                  className="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
                                  onClick={() => {
                                    setOperador(op.nome);
                                    setShowOperadorSuggestions(false);
                                  }}
                                >
                                  <p className="font-medium text-sm">{op.nome}</p>
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-muted-foreground italic">Nenhum operador encontrado</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="turno" className="text-sm font-semibold flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-primary" /> Turno
                        </Label>
                        <Select value={turno} onValueChange={setTurno}>
                          <SelectTrigger id="turno" className="h-11">
                            <SelectValue placeholder="Selecione o turno..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="diurno">Diurno</SelectItem>
                            <SelectItem value="noturno">Noturno</SelectItem>
                            <SelectItem value="especial">Especial / 24h</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Grid 2: Parâmetros de Cálculo */}
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-6">
                      <h3 className="text-lg font-heading flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        Parâmetros de Trabalho
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="taxa" className="text-sm font-semibold">Taxa Desejada (L/ha)</Label>
                          <Input
                            id="taxa"
                            type="number"
                            placeholder="Ex: 100"
                            value={taxaDesejada}
                            onChange={(e) => setTaxaDesejada(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="velocidade" className="text-sm font-semibold">Velocidade (km/h)</Label>
                          <Input
                            id="velocidade"
                            type="number"
                            placeholder="Ex: 8"
                            value={velocidade}
                            onChange={(e) => setVelocidade(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="espacamento" className="text-sm font-semibold">Espaçamento Bicos (cm)</Label>
                          <Input
                            id="espacamento"
                            type="number"
                            placeholder="Ex: 50"
                            value={espacamento}
                            onChange={(e) => setEspacamento(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                      </div>

                      {vazaoTeorica > 0 && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 animate-in fade-in zoom-in duration-300">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Vazão Teórica por Bico (qt)</p>
                              <p className="text-3xl font-heading text-primary font-bold">{vazaoTeorica.toFixed(3)} <span className="text-sm font-normal">L/min</span></p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button type="submit" size="lg" className="w-full h-14 text-lg font-heading group">
                      Iniciar Coleta de Dados
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Step 2 Content: Coleta */}
            {step === "coleta" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-heading text-foreground tracking-tight">Coleta de Volume</h2>
                    <p className="text-muted-foreground text-sm">Colete o volume de cada bico durante 60 segundos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Reiniciar
                    </Button>
                    <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-bold border border-primary/20">
                      Vazão Alvo: {vazaoTeorica.toFixed(3)} L/min
                    </div>
                  </div>
                </div>

                <Card className="shadow-lg overflow-hidden border-border/50">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0 border-t border-l border-border/50">
                      {coletas.map((c, i) => {
                        const status = getNozzleStatus(c.value, vazaoTeorica);
                        const desvio = vazaoTeorica > 0 ? ((c.value - vazaoTeorica) / vazaoTeorica) * 100 : 0;
                        return (
                          <div key={i} className={`p-4 border-r border-b border-border/50 transition-colors ${
                            c.value === 0 ? "bg-background" : 
                            status === "alerta" ? "bg-destructive/5" : "bg-success/5"
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Bico {c.nozzleNumber}</span>
                              {c.value > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  status === "alerta" ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground"
                                }`}>
                                  {desvio >= 0 ? "+" : ""}{desvio.toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <Input
                                type="number"
                                step="0.001"
                                placeholder="0.000"
                                value={c.value || ""}
                                onChange={(e) => handleColetaChange(i, e.target.value)}
                                className={`text-lg font-mono font-bold h-11 pr-10 text-center ${
                                  c.value > 0 && status === "alerta" ? "border-destructive focus-visible:ring-destructive" : ""
                                }`}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">L</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-3 no-print">
                  <Button variant="ghost" size="lg" onClick={() => setStep("config")}>Voltar</Button>
                  <Button size="lg" onClick={handleCalcular} className="px-12 font-heading text-lg">
                    Calcular Resultados
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3 Content: Resultado */}
            {step === "resultado" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between no-print gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-heading text-foreground tracking-tight">Relatório de Calibração</h2>
                    <p className="text-muted-foreground text-sm font-medium">Análise detalhada da uniformidade de aplicação</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleImprimir}>
                      <Printer className="h-4 w-4 mr-1" /> Imprimir PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      // Construir um objeto compatível com AfericaoVazaoRecord para o handleShare
                      const record: any = {
                        dataHora: dataHora.toISOString(),
                        modeloTrator,
                        frota,
                        tipoImplemento,
                        numeroBicos: nBicos,
                        localColeta,
                        operador,
                        turno,
                        taxaDesejada: T,
                        velocidade: V,
                        espacamento: E,
                        vazaoTeorica,
                        mediaReal,
                        desvioPercent,
                        statusGeral,
                        coletas,
                      };
                      handleShare(record);
                    }}>
                      <Share2 className="h-4 w-4 mr-1" /> WhatsApp
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-1" /> {isSaving ? "Salvando..." : "Salvar Aferição"}
                    </Button>
                    <Button variant="default" size="sm" onClick={handleReset}>
                      <Plus className="h-4 w-4 mr-1" /> Nova Aferição
                    </Button>
                  </div>
                </div>

                <div ref={reportRef} className="space-y-8 print:p-0">
                  <div className="hidden print:block border-b border-border pb-1 mb-1">
                    <h1 className="text-sm font-heading text-foreground text-center">
                      Relatório de Calibração de Vazão
                    </h1>
                    <p className="text-center text-[8px] text-muted-foreground">
                      Gerado em: {dataHora.toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <Card className={`shadow-lg animate-slide-up border-2 ${statusConfig.className} print:shadow-none print:border`}>
                    <CardContent className="p-6 flex items-center gap-4 print:p-2 print:gap-2">
                      <div className="h-16 w-16 rounded-xl flex items-center justify-center bg-background print:h-7 print:w-7 print:rounded">
                        <StatusIcon className="h-8 w-8 print:h-4 print:w-4" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-heading print:text-xs">{statusConfig.label}</h2>
                        <p className="text-sm opacity-80 print:text-[8px]">
                          Desvio geral: {desvioPercent >= 0 ? "+" : ""}{desvioPercent.toFixed(2)}% em relação à vazão teórica
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="print:grid print:grid-cols-2 print:gap-1 space-y-6 print:space-y-0">
                    <Card className="shadow-lg animate-slide-up print:shadow-none">
                      <CardHeader className="border-b border-border print:p-1.5">
                        <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                          <FileText className="h-5 w-5 text-primary print:h-3 print:w-3" />
                          Dados da Aferição
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 print:p-1.5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm print:grid-cols-2 print:gap-0.5 print:text-[8px]">
                          <div><p className="text-muted-foreground">Trator</p><p className="font-medium">{modeloTrator}</p></div>
                          <div><p className="text-muted-foreground">Frota</p><p className="font-medium">{frota}</p></div>
                          <div><p className="text-muted-foreground">Operador</p><p className="font-medium">{operador}</p></div>
                          <div><p className="text-muted-foreground">Data/Hora</p><p className="font-medium">{dataHora.toLocaleString("pt-BR")}</p></div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-lg animate-slide-up print:shadow-none">
                      <CardHeader className="border-b border-border print:p-1.5">
                        <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                          <Calculator className="h-5 w-5 text-primary print:h-3 print:w-3" />
                          Resumo do Cálculo
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 print:p-1.5">
                        <div className="grid grid-cols-2 gap-4 print:gap-1">
                          <div className="bg-muted p-2 rounded"><p className="text-xs">Vazão Teórica</p><p className="font-bold">{vazaoTeorica.toFixed(3)} L/min</p></div>
                          <div className="bg-muted p-2 rounded"><p className="text-xs">Média Real</p><p className="font-bold">{mediaReal.toFixed(3)} L/min</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="shadow-lg animate-slide-up print:shadow-none">
                    <CardHeader className="border-b border-border print:p-1.5">
                      <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                        <Beaker className="h-5 w-5 text-primary print:h-3 print:w-3" />
                        Análise Individual dos Bicos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm print:text-[7px]">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold print:px-1 print:py-0.5">Bico</th>
                              <th className="px-4 py-3 text-right font-semibold print:px-1 print:py-0.5">Vazão (L/min)</th>
                              <th className="px-4 py-3 text-right font-semibold print:px-1 print:py-0.5">Desvio (%)</th>
                              <th className="px-4 py-3 text-center font-semibold print:px-1 print:py-0.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {coletas.map((c) => {
                              const desvio = vazaoTeorica > 0 ? ((c.value - vazaoTeorica) / vazaoTeorica) * 100 : 0;
                              const status = getNozzleStatus(c.value, vazaoTeorica);
                              return (
                                <tr key={c.nozzleNumber} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-2 font-medium print:px-1 print:py-0.5">#{c.nozzleNumber}</td>
                                  <td className="px-4 py-2 text-right font-mono print:px-1 print:py-0.5">{c.value.toFixed(3)}</td>
                                  <td className={`px-4 py-2 text-right font-mono font-bold print:px-1 print:py-0.5 ${
                                    status === "alerta" ? "text-destructive" : "text-success"
                                  }`}>
                                    {desvio >= 0 ? "+" : ""}{desvio.toFixed(1)}%
                                  </td>
                                  <td className="px-4 py-2 text-center print:px-1 print:py-0.5">
                                    <Badge variant={status === "alerta" ? "destructive" : "secondary"} className="text-[10px] py-0 px-1.5 h-5 print:h-3 print:text-[5px]">
                                      {status === "alerta" ? "Alerta" : "OK"}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                  <History className="h-5 w-5 text-primary" />
                  Histórico de Aferições
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar frota, operador..."
                    className="pl-9 h-9"
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground italic">
                  Nenhuma aferição encontrada.
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredHistory.map((h) => {
                    const hConfig = getStatusConfig(h.statusGeral);
                    const HStatusIcon = hConfig.icon;
                    return (
                      <div key={h.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-foreground">Frota {h.frota}</span>
                            <Badge className={`${hConfig.className} text-[10px] py-0 px-1.5`}>
                              <HStatusIcon className="h-3 w-3 mr-1" />
                              {hConfig.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground flex items-center gap-3">
                            <span><Tractor className="h-3 w-3 inline mr-1" />{h.modeloTrator}</span>
                            <span><User className="h-3 w-3 inline mr-1" />{h.operador}</span>
                            <span><Calendar className="h-3 w-3 inline mr-1" />{new Date(h.dataHora).toLocaleDateString("pt-BR")}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/10" onClick={() => handleShare(h)}>
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleViewFromHistory(h)}>
                            <FileText className="h-4 w-4 mr-1" /> Ver
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteHistory(h.id)}>
                            <TrashIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={!!viewHistoryRecord} onOpenChange={(open) => !open && setViewHistoryRecord(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between pr-8">
            <DialogTitle>Detalhes da Aferição</DialogTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => viewHistoryRecord && handleShare(viewHistoryRecord)}>
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
          </DialogHeader>
          {viewHistoryRecord && (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl flex items-center gap-3 ${getStatusConfig(viewHistoryRecord.statusGeral).className}`}>
                <div><p className="font-bold">{getStatusConfig(viewHistoryRecord.statusGeral).label}</p><p className="text-xs opacity-80">Desvio: {viewHistoryRecord.desvioPercent.toFixed(2)}%</p></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-2 border rounded"><b>Data:</b> {new Date(viewHistoryRecord.dataHora).toLocaleString("pt-BR")}</div>
                <div className="p-2 border rounded"><b>Frota:</b> {viewHistoryRecord.frota}</div>
                <div className="p-2 border rounded"><b>Operador:</b> {viewHistoryRecord.operador}</div>
                <div className="p-2 border rounded"><b>Taxa:</b> {viewHistoryRecord.taxaDesejada} L/ha</div>
              </div>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">Bico</th>
                      <th className="px-3 py-2 text-right">L/min</th>
                      <th className="px-3 py-2 text-right">Desvio (%)</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewHistoryRecord.coletas.map(c => {
                      const vt = viewHistoryRecord.vazaoTeorica || 0;
                      const desvio = vt > 0 ? ((c.value - vt) / vt) * 100 : 0;
                      const status = getNozzleStatus(c.value, vt);
                      return (
                        <tr key={c.nozzleNumber} className="border-t">
                          <td className="px-3 py-1.5">#{c.nozzleNumber}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{c.value.toFixed(3)}</td>
                          <td className={`px-3 py-1.5 text-right font-mono font-bold ${
                            status === "alerta" ? "text-destructive" : "text-success"
                          }`}>
                            {desvio >= 0 ? "+" : ""}{desvio.toFixed(1)}%
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <Badge variant={status === "alerta" ? "destructive" : "secondary"} className="text-[9px] h-4">
                              {status === "alerta" ? "Alerta" : "OK"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
