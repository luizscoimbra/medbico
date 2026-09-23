import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Battery,
  AlertTriangle,
  History,
  Plus,
  Zap,
  Thermometer,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  getAllDroneComponents,
  getDroneComponents,
  createDroneComponent,
  updateDroneComponent,
  deleteDroneComponent,
  createBatteryCycle,
  updateBatteryCycle,
  deleteBatteryCycle,
  getBatteryCycles,
  getAllDrones,
  DroneComponent,
  BatteryCycle,
  Drone,
} from "@/lib/droneStorage";

const MAX_CYCLES = 350;

const AVARIA_OPTIONS: { value: string; label: string }[] = [
  { value: "estufamento", label: "Estufamento" },
  { value: "risco_conector", label: "Risco Conector" },
  { value: "aquecimento_excessivo", label: "Aquecimento Excessivo" },
  { value: "queda_tensao", label: "Queda de Tensao" },
  { value: "outro", label: "Outro" },
];

function getStatus(ciclosAtuais: number, cicloMaximo: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (cicloMaximo <= 0) return { label: "Sem limite", variant: "default" };
  const percentual = (ciclosAtuais / cicloMaximo) * 100;
  if (percentual >= 90) return { label: "Critico", variant: "destructive" };
  if (percentual >= 70) return { label: "Alerta", variant: "secondary" };
  return { label: "OK", variant: "default" };
}

function getCycleProgressColor(ciclosAtuais: number, cicloMaximo: number): string {
  if (cicloMaximo <= 0) return "bg-emerald-500";
  const percentual = (ciclosAtuais / cicloMaximo) * 100;
  if (percentual >= 90) return "bg-red-500";
  if (percentual >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

interface CycleFormData {
  ciclo_numero: string;
  voltagem_inicio: string;
  voltagem_fim: string;
  soh: string;
  temperatura_operacao: string;
  tempo_carga_min: string;
  avarias: string[];
  observacoes: string;
}

const DEFAULT_CYCLE_FORM: CycleFormData = {
  ciclo_numero: "",
  voltagem_inicio: "",
  voltagem_fim: "",
  soh: "",
  temperatura_operacao: "",
  tempo_carga_min: "",
  avarias: [],
  observacoes: "",
};

interface BatteryWithDrone extends BatteryCycle {
  droneModelo?: string;
}

export default function BatteryManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [batteries, setBatteries] = useState<DroneComponent[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [batteryCycles, setBatteryCycles] = useState<Record<string, BatteryCycle[]>>({});

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedBattery, setSelectedBattery] = useState<DroneComponent | null>(null);

  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [cycleForm, setCycleForm] = useState<CycleFormData>(DEFAULT_CYCLE_FORM);
  const [saving, setSaving] = useState(false);

  const [batteryDialogOpen, setBatteryDialogOpen] = useState(false);
  const [batteryForm, setBatteryForm] = useState({
    drone_id: "",
    modelo: "",
    numero_serie: "",
    ciclo_maximo: "",
  });
  const [savingBattery, setSavingBattery] = useState(false);
  const [editingBatteryId, setEditingBatteryId] = useState<string | null>(null);
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [detailCard, setDetailCard] = useState<
    "total" | "ciclos" | "alertas" | "soh" | null
  >(null);

  const droneMap = useMemo(() => {
    const map: Record<string, Drone> = {};
    drones.forEach((d) => { map[d.id] = d; });
    return map;
  }, [drones]);

  const batteriesStats = useMemo(() => {
    return batteries.map((b) => {
      const cycles = batteryCycles[b.id] || [];
      const ciclosAtuais = cycles.length;
      const cicloMaximo = b.ciclo_maximo || 0;
      const percentual = cicloMaximo > 0 ? (ciclosAtuais / cicloMaximo) * 100 : 0;
      const status = getStatus(ciclosAtuais, cicloMaximo);
      const sohValues = cycles
        .filter((c) => c.soh != null)
        .map((c) => c.soh as number);
      const avgSohBat =
        sohValues.length > 0
          ? Math.round(sohValues.reduce((acc, c) => acc + c, 0) / sohValues.length)
          : null;
      return {
        battery: b,
        cycles,
        ciclosAtuais,
        cicloMaximo,
        percentual,
        status,
        drone: droneMap[b.drone_id],
        avgSohBat,
        lastSoh: cycles[0]?.soh ?? null,
        lastCycle: cycles[0] || null,
        inAlerta: cicloMaximo > 0 && ciclosAtuais >= cicloMaximo * 0.9,
      };
    });
  }, [batteries, batteryCycles, droneMap]);

  const alertasList = useMemo(
    () => batteriesStats.filter((s) => s.inAlerta),
    [batteriesStats]
  );

  const summary = useMemo(() => {
    const total = batteriesStats.length;
    if (total === 0) return { total: 0, avgCycles: 0, alertCount: 0, avgSoh: 0 };

    const totalCiclosAtuais = batteriesStats.reduce(
      (acc, s) => acc + s.ciclosAtuais,
      0
    );
    const alertCount = batteriesStats.filter((s) => s.inAlerta).length;
    const avgCycles = Math.round(totalCiclosAtuais / total);

    let sohSum = 0;
    let sohCount = 0;
    batteriesStats.forEach((s) => {
      s.cycles.forEach((c) => {
        if (c.soh != null) {
          sohSum += c.soh;
          sohCount++;
        }
      });
    });
    const avgSoh = sohCount > 0 ? Math.round(sohSum / sohCount) : 0;

    return { total, avgCycles, alertCount, avgSoh };
  }, [batteriesStats]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allBatteries, allDrones] = await Promise.all([
        getAllDroneComponents(),
        getAllDrones(),
      ]);

      const baterias = allBatteries.filter((c) => c.tipo === "bateria");
      setBatteries(baterias);
      setDrones(allDrones);

      const cyclesMap: Record<string, BatteryCycle[]> = {};
      await Promise.all(
        baterias.map(async (b) => {
          try {
            const cycles = await getBatteryCycles(b.id);
            cyclesMap[b.id] = cycles;
          } catch {
            cyclesMap[b.id] = [];
          }
        })
      );
      setBatteryCycles(cyclesMap);
    } catch {
      toast.error("Erro ao carregar dados de baterias");
    } finally {
      setLoading(false);
    }
  };

  const openHistory = (battery: DroneComponent) => {
    setSelectedBattery(battery);
    setHistoryDialogOpen(true);
  };

  const openNewCycle = () => {
    const maxCiclo = selectedBattery
      ? (batteryCycles[selectedBattery.id]?.[0]?.ciclo_numero || 0) + 1
      : 1;
    setCycleForm({ ...DEFAULT_CYCLE_FORM, ciclo_numero: maxCiclo.toString() });
    setCycleDialogOpen(true);
  };

  const openNewCycleFor = (battery: DroneComponent) => {
    const maxCiclo = (batteryCycles[battery.id]?.[0]?.ciclo_numero || 0) + 1;
    setCycleForm({ ...DEFAULT_CYCLE_FORM, ciclo_numero: maxCiclo.toString() });
    setSelectedBattery(battery);
    setCycleDialogOpen(true);
  };

  const handleSaveCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBattery) return;

    if (!cycleForm.ciclo_numero.trim()) {
      toast.error("O numero do ciclo e obrigatorio");
      return;
    }

    setSaving(true);
    try {
      const cycleData = {
        component_id: selectedBattery.id,
        flight_log_id: null,
        ciclo_numero: parseInt(cycleForm.ciclo_numero) || 0,
        voltagem_inicio: parseFloat(cycleForm.voltagem_inicio) || 0,
        voltagem_fim: parseFloat(cycleForm.voltagem_fim) || 0,
        soh: parseFloat(cycleForm.soh) || 0,
        temperatura_operacao: parseFloat(cycleForm.temperatura_operacao) || 0,
        data_carga: null,
        tempo_carga_min: parseFloat(cycleForm.tempo_carga_min) || 0,
        avarias: cycleForm.avarias,
      };

      if (editingCycleId) {
        await updateBatteryCycle(editingCycleId, cycleData);
        toast.success("Ciclo atualizado com sucesso!");
      } else {
        await createBatteryCycle(cycleData);
        toast.success("Ciclo registrado com sucesso!");
      }

      setCycleDialogOpen(false);
      setCycleForm(DEFAULT_CYCLE_FORM);
      setEditingCycleId(null);

      const cycles = await getBatteryCycles(selectedBattery.id);
      setBatteryCycles((prev) => ({ ...prev, [selectedBattery.id]: cycles }));

      await loadData();
    } catch {
      toast.error("Erro ao salvar ciclo");
    } finally {
      setSaving(false);
    }
  };

  const handleEditCycle = (cycle: BatteryCycle) => {
    setEditingCycleId(cycle.id);
    setCycleForm({
      ciclo_numero: cycle.ciclo_numero?.toString() || "",
      voltagem_inicio: cycle.voltagem_inicio?.toString() || "",
      voltagem_fim: cycle.voltagem_fim?.toString() || "",
      soh: cycle.soh?.toString() || "",
      temperatura_operacao: cycle.temperatura_operacao?.toString() || "",
      tempo_carga_min: cycle.tempo_carga_min?.toString() || "",
      avarias: cycle.avarias || [],
      observacoes: "",
    });
    setCycleDialogOpen(true);
  };

  const handleDeleteCycle = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este ciclo?")) return;
    try {
      await deleteBatteryCycle(id);
      toast.success("Ciclo excluido com sucesso!");
      if (selectedBattery) {
        const cycles = await getBatteryCycles(selectedBattery.id);
        setBatteryCycles((prev) => ({ ...prev, [selectedBattery.id]: cycles }));
      }
      await loadData();
    } catch {
      toast.error("Erro ao excluir ciclo");
    }
  };

  const toggleAvaria = (value: string) => {
    setCycleForm((prev) => ({
      ...prev,
      avarias: prev.avarias.includes(value)
        ? prev.avarias.filter((a) => a !== value)
        : [...prev.avarias, value],
    }));
  };

  const handleSaveBattery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batteryForm.modelo.trim()) {
      toast.error("O modelo da bateria e obrigatorio");
      return;
    }
    if (!batteryForm.drone_id) {
      toast.error("Selecione o drone vinculado");
      return;
    }
    setSavingBattery(true);
    try {
      const batteryData = {
        drone_id: batteryForm.drone_id,
        tipo: "bateria" as const,
        modelo: batteryForm.modelo.trim(),
        numero_serie: batteryForm.numero_serie.trim(),
        especificacoes: {},
        ciclo_maximo: parseInt(batteryForm.ciclo_maximo) || 0,
        status: "ativo" as const,
      };

      if (editingBatteryId) {
        await updateDroneComponent(editingBatteryId, batteryData);
        toast.success("Bateria atualizada com sucesso!");
      } else {
        await createDroneComponent(batteryData);
        toast.success("Bateria cadastrada com sucesso!");
      }

      setBatteryDialogOpen(false);
      setBatteryForm({ drone_id: "", modelo: "", numero_serie: "", ciclo_maximo: "" });
      setEditingBatteryId(null);
      await loadData();
    } catch {
      toast.error("Erro ao salvar bateria");
    } finally {
      setSavingBattery(false);
    }
  };

  const handleEditBattery = (battery: DroneComponent) => {
    setEditingBatteryId(battery.id);
    setBatteryForm({
      drone_id: battery.drone_id || "",
      modelo: battery.modelo || "",
      numero_serie: battery.numero_serie || "",
      ciclo_maximo: battery.ciclo_maximo?.toString() || "",
    });
    setBatteryDialogOpen(true);
  };

  const handleDeleteBattery = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta bateria?")) return;
    try {
      await deleteDroneComponent(id);
      toast.success("Bateria excluida com sucesso!");
      await loadData();
    } catch {
      toast.error("Erro ao excluir bateria");
    }
  };

  const verHistoricoFromDetail = (battery: DroneComponent) => {
    setDetailCard(null);
    openHistory(battery);
  };

  const novoCicloFromDetail = (battery: DroneComponent) => {
    setDetailCard(null);
    openNewCycleFor(battery);
  };

  const editarFromDetail = (battery: DroneComponent) => {
    setDetailCard(null);
    handleEditBattery(battery);
  };

  const excluirFromDetail = (id: string) => {
    setDetailCard(null);
    handleDeleteBattery(id);
  };

  const novaBateriaFromDetail = () => {
    setDetailCard(null);
    setEditingBatteryId(null);
    setBatteryForm({ drone_id: "", modelo: "", numero_serie: "", ciclo_maximo: "" });
    setBatteryDialogOpen(true);
  };

  const openCardDetail = (key: "total" | "ciclos" | "alertas" | "soh") =>
    setDetailCard(key);

  const cardKeyDown =
    (key: "total" | "ciclos" | "alertas" | "soh") =>
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setDetailCard(key);
      }
    };

  const statusBadge = (status: {
    label: string;
    variant: "default" | "secondary" | "destructive";
  }) => (
    <Badge
      variant={status.variant}
      className={
        status.variant === "default"
          ? "bg-emerald-100 text-emerald-800 border-emerald-200"
          : status.variant === "secondary"
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : ""
      }
    >
      {status.label}
    </Badge>
  );

  const rowActions = (battery: DroneComponent) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-blue-500"
        onClick={() => verHistoricoFromDetail(battery)}
        title="Ver historico"
      >
        <History className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-emerald-500"
        onClick={() => novoCicloFromDetail(battery)}
        title="Registrar ciclo"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-amber-500"
        onClick={() => editarFromDetail(battery)}
        title="Editar bateria"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-500"
        onClick={() => excluirFromDetail(battery.id)}
        title="Excluir bateria"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/visao-geral")}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-heading text-foreground">
              Gestao de Baterias
            </h1>
            <p className="text-muted-foreground text-sm">
              Acompanhe a saude e ciclo de vida das baterias da frota.
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setEditingBatteryId(null); setBatteryDialogOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Bateria
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="bg-card/50 backdrop-blur-sm border-blue-500/20 cursor-pointer transition-all hover:shadow-md hover:border-blue-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("total")}
          onKeyDown={cardKeyDown("total")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Battery className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-500/5 px-2 py-1 rounded">
                Total
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {summary.total}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Baterias Cadastradas</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-emerald-500/20 cursor-pointer transition-all hover:shadow-md hover:border-emerald-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("ciclos")}
          onKeyDown={cardKeyDown("ciclos")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-500/5 px-2 py-1 rounded">
                Media
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {summary.avgCycles}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ciclos Medios</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-red-500/20 cursor-pointer transition-all hover:shadow-md hover:border-red-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("alertas")}
          onKeyDown={cardKeyDown("alertas")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-[10px] font-bold text-red-600 uppercase bg-red-500/5 px-2 py-1 rounded">
                Alerta
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {summary.alertCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Baterias Alerta (&gt;90% vida util)</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-amber-500/20 cursor-pointer transition-all hover:shadow-md hover:border-amber-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("soh")}
          onKeyDown={cardKeyDown("soh")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Thermometer className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-500/5 px-2 py-1 rounded">
                SOH
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {summary.avgSoh}
              <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">SOH Medio</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Battery className="h-5 w-5 text-blue-500" />
            Saude das Baterias ({batteries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {batteries.length === 0 ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Battery className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Nenhuma bateria encontrada</h3>
                  <p className="text-sm text-muted-foreground">
                    Cadastre componentes do tipo bateria na gestao de drones.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bateria</TableHead>
                    <TableHead className="hidden sm:table-cell">Drone Vinculado</TableHead>
                    <TableHead>Ciclos (Usados / Vida Util)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Ultimo Ciclo</TableHead>
                    <TableHead className="w-24 text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batteries.map((battery) => {
                    const cycles = batteryCycles[battery.id] || [];
                    const ciclosAtuais = cycles.length;
                    const cicloMaximo = battery.ciclo_maximo || 0;
                    const status = getStatus(ciclosAtuais, cicloMaximo);
                    const cyclePercent = cicloMaximo > 0 ? Math.min((ciclosAtuais / cicloMaximo) * 100, 100) : 0;
                    const drone = droneMap[battery.drone_id];
                    const lastCycle = cycles[0];

                    return (
                      <TableRow key={battery.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{battery.modelo}</p>
                            <p className="text-xs text-muted-foreground">
                              S/N: {battery.numero_serie}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {drone ? `${drone.marca} ${drone.modelo}` : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <span className="text-sm font-mono font-medium w-8 text-right">
                              {ciclosAtuais}
                            </span>
                            <div className="flex-1 relative h-2 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getCycleProgressColor(
                                  ciclosAtuais,
                                  cicloMaximo
                                )}`}
                                style={{ width: `${cyclePercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-6">
                              /{cicloMaximo || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status.variant}
                            className={
                              status.variant === "default"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : status.variant === "secondary"
                                ? "bg-amber-100 text-amber-800 border-amber-200"
                                : ""
                            }
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {lastCycle ? (
                            <div>
                              <span className="font-medium">#{lastCycle.ciclo_numero}</span>
                              <span className="text-muted-foreground ml-2">
                                {new Date(lastCycle.created_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-500"
                              onClick={() => openHistory(battery)}
                              title="Ver historico"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-500"
                              onClick={() => openNewCycleFor(battery)}
                              title="Registrar ciclo"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-500"
                              onClick={() => handleEditBattery(battery)}
                              title="Editar bateria"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500"
                              onClick={() => handleDeleteBattery(battery.id)}
                              title="Excluir bateria"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Historico de Ciclos
            </DialogTitle>
            {selectedBattery && (
              <DialogDescription>
                {selectedBattery.modelo} — S/N: {selectedBattery.numero_serie}
                {droneMap[selectedBattery.drone_id] &&
                  ` | Drone: ${droneMap[selectedBattery.drone_id].marca} ${droneMap[selectedBattery.drone_id].modelo}`}
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedBattery && (
            <>
              <div className="flex justify-end mb-2">
                <Button size="sm" onClick={openNewCycle}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ciclo
                </Button>
              </div>

              {(batteryCycles[selectedBattery.id] || []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p>Nenhum ciclo registrado para esta bateria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead className="hidden sm:table-cell">Data</TableHead>
                        <TableHead>Vol. Inicio</TableHead>
                        <TableHead>Vol. Fim</TableHead>
                        <TableHead>SOH</TableHead>
                        <TableHead className="hidden md:table-cell">Temp.</TableHead>
                        <TableHead className="hidden lg:table-cell">Avarias</TableHead>
                        <TableHead className="w-20 text-right">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(batteryCycles[selectedBattery.id] || []).map((cycle) => (
                        <TableRow key={cycle.id}>
                          <TableCell className="font-mono font-medium">
                            {cycle.ciclo_numero}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                            {new Date(cycle.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-sm">
                            {cycle.voltagem_inicio ? `${cycle.voltagem_inicio}V` : "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {cycle.voltagem_fim ? `${cycle.voltagem_fim}V` : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Progress value={cycle.soh || 0} className="h-2 flex-1" />
                              <span className="text-xs font-mono w-8 text-right">
                                {cycle.soh || 0}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {cycle.temperatura_operacao
                              ? `${cycle.temperatura_operacao}°C`
                              : "—"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {cycle.avarias && cycle.avarias.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {cycle.avarias.map((av) => (
                                  <Badge key={av} variant="destructive" className="text-[10px]">
                                    {av}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-500"
                                onClick={() => handleEditCycle(cycle)}
                                title="Editar ciclo"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500"
                                onClick={() => handleDeleteCycle(cycle.id)}
                                title="Excluir ciclo"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cycleDialogOpen} onOpenChange={(open) => { setCycleDialogOpen(open); if (!open) setEditingCycleId(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              {editingCycleId ? "Editar Ciclo de Bateria" : "Novo Ciclo de Bateria"}
            </DialogTitle>
            <DialogDescription>
              {selectedBattery &&
                `Registrar ciclo para ${selectedBattery.modelo} (S/N: ${selectedBattery.numero_serie})`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveCycle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ciclo_numero">Ciclo Numero *</Label>
              <Input
                id="ciclo_numero"
                type="number"
                placeholder="Ex: 1"
                value={cycleForm.ciclo_numero}
                onChange={(e) =>
                  setCycleForm((p) => ({ ...p, ciclo_numero: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="voltagem_inicio">Voltagem Inicio (V)</Label>
                <Input
                  id="voltagem_inicio"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 44.2"
                  value={cycleForm.voltagem_inicio}
                  onChange={(e) =>
                    setCycleForm((p) => ({ ...p, voltagem_inicio: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voltagem_fim">Voltagem Fim (V)</Label>
                <Input
                  id="voltagem_fim"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 38.5"
                  value={cycleForm.voltagem_fim}
                  onChange={(e) =>
                    setCycleForm((p) => ({ ...p, voltagem_fim: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="soh">SOH (%)</Label>
                <Input
                  id="soh"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Ex: 85"
                  value={cycleForm.soh}
                  onChange={(e) =>
                    setCycleForm((p) => ({ ...p, soh: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="temperatura">Temperatura Operacao (°C)</Label>
                <Input
                  id="temperatura"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 25"
                  value={cycleForm.temperatura_operacao}
                  onChange={(e) =>
                    setCycleForm((p) => ({
                      ...p,
                      temperatura_operacao: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tempo_carga">Tempo Carga (min)</Label>
              <Input
                id="tempo_carga"
                type="number"
                placeholder="Ex: 45"
                value={cycleForm.tempo_carga_min}
                onChange={(e) =>
                  setCycleForm((p) => ({ ...p, tempo_carga_min: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Avarias</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVARIA_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={cycleForm.avarias.includes(opt.value)}
                      onCheckedChange={() => toggleAvaria(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observacoes</Label>
              <Textarea
                id="obs"
                placeholder="Informacoes adicionais..."
                rows={3}
                value={cycleForm.observacoes}
                onChange={(e) =>
                  setCycleForm((p) => ({ ...p, observacoes: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setCycleDialogOpen(false); setEditingCycleId(null); }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingCycleId ? "Atualizar Ciclo" : "Registrar Ciclo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Bateria */}
      <Dialog open={batteryDialogOpen} onOpenChange={(open) => { setBatteryDialogOpen(open); if (!open) setEditingBatteryId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Battery className="h-5 w-5 text-blue-500" />
              {editingBatteryId ? "Editar Bateria" : "Nova Bateria"}
            </DialogTitle>
            <DialogDescription>
              {editingBatteryId ? "Atualize os dados da bateria." : "Cadastre uma nova bateria e vincule a um drone."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveBattery} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bat_drone">Drone Vinculado *</Label>
              <select
                id="bat_drone"
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={batteryForm.drone_id}
                onChange={(e) => setBatteryForm((p) => ({ ...p, drone_id: e.target.value }))}
                required
              >
                <option value="">Selecione o drone...</option>
                {drones.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.modelo} — {d.numero_serie}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bat_modelo">Modelo da Bateria *</Label>
              <Input
                id="bat_modelo"
                placeholder="Ex: TB60, T40 Smart Battery"
                value={batteryForm.modelo}
                onChange={(e) => setBatteryForm((p) => ({ ...p, modelo: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bat_serie">Numero de Serie</Label>
              <Input
                id="bat_serie"
                placeholder="Ex: BAT-001"
                value={batteryForm.numero_serie}
                onChange={(e) => setBatteryForm((p) => ({ ...p, numero_serie: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bat_ciclos">Ciclos Maximos</Label>
              <Input
                id="bat_ciclos"
                type="number"
                min="0"
                placeholder="Ex: 350"
                value={batteryForm.ciclo_maximo}
                onChange={(e) => setBatteryForm((p) => ({ ...p, ciclo_maximo: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setBatteryDialogOpen(false); setEditingBatteryId(null); }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingBattery} className="bg-emerald-600 hover:bg-emerald-700">
                {savingBattery ? "Salvando..." : editingBatteryId ? "Atualizar Bateria" : "Cadastrar Bateria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={detailCard !== null}
        onOpenChange={(open) => {
          if (!open) setDetailCard(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailCard === "total" && (
                <>
                  <Battery className="h-5 w-5 text-blue-500" />
                  Baterias Cadastradas ({summary.total})
                </>
              )}
              {detailCard === "ciclos" && (
                <>
                  <Zap className="h-5 w-5 text-emerald-500" />
                  Ciclos Médios ({summary.avgCycles})
                </>
              )}
              {detailCard === "alertas" && (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Baterias em Alerta ({summary.alertCount})
                </>
              )}
              {detailCard === "soh" && (
                <>
                  <Thermometer className="h-5 w-5 text-amber-500" />
                  SOH Médio ({summary.avgSoh}%)
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailCard === "total" &&
                "Lista detalhada das baterias cadastradas. Histórico, ciclos, edição e exclusão."}
              {detailCard === "ciclos" &&
                "Ciclos utilizados por bateria em relação à vida útil."}
              {detailCard === "alertas" &&
                "Baterias que atingiram 90% ou mais da vida útil."}
              {detailCard === "soh" &&
                "Estado de saúde (SOH) médio por bateria registrado nos ciclos."}
            </DialogDescription>
          </DialogHeader>

          {detailCard === "total" &&
            (batteriesStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma bateria cadastrada.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bateria</TableHead>
                      <TableHead className="hidden sm:table-cell">Drone</TableHead>
                      <TableHead>Ciclos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-36 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batteriesStats.map((s) => (
                      <TableRow key={s.battery.id}>
                        <TableCell>
                          <p className="font-medium">{s.battery.modelo}</p>
                          <p className="text-xs text-muted-foreground">
                            S/N: {s.battery.numero_serie}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {s.drone ? `${s.drone.marca} ${s.drone.modelo}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {s.ciclosAtuais}/{s.cicloMaximo || "—"}
                        </TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell>{rowActions(s.battery)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

          {detailCard === "ciclos" &&
            (batteriesStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma bateria cadastrada.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bateria</TableHead>
                      <TableHead>Ciclos (Usados / Vida Útil)</TableHead>
                      <TableHead className="hidden sm:table-cell">%</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-36 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batteriesStats.map((s) => (
                      <TableRow key={s.battery.id}>
                        <TableCell>
                          <p className="font-medium">{s.battery.modelo}</p>
                          <p className="text-xs text-muted-foreground">
                            S/N: {s.battery.numero_serie}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <span className="text-sm font-mono font-medium w-8 text-right">
                              {s.ciclosAtuais}
                            </span>
                            <div className="flex-1 relative h-2 rounded-full bg-secondary overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getCycleProgressColor(
                                  s.ciclosAtuais,
                                  s.cicloMaximo
                                )}`}
                                style={{
                                  width: `${Math.min(s.percentual, 100)}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-6">
                              /{s.cicloMaximo || "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm font-mono">
                          {s.cicloMaximo > 0 ? `${Math.round(s.percentual)}%` : "—"}
                        </TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell>{rowActions(s.battery)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

          {detailCard === "alertas" &&
            (alertasList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma bateria em alerta. Toda a frota está dentro da vida útil.
              </p>
            ) : (
              <div className="space-y-2">
                {alertasList.map((s) => (
                  <div
                    key={s.battery.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {s.battery.modelo}{" "}
                        <span className="text-muted-foreground font-normal">
                          · S/N: {s.battery.numero_serie}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.drone ? `${s.drone.marca} ${s.drone.modelo} · ` : ""}
                        {s.ciclosAtuais}/{s.cicloMaximo} ciclos (
                        {Math.round(s.percentual)}% da vida útil)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(s.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-500"
                        title="Ver historico"
                        onClick={() => verHistoricoFromDetail(s.battery)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-500"
                        title="Editar bateria"
                        onClick={() => editarFromDetail(s.battery)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        title="Excluir bateria"
                        onClick={() => excluirFromDetail(s.battery.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {detailCard === "soh" &&
            (batteriesStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma bateria cadastrada.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bateria</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Ciclos com SOH
                      </TableHead>
                      <TableHead>SOH Médio</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Último SOH
                      </TableHead>
                      <TableHead className="w-16 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batteriesStats.map((s) => (
                      <TableRow key={s.battery.id}>
                        <TableCell>
                          <p className="font-medium">{s.battery.modelo}</p>
                          <p className="text-xs text-muted-foreground">
                            S/N: {s.battery.numero_serie}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm font-mono">
                          {s.cycles.filter((c) => c.soh != null).length}
                        </TableCell>
                        <TableCell>
                          {s.avgSohBat != null ? (
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <Progress value={s.avgSohBat} className="h-2 flex-1" />
                              <span className="text-xs font-mono w-8 text-right">
                                {s.avgSohBat}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm font-mono">
                          {s.lastSoh != null ? `${s.lastSoh}%` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500"
                            title="Ver historico"
                            onClick={() => verHistoricoFromDetail(s.battery)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDetailCard(null)}>
              Fechar
            </Button>
            {(detailCard === "total" ||
              detailCard === "ciclos" ||
              detailCard === "alertas") && (
              <Button
                onClick={novaBateriaFromDetail}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Bateria
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
