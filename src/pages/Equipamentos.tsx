import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  FlaskConical,
  Hash,
  Pencil,
  Plus,
  RefreshCcw,
  Settings,
  Timer,
  Trash2,
  Truck,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteEquipment,
  getAllEquipments,
  saveEquipment,
  type Equipment,
} from "@/lib/equipmentStorage";

interface FormState {
  equipment_model: string;
  tractor_model: string;
  fleet_number: string;
  total_nozzles: string;
  tank_capacity: string;
  horas_acumuladas: string;
}

const FORM_VAZIO: FormState = {
  equipment_model: "",
  tractor_model: "",
  fleet_number: "",
  total_nozzles: "",
  tank_capacity: "",
  horas_acumuladas: "",
};

export default function Equipamentos() {
  const navigate = useNavigate();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const [excluindo, setExcluindo] = useState<Equipment | null>(null);
  const [processando, setProcessando] = useState(false);

  const load = async () => {
    try {
      const list = await getAllEquipments();
      setEquipments([...list].sort((a, b) => (a.fleet_number || "").localeCompare(b.fleet_number || "")));
    } catch {
      toast.error("Erro ao carregar os equipamentos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const abrirNovo = () => {
    setEditingId(null);
    setForm(FORM_VAZIO);
    setFormOpen(true);
  };

  const abrirEditar = (eq: Equipment) => {
    setEditingId(eq.id);
    setForm({
      equipment_model: eq.equipment_model || "",
      tractor_model: eq.tractor_model || "",
      fleet_number: eq.fleet_number || "",
      total_nozzles: eq.total_nozzles ? String(eq.total_nozzles) : "",
      tank_capacity: eq.tank_capacity || eq.tank_capacity === 0 ? String(eq.tank_capacity) : "",
      horas_acumuladas: eq.horas_acumuladas != null ? String(eq.horas_acumuladas) : "",
    });
    setFormOpen(true);
  };

  const salvar = async () => {
    const equipment_model = form.equipment_model.trim();
    const fleet_number = form.fleet_number.trim();
    const total_nozzles = parseInt(form.total_nozzles, 10);
    const tank_capacity = parseFloat(form.tank_capacity);

    if (!equipment_model) {
      toast.error("Informe o modelo do pulverizador");
      return;
    }
    if (!fleet_number) {
      toast.error("Informe o número da frota");
      return;
    }
    const duplicado = equipments.some(
      (e) => e.fleet_number === fleet_number && e.id !== editingId
    );
    if (duplicado) {
      toast.error(`Já existe um equipamento com a frota "${fleet_number}"`);
      return;
    }
    if (!Number.isFinite(total_nozzles) || total_nozzles < 1) {
      toast.error("Informe a quantidade de bicos (mínimo 1)");
      return;
    }
    if (!Number.isFinite(tank_capacity) || tank_capacity < 0) {
      toast.error("Informe a capacidade do tanque");
      return;
    }

    setSalvando(true);
    try {
      const existing = editingId ? equipments.find((e) => e.id === editingId) : undefined;
      const horasDigitadas = parseFloat(form.horas_acumuladas);
      const horasAtualizadas =
        form.horas_acumuladas.trim() !== "" && Number.isFinite(horasDigitadas)
          ? horasDigitadas
          : existing?.horas_acumuladas ?? 0;
      const trocouHoras = horasAtualizadas !== existing?.horas_acumuladas;
      const payload: Equipment = {
        ...(existing || ({} as Equipment)),
        id:
          existing?.id ||
          `eq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        equipment_model,
        tractor_model: form.tractor_model.trim(),
        fleet_number,
        total_nozzles,
        tank_capacity,
        horas_acumuladas: horasAtualizadas,
        data_ultima_leitura:
          trocouHoras || !existing?.data_ultima_leitura
            ? new Date().toISOString().slice(0, 10)
            : existing.data_ultima_leitura,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };
      await saveEquipment(payload);
      toast.success(editingId ? "Equipamento atualizado!" : "Equipamento cadastrado!");
      setFormOpen(false);
      setEditingId(null);
      setForm(FORM_VAZIO);
      await load();
    } catch {
      toast.error("Erro ao salvar o equipamento");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!excluindo) return;
    setProcessando(true);
    try {
      await deleteEquipment(excluindo.id);
      toast.success("Equipamento excluído");
      setExcluindo(null);
      await load();
    } catch {
      toast.error("Erro ao excluir o equipamento");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-foreground">Equipamentos</h1>
            <p className="text-sm text-muted-foreground">
              Pulverizadores e tratores cadastrados na frota
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/manutencao-equipamentos")}>
            <Wrench className="h-4 w-4 mr-2" /> Manutenção
          </Button>
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-2" /> Novo Equipamento
          </Button>
        </div>
      </div>

      {/* Lista */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="border-b border-border/50 bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Equipamentos Cadastrados ({equipments.length})
          </CardTitle>
          <CardDescription>
            Use os botões de editar e excluir na coluna de ações para manter o cadastro atualizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground italic">
              Carregando equipamentos...
            </div>
          ) : equipments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic">
              Nenhum equipamento cadastrado.{" "}
              <button type="button" className="text-primary underline" onClick={abrirNovo}>
                Cadastrar o primeiro
              </button>
              .
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Frota</TableHead>
                    <TableHead>Pulverizador</TableHead>
                    <TableHead>Trator</TableHead>
                    <TableHead className="text-right">Bicos</TableHead>
                    <TableHead className="text-right">Tanque</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipments.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="font-mono font-semibold">{eq.fleet_number}</TableCell>
                      <TableCell className="font-medium">{eq.equipment_model || "—"}</TableCell>
                      <TableCell>{eq.tractor_model || "—"}</TableCell>
                      <TableCell className="text-right">{eq.total_nozzles}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {eq.tank_capacity || 0} L
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {eq.horas_acumuladas != null ? `${eq.horas_acumuladas} h` : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            className="h-8 w-8 text-primary"
                            onClick={() => abrirEditar(eq)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setExcluindo(eq)}
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

      {/* Dialog: novo / editar */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditingId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {editingId ? "Editar equipamento" : "Novo equipamento"}
            </DialogTitle>
            <DialogDescription>
              Os dados alimentam a Ordem de Serviço e os cálculos de aplicação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="eq_model" className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Modelo do Pulverizador *
              </Label>
              <Input
                id="eq_model"
                placeholder="Ex: Jacto Uniport 3030"
                value={form.equipment_model}
                onChange={(e) => setForm({ ...form, equipment_model: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eq_tractor" className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                Modelo do Trator
              </Label>
              <Input
                id="eq_tractor"
                placeholder="Ex: John Deere 8R 4100"
                value={form.tractor_model}
                onChange={(e) => setForm({ ...form, tractor_model: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eq_fleet" className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Número da Frota *
                </Label>
                <Input
                  id="eq_fleet"
                  placeholder="Ex: FR-001"
                  value={form.fleet_number}
                  onChange={(e) => setForm({ ...form, fleet_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eq_nozzles" className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Quantidade de Bicos *
                </Label>
                <Input
                  id="eq_nozzles"
                  type="number"
                  min="1"
                  max="200"
                  placeholder="Ex: 48"
                  value={form.total_nozzles}
                  onChange={(e) => setForm({ ...form, total_nozzles: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eq_capacity" className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                Capacidade do Tanque (L) *
              </Label>
              <Input
                id="eq_capacity"
                type="number"
                min="0"
                placeholder="Ex: 3000"
                value={form.tank_capacity}
                onChange={(e) => setForm({ ...form, tank_capacity: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eq_horas" className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                Horímetro (horas de trabalho)
              </Label>
              <Input
                id="eq_horas"
                type="number"
                min="0"
                step="0.1"
                placeholder="Ex: 1250"
                value={form.horas_acumuladas}
                onChange={(e) => setForm({ ...form, horas_acumuladas: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? (
                "Salvando..."
              ) : editingId ? (
                <>
                  <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" /> Cadastrar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && !processando && setExcluindo(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir equipamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Excluir o equipamento de frota "{excluindo?.fleet_number}" —{" "}
              {excluindo?.equipment_model}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={processando}>
              Voltar
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={excluir}
              disabled={processando}
            >
              {processando ? "Processando..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
