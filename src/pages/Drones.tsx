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
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Plane,
  Settings,
  Clock,
  Users,
  FileText,
  Wrench,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Drone,
  DroneComponent,
  DocumentAlert,
  Pilot,
  getAllDrones,
  createDrone,
  updateDrone,
  deleteDrone,
  getDroneComponents,
  createDroneComponent,
  updateDroneComponent,
  deleteDroneComponent,
  getDocumentAlerts,
  createDocumentAlert,
  updateDocumentAlert,
  getAllPilots,
  createPilot,
  updatePilot,
  deletePilot,
  getFleetSummary,
} from "@/lib/droneStorage";

type DroneStatus = Drone["status"];

interface DroneFormData {
  modelo: string;
  marca: string;
  numero_serie: string;
  registro_anac: string;
  registro_anatel: string;
  mtow: string;
  apolice_seguro: string;
  data_vencimento_seguro: string;
  status: DroneStatus;
  observacoes: string;
}

interface ComponentFormData {
  tipo: DroneComponent["tipo"];
  modelo: string;
  numero_serie: string;
  ciclo_maximo: string;
  status: DroneComponent["status"];
}

interface DocumentFormData {
  tipo: DocumentAlert["tipo"];
  titulo: string;
  data_vencimento: string;
  alertar_dias_antes: string;
}

interface PilotFormData {
  nome: string;
  licenca_anac: string;
  data_vencimento_licenca: string;
  telefone: string;
  email: string;
  status: Pilot["status"];
}

const DEFAULT_DRONE_FORM: DroneFormData = {
  modelo: "",
  marca: "",
  numero_serie: "",
  registro_anac: "",
  registro_anatel: "",
  mtow: "",
  apolice_seguro: "",
  data_vencimento_seguro: "",
  status: "ativo",
  observacoes: "",
};

const DEFAULT_COMPONENT_FORM: ComponentFormData = {
  tipo: "bateria",
  modelo: "",
  numero_serie: "",
  ciclo_maximo: "",
  status: "ativo",
};

const DEFAULT_DOCUMENT_FORM: DocumentFormData = {
  tipo: "seguro",
  titulo: "",
  data_vencimento: "",
  alertar_dias_antes: "30",
};

const DEFAULT_PILOT_FORM: PilotFormData = {
  nome: "",
  licenca_anac: "",
  data_vencimento_licenca: "",
  telefone: "",
  email: "",
  status: "ativo",
};

const STATUS_LABELS: Record<DroneStatus, string> = {
  ativo: "Ativo",
  manutencao: "Em Manutenção",
  inativo: "Inativo",
};

const STATUS_VARIANT: Record<DroneStatus, "default" | "secondary" | "destructive"> = {
  ativo: "default",
  manutencao: "secondary",
  inativo: "destructive",
};

const COMPONENT_TYPES: Record<DroneComponent["tipo"], string> = {
  bateria: "Bateria",
  tanque: "Tanque",
  bico: "Bico",
  sensor: "Sensor",
  carregador: "Carregador",
  camera: "Câmera",
  helice: "Hélice",
  outro: "Outro",
};

const COMPONENT_STATUS_LABELS: Record<DroneComponent["status"], string> = {
  ativo: "Ativo",
  desgastado: "Desgastado",
  danificado: "Danificado",
  substituido: "Substituído",
};

const DOCUMENT_TYPES: Record<DocumentAlert["tipo"], string> = {
  seguro: "Seguro",
  rancho: "Rancho",
  licenca_piloto: "Licença Piloto",
  inspecao: "Inspeção",
  outro: "Outro",
};

export default function Drones() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  const [drones, setDrones] = useState<Drone[]>([]);
  const [fleetSummary, setFleetSummary] = useState({
    totalDrones: 0,
    dronesAtivos: 0,
    dronesManutencao: 0,
    totalHorasVoo: 0,
  });
  const [loading, setLoading] = useState(true);

  const [droneDialogOpen, setDroneDialogOpen] = useState(false);
  const [editingDroneId, setEditingDroneId] = useState<string | null>(null);
  const [droneForm, setDroneForm] = useState<DroneFormData>(DEFAULT_DRONE_FORM);
  const [saving, setSaving] = useState(false);

  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);
  const [droneDetailTab, setDroneDetailTab] = useState("dados");

  const [components, setComponents] = useState<DroneComponent[]>([]);
  const [componentDialogOpen, setComponentDialogOpen] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [componentForm, setComponentForm] = useState<ComponentFormData>(DEFAULT_COMPONENT_FORM);

  const [documents, setDocuments] = useState<DocumentAlert[]>([]);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentFormData>(DEFAULT_DOCUMENT_FORM);

  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [pilotDialogOpen, setPilotDialogOpen] = useState(false);
  const [editingPilotId, setEditingPilotId] = useState<string | null>(null);
  const [pilotForm, setPilotForm] = useState<PilotFormData>(DEFAULT_PILOT_FORM);

  const [detailCard, setDetailCard] = useState<
    "total" | "ativos" | "manutencao" | "horas" | null
  >(null);

  const selectedDrone = useMemo(
    () => drones.find((d) => d.id === selectedDroneId) || null,
    [drones, selectedDroneId]
  );

  const dronesAtivosList = useMemo(
    () => drones.filter((d) => d.status === "ativo"),
    [drones]
  );

  const dronesManutList = useMemo(
    () => drones.filter((d) => d.status === "manutencao"),
    [drones]
  );

  const dronesPorHoras = useMemo(
    () =>
      [...drones].sort(
        (a, b) => (b.horas_voo_total || 0) - (a.horas_voo_total || 0)
      ),
    [drones]
  );

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para acessar esta página");
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    loadDrones();
  }, [userId]);

  useEffect(() => {
    if (selectedDroneId) {
      loadDroneDetail(selectedDroneId);
    }
  }, [selectedDroneId]);

  const loadDrones = async () => {
    try {
      setLoading(true);
      const [allDrones, summary] = await Promise.all([
        getAllDrones(),
        getFleetSummary(),
      ]);
      setDrones(allDrones);
      setFleetSummary(summary);
    } catch {
      toast.error("Erro ao carregar drones");
    } finally {
      setLoading(false);
    }
  };

  const loadDroneDetail = async (droneId: string) => {
    try {
      const [comps, docs, pilotsList] = await Promise.all([
        getDroneComponents(droneId),
        getDocumentAlerts(droneId),
        getAllPilots(),
      ]);
      setComponents(comps);
      setDocuments(docs);
      setPilots(pilotsList);
    } catch {
      toast.error("Erro ao carregar detalhes do drone");
    }
  };

  const openDroneDialog = (drone?: Drone) => {
    if (drone) {
      setEditingDroneId(drone.id);
      setDroneForm({
        modelo: drone.modelo,
        marca: drone.marca || "",
        numero_serie: drone.numero_serie,
        registro_anac: drone.registro_anac || "",
        registro_anatel: drone.registro_anatel || "",
        mtow: drone.mtow?.toString() || "",
        apolice_seguro: drone.apolice_seguro || "",
        data_vencimento_seguro: drone.data_vencimento_seguro || "",
        status: drone.status,
        observacoes: drone.observacoes || "",
      });
    } else {
      setEditingDroneId(null);
      setDroneForm(DEFAULT_DRONE_FORM);
    }
    setDroneDialogOpen(true);
  };

  const handleSaveDrone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!droneForm.modelo.trim()) {
      toast.error("O modelo é obrigatório");
      return;
    }
    if (!droneForm.numero_serie.trim()) {
      toast.error("O número de série é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: userId,
        modelo: droneForm.modelo.trim(),
        marca: droneForm.marca.trim(),
        numero_serie: droneForm.numero_serie.trim(),
        registro_anac: droneForm.registro_anac.trim(),
        registro_anatel: droneForm.registro_anatel.trim(),
        mtow: parseFloat(droneForm.mtow) || 0,
        apolice_seguro: droneForm.apolice_seguro.trim(),
        data_vencimento_seguro: droneForm.data_vencimento_seguro || null,
        status: droneForm.status,
        imagem_url: "",
        observacoes: droneForm.observacoes.trim(),
      };

      if (editingDroneId) {
        await updateDrone(editingDroneId, payload);
        toast.success("Drone atualizado!");
      } else {
        await createDrone(payload as any);
        toast.success("Drone cadastrado!");
      }

      setDroneDialogOpen(false);
      setEditingDroneId(null);
      setDroneForm(DEFAULT_DRONE_FORM);
      loadDrones();
    } catch {
      toast.error("Erro ao salvar drone");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDrone = async (id: string) => {
    if (!confirm("Deseja realmente excluir este drone?")) return;
    try {
      await deleteDrone(id);
      toast.success("Drone removido");
      if (selectedDroneId === id) {
        setSelectedDroneId(null);
      }
      loadDrones();
    } catch {
      toast.error("Erro ao excluir drone");
    }
  };

  const openComponentDialog = (comp?: DroneComponent) => {
    if (comp) {
      setEditingComponentId(comp.id);
      setComponentForm({
        tipo: comp.tipo,
        modelo: comp.modelo,
        numero_serie: comp.numero_serie,
        ciclo_maximo: comp.ciclo_maximo?.toString() || "",
        status: comp.status,
      });
    } else {
      setEditingComponentId(null);
      setComponentForm(DEFAULT_COMPONENT_FORM);
    }
    setComponentDialogOpen(true);
  };

  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDroneId) return;
    if (!componentForm.modelo.trim()) {
      toast.error("O modelo é obrigatório");
      return;
    }
    if (!componentForm.numero_serie.trim()) {
      toast.error("O número de série é obrigatório");
      return;
    }

    try {
      const payload = {
        drone_id: selectedDroneId,
        tipo: componentForm.tipo,
        modelo: componentForm.modelo.trim(),
        numero_serie: componentForm.numero_serie.trim(),
        ciclo_maximo: parseInt(componentForm.ciclo_maximo) || 0,
        status: componentForm.status,
        especificacoes: {},
      };

      if (editingComponentId) {
        await updateDroneComponent(editingComponentId, payload);
        toast.success("Componente atualizado!");
      } else {
        await createDroneComponent(payload as any);
        toast.success("Componente cadastrado!");
      }

      setComponentDialogOpen(false);
      setEditingComponentId(null);
      setComponentForm(DEFAULT_COMPONENT_FORM);
      loadDroneDetail(selectedDroneId);
    } catch {
      toast.error("Erro ao salvar componente");
    }
  };

  const handleDeleteComponent = async (id: string) => {
    if (!confirm("Deseja excluir este componente?")) return;
    try {
      await deleteDroneComponent(id);
      toast.success("Componente removido");
      if (selectedDroneId) loadDroneDetail(selectedDroneId);
    } catch {
      toast.error("Erro ao excluir componente");
    }
  };

  const handleEditDocument = (doc: DocumentAlert) => {
    setEditingDocumentId(doc.id);
    setDocumentForm({
      tipo: doc.tipo,
      titulo: doc.titulo,
      data_vencimento: doc.data_vencimento,
      alertar_dias_antes: doc.alertar_dias_antes?.toString() || "30",
    });
    setDocumentDialogOpen(true);
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDroneId) return;
    if (!documentForm.titulo.trim()) {
      toast.error("O título é obrigatório");
      return;
    }
    if (!documentForm.data_vencimento) {
      toast.error("A data de vencimento é obrigatória");
      return;
    }

    try {
      const payload = {
        drone_id: selectedDroneId,
        tipo: documentForm.tipo,
        titulo: documentForm.titulo.trim(),
        data_vencimento: documentForm.data_vencimento,
        alertar_dias_antes: parseInt(documentForm.alertar_dias_antes) || 30,
      };

      if (editingDocumentId) {
        await updateDocumentAlert(editingDocumentId, payload);
        toast.success("Documento atualizado!");
      } else {
        await createDocumentAlert({ ...payload, notificado: false });
        toast.success("Documento registrado!");
      }

      setDocumentDialogOpen(false);
      setEditingDocumentId(null);
      setDocumentForm(DEFAULT_DOCUMENT_FORM);
      loadDroneDetail(selectedDroneId);
    } catch {
      toast.error("Erro ao salvar documento");
    }
  };

  const openPilotDialog = (pilot?: Pilot) => {
    if (pilot) {
      setEditingPilotId(pilot.id);
      setPilotForm({
        nome: pilot.nome,
        licenca_anac: pilot.licenca_anac || "",
        data_vencimento_licenca: pilot.data_vencimento_licenca || "",
        telefone: pilot.telefone || "",
        email: pilot.email || "",
        status: pilot.status,
      });
    } else {
      setEditingPilotId(null);
      setPilotForm(DEFAULT_PILOT_FORM);
    }
    setPilotDialogOpen(true);
  };

  const handleSavePilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!pilotForm.nome.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    try {
      const payload = {
        user_id: userId,
        nome: pilotForm.nome.trim(),
        licenca_anac: pilotForm.licenca_anac.trim(),
        data_vencimento_licenca: pilotForm.data_vencimento_licenca || null,
        telefone: pilotForm.telefone.trim(),
        email: pilotForm.email.trim(),
        status: pilotForm.status,
      };

      if (editingPilotId) {
        await updatePilot(editingPilotId, payload);
        toast.success("Piloto atualizado!");
      } else {
        await createPilot(payload as any);
        toast.success("Piloto cadastrado!");
      }

      setPilotDialogOpen(false);
      setEditingPilotId(null);
      setPilotForm(DEFAULT_PILOT_FORM);
      if (selectedDroneId) loadDroneDetail(selectedDroneId);
    } catch {
      toast.error("Erro ao salvar piloto");
    }
  };

  const handleDeletePilot = async (id: string) => {
    if (!confirm("Deseja excluir este piloto?")) return;
    try {
      await deletePilot(id);
      toast.success("Piloto removido");
      if (selectedDroneId) loadDroneDetail(selectedDroneId);
    } catch {
      toast.error("Erro ao excluir piloto");
    }
  };

  const getDaysUntilDate = (dateStr: string | null): number | null => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDocumentBadge = (daysLeft: number | null) => {
    if (daysLeft === null) return null;
    if (daysLeft < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    if (daysLeft <= 30) {
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Vence em {daysLeft}d</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">OK</Badge>;
  };

  const openCardDetail = (key: "total" | "ativos" | "manutencao" | "horas") =>
    setDetailCard(key);

  const cardKeyDown =
    (key: "total" | "ativos" | "manutencao" | "horas") =>
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setDetailCard(key);
      }
    };

  const abrirDroneFromDetail = (id: string) => {
    setDetailCard(null);
    setSelectedDroneId(id);
  };

  const editarDroneFromDetail = (drone: Drone) => {
    setDetailCard(null);
    openDroneDialog(drone);
  };

  const excluirDroneFromDetail = (id: string) => {
    setDetailCard(null);
    handleDeleteDrone(id);
  };

  const novoDroneFromDetail = () => {
    setDetailCard(null);
    openDroneDialog();
  };

  const droneStatusBadge = (status: DroneStatus) => (
    <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
  );

  const droneRowActions = (drone: Drone) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-blue-500"
        title="Abrir drone"
        onClick={() => abrirDroneFromDetail(drone.id)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-amber-500"
        title="Editar drone"
        onClick={() => editarDroneFromDetail(drone)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-red-500"
        title="Excluir drone"
        onClick={() => excluirDroneFromDetail(drone.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const dronesDetailTable = (list: Drone[], showPercent = false) => {
    if (list.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhum drone nesta categoria.
        </p>
      );
    }
    const totalHoras = fleetSummary.totalHorasVoo || 0;
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Drone</TableHead>
              <TableHead className="hidden sm:table-cell">S/N</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Horas de Voo</TableHead>
              {showPercent && (
                <TableHead className="hidden sm:table-cell">Participação</TableHead>
              )}
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((d) => {
              const horas = d.horas_voo_total || 0;
              const percent =
                showPercent && totalHoras > 0
                  ? Math.round((horas / totalHoras) * 100)
                  : null;
              return (
                <TableRow key={d.id}>
                  <TableCell>
                    <p className="font-medium">
                      {d.marca} {d.modelo}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {d.numero_serie}
                  </TableCell>
                  <TableCell>{droneStatusBadge(d.status)}</TableCell>
                  <TableCell className="font-mono text-sm">{horas}h</TableCell>
                  {showPercent && (
                    <TableCell className="hidden sm:table-cell font-mono text-sm">
                      {percent !== null ? `${percent}%` : "—"}
                    </TableCell>
                  )}
                  <TableCell>{droneRowActions(d)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (selectedDrone) {
    return (
      <div className="space-y-6 animate-fade-in pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDroneId(null)}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-heading text-foreground">
                {selectedDrone.marca} {selectedDrone.modelo}
              </h1>
              <p className="text-muted-foreground text-sm">
                S/N: {selectedDrone.numero_serie}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[selectedDrone.status]} className="w-fit">
            {STATUS_LABELS[selectedDrone.status]}
          </Badge>
        </div>

        <Tabs value={droneDetailTab} onValueChange={setDroneDetailTab}>
          <TabsList className="grid w-full grid-cols-4 h-auto">
            <TabsTrigger value="dados" className="flex items-center gap-2 py-3">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Dados Gerais</span>
              <span className="sm:hidden">Dados</span>
            </TabsTrigger>
            <TabsTrigger value="componentes" className="flex items-center gap-2 py-3">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Componentes</span>
              <span className="sm:hidden">Comp.</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2 py-3">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documentos</span>
              <span className="sm:hidden">Docs</span>
            </TabsTrigger>
            <TabsTrigger value="pilotos" className="flex items-center gap-2 py-3">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Pilotos</span>
              <span className="sm:hidden">Pilotos</span>
            </TabsTrigger>
          </TabsList>

          {/* DADOS GERAIS */}
          <TabsContent value="dados">
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem label="Modelo" value={selectedDrone.modelo} />
                  <InfoItem label="Marca" value={selectedDrone.marca || "—"} />
                  <InfoItem label="N. Serie" value={selectedDrone.numero_serie} />
                  <InfoItem label="Registro ANAC" value={selectedDrone.registro_anac || "—"} />
                  <InfoItem label="Registro ANATEL" value={selectedDrone.registro_anatel || "—"} />
                  <InfoItem
                    label="MTOW"
                    value={selectedDrone.mtow ? `${selectedDrone.mtow} kg` : "—"}
                  />
                  <InfoItem label="Apólice Seguro" value={selectedDrone.apolice_seguro || "—"} />
                  <InfoItem
                    label="Vencimento Seguro"
                    value={
                      selectedDrone.data_vencimento_seguro
                        ? new Date(selectedDrone.data_vencimento_seguro).toLocaleDateString("pt-BR")
                        : "—"
                    }
                  />
                  <InfoItem
                    label="Horas de Voo"
                    value={`${selectedDrone.horas_voo_total || 0} h`}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase">Status</p>
                    <Badge variant={STATUS_VARIANT[selectedDrone.status]}>
                      {STATUS_LABELS[selectedDrone.status]}
                    </Badge>
                  </div>
                </div>
                {selectedDrone.observacoes && (
                  <div className="mt-6 space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold uppercase">Observações</p>
                    <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg">
                      {selectedDrone.observacoes}
                    </p>
                  </div>
                )}
                <div className="flex gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      openDroneDialog(selectedDrone);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteDrone(selectedDrone.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPONENTES */}
          <TabsContent value="componentes">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openComponentDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Componente
              </Button>
            </div>
            {components.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2 border-border">
                <div className="flex flex-col items-center gap-4">
                  <Wrench className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum componente cadastrado
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>N. Serie</TableHead>
                          <TableHead className="hidden sm:table-cell">Ciclos</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {components.map((comp) => (
                          <TableRow key={comp.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {COMPONENT_TYPES[comp.tipo]}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{comp.modelo}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {comp.numero_serie}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {comp.ciclo_maximo || 0}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {COMPONENT_STATUS_LABELS[comp.status]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary"
                                  onClick={() => openComponentDialog(comp)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteComponent(comp.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DOCUMENTOS */}
          <TabsContent value="documentos">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => setDocumentDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Documento
              </Button>
            </div>
            {documents.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2 border-border">
                <div className="flex flex-col items-center gap-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum documento registrado
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const days = getDaysUntilDate(doc.data_vencimento);
                  return (
                    <Card key={doc.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {doc.titulo}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {DOCUMENT_TYPES[doc.tipo]} • Vence em{" "}
                                {new Date(doc.data_vencimento).toLocaleDateString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-13 sm:ml-0">
                            {getDocumentBadge(days)}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-primary"
                              onClick={() => handleEditDocument(doc)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => {
                                if (!confirm("Excluir este documento?")) return;
                                supabase
                                  .from("document_alerts")
                                  .delete()
                                  .eq("id", doc.id)
                                  .then(() => {
                                    toast.success("Documento removido");
                                    if (selectedDroneId) loadDroneDetail(selectedDroneId);
                                  });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* PILOTOS */}
          <TabsContent value="pilotos">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openPilotDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Piloto
              </Button>
            </div>
            {pilots.length === 0 ? (
              <Card className="p-12 text-center border-dashed border-2 border-border">
                <div className="flex flex-col items-center gap-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum piloto cadastrado
                  </p>
                </div>
              </Card>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead className="hidden sm:table-cell">Licença ANAC</TableHead>
                          <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                          <TableHead className="hidden md:table-cell">Horas Voo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pilots.map((pilot) => (
                          <TableRow key={pilot.id}>
                            <TableCell className="font-medium">{pilot.nome}</TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                              {pilot.licenca_anac || "—"}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                              {pilot.telefone || "—"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {pilot.horas_voo_total || 0} h
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={pilot.status === "ativo" ? "default" : "destructive"}
                              >
                                {pilot.status === "ativo" ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary"
                                  onClick={() => openPilotDialog(pilot)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeletePilot(pilot.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
              Frota de Drones
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerencie seus drones, componentes, documentos e pilotos.
            </p>
          </div>
        </div>
        <Button onClick={() => openDroneDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Drone
        </Button>
      </div>

      {/* Fleet Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="bg-card/50 backdrop-blur-sm border-emerald-500/20 cursor-pointer transition-all hover:shadow-md hover:border-emerald-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("total")}
          onKeyDown={cardKeyDown("total")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Plane className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-500/5 px-2 py-1 rounded">
                Total
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {fleetSummary.totalDrones}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Drones Cadastrados</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-green-500/20 cursor-pointer transition-all hover:shadow-md hover:border-green-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("ativos")}
          onKeyDown={cardKeyDown("ativos")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-green-500" />
              </div>
              <span className="text-[10px] font-bold text-green-600 uppercase bg-green-500/5 px-2 py-1 rounded">
                Ativos
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {fleetSummary.dronesAtivos}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Em Operação</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-amber-500/20 cursor-pointer transition-all hover:shadow-md hover:border-amber-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("manutencao")}
          onKeyDown={cardKeyDown("manutencao")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-500/5 px-2 py-1 rounded">
                Manutenção
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {fleetSummary.dronesManutencao}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Em Manutenção</p>
          </CardContent>
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-blue-500/20 cursor-pointer transition-all hover:shadow-md hover:border-blue-500/40"
          role="button"
          tabIndex={0}
          title="Clique para ver detalhes"
          onClick={() => openCardDetail("horas")}
          onKeyDown={cardKeyDown("horas")}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-500/5 px-2 py-1 rounded">
                Horas
              </span>
            </div>
            <p className="text-3xl font-heading text-foreground">
              {fleetSummary.totalHorasVoo}
              <span className="text-sm font-normal text-muted-foreground ml-1">h</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Total de Voo</p>
          </CardContent>
        </Card>
      </div>

      {/* Drones Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plane className="h-5 w-5 text-emerald-500" />
            Drones Cadastrados ({drones.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {drones.length === 0 ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <Plane className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Nenhum drone cadastrado</h3>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Novo Drone" para começar.
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
                    <TableHead className="hidden sm:table-cell">Marca</TableHead>
                    <TableHead>N. Serie</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Horas Voo</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drones.map((drone) => (
                    <TableRow
                      key={drone.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedDroneId(drone.id)}
                    >
                      <TableCell className="font-medium">{drone.modelo}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {drone.marca || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {drone.numero_serie}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[drone.status]}>
                          {STATUS_LABELS[drone.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-right">
                        {drone.horas_voo_total || 0} h
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={() => openDroneDialog(drone)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteDrone(drone.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* New/Edit Drone Dialog */}
      <Dialog open={droneDialogOpen} onOpenChange={setDroneDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="h-5 w-5 text-emerald-500" />
              {editingDroneId ? "Editar Drone" : "Novo Drone"}
            </DialogTitle>
            <DialogDescription>
              {editingDroneId
                ? "Atualize os dados do drone."
                : "Preencha os dados para cadastrar um novo drone."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveDrone} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="d_modelo">Modelo *</Label>
                <Input
                  id="d_modelo"
                  placeholder="Ex: Agras T30"
                  value={droneForm.modelo}
                  onChange={(e) =>
                    setDroneForm((p) => ({ ...p, modelo: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_marca">Marca</Label>
                <Input
                  id="d_marca"
                  placeholder="Ex: DJI"
                  value={droneForm.marca}
                  onChange={(e) =>
                    setDroneForm((p) => ({ ...p, marca: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_serie">Numero de Serie *</Label>
                <Input
                  id="d_serie"
                  placeholder="Ex: 1ZABC123456"
                  value={droneForm.numero_serie}
                  onChange={(e) =>
                    setDroneForm((p) => ({ ...p, numero_serie: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_anac">Registro ANAC</Label>
                <Input
                  id="d_anac"
                  placeholder="Ex: ABC12345"
                  value={droneForm.registro_anac}
                  onChange={(e) =>
                    setDroneForm((p) => ({ ...p, registro_anac: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_anatel">Registro ANATEL</Label>
                <Input
                  id="d_anatel"
                  placeholder="Ex: 123456789"
                  value={droneForm.registro_anatel}
                  onChange={(e) =>
                    setDroneForm((p) => ({ ...p, registro_anatel: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_mtow">MTOW (kg)</Label>
                <Input
                  id="d_mtow"
                  type="number"
                  step="0.1"
                  placeholder="Ex: 40.0"
                  value={droneForm.mtow}
                  onChange={(e) =>
                    setDroneForm((p) => ({ ...p, mtow: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_apolice">Apolice de Seguro</Label>
                <Input
                  id="d_apolice"
                  placeholder="Ex: AP-123456"
                  value={droneForm.apolice_seguro}
                  onChange={(e) =>
                    setDroneForm((p) => ({ ...p, apolice_seguro: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_venc_seguro">Data Vencimento Seguro</Label>
                <Input
                  id="d_venc_seguro"
                  type="date"
                  value={droneForm.data_vencimento_seguro}
                  onChange={(e) =>
                    setDroneForm((p) => ({
                      ...p,
                      data_vencimento_seguro: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d_status">Status</Label>
                <Select
                  value={droneForm.status}
                  onValueChange={(val) =>
                    setDroneForm((p) => ({ ...p, status: val as DroneStatus }))
                  }
                >
                  <SelectTrigger id="d_status">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="manutencao">Em Manutencao</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="d_obs">Observacoes</Label>
              <Textarea
                id="d_obs"
                placeholder="Informacoes adicionais..."
                rows={3}
                value={droneForm.observacoes}
                onChange={(e) =>
                  setDroneForm((p) => ({ ...p, observacoes: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDroneDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingDroneId ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Component Dialog */}
      <Dialog open={componentDialogOpen} onOpenChange={setComponentDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-500" />
              {editingComponentId ? "Editar Componente" : "Novo Componente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveComponent} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c_tipo">Tipo</Label>
                <Select
                  value={componentForm.tipo}
                  onValueChange={(val) =>
                    setComponentForm((p) => ({ ...p, tipo: val as DroneComponent["tipo"] }))
                  }
                >
                  <SelectTrigger id="c_tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPONENT_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="c_status">Status</Label>
                <Select
                  value={componentForm.status}
                  onValueChange={(val) =>
                    setComponentForm((p) => ({
                      ...p,
                      status: val as DroneComponent["status"],
                    }))
                  }
                >
                  <SelectTrigger id="c_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPONENT_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c_modelo">Modelo *</Label>
              <Input
                id="c_modelo"
                placeholder="Ex: Bat001-LiPo"
                value={componentForm.modelo}
                onChange={(e) =>
                  setComponentForm((p) => ({ ...p, modelo: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c_serie">Numero de Serie *</Label>
                <Input
                  id="c_serie"
                  placeholder="Ex: SN12345"
                  value={componentForm.numero_serie}
                  onChange={(e) =>
                    setComponentForm((p) => ({ ...p, numero_serie: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c_ciclos">Ciclos Maximos</Label>
                <Input
                  id="c_ciclos"
                  type="number"
                  placeholder="Ex: 300"
                  value={componentForm.ciclo_maximo}
                  onChange={(e) =>
                    setComponentForm((p) => ({ ...p, ciclo_maximo: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setComponentDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingComponentId ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Document Dialog */}
      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              {editingDocumentId ? "Editar Documento" : "Novo Documento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDocument} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doc_tipo">Tipo</Label>
                <Select
                  value={documentForm.tipo}
                  onValueChange={(val) =>
                    setDocumentForm((p) => ({ ...p, tipo: val as DocumentAlert["tipo"] }))
                  }
                >
                  <SelectTrigger id="doc_tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc_dias">Alertar (dias antes)</Label>
                <Input
                  id="doc_dias"
                  type="number"
                  min="1"
                  value={documentForm.alertar_dias_antes}
                  onChange={(e) =>
                    setDocumentForm((p) => ({
                      ...p,
                      alertar_dias_antes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc_titulo">Titulo *</Label>
              <Input
                id="doc_titulo"
                placeholder="Ex: Seguro Aéreo 2025"
                value={documentForm.titulo}
                onChange={(e) =>
                  setDocumentForm((p) => ({ ...p, titulo: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc_venc">Data de Vencimento *</Label>
              <Input
                id="doc_venc"
                type="date"
                value={documentForm.data_vencimento}
                onChange={(e) =>
                  setDocumentForm((p) => ({
                    ...p,
                    data_vencimento: e.target.value,
                  }))
                }
                required
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDocumentDialogOpen(false);
                  setEditingDocumentId(null);
                  setDocumentForm(DEFAULT_DOCUMENT_FORM);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">{editingDocumentId ? "Atualizar" : "Registrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pilot Dialog */}
      <Dialog open={pilotDialogOpen} onOpenChange={setPilotDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              {editingPilotId ? "Editar Piloto" : "Novo Piloto"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePilot} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p_nome">Nome *</Label>
                <Input
                  id="p_nome"
                  placeholder="Ex: Joao da Silva"
                  value={pilotForm.nome}
                  onChange={(e) =>
                    setPilotForm((p) => ({ ...p, nome: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_licenca">Licenca ANAC</Label>
                <Input
                  id="p_licenca"
                  placeholder="Ex: 123456789"
                  value={pilotForm.licenca_anac}
                  onChange={(e) =>
                    setPilotForm((p) => ({ ...p, licenca_anac: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_venc_licenca">Vencimento Licenca</Label>
                <Input
                  id="p_venc_licenca"
                  type="date"
                  value={pilotForm.data_vencimento_licenca}
                  onChange={(e) =>
                    setPilotForm((p) => ({
                      ...p,
                      data_vencimento_licenca: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_telefone">Telefone</Label>
                <Input
                  id="p_telefone"
                  placeholder="Ex: (11) 99999-0000"
                  value={pilotForm.telefone}
                  onChange={(e) =>
                    setPilotForm((p) => ({ ...p, telefone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_email">Email</Label>
                <Input
                  id="p_email"
                  type="email"
                  placeholder="Ex: piloto@email.com"
                  value={pilotForm.email}
                  onChange={(e) =>
                    setPilotForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p_status">Status</Label>
                <Select
                  value={pilotForm.status}
                  onValueChange={(val) =>
                    setPilotForm((p) => ({ ...p, status: val as Pilot["status"] }))
                  }
                >
                  <SelectTrigger id="p_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPilotDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {editingPilotId ? "Atualizar" : "Cadastrar"}
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
                  <Plane className="h-5 w-5 text-emerald-500" />
                  Drones Cadastrados ({fleetSummary.totalDrones})
                </>
              )}
              {detailCard === "ativos" && (
                <>
                  <Settings className="h-5 w-5 text-green-500" />
                  Drones Ativos ({fleetSummary.dronesAtivos})
                </>
              )}
              {detailCard === "manutencao" && (
                <>
                  <Wrench className="h-5 w-5 text-amber-500" />
                  Drones em Manutenção ({fleetSummary.dronesManutencao})
                </>
              )}
              {detailCard === "horas" && (
                <>
                  <Clock className="h-5 w-5 text-blue-500" />
                  Horas de Voo ({fleetSummary.totalHorasVoo}h)
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailCard === "total" &&
                "Lista completa da frota. Abra, edite ou exclua drones."}
              {detailCard === "ativos" &&
                "Drones com status Ativo (em operação)."}
              {detailCard === "manutencao" &&
                "Drones com status Em Manutenção."}
              {detailCard === "horas" &&
                "Horas de voo por drone, ordenado do maior para o menor."}
            </DialogDescription>
          </DialogHeader>

          {detailCard === "total" && dronesDetailTable(drones)}
          {detailCard === "ativos" && dronesDetailTable(dronesAtivosList)}
          {detailCard === "manutencao" && dronesDetailTable(dronesManutList)}
          {detailCard === "horas" && dronesDetailTable(dronesPorHoras, true)}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDetailCard(null)}>
              Fechar
            </Button>
            {(detailCard === "total" ||
              detailCard === "ativos" ||
              detailCard === "manutencao") && (
              <Button onClick={novoDroneFromDetail}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Drone
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-semibold uppercase">{label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}
