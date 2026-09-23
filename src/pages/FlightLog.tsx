import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Pencil,
  Eye,
  Plane,
  Clock,
  Droplets,
  Leaf,
  Cloud,
  Wind,
  Thermometer,
  User,
  MapPin,
  Search,
  X,
  RefreshCcw,
  ArrowLeft,
} from "lucide-react";
import {
  supabase,
} from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  getAllDrones,
  getAllFlightLogs,
  createFlightLog,
  updateFlightLog,
  deleteFlightLog,
  Drone,
  FlightLog as FlightLogType,
} from "@/lib/droneStorage";

interface ProdutoAplicado {
  nome: string;
  dose: number;
  unidade: string;
}

interface FlightLogFormData {
  drone_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  area_nome: string;
  talhao: string;
  cliente_nome: string;
  cultura: string;
  piloto: string;
  operador_apoio: string;
  tempo_voo_min: number | string;
  hectares_pulverizados: number | string;
  volume_aplicado_l: number | string;
  produtos_aplicados: ProdutoAplicado[];
  ciclos_bateria: number | string;
  combustivel_gerador_l: number | string;
  condicoes_climaticas: string;
  vento_kmh: number | string;
  temperatura_c: number | string;
  os_id: string;
  observacoes: string;
}

const emptyFormData: FlightLogFormData = {
  drone_id: "",
  data: new Date().toISOString().split("T")[0],
  hora_inicio: "",
  hora_fim: "",
  area_nome: "",
  talhao: "",
  cliente_nome: "",
  cultura: "",
  piloto: "",
  operador_apoio: "",
  tempo_voo_min: "",
  hectares_pulverizados: "",
  volume_aplicado_l: "",
  produtos_aplicados: [{ nome: "", dose: 0, unidade: "L" }],
  ciclos_bateria: "",
  combustivel_gerador_l: "",
  condicoes_climaticas: "ensolarado",
  vento_kmh: "",
  temperatura_c: "",
  os_id: "",
  observacoes: "",
};

const condicoesOptions = [
  { value: "ensolarado", label: "Ensolarado" },
  { value: "nublado", label: "Nublado" },
  { value: "chuvoso", label: "Chuvoso" },
  { value: "ventoso", label: "Ventoso" },
];

export default function FlightLog() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [flightLogs, setFlightLogs] = useState<FlightLogType[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<FlightLogType | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FlightLogFormData>(emptyFormData);

  const [filterDrone, setFilterDrone] = useState("all");
  const [filterPiloto, setFilterPiloto] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para acessar o logbook de voo");
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dronesData, logsData] = await Promise.all([
        getAllDrones(),
        getAllFlightLogs(),
      ]);
      setDrones(dronesData);
      setFlightLogs(logsData);
    } catch (err) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return flightLogs.filter((log) => {
      if (filterDrone !== "all" && log.drone_id !== filterDrone) return false;
      if (filterPiloto && !log.piloto?.toLowerCase().includes(filterPiloto.toLowerCase()))
        return false;
      if (filterDateFrom && log.data < filterDateFrom) return false;
      if (filterDateTo && log.data > filterDateTo) return false;
      return true;
    });
  }, [flightLogs, filterDrone, filterPiloto, filterDateFrom, filterDateTo]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const voosHoje = flightLogs.filter((l) => l.data === today).length;
    const logsMes = flightLogs.filter((l) => {
      const d = new Date(l.data);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const voosMes = logsMes.length;
    const horasVooMes = logsMes.reduce((acc, l) => acc + (l.tempo_voo_min || 0), 0) / 60;
    const hectaresMes = logsMes.reduce((acc, l) => acc + (l.hectares_pulverizados || 0), 0);

    return {
      voosHoje,
      voosMes,
      horasVooMes: Math.round(horasVooMes * 10) / 10,
      hectaresMes: Math.round(hectaresMes * 100) / 100,
    };
  }, [flightLogs]);

  const getDroneModelo = (droneId: string) => {
    const drone = drones.find((d) => d.id === droneId);
    return drone ? `${drone.marca} ${drone.modelo}` : "Desconhecido";
  };

  const openNewDialog = () => {
    setEditingId(null);
    setFormData({ ...emptyFormData, data: new Date().toISOString().split("T")[0] });
    setDialogOpen(true);
  };

  const openEditDialog = (log: FlightLogType) => {
    setEditingId(log.id);
    setFormData({
      drone_id: log.drone_id,
      data: log.data,
      hora_inicio: log.hora_inicio || "",
      hora_fim: log.hora_fim || "",
      area_nome: log.area_nome || "",
      talhao: log.talhao || "",
      cliente_nome: log.cliente_nome || "",
      cultura: log.cultura || "",
      piloto: log.piloto || "",
      operador_apoio: log.operador_apoio || "",
      tempo_voo_min: log.tempo_voo_min || "",
      hectares_pulverizados: log.hectares_pulverizados || "",
      volume_aplicado_l: log.volume_aplicado_l || "",
      produtos_aplicados:
        log.produtos_aplicados && log.produtos_aplicados.length > 0
          ? log.produtos_aplicados
          : [{ nome: "", dose: 0, unidade: "L" }],
      ciclos_bateria: log.ciclos_bateria || "",
      combustivel_gerador_l: log.combustivel_gerador_l || "",
      condicoes_climaticas: log.condicoes_climaticas || "ensolarado",
      vento_kmh: log.vento_kmh || "",
      temperatura_c: log.temperatura_c || "",
      os_id: log.os_id || "",
      observacoes: log.observacoes || "",
    });
    setDialogOpen(true);
  };

  const openViewDialog = (log: FlightLogType) => {
    setSelectedLog(log);
    setViewDialogOpen(true);
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!formData.drone_id) {
      toast.error("Selecione um drone");
      return;
    }
    if (!formData.data) {
      toast.error("Informe a data do voo");
      return;
    }

    const payload: Omit<FlightLogType, "id" | "created_at" | "updated_at"> = {
      drone_id: formData.drone_id,
      user_id: userId,
      data: formData.data,
      hora_inicio: formData.hora_inicio || null,
      hora_fim: formData.hora_fim || null,
      area_nome: formData.area_nome,
      talhao: formData.talhao,
      cliente_nome: formData.cliente_nome,
      cultura: formData.cultura,
      piloto: formData.piloto,
      operador_apoio: formData.operador_apoio,
      tempo_voo_min: Number(formData.tempo_voo_min) || 0,
      hectares_pulverizados: Number(formData.hectares_pulverizados) || 0,
      volume_aplicado_l: Number(formData.volume_aplicado_l) || 0,
      produtos_aplicados: formData.produtos_aplicados.filter((p) => p.nome.trim()),
      ciclos_bateria: Number(formData.ciclos_bateria) || 0,
      combustivel_gerador_l: Number(formData.combustivel_gerador_l) || 0,
      condicoes_climaticas: formData.condicoes_climaticas,
      vento_kmh: Number(formData.vento_kmh) || 0,
      temperatura_c: Number(formData.temperatura_c) || 0,
      observacoes: formData.observacoes,
      os_id: formData.os_id,
    };

    try {
      if (editingId) {
        await updateFlightLog(editingId, payload);
        toast.success("Registro de voo atualizado!");
      } else {
        await createFlightLog(payload);
        toast.success("Registro de voo criado!");
      }
      setDialogOpen(false);
      setEditingId(null);
      setFormData(emptyFormData);
      loadData();
    } catch (err) {
      toast.error("Erro ao salvar registro de voo");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteFlightLog(deletingId);
      toast.success("Registro removido");
      setDeletingId(null);
      loadData();
    } catch (err) {
      toast.error("Erro ao excluir registro");
    }
  };

  const addProduto = () => {
    setFormData((prev) => ({
      ...prev,
      produtos_aplicados: [...prev.produtos_aplicados, { nome: "", dose: 0, unidade: "L" }],
    }));
  };

  const removeProduto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      produtos_aplicados: prev.produtos_aplicados.filter((_, i) => i !== index),
    }));
  };

  const updateProduto = (index: number, field: keyof ProdutoAplicado, value: string | number) => {
    setFormData((prev) => {
      const updated = [...prev.produtos_aplicados];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, produtos_aplicados: updated };
    });
  };

  const clearFilters = () => {
    setFilterDrone("all");
    setFilterPiloto("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const hasActiveFilters = filterDrone !== "all" || filterPiloto !== "" || filterDateFrom !== "" || filterDateTo !== "";

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              <h1 className="text-3xl font-heading text-foreground mb-2">
                Logbook de Voo
              </h1>
              <p className="text-muted-foreground">
                Registro e acompanhamento de todos os voos realizados.
              </p>
            </div>
          </div>
          <Button onClick={openNewDialog} className="self-start">
            <Plus className="h-4 w-4 mr-2" />
            Novo Registro
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-slide-up">
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Plane className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Voos Hoje</p>
                <p className="text-2xl font-bold">{stats.voosHoje}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Plane className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Voos no Mês</p>
                <p className="text-2xl font-bold">{stats.voosMes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horas Voo (Mês)</p>
                <p className="text-2xl font-bold">{stats.horasVooMes}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Leaf className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hectares (Mês)</p>
                <p className="text-2xl font-bold">{stats.hectaresMes} ha</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="mb-6 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <Label className="text-xs mb-1 block">Drone</Label>
              <Select value={filterDrone} onValueChange={setFilterDrone}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os drones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {drones.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.marca} {d.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <Label className="text-xs mb-1 block">Piloto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar piloto..."
                  value={filterPiloto}
                  onChange={(e) => setFilterPiloto(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <Label className="text-xs mb-1 block">Data Início</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-0 w-full sm:w-auto">
              <Label className="text-xs mb-1 block">Data Fim</Label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Flight Logs Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">
            Registros de Voo ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Plane className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg">Nenhum registro de voo encontrado.</p>
              <p className="text-sm mt-1">
                Clique em "Novo Registro" para adicionar o primeiro voo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="hidden sm:table-cell">Drone</TableHead>
                    <TableHead>Área/Talhão</TableHead>
                    <TableHead className="hidden md:table-cell">Piloto</TableHead>
                    <TableHead className="hidden sm:table-cell">Tempo Voo</TableHead>
                    <TableHead className="hidden md:table-cell">Ha</TableHead>
                    <TableHead className="hidden lg:table-cell">Volume</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {new Date(log.data + "T00:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {getDroneModelo(log.drone_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[150px]">{log.area_nome || "—"}</span>
                          {log.talhao && (
                            <span className="text-xs text-muted-foreground">T{log.talhao}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{log.piloto || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell whitespace-nowrap">
                        {log.tempo_voo_min ? `${log.tempo_voo_min} min` : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell whitespace-nowrap">
                        {log.hectares_pulverizados ? `${log.hectares_pulverizados} ha` : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell whitespace-nowrap">
                        {log.volume_aplicado_l ? `${log.volume_aplicado_l} L` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600"
                            onClick={() => openViewDialog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary"
                            onClick={() => openEditDialog(log)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(log.id)}
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

      {/* New/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Registro de Voo" : "Novo Registro de Voo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Drone + Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Drone *</Label>
                <Select
                  value={formData.drone_id}
                  onValueChange={(val) => setFormData((p) => ({ ...p, drone_id: val }))}
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
                  value={formData.data}
                  onChange={(e) => setFormData((p) => ({ ...p, data: e.target.value }))}
                />
              </div>
            </div>

            {/* Horas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Início</Label>
                <Input
                  type="time"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData((p) => ({ ...p, hora_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Fim</Label>
                <Input
                  type="time"
                  value={formData.hora_fim}
                  onChange={(e) => setFormData((p) => ({ ...p, hora_fim: e.target.value }))}
                />
              </div>
            </div>

            {/* Área / Talhão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Área/Propriedade</Label>
                <Input
                  placeholder="Nome da área"
                  value={formData.area_nome}
                  onChange={(e) => setFormData((p) => ({ ...p, area_nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Talhão</Label>
                <Input
                  placeholder="Ex: 1, 2A"
                  value={formData.talhao}
                  onChange={(e) => setFormData((p) => ({ ...p, talhao: e.target.value }))}
                />
              </div>
            </div>

            {/* Cliente / Cultura */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input
                  placeholder="Nome do cliente"
                  value={formData.cliente_nome}
                  onChange={(e) => setFormData((p) => ({ ...p, cliente_nome: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Cultura</Label>
                <Input
                  placeholder="Ex: Soja, Milho"
                  value={formData.cultura}
                  onChange={(e) => setFormData((p) => ({ ...p, cultura: e.target.value }))}
                />
              </div>
            </div>

            {/* Piloto / Operador */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Piloto</Label>
                <Input
                  placeholder="Nome do piloto"
                  value={formData.piloto}
                  onChange={(e) => setFormData((p) => ({ ...p, piloto: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Operador de Apoio</Label>
                <Input
                  placeholder="Nome do operador"
                  value={formData.operador_apoio}
                  onChange={(e) => setFormData((p) => ({ ...p, operador_apoio: e.target.value }))}
                />
              </div>
            </div>

            {/* Tempo / Ha / Volume */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tempo Voo (min)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.tempo_voo_min}
                  onChange={(e) => setFormData((p) => ({ ...p, tempo_voo_min: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Hectares Pulverizados</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={formData.hectares_pulverizados}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, hectares_pulverizados: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Volume Aplicado (L)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={formData.volume_aplicado_l}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, volume_aplicado_l: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Produtos Aplicados */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Produtos Aplicados</Label>
                <Button type="button" variant="outline" size="sm" onClick={addProduto}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              {formData.produtos_aplicados.map((prod, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Nome do produto"
                      value={prod.nome}
                      onChange={(e) => updateProduto(idx, "nome", e.target.value)}
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Dose"
                      value={prod.dose || ""}
                      onChange={(e) => updateProduto(idx, "dose", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <Select
                      value={prod.unidade}
                      onValueChange={(val) => updateProduto(idx, "unidade", val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="mL">mL</SelectItem>
                        <SelectItem value="g">g</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.produtos_aplicados.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive shrink-0"
                      onClick={() => removeProduto(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Bateria / Combustível */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ciclos Bateria</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.ciclos_bateria}
                  onChange={(e) => setFormData((p) => ({ ...p, ciclos_bateria: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Combustível Gerador (L)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={formData.combustivel_gerador_l}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, combustivel_gerador_l: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Condições / Vento / Temp */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Condições Climáticas</Label>
                <Select
                  value={formData.condicoes_climaticas}
                  onValueChange={(val) =>
                    setFormData((p) => ({ ...p, condicoes_climaticas: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {condicoesOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vento (km/h)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={formData.vento_kmh}
                  onChange={(e) => setFormData((p) => ({ ...p, vento_kmh: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Temperatura (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={formData.temperatura_c}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, temperatura_c: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* OS / Observações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>OS Vinculada</Label>
                <Input
                  placeholder="Número da OS"
                  value={formData.os_id}
                  onChange={(e) => setFormData((p) => ({ ...p, os_id: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações sobre o voo..."
                rows={3}
                value={formData.observacoes}
                onChange={(e) => setFormData((p) => ({ ...p, observacoes: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingId ? (
                  <>
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Atualizar
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Voo</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {new Date(selectedLog.data + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Drone</p>
                  <Badge variant="outline">{getDroneModelo(selectedLog.drone_id)}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Hora Início</p>
                  <p className="font-medium">{selectedLog.hora_inicio || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hora Fim</p>
                  <p className="font-medium">{selectedLog.hora_fim || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Área/Propriedade</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedLog.area_nome || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Talhão</p>
                  <p className="font-medium">{selectedLog.talhao || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedLog.cliente_nome || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cultura</p>
                  <p className="font-medium">{selectedLog.cultura || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Piloto</p>
                  <p className="font-medium flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {selectedLog.piloto || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Operador de Apoio</p>
                  <p className="font-medium">{selectedLog.operador_apoio || "—"}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Dados de Voo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Tempo de Voo</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedLog.tempo_voo_min ? `${selectedLog.tempo_voo_min} min` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hectares</p>
                    <p className="font-medium flex items-center gap-1">
                      <Leaf className="h-3 w-3" />
                      {selectedLog.hectares_pulverizados
                        ? `${selectedLog.hectares_pulverizados} ha`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Volume Aplicado</p>
                    <p className="font-medium flex items-center gap-1">
                      <Droplets className="h-3 w-3" />
                      {selectedLog.volume_aplicado_l
                        ? `${selectedLog.volume_aplicado_l} L`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedLog.produtos_aplicados &&
                selectedLog.produtos_aplicados.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-sm mb-2">Produtos Aplicados</h4>
                    <div className="space-y-1">
                      {selectedLog.produtos_aplicados.map((prod, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm bg-muted/50 rounded px-3 py-1.5"
                        >
                          <span className="font-medium">{prod.nome}</span>
                          <span className="text-muted-foreground">
                            — {prod.dose} {prod.unidade}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Recursos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Ciclos Bateria</p>
                    <p className="font-medium">{selectedLog.ciclos_bateria || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Combustível Gerador</p>
                    <p className="font-medium">
                      {selectedLog.combustivel_gerador_l
                        ? `${selectedLog.combustivel_gerador_l} L`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Condições Climáticas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Condições</p>
                    <p className="font-medium flex items-center gap-1">
                      <Cloud className="h-3 w-3" />
                      {selectedLog.condicoes_climaticas
                        ? condicoesOptions.find(
                            (c) => c.value === selectedLog.condicoes_climaticas
                          )?.label || selectedLog.condicoes_climaticas
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Vento</p>
                    <p className="font-medium flex items-center gap-1">
                      <Wind className="h-3 w-3" />
                      {selectedLog.vento_kmh ? `${selectedLog.vento_kmh} km/h` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Temperatura</p>
                    <p className="font-medium flex items-center gap-1">
                      <Thermometer className="h-3 w-3" />
                      {selectedLog.temperatura_c
                        ? `${selectedLog.temperatura_c} °C`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedLog.os_id && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground">OS Vinculada</p>
                  <p className="font-medium">{selectedLog.os_id}</p>
                </div>
              )}

              {selectedLog.observacoes && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedLog.observacoes}</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir este registro de voo? Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeletingId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
