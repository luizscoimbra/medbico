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

// ── Modo de aferição: terrestre (padrão, inalterado) ou drone ──────────
type TipoAfericao = "terrestre" | "drone";
type MaterialDrone = "liquido" | "solido";
type MetodoLiquido = "direto" | "sensor";
type MetodoSolido = "bancada" | "app";
type ContextoStatus = "terrestre" | "drone_liquido" | "drone_solido";

function getStatus(desvioPercent: number): CalibrationStatus {
  const abs = Math.abs(desvioPercent);
  if (abs <= 5) return "calibrado";
  if (abs <= 10) return "ajustar";
  return "trocar";
}

function getStatusConfig(status: CalibrationStatus, contexto: ContextoStatus = "terrestre") {
  const rotuloAjustar =
    contexto === "drone_liquido"
      ? "Ajustar Bomba (App)"
      : contexto === "drone_solido"
      ? "Ajustar Comporta"
      : "Ajustar Pressão";
  const rotuloTrocar =
    contexto === "drone_liquido"
      ? "Trocar Bicos"
      : contexto === "drone_solido"
      ? "Limpar / Revisar Disco"
      : "Trocar Pontas";
  switch (status) {
    case "calibrado":
      return { label: "Calibrado", icon: CheckCircle2, className: "bg-success/10 text-success border-success/30" };
    case "ajustar":
      return { label: rotuloAjustar, icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/30" };
    case "trocar":
      return { label: rotuloTrocar, icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" };
    default:
      return { label: "Desconhecido", icon: AlertTriangle, className: "bg-muted text-muted-foreground border-muted" };
  }
}

function contextoDeRegistro(r: AfericaoVazaoRecord): ContextoStatus {
  if (r.modo !== "drone") return "terrestre";
  return r.material === "solido" ? "drone_solido" : "drone_liquido";
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

  // ── Parâmetros do modo Drone ────────────────────────────────────────
  const [tipoAfericao, setTipoAfericao] = useState<TipoAfericao>("terrestre");
  const [materialDrone, setMaterialDrone] = useState<MaterialDrone>("liquido");
  const [metodoLiquido, setMetodoLiquido] = useState<MetodoLiquido>("direto");
  const [metodoSolido, setMetodoSolido] = useState<MetodoSolido>("bancada");
  const [faixaUtil, setFaixaUtil] = useState("");
  const [tempoColeta, setTempoColeta] = useState("60");
  const [tempoEnsaio, setTempoEnsaio] = useState("60");
  const [massaColetada, setMassaColetada] = useState("");
  const [vazaoMaxSistema, setVazaoMaxSistema] = useState("");
  const [comportaAtual, setComportaAtual] = useState("");
  const [leituraSensor, setLeituraSensor] = useState("");

  const [coletas, setColetas] = useState<NozzleCollect[]>([]);

  const nBicos = parseInt(numeroBicos) || 0;
  const T = parseFloat(taxaDesejada) || 0;
  const V = parseFloat(velocidade) || 0;
  const E = parseFloat(espacamento) || 0;
  const W = parseFloat(faixaUtil) || 0;
  const massa = parseFloat(massaColetada) || 0;
  const vazaoMax = parseFloat(vazaoMaxSistema) || 0;
  const comporta = parseFloat(comportaAtual) || 0;
  const leituraSensorNum = parseFloat(leituraSensor) || 0;
  const tempoEnsaioNum = parseInt(tempoEnsaio) || 60;
  const tempoColetaNum = parseInt(tempoColeta) || 60;

  const ehDrone = tipoAfericao === "drone";
  const ehLiquido = !ehDrone || materialDrone === "liquido";
  const ehDireto = !ehDrone || (materialDrone === "liquido" && metodoLiquido === "direto");
  const ehBancada = ehDrone && materialDrone === "solido" && metodoSolido === "bancada";
  const ehApp = ehDrone && materialDrone === "solido" && metodoSolido === "app";
  const unidadeVazao = ehDrone && materialDrone === "solido" ? "kg/min" : "L/min";
  const unidadeDose = ehDrone && materialDrone === "solido" ? "kg/ha" : "L/ha";
  const contextoStatus: ContextoStatus = !ehDrone
    ? "terrestre"
    : materialDrone === "solido"
    ? "drone_solido"
    : "drone_liquido";

  // Fator de conversão da coleta bruta para vazão por minuto (drone líquido: 30 s × 2)
  const fatorTempo = ehDireto ? 60 / tempoColetaNum : 1;

  // Vazão teórica alvo (por bico no terrestre e no drone líquido-direto; total no sensor; massa no sólido)
  const vazaoTeorica = useMemo(() => {
    if (ehDrone) {
      if (T <= 0 || V <= 0 || W <= 0) return 0;
      const total = (T * W * V) / 600; // Q_total (L/min) ou M_vazão (kg/min)
      if (materialDrone === "liquido" && metodoLiquido === "direto") {
        return nBicos > 0 ? total / nBicos : 0;
      }
      return total;
    }
    if (T > 0 && V > 0 && E > 0) {
      return (T * V * E) / 60000;
    }
    return 0;
  }, [ehDrone, materialDrone, metodoLiquido, T, V, W, E, nBicos]);

  // Vazão total de todos os bicos (drone líquido) — usada no card de prévia
  const vazaoTotalTeorica = useMemo(() => {
    if (!ehDrone || materialDrone !== "liquido") return 0;
    if (T <= 0 || V <= 0 || W <= 0) return 0;
    return (T * W * V) / 600;
  }, [ehDrone, materialDrone, T, V, W]);

  const mediaReal = useMemo(() => {
    if (coletas.length === 0) return 0;
    const soma = coletas.reduce((acc, c) => acc + c.value, 0);
    return (soma / coletas.length) * fatorTempo;
  }, [coletas, fatorTempo]);

  // Abertura de comporta ideal (%) — somente drone sólido
  const comportaIdeal = useMemo(() => {
    if (!ehDrone || materialDrone !== "solido" || vazaoTeorica <= 0) return 0;
    if (metodoSolido === "bancada") {
      if (massa <= 0 || comporta <= 0 || tempoEnsaioNum <= 0) return 0;
      const real = massa / (tempoEnsaioNum / 60);
      if (real <= 0) return 0;
      return comporta * (vazaoTeorica / real);
    }
    if (vazaoMax <= 0) return 0;
    return (vazaoTeorica / vazaoMax) * 100;
  }, [ehDrone, materialDrone, metodoSolido, vazaoTeorica, massa, comporta, tempoEnsaioNum, vazaoMax]);

  const desvioPercent = useMemo(() => {
    if (vazaoTeorica === 0) return 0;
    return ((mediaReal - vazaoTeorica) / vazaoTeorica) * 100;
  }, [mediaReal, vazaoTeorica]);

  const statusGeral = useMemo(() => getStatus(desvioPercent), [desvioPercent]);

  const handleStartColeta = (e: React.FormEvent) => {
    e.preventDefault();

    if (!modeloTrator.trim()) {
      toast.error(ehDrone ? "Informe o modelo do drone" : "Informe o modelo do trator");
      return;
    }
    if (ehLiquido) {
      const maxBicos = ehDrone ? 32 : 200;
      if (nBicos < 1 || nBicos > maxBicos) {
        toast.error(`Número de bicos deve ser entre 1 e ${maxBicos}`);
        return;
      }
    }
    if (ehDrone) {
      if (T <= 0 || V <= 0 || W <= 0) {
        toast.error(`Preencha ${materialDrone === "solido" ? "dose" : "taxa"}, faixa/largura (m) e velocidade (km/h)`);
        return;
      }
      if (materialDrone === "solido" && metodoSolido === "app" && vazaoMax <= 0) {
        toast.error("Informe a vazão máxima do sistema (kg/min) a 100% de comporta");
        return;
      }
      if (materialDrone === "solido" && comporta <= 0) {
        toast.error("Informe a abertura atual da comporta (%)");
        return;
      }
    } else if (T <= 0 || V <= 0 || E <= 0) {
      toast.error("Preencha todos os parâmetros de cálculo");
      return;
    }

    // Grade por bico: terrestre e drone líquido pelo método direto (volumétrico)
    setColetas(
      ehDireto
        ? Array.from({ length: ehLiquido ? nBicos : 1 }, (_, i) => ({
            nozzleNumber: i + 1,
            value: 0,
          }))
        : []
    );
    setStep("coleta");
    if (ehDireto) {
      toast.success(
        ehDrone
          ? `Drone estático no solo: colete a saída de cada bico durante ${tempoColetaNum} s.`
          : "Configuração salva! Informe as coletas de cada bico."
      );
    } else {
      toast.success("Configuração salva! Informe a leitura do método escolhido.");
    }
  };

  const handleColetaChange = (index: number, val: string) => {
    setColetas((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: parseFloat(val) || 0 };
      return updated;
    });
  };

  const handleCalcular = () => {
    if (ehDireto) {
      const allFilled = coletas.length > 0 && coletas.every((c) => c.value > 0);
      if (!allFilled) {
        toast.error("Preencha todas as coletas antes de calcular");
        return;
      }
    } else if (materialDrone === "liquido" && metodoLiquido === "sensor") {
      if (leituraSensorNum <= 0) {
        toast.error("Informe a vazão medida pelo fluxômetro (L/min)");
        return;
      }
      setColetas([{ nozzleNumber: 1, value: leituraSensorNum }]);
    } else if (ehBancada) {
      if (massa <= 0 || comporta <= 0 || tempoEnsaioNum <= 0) {
        toast.error("Informe a massa coletada (kg), o tempo e a abertura atual da comporta (%)");
        return;
      }
      const real = massa / (tempoEnsaioNum / 60);
      setColetas([{ nozzleNumber: 1, value: real }]);
    } else if (ehApp) {
      if (vazaoMax <= 0 || comporta <= 0) {
        toast.error("Informe a vazão máxima do sistema (kg/min) e a abertura atual da comporta (%)");
        return;
      }
      setColetas([{ nozzleNumber: 1, value: (vazaoMax * comporta) / 100 }]);
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
    setTipoAfericao("terrestre");
    setMaterialDrone("liquido");
    setMetodoLiquido("direto");
    setMetodoSolido("bancada");
    setFaixaUtil("");
    setTempoColeta("60");
    setTempoEnsaio("60");
    setMassaColetada("");
    setVazaoMaxSistema("");
    setComportaAtual("");
    setLeituraSensor("");
    toast.info("Formulário reiniciado");
  };

  const buildRecord = (): AfericaoVazaoRecord => ({
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
    modo: tipoAfericao,
    ...(ehDrone
      ? {
          material: materialDrone,
          metodo: ehLiquido ? (metodoLiquido === "direto" ? "volumetrico" : "sensor") : metodoSolido,
          faixaUtil: W,
          tempoColeta: ehDireto ? tempoColetaNum : tempoEnsaioNum,
          massaColetada: ehBancada ? massa : undefined,
          vazaoMaxSistema: ehApp ? vazaoMax : undefined,
          comportaAtual: ehBancada || ehApp ? comporta : undefined,
          comportaIdeal: (ehBancada || ehApp) && comportaIdeal > 0 ? comportaIdeal : undefined,
        }
      : {}),
  });

  const handleSave = async () => {
    if (step !== "resultado") return;
    setIsSaving(true);
    try {
      await saveAfericao(buildRecord());
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
    const ehDroneRec = record.modo === "drone";
    const solidoRec = ehDroneRec && record.material === "solido";
    const un = solidoRec ? "kg/min" : "L/min";
    const unDose = solidoRec ? "kg/ha" : "L/ha";
    const statusLabel = getStatusConfig(record.statusGeral, contextoDeRegistro(record)).label;
    const bicosAlerta = record.coletas.filter(c => {
      const vt = record.vazaoTeorica || 0;
      return vt > 0 && Math.abs((c.value - vt) / vt) * 100 > 10;
    }).length;

    const linhas = [
      `*Relatório de Aferição de Vazão* ${ehDroneRec ? "🛸" : "🚜"}`,
      "----------------------------------",
      `📍 *Local:* ${record.localColeta || "-"}`,
      `${ehDroneRec ? "🛸" : "🚜"} *Equipamento:* ${ehDroneRec ? `Drone ${record.frota}` : `Frota ${record.frota} (${record.modeloTrator})`}`,
      `👤 *Operador:* ${record.operador || "-"}`,
      `📅 *Data:* ${new Date(record.dataHora).toLocaleString("pt-BR")}`,
      "",
      `📊 *Resultado:* ${statusLabel.toUpperCase()}`,
      `📉 *Desvio Geral:* ${record.desvioPercent >= 0 ? "+" : ""}${record.desvioPercent.toFixed(2)}%`,
      ...(!solidoRec ? [`⚠️ *Bicos em Alerta:* ${bicosAlerta} de ${record.numeroBicos}`] : []),
      "",
      `⚙️ *Parâmetros:*`,
      `- ${solidoRec ? "Dose" : "Taxa Alvo"}: ${record.taxaDesejada} ${unDose}`,
      `- Velocidade: ${record.velocidade} km/h`,
      ...(ehDroneRec && record.faixaUtil ? [`- Faixa/largura útil: ${record.faixaUtil} m`] : []),
      ...(!ehDroneRec ? [`- Espaçamento: ${record.espacamento} cm`] : []),
      `- Vazão Teórica: ${record.vazaoTeorica.toFixed(3)} ${un}`,
      `- Média/Leitura Real: ${record.mediaReal.toFixed(3)} ${un}`,
      ...(record.comportaAtual ? [`- Comporta atual: ${record.comportaAtual}%`] : []),
      ...(record.comportaIdeal ? [`- Comporta ideal: ${record.comportaIdeal.toFixed(1)}%`] : []),
      "",
      "_Gerado pelo sistema MedBico_",
    ];

    const encodedText = encodeURIComponent(linhas.join("\n"));
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, "_blank");
  };

  const statusConfig = getStatusConfig(statusGeral, contextoStatus);
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
                    {/* Modo de aferição: Terrestre (padrão) × Drone */}
                    <div className="bg-muted/30 p-6 rounded-2xl space-y-4">
                      <h3 className="text-lg font-heading flex items-center gap-2">
                        <Settings className="h-5 w-5 text-primary" />
                        Modo de Aferição
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setTipoAfericao("terrestre")}
                          className={`rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${
                            !ehDrone ? "border-primary bg-primary/10" : "border-border bg-background"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-heading font-semibold">🚜 Terrestre</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Pulverizador · coleta por bico · 60 s</p>
                            </div>
                            {!ehDrone && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setTipoAfericao("drone")}
                          className={`rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${
                            ehDrone ? "border-primary bg-primary/10" : "border-border bg-background"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-heading font-semibold">🛸 Drone Agrícola</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Baixo volume (5–20 L/ha) · líquidos e sólidos</p>
                            </div>
                            {ehDrone && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
                          </div>
                        </button>
                      </div>

                      {ehDrone && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold">Material a Aferir</Label>
                            <Select value={materialDrone} onValueChange={(v) => setMaterialDrone(v as MaterialDrone)}>
                              <SelectTrigger className="h-11">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="liquido">Líquidos — calda (vazão em L/min)</SelectItem>
                                <SelectItem value="solido">Sólidos — granulados, adubos e sementes (kg/min)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold">Método de Medição</Label>
                            {materialDrone === "liquido" ? (
                              <Select value={metodoLiquido} onValueChange={(v) => setMetodoLiquido(v as MetodoLiquido)}>
                                <SelectTrigger className="h-11">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="direto">Direto (Volumétrico) — proveta por bico</SelectItem>
                                  <SelectItem value="sensor">Sensores de Vazão — fluxômetro integrado</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Select value={metodoSolido} onValueChange={(v) => setMetodoSolido(v as MetodoSolido)}>
                                <SelectTrigger className="h-11">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bancada">Ensaio de Bancada / Solo — balança de precisão</SelectItem>
                                  <SelectItem value="app">Calibração pelo App do Drone — comporta/densidade</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

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
                          <Tractor className="h-3.5 w-3.5 text-primary" /> {ehDrone ? "Modelo do Drone" : "Modelo do Trator"}
                        </Label>
                        <Input
                          id="modelo"
                          placeholder={ehDrone ? "Ex: DJI Agras T40" : "Ex: John Deere 6125J"}
                          value={modeloTrator}
                          onChange={(e) => setModeloTrator(e.target.value)}
                          className="h-11"
                        />
                      </div>

                      {!ehDrone && (
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
                      )}

                      {ehLiquido && (
                      <div className="space-y-2">
                        <Label htmlFor="bicos" className="text-sm font-semibold flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-primary" /> Quantidade de Bicos
                        </Label>
                        <Input
                          id="bicos"
                          type="number"
                          placeholder={ehDrone ? "4" : "60"}
                          value={numeroBicos}
                          onChange={(e) => setNumeroBicos(e.target.value)}
                          className="h-11"
                        />
                      </div>
                      )}

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
                          <Label htmlFor="taxa" className="text-sm font-semibold">
                            {ehDrone && materialDrone === "solido" ? "Dose Desejada (kg/ha)" : "Taxa Desejada (L/ha)"}
                          </Label>
                          <Input
                            id="taxa"
                            type="number"
                            placeholder={ehDrone ? (materialDrone === "solido" ? "Ex: 30" : "Ex: 10") : "Ex: 100"}
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
                            placeholder={ehDrone ? "Ex: 20" : "Ex: 8"}
                            value={velocidade}
                            onChange={(e) => setVelocidade(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          {!ehDrone ? (
                            <>
                              <Label htmlFor="espacamento" className="text-sm font-semibold">Espaçamento Bicos (cm)</Label>
                              <Input
                                id="espacamento"
                                type="number"
                                placeholder="Ex: 50"
                                value={espacamento}
                                onChange={(e) => setEspacamento(e.target.value)}
                                className="h-11 text-lg font-mono font-bold"
                              />
                            </>
                          ) : (
                            <>
                              <Label htmlFor="faixa" className="text-sm font-semibold">
                                {materialDrone === "solido" ? "Largura de Espalhamento (m)" : "Faixa Útil de Aplicação (m)"}
                              </Label>
                              <Input
                                id="faixa"
                                type="number"
                                placeholder={materialDrone === "solido" ? "Ex: 7" : "Ex: 6"}
                                value={faixaUtil}
                                onChange={(e) => setFaixaUtil(e.target.value)}
                                className="h-11 text-lg font-mono font-bold"
                              />
                            </>
                          )}
                        </div>
                      </div>

                      {vazaoTeorica > 0 && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 animate-in fade-in zoom-in duration-300 space-y-2">
                          {!ehDrone ? (
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Vazão Teórica por Bico (qt)</p>
                                <p className="text-3xl font-heading text-primary font-bold">{vazaoTeorica.toFixed(3)} <span className="text-sm font-normal">L/min</span></p>
                              </div>
                            </div>
                          ) : materialDrone === "liquido" ? (
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Vazão Total do Sistema (Q_total)</p>
                                <p className="text-3xl font-heading text-primary font-bold">{vazaoTotalTeorica.toFixed(3)} <span className="text-sm font-normal">L/min</span></p>
                                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                  Q = (V × W × v) ÷ 600 = ({T} × {W} × {V}) ÷ 600
                                </p>
                              </div>
                              {metodoLiquido === "direto" && nBicos > 0 && (
                                <div className="pt-2 border-t border-primary/20">
                                  <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Alvo por Bico (Q ÷ {nBicos} bicos)</p>
                                  <p className="text-2xl font-heading text-primary font-bold">{vazaoTeorica.toFixed(3)} <span className="text-sm font-normal">L/min</span></p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Vazão de Massa Teórica (M)</p>
                              <p className="text-3xl font-heading text-primary font-bold">{vazaoTeorica.toFixed(3)} <span className="text-sm font-normal">kg/min</span></p>
                              <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                M = (D × W × v) ÷ 600 = ({T} × {W} × {V}) ÷ 600
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Button type="submit" size="lg" className="w-full h-14 text-lg font-heading group">
                      {ehDireto ? "Iniciar Coleta de Dados" : "Registrar Leitura"}
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
                    <h2 className="text-2xl font-heading text-foreground tracking-tight">
                      {!ehDrone
                        ? "Coleta de Volume"
                        : ehDireto
                        ? "Coleta de Vazão — Drone"
                        : materialDrone === "liquido"
                        ? "Leitura do Fluxômetro — Drone"
                        : "Ensaio de Vazão de Massa — Drone"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {!ehDrone
                        ? "Colete o volume de cada bico durante 60 segundos"
                        : ehDireto
                        ? `Drone estático no solo, sistema ligado na rotação de trabalho — cole a saída de cada bico durante ${tempoColetaNum} segundos${tempoColetaNum === 30 ? " (multiplique por 2 para obter L/min — conversão automática)" : ""}`
                        : materialDrone === "liquido"
                        ? "Informe a vazão total medida pelo fluxômetro integrado (ex.: DJI Agras, XAG) em tempo real"
                        : metodoSolido === "bancada"
                        ? "Comporta aberta na porcentagem de trabalho  pese a massa expelida em um intervalo de tempo exato"
                        : "Informe a vazão máxima do sistema e a abertura atual de comporta informadas no app/manual do drone"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Reiniciar
                    </Button>
                    <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-bold border border-primary/20">
                      Vazão Alvo: {vazaoTeorica.toFixed(3)} {unidadeVazao}
                    </div>
                  </div>
                </div>

                {/* Tempo de coleta — drone líquido, método direto */}
                {ehDrone && materialDrone === "liquido" && metodoLiquido === "direto" && (
                  <div className="flex items-center gap-3 flex-wrap bg-muted/30 rounded-xl p-4">
                    <span className="text-sm font-semibold">Tempo de coleta:</span>
                    <Select value={tempoColeta} onValueChange={setTempoColeta}>
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">60 segundos</SelectItem>
                        <SelectItem value="30">30 segundos (× 2)</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      O volume coletado é convertido automaticamente para L/min.
                    </span>
                  </div>
                )}

                {ehDireto ? (
                <Card className="shadow-lg overflow-hidden border-border/50">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-0 border-t border-l border-border/50">
                      {coletas.map((c, i) => {
                        const valorNorm = c.value * fatorTempo;
                        const status = getNozzleStatus(valorNorm, vazaoTeorica);
                        const desvio = vazaoTeorica > 0 ? ((valorNorm - vazaoTeorica) / vazaoTeorica) * 100 : 0;
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
                ) : (
                <Card className="shadow-lg border-border/50">
                  <CardContent className="p-6 space-y-5">
                    {/* Drone líquido — leitura do fluxômetro */}
                    {materialDrone === "liquido" && metodoLiquido === "sensor" && (
                      <div className="space-y-2 max-w-sm">
                        <Label htmlFor="sensor" className="text-sm font-semibold">Vazão medida pelo fluxômetro (L/min)</Label>
                        <Input
                          id="sensor"
                          type="number"
                          step="0.001"
                          placeholder="Ex: 2.000"
                          value={leituraSensor}
                          onChange={(e) => setLeituraSensor(e.target.value)}
                          className="h-11 text-lg font-mono font-bold"
                        />
                        <p className="text-xs text-muted-foreground">
                          Valor total de saída de todos os bicos, lido no app do drone.
                        </p>
                      </div>
                    )}

                    {/* Drone sólido — ensaio de bancada (gravimétrico) */}
                    {ehBancada && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="massa" className="text-sm font-semibold">Massa coletada (kg)</Label>
                          <Input
                            id="massa"
                            type="number"
                            step="0.001"
                            placeholder="Ex: 4.375"
                            value={massaColetada}
                            onChange={(e) => setMassaColetada(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Tempo de ensaio</Label>
                          <Select value={tempoEnsaio} onValueChange={setTempoEnsaio}>
                            <SelectTrigger className="h-11">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="60">60 segundos</SelectItem>
                              <SelectItem value="30">30 segundos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="comporta" className="text-sm font-semibold">Comporta atual (%)</Label>
                          <Input
                            id="comporta"
                            type="number"
                            step="1"
                            placeholder="Ex: 50"
                            value={comportaAtual}
                            onChange={(e) => setComportaAtual(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                        {massa > 0 && comporta > 0 && (
                          <div className="md:col-span-3 rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                            Vazão real = {massa} kg ÷ {tempoEnsaioNum} s ={" "}
                            <span className="font-mono font-bold">
                              {(massa / (tempoEnsaioNum / 60)).toFixed(3)} kg/min
                            </span>{" "}
                            (comporta {comporta}%)
                          </div>
                        )}
                      </div>
                    )}

                    {/* Drone sólido — calibração pelo app (comporta/densidade) */}
                    {ehApp && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="vazaoMax" className="text-sm font-semibold">Vazão máxima do sistema (kg/min a 100%)</Label>
                          <Input
                            id="vazaoMax"
                            type="number"
                            step="0.001"
                            placeholder="Ex: 20.000"
                            value={vazaoMaxSistema}
                            onChange={(e) => setVazaoMaxSistema(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="comportaApp" className="text-sm font-semibold">Comporta atual (%)</Label>
                          <Input
                            id="comportaApp"
                            type="number"
                            step="1"
                            placeholder="Ex: 50"
                            value={comportaAtual}
                            onChange={(e) => setComportaAtual(e.target.value)}
                            className="h-11 text-lg font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Vazão real estimada</Label>
                          <div className="h-11 flex items-center px-3 rounded-md border border-border bg-muted/40 font-mono font-bold text-lg">
                            {vazaoMax > 0 && comporta > 0 ? `${((vazaoMax * comporta) / 100).toFixed(3)} kg/min` : ""}
                          </div>
                        </div>
                        <p className="md:col-span-3 text-xs text-muted-foreground">
                          Consulte no app do drone ou no manual a vazão do sistema com a comporta totalmente aberta; recalibre sempre que mudar o lote do insumo (densidade).
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                )}

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
                    <p className="text-muted-foreground text-sm font-medium">
                      {ehDrone
                        ? ehLiquido
                          ? "🛸 Aferição de vazão — Drone agrícola (líquidos em baixo volume)"
                          : "🛸 Aferição de vazão de massa — Drone agrícola (granulados, adubos e sementes)"
                        : "Análise detalhada da uniformidade de aplicação"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleImprimir}>
                      <Printer className="h-4 w-4 mr-1" /> Imprimir PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleShare(buildRecord())}>
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
                          <div><p className="text-muted-foreground">{ehDrone ? "Drone" : "Trator"}</p><p className="font-medium">{modeloTrator}</p></div>
                          <div><p className="text-muted-foreground">Frota</p><p className="font-medium">{frota}</p></div>
                          <div><p className="text-muted-foreground">Modo</p><p className="font-medium">{ehDrone ? "🛸 Drone" : "🚜 Terrestre"}</p></div>
                          {ehDrone && (
                            <div>
                              <p className="text-muted-foreground">Material / Método</p>
                              <p className="font-medium">
                                {materialDrone === "solido" ? "Sólido" : "Líquido"} —{" "}
                                {materialDrone === "solido"
                                  ? metodoSolido === "bancada"
                                    ? "Bancada"
                                    : "App"
                                  : metodoLiquido === "direto"
                                  ? "Volumétrico"
                                  : "Fluxômetro"}
                              </p>
                            </div>
                          )}
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
                          <div className="bg-muted p-2 rounded">
                            <p className="text-xs">{ehDireto ? "Alvo por Bico" : "Vazão Teórica"}</p>
                            <p className="font-bold">{vazaoTeorica.toFixed(3)} {unidadeVazao}</p>
                          </div>
                          <div className="bg-muted p-2 rounded">
                            <p className="text-xs">{ehDireto ? "Média Real por Bico" : "Média / Leitura Real"}</p>
                            <p className="font-bold">{mediaReal.toFixed(3)} {unidadeVazao}</p>
                          </div>
                          {ehDrone && materialDrone === "liquido" && (
                            <div className="bg-muted p-2 rounded">
                              <p className="text-xs">Q_total do sistema</p>
                              <p className="font-bold">{vazaoTotalTeorica.toFixed(3)} L/min</p>
                            </div>
                          )}
                          {ehDrone && materialDrone === "solido" && comportaIdeal > 0 && (
                            <div className="bg-primary/10 border border-primary/20 p-2 rounded">
                              <p className="text-xs">Comporta Ideal</p>
                              <p className="font-bold text-primary">
                                {comportaIdeal.toFixed(1)}%{comporta > 0 ? ` (atual ${comporta}%)` : ""}
                              </p>
                            </div>
                          )}
                          {ehDrone && comportaIdeal > 100 && (
                            <p className="col-span-2 text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Abertura ideal acima de 100% — o sistema não alcança a taxa desejada: aumente a faixa/velocidade ou divida em mais passadas.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="shadow-lg animate-slide-up print:shadow-none">
                    <CardHeader className="border-b border-border print:p-1.5">
                      <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                        <Beaker className="h-5 w-5 text-primary print:h-3 print:w-3" />
                        {ehDireto ? "Análise Individual dos Bicos" : "Análise da Leitura"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm print:text-[7px]">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold print:px-1 print:py-0.5">{ehDireto ? "Bico" : "Leitura"}</th>
                              <th className="px-4 py-3 text-right font-semibold print:px-1 print:py-0.5">
                                {ehLiquido ? "Vazão" : "Vazão de Massa"} ({unidadeVazao})
                              </th>
                              <th className="px-4 py-3 text-right font-semibold print:px-1 print:py-0.5">Desvio (%)</th>
                              <th className="px-4 py-3 text-center font-semibold print:px-1 print:py-0.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {coletas.map((c) => {
                              const valorNorm = c.value * fatorTempo;
                              const desvio = vazaoTeorica > 0 ? ((valorNorm - vazaoTeorica) / vazaoTeorica) * 100 : 0;
                              const status = getNozzleStatus(valorNorm, vazaoTeorica);
                              return (
                                <tr key={c.nozzleNumber} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-2 font-medium print:px-1 print:py-0.5">{ehDireto ? `#${c.nozzleNumber}` : "Medido"}</td>
                                  <td className="px-4 py-2 text-right font-mono print:px-1 print:py-0.5">{valorNorm.toFixed(3)}</td>
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

                  {ehDrone && (
                    <div className="print:grid print:grid-cols-2 print:gap-1 space-y-6 print:space-y-0">
                      <Card className="shadow-lg animate-slide-up print:shadow-none">
                        <CardHeader className="border-b border-border print:p-1.5">
                          <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                            <Calculator className="h-5 w-5 text-primary print:h-3 print:w-3" />
                            Fórmula Aplicada
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-3 print:p-1.5 print:text-[8px]">
                          {materialDrone === "liquido" ? (
                            <>
                              <div className="font-mono text-sm bg-muted p-3 rounded-lg break-words">
                                Q_total = (V × W × v) / 600 = ({T} × {W} × {V}) / 600 = {vazaoTotalTeorica.toFixed(3)} L/min
                              </div>
                              {ehDireto && (
                                <p className="text-xs text-muted-foreground">
                                  Alvo por bico = Q_total / {nBicos} bicos = {vazaoTeorica.toFixed(3)} L/min
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Taxa {T} L/ha · faixa {W} m · velocidade {V} km/h
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="font-mono text-sm bg-muted p-3 rounded-lg break-words">
                                M_vazão = (D × W × v) / 600 = ({T} × {W} × {V}) / 600 = {vazaoTeorica.toFixed(3)} kg/min
                              </div>
                              {ehBancada && massa > 0 && (
                                <div className="font-mono text-sm bg-muted p-3 rounded-lg break-words">
                                  Real = {massa} kg / ({tempoEnsaioNum} / 60) = {(massa / (tempoEnsaioNum / 60)).toFixed(3)} kg/min
                                </div>
                              )}
                              {ehApp && comporta > 0 && vazaoMax > 0 && (
                                <div className="font-mono text-sm bg-muted p-3 rounded-lg break-words">
                                  Real = {vazaoMax} × {comporta}% = {((vazaoMax * comporta) / 100).toFixed(3)} kg/min
                                </div>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Taxa {T} kg/ha · faixa {W} m · velocidade {V} km/h
                              </p>
                            </>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="shadow-lg animate-slide-up print:shadow-none">
                        <CardHeader className="border-b border-border print:p-1.5">
                          <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                            <AlertTriangle className="h-5 w-5 text-primary print:h-3 print:w-3" />
                            Boas Práticas — Calibração de Drone
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 print:p-1.5">
                          <ul className="space-y-2 text-sm print:text-[8px] print:space-y-0.5">
                            <li className="flex gap-2"><span className="font-bold text-primary shrink-0">1.</span> Enxágue o sistema com água limpa <strong>antes</strong> de calibrar e ao terminar; nunca faça a calibração com calda viscosa já no tanque.</li>
                            <li className="flex gap-2"><span className="font-bold text-primary shrink-0">2.</span> Desvio entre bicos <strong>&gt; 10%</strong> ⇒ trocar ou limpar o bico — desigualdade além desse limite invalida a aplicação.</li>
                            <li className="flex gap-2"><span className="font-bold text-primary shrink-0">3.</span> Recalibre a cada <strong>novo lote de sólido</strong>: a densidade muda de lote para lote e altera a vazão de massa.</li>
                            <li className="flex gap-2"><span className="font-bold text-primary shrink-0">4.</span> Faixa efetiva de trabalho <strong>não é a envergadura</strong> do drone — meça com copos (teste em campo) antes de usar em W.</li>
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  )}
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
                    const hConfig = getStatusConfig(h.statusGeral, contextoDeRegistro(h));
                    const HStatusIcon = hConfig.icon;
                    const ehDroneRec = h.modo === "drone";
                    return (
                      <div key={h.id} className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-foreground">Frota {h.frota}</span>
                            <Badge className={`${hConfig.className} text-[10px] py-0 px-1.5`}>
                              <HStatusIcon className="h-3 w-3 mr-1" />
                              {hConfig.label}
                            </Badge>
                            <Badge variant={ehDroneRec ? "default" : "secondary"} className="text-[10px] py-0 px-1.5">
                              {ehDroneRec ? "🛸 Drone" : "🚜 Terrestre"}
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
          {viewHistoryRecord && (() => {
            const rec = viewHistoryRecord;
            const ehDroneRec = rec.modo === "drone";
            const ehLiquidoRec = !ehDroneRec || rec.material !== "solido";
            const ehDiretoRec = ehLiquidoRec && rec.metodo === "volumetrico";
            const fatorRec = ehDiretoRec && rec.tempoColeta && rec.tempoColeta !== 60 ? 60 / rec.tempoColeta : 1;
            const unidadeRec = ehLiquidoRec ? "L/min" : "kg/min";
            const recConfig = getStatusConfig(rec.statusGeral, contextoDeRegistro(rec));
            return (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl flex items-center gap-3 ${recConfig.className}`}>
                <div><p className="font-bold">{recConfig.label}</p><p className="text-xs opacity-80">Desvio: {rec.desvioPercent.toFixed(2)}%</p></div>
                <Badge variant={ehDroneRec ? "default" : "secondary"} className="ml-auto text-[10px] py-0 px-1.5">
                  {ehDroneRec ? "🛸 Drone" : "🚜 Terrestre"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div className="p-2 border rounded"><b>Data:</b> {new Date(rec.dataHora).toLocaleString("pt-BR")}</div>
                <div className="p-2 border rounded"><b>Frota:</b> {rec.frota}</div>
                <div className="p-2 border rounded"><b>Operador:</b> {rec.operador}</div>
                <div className="p-2 border rounded"><b>Taxa:</b> {rec.taxaDesejada} {ehLiquidoRec ? "L/ha" : "kg/ha"}</div>
                <div className="p-2 border rounded"><b>Alvo:</b> {(rec.vazaoTeorica || 0).toFixed(3)} {unidadeRec}</div>
                <div className="p-2 border rounded"><b>Média real:</b> {(rec.mediaReal || 0).toFixed(3)} {unidadeRec}</div>
                {ehDroneRec && rec.faixaUtil ? <div className="p-2 border rounded"><b>Faixa útil:</b> {rec.faixaUtil} m</div> : null}
                {ehDroneRec && rec.comportaIdeal ? <div className="p-2 border rounded"><b>Comporta ideal:</b> {rec.comportaIdeal.toFixed(1)}%</div> : null}
              </div>
              <div className="border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left">{ehDiretoRec ? "Bico" : "Leitura"}</th>
                      <th className="px-3 py-2 text-right">{unidadeRec}</th>
                      <th className="px-3 py-2 text-right">Desvio (%)</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.coletas.map(c => {
                      const vt = rec.vazaoTeorica || 0;
                      const valorNorm = c.value * fatorRec;
                      const desvio = vt > 0 ? ((valorNorm - vt) / vt) * 100 : 0;
                      const status = getNozzleStatus(valorNorm, vt);
                      return (
                        <tr key={c.nozzleNumber} className="border-t">
                          <td className="px-3 py-1.5">{ehDiretoRec ? `#${c.nozzleNumber}` : "Medido"}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{valorNorm.toFixed(3)}</td>
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
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
