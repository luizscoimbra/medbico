import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Wrench,
  Clock,
  DollarSign,
  CalendarClock,
  CheckCircle2,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCcw,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  getAllDrones,
  getMaintenanceRecords,
  createMaintenanceRecord,
  updateMaintenanceRecord,
  deleteMaintenanceRecord,
  getMaintenanceSchedules,
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  deleteMaintenanceSchedule,
  Drone,
  MaintenanceRecord,
  MaintenanceSchedule,
} from "@/lib/droneStorage";
import {
  getAllComponentes,
  saveComponente,
  ComponenteCatalogo,
} from "@/lib/componenteStorage";
import { formatBRL } from "@/lib/utils";

interface MaintenanceAgendaItem {
  drone: Drone;
  schedule: MaintenanceSchedule;
  horasRestantes: number;
  urgencia: "critica" | "alta" | "media" | "normal";
}

interface ComponenteTroca {
  nome: string;
  modelo: string;
  custo: number;
}

const EMPTY_COMPONENTE: ComponenteTroca = { nome: "", modelo: "", custo: 0 };

const TIPO_MANUTENCAO_OPTIONS = [
  { value: "diaria", label: "Diaria" },
  { value: "50h", label: "50 Horas" },
  { value: "100h", label: "100 Horas" },
  { value: "200h", label: "200 Horas" },
  { value: "corretiva", label: "Corretiva" },
];

const TIPO_REGISTRO_OPTIONS = [
  { value: "preventiva", label: "Preventiva" },
  { value: "corretiva", label: "Corretiva" },
];

function getUrgenciaBadge(urgencia: MaintenanceAgendaItem["urgencia"]) {
  switch (urgencia) {
    case "critica":
      return (
        <Badge variant="destructive" className="text-[10px]">
          Critica
        </Badge>
      );
    case "alta":
      return (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">
          Alta
        </Badge>
      );
    case "media":
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
          Media
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          Normal
        </Badge>
      );
  }
}

function calcularUrgencia(horasRestantes: number): MaintenanceAgendaItem["urgencia"] {
  if (horasRestantes <= 0) return "critica";
  if (horasRestantes <= 10) return "alta";
  if (horasRestantes <= 25) return "media";
  return "normal";
}

export default function MaintenanceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [activeTab, setActiveTab] = useState("agenda");
  const [detailCard, setDetailCard] = useState<
    "drones" | "pendentes" | "proxima" | "custo" | null
  >(null);

  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const [recordForm, setRecordForm] = useState({
    drone_id: "",
    data: new Date().toISOString().split("T")[0],
    tipo: "preventiva" as "preventiva" | "corretiva",
    titulo: "",
    descricao: "",
    responsavel: "",
    horas_voo_registradas: "",
  });
  const [componentesTrocados, setComponentesTrocados] = useState<ComponenteTroca[]>([
    { ...EMPTY_COMPONENTE },
  ]);
  const [componentesCatalogo, setComponentesCatalogo] = useState<ComponenteCatalogo[]>([]);
  const [dropdownComp, setDropdownComp] = useState<{ idx: number; highlight: number } | null>(null);
  const [cadComponenteOpen, setCadComponenteOpen] = useState(false);
  const [savingComponente, setSavingComponente] = useState(false);
  const [cadComponenteForm, setCadComponenteForm] = useState({
    nome: "",
    numero_serie: "",
    marca: "",
    modelo: "",
    custo: "",
  });

  const [scheduleForm, setScheduleForm] = useState({
    drone_modelo: "",
    tipo_manutencao: "50h" as MaintenanceSchedule["tipo_manutencao"],
    titulo: "",
    descricao: "",
    intervalo_horas: "",
    intervalo_dias: "",
  });
  const [checklistItems, setChecklistItems] = useState<string[]>([""]);

  const custoTotalComponentes = useMemo(
    () => componentesTrocados.reduce((acc, c) => acc + (c.custo || 0), 0),
    [componentesTrocados]
  );

  const droneMap = useMemo(() => {
    const map: Record<string, Drone> = {};
    drones.forEach((d) => {
      map[d.id] = d;
    });
    return map;
  }, [drones]);

  const droneModelos = useMemo(() => {
    const modelos = new Set<string>();
    drones.forEach((d) => modelos.add(d.modelo));
    return Array.from(modelos).sort();
  }, [drones]);

  const agenda = useMemo(() => {
    const items: MaintenanceAgendaItem[] = [];
    const activeDrones = drones.filter((d) => d.status === "ativo");

    activeDrones.forEach((drone) => {
      const matchingSchedules = schedules.filter(
        (s) => s.drone_modelo === drone.modelo && s.ativo
      );

      matchingSchedules.forEach((schedule) => {
        const horasVoo = drone.horas_voo_total || 0;
        let horasRestantes = 0;

        if (schedule.intervalo_horas > 0) {
          const ultimoRegistro = records
            .filter(
              (r) =>
                r.drone_id === drone.id &&
                r.schedule_id === schedule.id
            )
            .sort((a, b) => b.horas_voo_registradas - a.horas_voo_registradas)[0];

          const horasDesdeUltima = ultimoRegistro
            ? horasVoo - ultimoRegistro.horas_voo_registradas
            : horasVoo;

          horasRestantes = schedule.intervalo_horas - horasDesdeUltima;
        }

        if (schedule.intervalo_dias > 0) {
          const ultimoRegistro = records
            .filter(
              (r) =>
                r.drone_id === drone.id &&
                r.schedule_id === schedule.id
            )
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0];

          const diasDesdeUltima = ultimoRegistro
            ? (Date.now() - new Date(ultimoRegistro.data).getTime()) /
              (1000 * 60 * 60 * 24)
            : 999;

          const horasDiasRestantes = schedule.intervalo_dias - diasDesdeUltima;
          if (horasDiasRestantes < horasRestantes || horasRestantes === 0) {
            horasRestantes = horasDiasRestantes * 24;
          }
        }

        items.push({
          drone,
          schedule,
          horasRestantes: Math.round(horasRestantes),
          urgencia: calcularUrgencia(horasRestantes),
        });
      });
    });

    return items.sort((a, b) => a.horasRestantes - b.horasRestantes);
  }, [drones, schedules, records]);

  const dronesAtivos = useMemo(
    () => drones.filter((d) => d.status === "ativo"),
    [drones]
  );

  const pendentesList = useMemo(
    () => agenda.filter((a) => a.urgencia === "critica" || a.urgencia === "alta"),
    [agenda]
  );

  const recordsMes = useMemo(() => {
    const now = new Date();
    return records
      .filter((r) => {
        const d = new Date(r.data);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [records]);

  const mesAtualLabel = new Date().toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const summary = useMemo(() => {
    const proximaAgenda = agenda.length > 0 ? agenda[0] : null;
    const custoMes = recordsMes.reduce((acc, r) => acc + (r.custo || 0), 0);

    return {
      dronesAtivos: dronesAtivos.length,
      manutencoesPendentes: pendentesList.length,
      proximaAgenda,
      custoMes,
    };
  }, [dronesAtivos, pendentesList, agenda, recordsMes]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dronesData, recordsData, schedulesData, catalogoData] = await Promise.all([
        getAllDrones(),
        getMaintenanceRecords(),
        getMaintenanceSchedules(),
        getAllComponentes().catch(() => [] as ComponenteCatalogo[]),
      ]);
      setDrones(dronesData);
      setRecords(recordsData);
      setSchedules(schedulesData);
      setComponentesCatalogo(catalogoData);
    } catch {
      toast.error("Erro ao carregar dados de manutencao");
    } finally {
      setLoading(false);
    }
  };

  const loadComponentesCatalogo = async () => {
    try {
      setComponentesCatalogo(await getAllComponentes());
    } catch {
      // ignora erro de carregamento do catalogo
    }
  };

  const filtrarComponentesCatalogo = (busca: string): ComponenteCatalogo[] => {
    const q = busca.trim().toLowerCase();
    if (!q) return componentesCatalogo;
    return componentesCatalogo.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.marca || "").toLowerCase().includes(q) ||
        (c.modelo || "").toLowerCase().includes(q) ||
        (c.numero_serie || "").toLowerCase().includes(q)
    );
  };

  const selecionarComponenteCatalogo = (idx: number, comp: ComponenteCatalogo) => {
    setComponentesTrocados((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        nome: comp.nome,
        modelo: comp.modelo,
        custo: comp.custo,
      };
      if (idx === updated.length - 1) {
        updated.push({ ...EMPTY_COMPONENTE });
      }
      return updated;
    });
    setDropdownComp(null);
    setTimeout(() => {
      document.getElementById(`comp-nome-${idx + 1}`)?.focus();
    }, 60);
  };

  const handleSaveComponenteCatalogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cadComponenteForm.nome.trim()) {
      toast.error("Informe o nome do componente");
      return;
    }
    setSavingComponente(true);
    try {
      await saveComponente({
        id: crypto.randomUUID(),
        nome: cadComponenteForm.nome.trim(),
        numero_serie: cadComponenteForm.numero_serie.trim(),
        marca: cadComponenteForm.marca.trim(),
        modelo: cadComponenteForm.modelo.trim(),
        custo: parseFloat(cadComponenteForm.custo) || 0,
        createdAt: new Date().toISOString(),
      });
      await loadComponentesCatalogo();
      toast.success("Componente cadastrado!");
      setCadComponenteOpen(false);
      setCadComponenteForm({ nome: "", numero_serie: "", marca: "", modelo: "", custo: "" });
    } catch {
      toast.error("Erro ao cadastrar componente");
    } finally {
      setSavingComponente(false);
    }
  };

  const addComponente = () => {
    setComponentesTrocados((prev) => [...prev, { ...EMPTY_COMPONENTE }]);
  };

  const removeComponente = (index: number) => {
    setComponentesTrocados((prev) => prev.filter((_, i) => i !== index));
  };

  const updateComponente = (
    index: number,
    field: keyof ComponenteTroca,
    value: string | number
  ) => {
    setComponentesTrocados((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addChecklistItem = () => {
    setChecklistItems((prev) => [...prev, ""]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, value: string) => {
    setChecklistItems((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const goToTab = (tab: string) => {
    setDetailCard(null);
    setActiveTab(tab);
  };

  const openCardDetail = (key: "drones" | "pendentes" | "proxima" | "custo") =>
    setDetailCard(key);

  const cardKeyDown =
    (key: "drones" | "pendentes" | "proxima" | "custo") =>
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setDetailCard(key);
      }
    };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.drone_id) {
      toast.error("Selecione um drone");
      return;
    }
    if (!recordForm.titulo.trim()) {
      toast.error("Informe o titulo da manutencao");
      return;
    }

    setSaving(true);
    try {
      const drone = droneMap[recordForm.drone_id];
      const payload = {
        drone_id: recordForm.drone_id,
        schedule_id: null,
        data: recordForm.data,
        horas_voo_registradas: drone?.horas_voo_total || 0,
        tipo: recordForm.tipo,
        titulo: recordForm.titulo,
        descricao: recordForm.descricao,
        componentes_trocados: componentesTrocados.filter((c) => c.nome.trim()),
        custo: custoTotalComponentes,
        responsavel: recordForm.responsavel,
        fotos_url: [],
      };
      if (editingRecordId) {
        await updateMaintenanceRecord(editingRecordId, payload);
        toast.success("Registro de manutencao atualizado!");
      } else {
        await createMaintenanceRecord(payload);
        toast.success("Registro de manutencao criado!");
      }
      setRecordDialogOpen(false);
      resetRecordForm();
      loadData();
    } catch {
      toast.error("Erro ao salvar registro de manutencao");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.drone_modelo) {
      toast.error("Informe o modelo do drone");
      return;
    }
    if (!scheduleForm.titulo.trim()) {
      toast.error("Informe o titulo do programa");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        drone_modelo: scheduleForm.drone_modelo,
        tipo_manutencao: scheduleForm.tipo_manutencao,
        titulo: scheduleForm.titulo,
        descricao: scheduleForm.descricao,
        intervalo_horas: parseFloat(scheduleForm.intervalo_horas) || 0,
        intervalo_dias: parseFloat(scheduleForm.intervalo_dias) || 0,
        checklist: checklistItems.filter((item) => item.trim()),
        ativo: true,
      };
      if (editingScheduleId) {
        await updateMaintenanceSchedule(editingScheduleId, payload);
        toast.success("Programa de manutencao atualizado!");
      } else {
        await createMaintenanceSchedule(payload);
        toast.success("Programa de manutencao criado!");
      }
      setScheduleDialogOpen(false);
      resetScheduleForm();
      loadData();
    } catch {
      toast.error("Erro ao salvar programa de manutencao");
    } finally {
      setSaving(false);
    }
  };

  const resetRecordForm = () => {
    setEditingRecordId(null);
    setRecordForm({
      drone_id: "",
      data: new Date().toISOString().split("T")[0],
      tipo: "preventiva",
      titulo: "",
      descricao: "",
      responsavel: "",
      horas_voo_registradas: "",
    });
    setComponentesTrocados([{ ...EMPTY_COMPONENTE }]);
  };

  const resetScheduleForm = () => {
    setEditingScheduleId(null);
    setScheduleForm({
      drone_modelo: "",
      tipo_manutencao: "50h",
      titulo: "",
      descricao: "",
      intervalo_horas: "",
      intervalo_dias: "",
    });
    setChecklistItems([""]);
  };

  const handleEditRecord = (record: MaintenanceRecord) => {
    setEditingRecordId(record.id);
    setRecordForm({
      drone_id: record.drone_id,
      data: record.data,
      tipo: record.tipo,
      titulo: record.titulo,
      descricao: record.descricao,
      responsavel: record.responsavel || "",
      horas_voo_registradas: String(record.horas_voo_registradas),
    });
    setComponentesTrocados(
      record.componentes_trocados && record.componentes_trocados.length > 0
        ? record.componentes_trocados.map((c) => ({
            nome: c.nome,
            modelo: c.modelo,
            custo: c.custo || 0,
          }))
        : [{ ...EMPTY_COMPONENTE }]
    );
    setRecordDialogOpen(true);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro de manutencao?")) return;
    try {
      await deleteMaintenanceRecord(id);
      toast.success("Registro de manutencao excluido!");
      loadData();
    } catch {
      toast.error("Erro ao excluir registro de manutencao");
    }
  };

  const handleEditSchedule = (schedule: MaintenanceSchedule) => {
    setEditingScheduleId(schedule.id);
    setScheduleForm({
      drone_modelo: schedule.drone_modelo,
      tipo_manutencao: schedule.tipo_manutencao,
      titulo: schedule.titulo,
      descricao: schedule.descricao,
      intervalo_horas: schedule.intervalo_horas > 0 ? String(schedule.intervalo_horas) : "",
      intervalo_dias: schedule.intervalo_dias > 0 ? String(schedule.intervalo_dias) : "",
    });
    setChecklistItems(
      schedule.checklist && schedule.checklist.length > 0
        ? [...schedule.checklist]
        : [""]
    );
    setScheduleDialogOpen(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este programa de manutencao?")) return;
    try {
      await deleteMaintenanceSchedule(id);
      toast.success("Programa de manutencao excluido!");
      loadData();
    } catch {
      toast.error("Erro ao excluir programa de manutencao");
    }
  };

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
              Manutencao de Drones
            </h1>
            <p className="text-muted-foreground text-sm">
              Acompanhe agenda, historico e programas de manutencao da frota.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="bg-card/50 backdrop-blur-sm border-emerald-500/20 cursor-pointer transition-all hover:shadow-md hover:border-emerald-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("drones")}
          onKeyDown={cardKeyDown("drones")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-500/5 px-2 py-1 rounded">
                Frota
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">{summary.dronesAtivos}</p>
            <p className="text-xs text-muted-foreground mt-1">Drones Ativos</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-red-500/20 cursor-pointer transition-all hover:shadow-md hover:border-red-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("pendentes")}
          onKeyDown={cardKeyDown("pendentes")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-[10px] font-bold text-red-600 uppercase bg-red-500/5 px-2 py-1 rounded">
                Urgente
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {summary.manutencoesPendentes}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Manutencoes Pendentes</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-blue-500/20 cursor-pointer transition-all hover:shadow-md hover:border-blue-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("proxima")}
          onKeyDown={cardKeyDown("proxima")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CalendarClock className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-500/5 px-2 py-1 rounded">
                Proxima
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {summary.proximaAgenda
                ? summary.proximaAgenda.horasRestantes > 0
                  ? `${summary.proximaAgenda.horasRestantes}h`
                  : "Atrasada"
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.proximaAgenda
                ? `${summary.proximaAgenda.drone.modelo} - ${summary.proximaAgenda.schedule.titulo}`
                : "Nenhuma agenda"}
            </p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-amber-500/20 cursor-pointer transition-all hover:shadow-md hover:border-amber-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("custo")}
          onKeyDown={cardKeyDown("custo")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-500/5 px-2 py-1 rounded">
                Custo
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              R$ {summary.custoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Custo Manutencao Mes</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="agenda" className="gap-2">
              <Clock className="h-4 w-4" />
              Agenda
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2">
              <Wrench className="h-4 w-4" />
              Historico
            </TabsTrigger>
            <TabsTrigger value="programas" className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Programas
            </TabsTrigger>
          </TabsList>
          {activeTab === "historico" && (
            <Button size="sm" onClick={() => setRecordDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Registro
            </Button>
          )}
          {activeTab === "programas" && (
            <Button size="sm" onClick={() => setScheduleDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Programa
            </Button>
          )}
        </div>

        <TabsContent value="agenda" className="mt-6">
          {agenda.length === 0 ? (
            <Card className="shadow-lg">
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <CalendarClock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Nenhuma manutencao agendada</h3>
                    <p className="text-sm text-muted-foreground">
                      Crie programas de manutencao na aba Programas para gerar a agenda automatica.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agenda.map((item) => (
                <Card
                  key={`${item.drone.id}-${item.schedule.id}`}
                  className="shadow-md hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {item.drone.marca} {item.drone.modelo}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          S/N: {item.drone.numero_serie}
                        </p>
                      </div>
                      {getUrgenciaBadge(item.urgencia)}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{item.schedule.titulo}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>
                          {item.horasRestantes > 0
                            ? `${item.horasRestantes}h restantes`
                            : "Atrasada"}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {item.schedule.tipo_manutencao}
                      </Badge>
                    </div>

                    {item.schedule.checklist && item.schedule.checklist.length > 0 && (
                      <div className="border-t pt-3 mb-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                          Checklist
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {item.schedule.checklist.slice(0, 3).map((item, idx) => (
                            <li key={idx} className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                              {item}
                            </li>
                          ))}
                          {item.schedule.checklist.length > 3 && (
                            <li className="text-[10px]">
                              +{item.schedule.checklist.length - 3} itens
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setRecordForm((prev) => ({
                          ...prev,
                          drone_id: item.drone.id,
                        }));
                        setRecordDialogOpen(true);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Registrar Conclusao
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-500" />
                Historico de Manutencoes ({records.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {records.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <Wrench className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Nenhum registro encontrado</h3>
                      <p className="text-sm text-muted-foreground">
                        Registre manutencoes realizadas clicando em "Novo Registro".
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead className="hidden sm:table-cell">Drone</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Titulo</TableHead>
                        <TableHead className="hidden md:table-cell">Custo</TableHead>
                        <TableHead className="hidden lg:table-cell">Responsavel</TableHead>
                        <TableHead className="w-16">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record) => {
                        const drone = droneMap[record.drone_id];
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {new Date(record.data + "T00:00:00").toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className="text-xs">
                                {drone ? `${drone.marca} ${drone.modelo}` : "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={record.tipo === "preventiva" ? "default" : "destructive"}
                                className="text-[10px]"
                              >
                                {record.tipo === "preventiva" ? "Preventiva" : "Corretiva"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {record.titulo}
                            </TableCell>
                            <TableCell className="hidden md:table-cell whitespace-nowrap">
                              {record.custo > 0
                                ? `R$ ${record.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                : "—"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {record.responsavel || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditRecord(record)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteRecord(record.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                                {record.componentes_trocados &&
                                  record.componentes_trocados.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {record.componentes_trocados.length} pecas
                                    </Badge>
                                  )}
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
        </TabsContent>

        <TabsContent value="programas" className="mt-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCcw className="h-5 w-5 text-emerald-500" />
                Programas de Manutencao ({schedules.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {schedules.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <RefreshCcw className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Nenhum programa cadastrado</h3>
                      <p className="text-sm text-muted-foreground">
                        Crie programas de manutencao para gerar a agenda automatica.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Titulo</TableHead>
                        <TableHead className="hidden sm:table-cell">Intervalo</TableHead>
                        <TableHead className="hidden md:table-cell">Checklist</TableHead>
                        <TableHead className="w-16">Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((sched) => (
                        <TableRow key={sched.id}>
                          <TableCell className="font-medium">{sched.drone_modelo}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {sched.tipo_manutencao}
                            </Badge>
                          </TableCell>
                          <TableCell>{sched.titulo}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
                            {sched.intervalo_horas > 0 && `${sched.intervalo_horas}h`}
                            {sched.intervalo_horas > 0 && sched.intervalo_dias > 0 && " / "}
                            {sched.intervalo_dias > 0 && `${sched.intervalo_dias}d`}
                            {sched.intervalo_horas === 0 && sched.intervalo_dias === 0 && "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {sched.checklist && sched.checklist.length > 0 ? (
                              <span className="text-xs text-muted-foreground">
                                {sched.checklist.length} itens
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditSchedule(sched)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteSchedule(sched.id)}
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-blue-500" />
              {editingRecordId ? "Editar Registro de Manutencao" : "Novo Registro de Manutencao"}
            </DialogTitle>
            <DialogDescription>
              Registre uma manutencao preventiva ou corretiva realizada em um drone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRecord} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Drone *</Label>
                <Select
                  value={recordForm.drone_id}
                  onValueChange={(val) =>
                    setRecordForm((p) => ({ ...p, drone_id: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o drone" />
                  </SelectTrigger>
                  <SelectContent>
                    {drones.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.marca} {d.modelo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={recordForm.data}
                  onChange={(e) =>
                    setRecordForm((p) => ({ ...p, data: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={recordForm.tipo}
                  onValueChange={(val: "preventiva" | "corretiva") =>
                    setRecordForm((p) => ({ ...p, tipo: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_REGISTRO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Horas de Voo Atual</Label>
                <Input
                  type="number"
                  placeholder="Horas registradas no drone"
                  value={
                    recordForm.drone_id
                      ? droneMap[recordForm.drone_id]?.horas_voo_total || ""
                      : recordForm.horas_voo_registradas
                  }
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input
                placeholder="Ex: Troca de helices, Revisao geral"
                value={recordForm.titulo}
                onChange={(e) =>
                  setRecordForm((p) => ({ ...p, titulo: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                placeholder="Detalhes da manutencao realizada..."
                rows={3}
                value={recordForm.descricao}
                onChange={(e) =>
                  setRecordForm((p) => ({ ...p, descricao: e.target.value }))
                }
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>Componentes Trocados</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCadComponenteOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Cadastrar Componente
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addComponente}>
                    <Plus className="h-3 w-3 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
              {componentesTrocados.map((comp, idx) => (
                <div key={idx} className="flex items-end gap-2 mb-2">
                  <div className="flex-1 space-y-1 relative">
                    <Input
                      id={`comp-nome-${idx}`}
                      placeholder="Nome (ex: Helice) - clique para ver cadastrados"
                      value={comp.nome}
                      autoComplete="off"
                      onFocus={() => setDropdownComp({ idx, highlight: 0 })}
                      onChange={(e) => {
                        updateComponente(idx, "nome", e.target.value);
                        setDropdownComp({ idx, highlight: 0 });
                      }}
                      onBlur={() =>
                        setTimeout(() => {
                          setDropdownComp((prev) => (prev?.idx === idx ? null : prev));
                        }, 150)
                      }
                      onKeyDown={(e) => {
                        const filtrados = filtrarComponentesCatalogo(comp.nome);
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (dropdownComp?.idx === idx && filtrados.length > 0) {
                            const sel =
                              filtrados[dropdownComp.highlight] || filtrados[0];
                            selecionarComponenteCatalogo(idx, sel);
                          }
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setDropdownComp({
                            idx,
                            highlight: Math.min(
                              (dropdownComp?.idx === idx ? dropdownComp.highlight : -1) + 1,
                              Math.max(filtrados.length - 1, 0)
                            ),
                          });
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setDropdownComp({
                            idx,
                            highlight: Math.max(
                              (dropdownComp?.idx === idx ? dropdownComp.highlight : 1) - 1,
                              0
                            ),
                          });
                        } else if (e.key === "Escape") {
                          setDropdownComp(null);
                        }
                      }}
                    />
                    {dropdownComp?.idx === idx && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto rounded-md border bg-popover shadow-lg">
                        {filtrarComponentesCatalogo(comp.nome).length === 0 ? (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            {componentesCatalogo.length === 0
                              ? "Nenhum componente cadastrado. Use 'Cadastrar Componente'."
                              : "Nenhum componente encontrado."}
                          </div>
                        ) : (
                          filtrarComponentesCatalogo(comp.nome).map((c, fIdx) => (
                            <button
                              key={c.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selecionarComponenteCatalogo(idx, c);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-3 border-b border-border/50 last:border-0 ${
                                dropdownComp.highlight === fIdx
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-accent/60"
                              }`}
                            >
                              <span className="font-medium truncate">{c.nome}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {[c.marca, c.modelo].filter(Boolean).join(" ")}
                                {c.custo > 0 && ` · ${formatBRL(c.custo)}`}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Modelo (ex: DJI)"
                      value={comp.modelo}
                      onChange={(e) => updateComponente(idx, "modelo", e.target.value)}
                    />
                  </div>
                  <div className="w-28 space-y-1 shrink-0">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Custo (R$)"
                      value={comp.custo || ""}
                      onChange={(e) =>
                        updateComponente(idx, "custo", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  {componentesTrocados.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive shrink-0"
                      onClick={() => removeComponente(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor total (R$)</Label>
                <Input
                  type="number"
                  readOnly
                  placeholder="0.00"
                  value={custoTotalComponentes || ""}
                  className="bg-muted/50 font-semibold"
                />
                <p className="text-[11px] text-muted-foreground">
                  Soma automatica dos custos dos componentes selecionados
                </p>
              </div>
              <div className="space-y-2">
                <Label>Responsavel</Label>
                <Input
                  placeholder="Nome do responsavel"
                  value={recordForm.responsavel}
                  onChange={(e) =>
                    setRecordForm((p) => ({ ...p, responsavel: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRecordDialogOpen(false);
                  resetRecordForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Registro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCcw className="h-5 w-5 text-emerald-500" />
              {editingScheduleId ? "Editar Programa de Manutencao" : "Novo Programa de Manutencao"}
            </DialogTitle>
            <DialogDescription>
              Defina regras de manutencao preventiva por modelo de drone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSchedule} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modelo do Drone *</Label>
                <Input
                  placeholder="Ex: DJI Agras T40"
                  list="drone-modelos"
                  value={scheduleForm.drone_modelo}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, drone_modelo: e.target.value }))
                  }
                />
                <datalist id="drone-modelos">
                  {droneModelos.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>Tipo Manutencao *</Label>
                <Select
                  value={scheduleForm.tipo_manutencao}
                  onValueChange={(val: MaintenanceSchedule["tipo_manutencao"]) =>
                    setScheduleForm((p) => ({ ...p, tipo_manutencao: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_MANUTENCAO_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Titulo *</Label>
              <Input
                placeholder="Ex: Revisao de 50 horas"
                value={scheduleForm.titulo}
                onChange={(e) =>
                  setScheduleForm((p) => ({ ...p, titulo: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                placeholder="Detalhes do programa de manutencao..."
                rows={3}
                value={scheduleForm.descricao}
                onChange={(e) =>
                  setScheduleForm((p) => ({ ...p, descricao: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Intervalo (horas)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Ex: 50"
                  value={scheduleForm.intervalo_horas}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, intervalo_horas: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Intervalo (dias)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Ex: 30"
                  value={scheduleForm.intervalo_dias}
                  onChange={(e) =>
                    setScheduleForm((p) => ({ ...p, intervalo_dias: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label>Itens do Checklist</Label>
                <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <Input
                    placeholder={`Item ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateChecklistItem(idx, e.target.value)}
                  />
                  {checklistItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive shrink-0"
                      onClick={() => removeChecklistItem(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setScheduleDialogOpen(false);
                  resetScheduleForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : "Salvar Programa"}
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailCard === "drones" && (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Drones Ativos ({dronesAtivos.length})
                </>
              )}
              {detailCard === "pendentes" && (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Manutenções Pendentes ({pendentesList.length})
                </>
              )}
              {detailCard === "proxima" && (
                <>
                  <CalendarClock className="h-5 w-5 text-blue-500" />
                  Próxima Manutenção
                </>
              )}
              {detailCard === "custo" && (
                <>
                  <DollarSign className="h-5 w-5 text-amber-500" />
                  Custo de Manutenção — {mesAtualLabel}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailCard === "drones" &&
                "Lista detalhada da frota de drones ativa. Acesse a tela de frota para editar."}
              {detailCard === "pendentes" &&
                "Manutenções com urgência crítica ou alta. Edite o programa correspondente."}
              {detailCard === "proxima" &&
                "Detalhes da próxima manutenção da agenda e do programa vinculado."}
              {detailCard === "custo" &&
                "Registros de manutenção do mês que compõem o custo total."}
            </DialogDescription>
          </DialogHeader>

          {detailCard === "drones" && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drone</TableHead>
                    <TableHead>S/N</TableHead>
                    <TableHead>Horas de Voo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dronesAtivos.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        Nenhum drone ativo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dronesAtivos.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {d.marca} {d.modelo}
                        </TableCell>
                        <TableCell>{d.numero_serie}</TableCell>
                        <TableCell>{d.horas_voo_total || 0}h</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-[10px] text-emerald-600 border-emerald-500/40"
                          >
                            Ativo
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {detailCard === "pendentes" && (
            <div className="space-y-2">
              {pendentesList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma manutenção pendente.
                </p>
              ) : (
                pendentesList.map((item) => (
                  <div
                    key={`${item.drone.id}-${item.schedule.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {item.schedule.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.drone.marca} {item.drone.modelo} ·{" "}
                        {item.horasRestantes > 0
                          ? `${item.horasRestantes}h restantes`
                          : "Atrasada"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getUrgenciaBadge(item.urgencia)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Editar programa"
                        onClick={() => {
                          setDetailCard(null);
                          setActiveTab("programas");
                          handleEditSchedule(item.schedule);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {detailCard === "proxima" &&
            (summary.proximaAgenda ? (
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {summary.proximaAgenda.drone.marca}{" "}
                      {summary.proximaAgenda.drone.modelo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      S/N: {summary.proximaAgenda.drone.numero_serie}
                    </p>
                  </div>
                  {getUrgenciaBadge(summary.proximaAgenda.urgencia)}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      Programa
                    </p>
                    <p>{summary.proximaAgenda.schedule.titulo}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      Tipo
                    </p>
                    <p>{summary.proximaAgenda.schedule.tipo_manutencao}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      Prazo
                    </p>
                    <p>
                      {summary.proximaAgenda.horasRestantes > 0
                        ? `${summary.proximaAgenda.horasRestantes}h restantes`
                        : "Atrasada"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                      Horas de Voo
                    </p>
                    <p>{summary.proximaAgenda.drone.horas_voo_total || 0}h</p>
                  </div>
                </div>
                {summary.proximaAgenda.schedule.checklist &&
                  summary.proximaAgenda.schedule.checklist.length > 0 && (
                    <div className="border-t pt-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                        Checklist ({summary.proximaAgenda.schedule.checklist.length} itens)
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {summary.proximaAgenda.schedule.checklist.map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma manutenção agendada.
              </p>
            ))}

          {detailCard === "custo" &&
            (recordsMes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma manutenção registrada neste mês.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Drone</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsMes.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {droneMap[r.drone_id]
                            ? `${droneMap[r.drone_id].marca} ${droneMap[r.drone_id].modelo}`
                            : "N/A"}
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {r.titulo}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatBRL(r.custo || 0)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Editar registro"
                            onClick={() => {
                              setDetailCard(null);
                              setActiveTab("historico");
                              handleEditRecord(r);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-semibold">
                      <TableCell colSpan={3} className="text-right">
                        Total
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatBRL(summary.custoMes)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ))}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDetailCard(null)}>
              Fechar
            </Button>
            {detailCard === "drones" && (
              <Button
                onClick={() => {
                  setDetailCard(null);
                  navigate("/drones");
                }}
              >
                Abrir Frota de Drones
              </Button>
            )}
            {detailCard === "pendentes" && (
              <>
                <Button variant="outline" onClick={() => goToTab("agenda")}>
                  Ver Agenda
                </Button>
                <Button onClick={() => goToTab("programas")}>
                  Editar Programas
                </Button>
              </>
            )}
            {detailCard === "proxima" && (
              <>
                <Button variant="outline" onClick={() => goToTab("agenda")}>
                  Ver Agenda
                </Button>
                <Button
                  disabled={!summary.proximaAgenda}
                  onClick={() => {
                    if (!summary.proximaAgenda) return;
                    const schedule = summary.proximaAgenda.schedule;
                    setDetailCard(null);
                    setActiveTab("programas");
                    handleEditSchedule(schedule);
                  }}
                >
                  Editar Programa
                </Button>
              </>
            )}
            {detailCard === "custo" && (
              <Button onClick={() => goToTab("historico")}>Abrir Histórico</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cadComponenteOpen} onOpenChange={setCadComponenteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-emerald-500" />
              Cadastrar Componente
            </DialogTitle>
            <DialogDescription>
              Cadastre o componente para usa-lo rapidamente no lancamento de manutencoes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveComponenteCatalogo} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Helice, Bateria, Filtro"
                value={cadComponenteForm.nome}
                onChange={(e) =>
                  setCadComponenteForm((p) => ({ ...p, nome: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Numero de Serie</Label>
              <Input
                placeholder="Ex: SN-123456"
                value={cadComponenteForm.numero_serie}
                onChange={(e) =>
                  setCadComponenteForm((p) => ({ ...p, numero_serie: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input
                  placeholder="Ex: DJI"
                  value={cadComponenteForm.marca}
                  onChange={(e) =>
                    setCadComponenteForm((p) => ({ ...p, marca: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input
                  placeholder="Ex: T40"
                  value={cadComponenteForm.modelo}
                  onChange={(e) =>
                    setCadComponenteForm((p) => ({ ...p, modelo: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Custo (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={cadComponenteForm.custo}
                onChange={(e) =>
                  setCadComponenteForm((p) => ({ ...p, custo: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCadComponenteOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savingComponente}>
                {savingComponente ? "Salvando..." : "Cadastrar Componente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
