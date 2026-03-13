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
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EquipmentRecord {
  id: string;
  fleet_number: string;
  tractor_model: string | null;
  equipment_model: string;
  total_nozzles: number;
}

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
  const reportRef = useRef<HTMLDivElement>(null);

  const [modeloTrator, setModeloTrator] = useState("");
  const [frota, setFrota] = useState("");
  const [tipoImplemento, setTipoImplemento] = useState("");
  const [numeroBicos, setNumeroBicos] = useState("");
  const [localColeta, setLocalColeta] = useState("");
  const [operador, setOperador] = useState("");
  const [turno, setTurno] = useState("");
  const dataHora = useMemo(() => new Date(), []);

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

  const handleReset = () => {
    setStep("config");
    setColetas([]);
    toast.info("Formulário reiniciado");
  };

  // Step 1: Configuration
  if (step === "config") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                Etapa 1 de 3
              </span>
              <span>Configuração</span>
            </div>
            <h1 className="text-3xl font-heading text-foreground mb-2">
              Aferir Vazão do Implemento
            </h1>
            <p className="text-muted-foreground">
              Calibração de pulverização agrícola com cálculo de vazão teórica e desvio.
            </p>
          </div>

          <form onSubmit={handleStartColeta} className="space-y-6">
            {/* Identification */}
            <Card className="shadow-lg animate-slide-up">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Identificação
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tractor className="h-4 w-4 text-muted-foreground" />
                      Modelo do Trator *
                    </Label>
                    <Input
                      placeholder="Ex: John Deere 8R 410"
                      value={modeloTrator}
                      onChange={(e) => setModeloTrator(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      Frota
                    </Label>
                    <Input
                      placeholder="Ex: FR-001"
                      value={frota}
                      onChange={(e) => setFrota(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Implemento *</Label>
                    <Select value={tipoImplemento} onValueChange={setTipoImplemento} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="barra">Barra</SelectItem>
                        <SelectItem value="turbo">Turbo</SelectItem>
                        <SelectItem value="costal">Costal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Bicos *</Label>
                    <Input
                      type="number"
                      min="1"
                      max="200"
                      placeholder="Ex: 48"
                      value={numeroBicos}
                      onChange={(e) => setNumeroBicos(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Local da Coleta
                    </Label>
                    <Input
                      placeholder="Ex: Fazenda São Pedro - Talhão 5"
                      value={localColeta}
                      onChange={(e) => setLocalColeta(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Operador
                    </Label>
                    <Input
                      placeholder="Nome do operador"
                      value={operador}
                      onChange={(e) => setOperador(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Turno
                    </Label>
                    <Select value={turno} onValueChange={setTurno}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o turno" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noite">Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data / Hora</Label>
                    <Input
                      value={dataHora.toLocaleString("pt-BR")}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calculation Parameters */}
            <Card className="shadow-lg animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Parâmetros de Cálculo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Taxa Desejada (L/ha) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      placeholder="Ex: 150"
                      value={taxaDesejada}
                      onChange={(e) => setTaxaDesejada(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Velocidade (km/h) *</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="Ex: 8"
                      value={velocidade}
                      onChange={(e) => setVelocidade(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Espaçamento entre Bicos (cm) *</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="Ex: 50"
                      value={espacamento}
                      onChange={(e) => setEspacamento(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {vazaoTeorica > 0 && (
                  <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Vazão Teórica por Bico (q<sub>t</sub>)</p>
                    <p className="text-2xl font-heading text-primary">
                      {vazaoTeorica.toFixed(3)} <span className="text-base font-normal">L/min</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      q<sub>t</sub> = ({T} × {V} × {E}) / 60.000
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" size="lg">
                Iniciar Coleta
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Nozzle data collection
  if (step === "coleta") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                Etapa 2 de 3
              </span>
              <span>Coleta de Dados</span>
            </div>
            <h1 className="text-3xl font-heading text-foreground mb-2">
              Coleta por Bico
            </h1>
            <p className="text-muted-foreground">
              Informe a vazão coletada (L/min) de cada bico. Vazão teórica: <strong>{vazaoTeorica.toFixed(3)} L/min</strong>
            </p>
          </div>

          <Card className="shadow-lg animate-slide-up">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {coletas.map((c, i) => (
                  <div key={c.nozzleNumber} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Bico {c.nozzleNumber}
                    </Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      value={c.value || ""}
                      onChange={(e) => handleColetaChange(i, e.target.value)}
                      className="text-center font-mono text-sm"
                    />
                  </div>
                ))}
              </div>

              {mediaReal > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Média Real (q̄)</p>
                      <p className="text-lg font-heading text-foreground">{mediaReal.toFixed(3)} L/min</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Vazão Teórica (q<sub>t</sub>)</p>
                      <p className="text-lg font-heading text-foreground">{vazaoTeorica.toFixed(3)} L/min</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Desvio</p>
                      <p className={`text-lg font-heading ${
                        Math.abs(desvioPercent) <= 5 ? "text-success" :
                        Math.abs(desvioPercent) <= 10 ? "text-warning" : "text-destructive"
                      }`}>
                        {desvioPercent >= 0 ? "+" : ""}{desvioPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setStep("config")}>
                  Voltar
                </Button>
                <Button size="lg" onClick={handleCalcular}>
                  Calcular Resultado
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Results & Report
  const statusConfig = getStatusConfig(statusGeral);
  const StatusIcon = statusConfig.icon;

  const bicosAlerta = coletas.filter((c) => getNozzleStatus(c.value, mediaReal) === "alerta");
  const turnoLabel = turno === "manha" ? "Manhã" : turno === "tarde" ? "Tarde" : turno === "noite" ? "Noite" : "-";
  const implementoLabel = tipoImplemento === "barra" ? "Barra" : tipoImplemento === "turbo" ? "Turbo" : tipoImplemento === "costal" ? "Costal" : "-";

  return (
    <div className="container mx-auto px-4 py-8 print:px-2 print:py-1">
      <div className="max-w-4xl mx-auto print:max-w-full">
        {/* Screen header - hidden on print */}
        <div className="mb-8 animate-fade-in flex items-center justify-between print:hidden">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
                Etapa 3 de 3
              </span>
              <span>Resultado</span>
            </div>
            <h1 className="text-3xl font-heading text-foreground">
              Relatório de Calibração
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Nova Aferição
            </Button>
            <Button size="sm" onClick={handleImprimir}>
              <Printer className="h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>

        <div ref={reportRef} className="space-y-6 print:space-y-1">
          {/* Print-only compact header */}
          <div className="hidden print:block border-b border-border pb-1 mb-1">
            <h1 className="text-sm font-heading text-foreground text-center">
              Relatório de Calibração de Vazão
            </h1>
            <p className="text-center text-[8px] text-muted-foreground">
              Gerado em: {dataHora.toLocaleString("pt-BR")}
            </p>
          </div>

          {/* Status Card - compact on print */}
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

          {/* Identification + Calculation side by side on print */}
          <div className="print:grid print:grid-cols-2 print:gap-1 space-y-6 print:space-y-0">
            {/* Identification Summary */}
            <Card className="shadow-lg animate-slide-up print:shadow-none" style={{ animationDelay: "0.05s" }}>
              <CardHeader className="border-b border-border print:p-1.5 print:pb-0.5">
                <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                  <FileText className="h-5 w-5 text-primary print:h-3 print:w-3" />
                  Dados da Aferição
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 print:p-1.5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm print:grid-cols-2 print:gap-0.5 print:text-[8px]">
                  <div>
                    <p className="text-muted-foreground">Trator</p>
                    <p className="font-medium text-foreground">{modeloTrator || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Frota</p>
                    <p className="font-medium text-foreground">{frota || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Implemento</p>
                    <p className="font-medium text-foreground">{implementoLabel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nº Bicos</p>
                    <p className="font-medium text-foreground">{nBicos}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Local</p>
                    <p className="font-medium text-foreground">{localColeta || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Operador</p>
                    <p className="font-medium text-foreground">{operador || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Turno</p>
                    <p className="font-medium text-foreground">{turnoLabel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data/Hora</p>
                    <p className="font-medium text-foreground">{dataHora.toLocaleString("pt-BR")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calculation Summary */}
            <Card className="shadow-lg animate-slide-up print:shadow-none" style={{ animationDelay: "0.1s" }}>
              <CardHeader className="border-b border-border print:p-1.5 print:pb-0.5">
                <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                  <Calculator className="h-5 w-5 text-primary print:h-3 print:w-3" />
                  Resumo do Cálculo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 print:p-1.5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:grid-cols-2 print:gap-0.5">
                  <div className="p-4 rounded-lg bg-muted/50 text-center print:p-1 print:rounded">
                    <p className="text-xs text-muted-foreground mb-1 print:text-[7px] print:mb-0">Taxa Desejada</p>
                    <p className="text-xl font-heading text-foreground print:text-[9px]">{T} <span className="text-xs font-normal print:text-[7px]">L/ha</span></p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center print:p-1 print:rounded">
                    <p className="text-xs text-muted-foreground mb-1 print:text-[7px] print:mb-0">Vazão Teórica</p>
                    <p className="text-xl font-heading text-primary print:text-[9px]">{vazaoTeorica.toFixed(3)} <span className="text-xs font-normal print:text-[7px]">L/min</span></p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50 text-center print:p-1 print:rounded">
                    <p className="text-xs text-muted-foreground mb-1 print:text-[7px] print:mb-0">Média Real</p>
                    <p className="text-xl font-heading text-foreground print:text-[9px]">{mediaReal.toFixed(3)} <span className="text-xs font-normal print:text-[7px]">L/min</span></p>
                  </div>
                  <div className={`p-4 rounded-lg text-center print:p-1 print:rounded ${
                    Math.abs(desvioPercent) <= 5 ? "bg-success/10" :
                    Math.abs(desvioPercent) <= 10 ? "bg-warning/10" : "bg-destructive/10"
                  }`}>
                    <p className="text-xs text-muted-foreground mb-1 print:text-[7px] print:mb-0">Desvio (%)</p>
                    <p className={`text-xl font-heading print:text-[9px] ${
                      Math.abs(desvioPercent) <= 5 ? "text-success" :
                      Math.abs(desvioPercent) <= 10 ? "text-warning" : "text-destructive"
                    }`}>
                      {desvioPercent >= 0 ? "+" : ""}{desvioPercent.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded bg-muted/30 text-xs text-muted-foreground font-mono print:mt-1 print:p-1 print:text-[6px]">
                  q<sub>t</sub> = ({T} × {V} × {E}) / 60.000 = {vazaoTeorica.toFixed(3)} L/min &nbsp;|&nbsp;
                  q̄ = Σcoletas / {nBicos} = {mediaReal.toFixed(3)} L/min &nbsp;|&nbsp;
                  Erro = {desvioPercent.toFixed(2)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Nozzle Detail Table */}
          <Card className="shadow-lg animate-slide-up print:shadow-none print:break-inside-avoid" style={{ animationDelay: "0.15s" }}>
            <CardHeader className="border-b border-border print:p-1.5 print:pb-0.5">
              <CardTitle className="text-lg flex items-center gap-2 print:text-[9px]">
                <Gauge className="h-5 w-5 text-primary print:h-3 print:w-3" />
                Coleta por Bico
                {bicosAlerta.length > 0 && (
                  <Badge variant="destructive" className="ml-2 print:text-[7px] print:px-1 print:py-0">
                    {bicosAlerta.length} bico(s) com desvio &gt; 10%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 print:p-1">
              <div className="overflow-visible">
                <table className="w-full text-sm print:text-[8px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-2 px-3 text-muted-foreground font-medium print:py-0.5 print:px-1">Bico</th>
                      <th className="py-2 px-3 text-muted-foreground font-medium print:py-0.5 print:px-1">Vazão (L/min)</th>
                      <th className="py-2 px-3 text-muted-foreground font-medium print:py-0.5 print:px-1">Desvio vs Média</th>
                      <th className="py-2 px-3 text-muted-foreground font-medium print:py-0.5 print:px-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coletas.map((c) => {
                      const desvioIndividual = mediaReal > 0 ? ((c.value - mediaReal) / mediaReal) * 100 : 0;
                      const isAlerta = Math.abs(desvioIndividual) > 10;
                      return (
                        <tr
                          key={c.nozzleNumber}
                          className={`border-b border-border/50 ${isAlerta ? "bg-destructive/5" : ""}`}
                        >
                          <td className="py-2 px-3 font-mono print:py-0 print:px-1">{c.nozzleNumber}</td>
                          <td className="py-2 px-3 font-mono print:py-0 print:px-1">{c.value.toFixed(3)}</td>
                          <td className={`py-2 px-3 font-mono print:py-0 print:px-1 ${
                            isAlerta ? "text-destructive font-semibold" :
                            Math.abs(desvioIndividual) <= 5 ? "text-success" : "text-warning"
                          }`}>
                            {desvioIndividual >= 0 ? "+" : ""}{desvioIndividual.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 print:py-0 print:px-1">
                            {isAlerta ? (
                              <Badge variant="destructive" className="text-xs print:text-[7px] print:px-0.5 print:py-0">⚠ Fora</Badge>
                            ) : (
                              <Badge className="bg-success/10 text-success border-success/30 text-xs print:text-[7px] print:px-0.5 print:py-0">OK</Badge>
                            )}
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
    </div>
  );
}
