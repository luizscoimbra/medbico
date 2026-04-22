import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Settings, FlaskConical, Plus, Trash2, Tractor, Hash, Truck, Map, MapPin, Activity, Pencil, RefreshCcw, Users } from "lucide-react";
import { saveTipoAplicacao, getAllTiposAplicacao, deleteTipoAplicacao, TipoAplicacao } from "@/lib/applicationTypeStorage";
import { saveEquipment, getAllEquipments, deleteEquipment, Equipment } from "@/lib/equipmentStorage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { saveArea, getAllAreas, deleteArea, AreaCadastro, AreaTalhao } from "@/lib/areaStorage";
import { saveOperador, getAllOperadores, deleteOperador, Operador } from "@/lib/operatorStorage";



interface RegisteredProduct {
  id: string;
  commercial_name: string;
  formulation: string;
  unit: string;
  package_size: number;
}

interface WaterTruck {
  id: string;
  fleet_number: string;
  model: string;
  capacity: number;
}

export default function Cadastros() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  // Equipment state
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [eqForm, setEqForm] = useState({
    equipment_model: "",
    tractor_model: "",
    fleet_number: "",
    total_nozzles: "",
    tank_capacity: "",
  });

  // Products state
  const [products, setProducts] = useState<RegisteredProduct[]>([]);
  const [prodForm, setProdForm] = useState({
    commercial_name: "",
    formulation: "SL",
    unit: "L",
    package_size: "",
  });

  // Water Trucks state
  const [waterTrucks, setWaterTrucks] = useState<WaterTruck[]>(() => {
    const saved = localStorage.getItem("waterTrucks");
    return saved ? JSON.parse(saved) : [];
  });
  const [wtForm, setWtForm] = useState({
    fleet_number: "",
    model: "",
    capacity: "",
  });
  const [editingWaterTruckId, setEditingWaterTruckId] = useState<string | null>(null);

  // Custom formulations
  const defaultFormulations = [
    { value: "WP", label: "WP - Pó Molhável" },
    { value: "WG", label: "WG - Grânulos Dispersíveis" },
    { value: "SC", label: "SC - Suspensão Concentrada" },
    { value: "EC", label: "EC - Concentrado Emulsionável" },
    { value: "SL", label: "SL - Concentrado Solúvel" },
    { value: "ADJ", label: "ADJ - Adjuvante / Óleo" },
  ];
  const [customFormulations, setCustomFormulations] = useState<{ value: string; label: string }[]>(() => {
    const saved = localStorage.getItem("customFormulations");
    return saved ? JSON.parse(saved) : [];
  });
  const [newFormulation, setNewFormulation] = useState({ value: "", label: "" });
  const [formDialogOpen, setFormDialogOpen] = useState(false);

  // Áreas state
  const [areas, setAreas] = useState<AreaCadastro[]>([]);
  const [areaForm, setAreaForm] = useState({
    nome: "",
    codigo: "",
    municipio: "",
    coordenadas: "",
    quantidadeTalhoes: "",
    areaCarreador: 0,
  });
  const [talhoesForm, setTalhoesForm] = useState<AreaTalhao[]>([]);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);

  // Tipos de Aplicação state
  const [tiposAplicacao, setTiposAplicacao] = useState<TipoAplicacao[]>([]);
  const [tipoForm, setTipoForm] = useState({
    nome: "",
    codigo: "",
  });
  const [editingTipoId, setEditingTipoId] = useState<string | null>(null);

  // Operadores state
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [operadorForm, setOperadorForm] = useState<Omit<Operador, "id" | "createdAt">>({
    nome: "",
    cracha: "",
    funcao: "Operador",
    setor: "",
  });
  const [editingOperadorId, setEditingOperadorId] = useState<string | null>(null);

  const allFormulations = [...defaultFormulations, ...customFormulations];

  const handleAddFormulation = () => {
    const code = newFormulation.value.trim().toUpperCase();
    const desc = newFormulation.label.trim();
    if (!code || !desc) {
      toast.error("Preencha a sigla e a descrição");
      return;
    }
    if (allFormulations.some((f) => f.value === code)) {
      toast.error("Essa sigla já existe");
      return;
    }
    const updated = [...customFormulations, { value: code, label: `${code} - ${desc}` }];
    setCustomFormulations(updated);
    localStorage.setItem("customFormulations", JSON.stringify(updated));
    setProdForm((p) => ({ ...p, formulation: code }));
    setNewFormulation({ value: "", label: "" });
    setFormDialogOpen(false);
    toast.success("Formulação adicionada!");
  };

  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);

  const handleEditEquipment = (eq: Equipment) => {
    setEditingEquipmentId(eq.id);
    setEqForm({
      equipment_model: eq.equipment_model,
      tractor_model: eq.tractor_model || "",
      fleet_number: eq.fleet_number,
      total_nozzles: eq.total_nozzles.toString(),
      tank_capacity: (eq.tank_capacity || 0).toString(),
    });
    const el = document.getElementById("form-equipamento");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleCancelEditEquipment = () => {
    setEditingEquipmentId(null);
    setEqForm({ equipment_model: "", tractor_model: "", fleet_number: "", total_nozzles: "", tank_capacity: "" });
  };

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const handleEditProduct = (prod: RegisteredProduct) => {
    setEditingProductId(prod.id);
    setProdForm({
      commercial_name: prod.commercial_name,
      formulation: prod.formulation,
      unit: prod.unit,
      package_size: prod.package_size.toString(),
    });
    const el = document.getElementById("form-produto");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleCancelEditProduct = () => {
    setEditingProductId(null);
    setProdForm({ commercial_name: "", formulation: "SL", unit: "L", package_size: "" });
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Faça login para acessar os cadastros");
        navigate("/auth");
        return;
      }
      setUserId(user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    fetchEquipments();
    fetchProducts();
    fetchAreasList();
    fetchTiposAplicacaoList();
    fetchOperadoresList();
  }, [userId]);

  const fetchOperadoresList = async () => {
    const list = await getAllOperadores();
    setOperadores(list);
  };

  const fetchTiposAplicacaoList = async () => {
    const list = await getAllTiposAplicacao();
    setTiposAplicacao(list);
  };

  const fetchAreasList = async () => {
    const list = await getAllAreas();
    setAreas(list);
  };

  const fetchEquipments = async () => {
    const list = await getAllEquipments();
    setEquipments(list);
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("registered_products")
      .select("*")
      .order("commercial_name");
    if (data) setProducts(data as RegisteredProduct[]);
  };

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const nozzles = parseInt(eqForm.total_nozzles);
    const capacity = parseFloat(eqForm.tank_capacity) || 0;
    if (!eqForm.equipment_model.trim() || !eqForm.fleet_number.trim() || isNaN(nozzles) || nozzles < 1) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    
    const newEq: Equipment = {
      id: editingEquipmentId || crypto.randomUUID(),
      equipment_model: eqForm.equipment_model.trim(),
      tractor_model: eqForm.tractor_model.trim(),
      fleet_number: eqForm.fleet_number.trim(),
      total_nozzles: nozzles,
      tank_capacity: capacity,
      createdAt: editingEquipmentId 
        ? equipments.find(e => e.id === editingEquipmentId)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };

    await saveEquipment(newEq);
    toast.success(editingEquipmentId ? "Equipamento atualizado!" : "Equipamento cadastrado!");
    
    setEditingEquipmentId(null);
    setEqForm({ equipment_model: "", tractor_model: "", fleet_number: "", total_nozzles: "", tank_capacity: "" });
    fetchEquipments();
  };

  const handleDeleteEquipment = async (id: string) => {
    await deleteEquipment(id);
    toast.success("Equipamento removido");
    fetchEquipments();
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const size = parseFloat(prodForm.package_size);
    if (!prodForm.commercial_name.trim() || isNaN(size) || size <= 0) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    
    const prodData = {
      user_id: userId,
      commercial_name: prodForm.commercial_name.trim(),
      formulation: prodForm.formulation,
      unit: prodForm.unit,
      package_size: size,
    };

    if (editingProductId) {
      const { error } = await supabase
        .from("registered_products")
        .update(prodData)
        .eq("id", editingProductId);
      
      if (error) {
        toast.error("Erro ao atualizar produto");
        return;
      }
      toast.success("Produto atualizado!");
    } else {
      const { error } = await supabase.from("registered_products").insert(prodData);
      if (error) {
        toast.error("Erro ao cadastrar produto");
        return;
      }
      toast.success("Produto cadastrado!");
    }
    
    setEditingProductId(null);
    setProdForm({ commercial_name: "", formulation: "SL", unit: "L", package_size: "" });
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    await supabase.from("registered_products").delete().eq("id", id);
    toast.success("Produto removido");
    fetchProducts();
  };

  const handleEditWaterTruck = (wt: WaterTruck) => {
    setEditingWaterTruckId(wt.id);
    setWtForm({
      fleet_number: wt.fleet_number,
      model: wt.model,
      capacity: wt.capacity.toString(),
    });
    const el = document.getElementById("form-caminhao");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleCancelEditWaterTruck = () => {
    setEditingWaterTruckId(null);
    setWtForm({ fleet_number: "", model: "", capacity: "" });
  };

  const handleAddWaterTruck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wtForm.fleet_number.trim() || !wtForm.model.trim() || !wtForm.capacity.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    
    if (editingWaterTruckId) {
      const updated = waterTrucks.map(wt => 
        wt.id === editingWaterTruckId 
          ? { 
              ...wt, 
              fleet_number: wtForm.fleet_number.trim(),
              model: wtForm.model.trim(),
              capacity: parseFloat(wtForm.capacity) || 0
            } 
          : wt
      );
      setWaterTrucks(updated);
      localStorage.setItem("waterTrucks", JSON.stringify(updated));
      toast.success("Caminhão pipa atualizado!");
      setEditingWaterTruckId(null);
    } else {
      const newTruck = {
        id: crypto.randomUUID(),
        fleet_number: wtForm.fleet_number.trim(),
        model: wtForm.model.trim(),
        capacity: parseFloat(wtForm.capacity) || 0
      };
      const updated = [...waterTrucks, newTruck];
      setWaterTrucks(updated);
      localStorage.setItem("waterTrucks", JSON.stringify(updated));
      toast.success("Caminhão pipa cadastrado!");
    }
    
    setWtForm({ fleet_number: "", model: "", capacity: "" });
  };

  const handleDeleteWaterTruck = (id: string) => {
    const updated = waterTrucks.filter((t) => t.id !== id);
    setWaterTrucks(updated);
    localStorage.setItem("waterTrucks", JSON.stringify(updated));
    toast.success("Caminhão pipa removido");
  };

  // Handle Areas
  const handleQuantidadeTalhoesChange = (val: string) => {
    setAreaForm((p) => ({ ...p, quantidadeTalhoes: val }));
    const qty = parseInt(val) || 0;

    if (qty > talhoesForm.length) {
      const novos = Array.from({ length: qty - talhoesForm.length }, (_, i) => ({
        id: crypto.randomUUID(),
        numero: `${talhoesForm.length + i + 1}`,
        tamanhoHectares: 0,
      }));
      setTalhoesForm([...talhoesForm, ...novos]);
    } else if (qty < talhoesForm.length) {
      setTalhoesForm(talhoesForm.slice(0, qty));
    }
  };

  const updateTalhaoForm = (idx: number, field: keyof AreaTalhao, value: any) => {
    const updated = [...talhoesForm];
    updated[idx] = { ...updated[idx], [field]: value };
    setTalhoesForm(updated);
  };

  const handleEditArea = (area: AreaCadastro) => {
    setEditingAreaId(area.id);
    setAreaForm({
      nome: area.nome,
      codigo: area.codigo || "",
      municipio: area.municipio || "",
      coordenadas: area.coordenadas || "",
      quantidadeTalhoes: area.quantidadeTalhoes.toString(),
      areaCarreador: area.areaCarreador || 0,
    });
    setTalhoesForm(area.talhoes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEditArea = () => {
    setEditingAreaId(null);
    setAreaForm({
      nome: "",
      codigo: "",
      municipio: "",
      coordenadas: "",
      quantidadeTalhoes: "",
      areaCarreador: 0,
    });
    setTalhoesForm([]);
  };

  const handleEditTipoAplicacao = (tipo: TipoAplicacao) => {
    setEditingTipoId(tipo.id);
    setTipoForm({
      nome: tipo.nome,
      codigo: tipo.codigo,
    });
    const el = document.getElementById("form-tipo-aplicacao");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleCancelEditTipoAplicacao = () => {
    setEditingTipoId(null);
    setTipoForm({ nome: "", codigo: "" });
  };

  const handleEditOperador = (op: Operador) => {
    setEditingOperadorId(op.id);
    setOperadorForm({
      nome: op.nome,
      cracha: op.cracha,
      funcao: op.funcao,
      setor: op.setor,
    });
    const el = document.getElementById("form-operador");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleCancelEditOperador = () => {
    setEditingOperadorId(null);
    setOperadorForm({ nome: "", cracha: "", funcao: "Operador", setor: "" });
  };

  const handleAddOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operadorForm.nome.trim() || !operadorForm.cracha.trim()) {
      toast.error("Preencha o nome e o crachá.");
      return;
    }
    const newOp: Operador = {
      id: editingOperadorId || crypto.randomUUID(),
      nome: operadorForm.nome.trim(),
      cracha: operadorForm.cracha.trim(),
      funcao: operadorForm.funcao,
      setor: operadorForm.setor.trim(),
      createdAt: editingOperadorId 
        ? operadores.find(o => o.id === editingOperadorId)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };
    await saveOperador(newOp);
    toast.success(editingOperadorId ? "Operador atualizado!" : "Operador cadastrado!");
    setEditingOperadorId(null);
    setOperadorForm({ nome: "", cracha: "", funcao: "Operador", setor: "" });
    fetchOperadoresList();
  };

  const handleDeleteOperador = async (id: string) => {
    await deleteOperador(id);
    toast.success("Operador removido");
    fetchOperadoresList();
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaForm.nome.trim() || talhoesForm.length === 0) {
      toast.error("Preencha o nome da área e adicione pelo menos 1 talhão.");
      return;
    }
    const newArea: AreaCadastro = {
      id: editingAreaId || crypto.randomUUID(),
      nome: areaForm.nome.trim(),
      codigo: areaForm.codigo.trim(),
      municipio: areaForm.municipio.trim(),
      coordenadas: areaForm.coordenadas.trim(),
      quantidadeTalhoes: talhoesForm.length,
      talhoes: talhoesForm,
      areaCarreador: parseFloat(areaForm.areaCarreador.toString()) || 0,
      createdAt: editingAreaId 
        ? areas.find(a => a.id === editingAreaId)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };
    await saveArea(newArea);
    toast.success(editingAreaId ? "Área atualizada!" : "Área cadastrada!");
    setEditingAreaId(null);
    setAreaForm({
      nome: "",
      codigo: "",
      municipio: "",
      coordenadas: "",
      quantidadeTalhoes: "",
      areaCarreador: 0,
    });
    setTalhoesForm([]);
    fetchAreasList();
  };

  const handleDeleteArea = async (id: string) => {
    await deleteArea(id);
    toast.success("Área removida");
    fetchAreasList();
  };

  const handleAddTipoAplicacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoForm.nome.trim() || !tipoForm.codigo.trim()) {
      toast.error("Preencha o nome do tipo de aplicação e o código.");
      return;
    }
    const newTipo: TipoAplicacao = {
      id: editingTipoId || crypto.randomUUID(),
      nome: tipoForm.nome.trim(),
      codigo: tipoForm.codigo.trim(),
      createdAt: editingTipoId 
        ? tiposAplicacao.find(t => t.id === editingTipoId)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };
    await saveTipoAplicacao(newTipo);
    toast.success(editingTipoId ? "Tipo de aplicação atualizado!" : "Tipo de aplicação cadastrado!");
    setEditingTipoId(null);
    setTipoForm({ nome: "", codigo: "" });
    fetchTiposAplicacaoList();
  };

  const handleDeleteTipoAplicacao = async (id: string) => {
    await deleteTipoAplicacao(id);
    toast.success("Tipo de aplicação removido");
    fetchTiposAplicacaoList();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-heading text-foreground mb-2">Cadastros</h1>
        <p className="text-muted-foreground">
          Gerencie seus equipamentos e produtos para uso rápido nas medições e cálculos.
        </p>
      </div>

      <Tabs defaultValue="equipamentos" className="animate-slide-up">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
          <TabsTrigger value="equipamentos" className="flex items-center gap-2 py-3 h-full whitespace-nowrap">
            <Settings className="h-4 w-4" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="caminhoes_pipa" className="flex items-center gap-2 py-3 h-full whitespace-nowrap">
            <Truck className="h-4 w-4" />
            Caminhão Pipa
          </TabsTrigger>
          <TabsTrigger value="produtos" className="flex items-center gap-2 py-3 h-full whitespace-nowrap">
            <FlaskConical className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="areas" className="flex items-center gap-2 py-3 h-full whitespace-nowrap">
            <Map className="h-4 w-4" />
            Áreas
          </TabsTrigger>
          <TabsTrigger value="tipos_aplicacao" className="flex items-center gap-2 py-3 h-full whitespace-nowrap">
            <Activity className="h-4 w-4" />
            Tipos Aplic.
          </TabsTrigger>
          <TabsTrigger value="operadores" className="flex items-center gap-2 py-3 h-full whitespace-nowrap">
            <Users className="h-4 w-4" />
            Operadores
          </TabsTrigger>
        </TabsList>

        {/* EQUIPAMENTOS TAB */}
        <TabsContent value="equipamentos">
          <Card className="shadow-lg">
            <CardHeader className="border-b border-border" id="form-equipamento">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary" />
                  {editingEquipmentId ? "Editar Equipamento" : "Cadastrar Equipamento"}
                </div>
                {editingEquipmentId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCancelEditEquipment}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancelar Edição
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddEquipment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="eq_model" className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-muted-foreground" />
                      Modelo do Pulverizador *
                    </Label>
                    <Input
                      id="eq_model"
                      placeholder="Ex: Jacto Uniport 3030"
                      value={eqForm.equipment_model}
                      onChange={(e) => setEqForm((p) => ({ ...p, equipment_model: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eq_tractor" className="flex items-center gap-2">
                      <Tractor className="h-4 w-4 text-muted-foreground" />
                      Modelo do Trator
                    </Label>
                    <Input
                      id="eq_tractor"
                      placeholder="Ex: John Deere 8R 410"
                      value={eqForm.tractor_model}
                      onChange={(e) => setEqForm((p) => ({ ...p, tractor_model: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eq_fleet" className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      Número da Frota *
                    </Label>
                    <Input
                      id="eq_fleet"
                      placeholder="Ex: FR-001"
                      value={eqForm.fleet_number}
                      onChange={(e) => setEqForm((p) => ({ ...p, fleet_number: e.target.value }))}
                      required
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
                      value={eqForm.total_nozzles}
                      onChange={(e) => setEqForm((p) => ({ ...p, total_nozzles: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eq_capacity" className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" />
                      Capacidade do Tanque (L) *
                    </Label>
                    <Input
                      id="eq_capacity"
                      type="number"
                      placeholder="Ex: 3000"
                      value={eqForm.tank_capacity}
                      onChange={(e) => setEqForm((p) => ({ ...p, tank_capacity: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingEquipmentId && (
                    <Button type="button" variant="outline" onClick={handleCancelEditEquipment}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit">
                    {editingEquipmentId ? (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Atualizar
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {equipments.length > 0 && (
            <Card className="mt-6 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Equipamentos Cadastrados ({equipments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Frota</TableHead>
                        <TableHead>Pulverizador</TableHead>
                        <TableHead>Trator</TableHead>
                        <TableHead>Bicos</TableHead>
                        <TableHead>Tanque</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipments.map((eq) => (
                        <TableRow key={eq.id}>
                          <TableCell className="font-medium">{eq.fleet_number}</TableCell>
                          <TableCell>{eq.equipment_model}</TableCell>
                          <TableCell>{eq.tractor_model || "—"}</TableCell>
                          <TableCell>{eq.total_nozzles}</TableCell>
                          <TableCell>{eq.tank_capacity || 0} L</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => handleEditEquipment(eq)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteEquipment(eq.id)}
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

        {/* CAMINHÕES PIPA TAB */}
        <TabsContent value="caminhoes_pipa">
          <Card className="shadow-lg">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Cadastrar Caminhão Pipa
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddWaterTruck} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="wt_fleet" className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      Frota *
                    </Label>
                    <Input
                      id="wt_fleet"
                      placeholder="Ex: CP-01"
                      value={wtForm.fleet_number}
                      onChange={(e) => setWtForm((p) => ({ ...p, fleet_number: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wt_model" className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      Modelo do Caminhão *
                    </Label>
                    <Input
                      id="wt_model"
                      placeholder="Ex: Mercedes-Benz Atego"
                      value={wtForm.model}
                      onChange={(e) => setWtForm((p) => ({ ...p, model: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wt_capacity" className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-muted-foreground" />
                      Capacidade do Tanque (L) *
                    </Label>
                    <Input
                      id="wt_capacity"
                      type="number"
                      placeholder="Ex: 15000"
                      value={wtForm.capacity}
                      onChange={(e) => setWtForm((p) => ({ ...p, capacity: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingWaterTruckId && (
                    <Button type="button" variant="outline" onClick={handleCancelEditWaterTruck}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit">
                    {editingWaterTruckId ? (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Atualizar
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {waterTrucks.length > 0 && (
            <Card className="mt-6 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Caminhões Pipa Cadastrados ({waterTrucks.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Frota</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Capacidade (L)</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterTrucks.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.fleet_number}</TableCell>
                          <TableCell>{t.model}</TableCell>
                          <TableCell>{t.capacity} L</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => handleEditWaterTruck(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteWaterTruck(t.id)}
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

        {/* PRODUTOS TAB */}
        <TabsContent value="produtos">
          <Card className="shadow-lg">
            <CardHeader className="border-b border-border" id="form-produto">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  {editingProductId ? "Editar Produto" : "Cadastrar Produto"}
                </div>
                {editingProductId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCancelEditProduct}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancelar Edição
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prod_name">Nome Comercial *</Label>
                    <Input
                      id="prod_name"
                      placeholder="Ex: Roundup Original"
                      value={prodForm.commercial_name}
                      onChange={(e) => setProdForm((p) => ({ ...p, commercial_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod_form">Formulação *</Label>
                    <div className="flex gap-2">
                      <Select
                        value={prodForm.formulation}
                        onValueChange={(v) => setProdForm((p) => ({ ...p, formulation: v }))}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allFormulations.map((f) => (
                            <SelectItem key={f.value} value={f.value}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline" size="icon" title="Adicionar formulação">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Nova Formulação</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                              <Label htmlFor="form_code">Sigla *</Label>
                              <Input
                                id="form_code"
                                placeholder="Ex: ME"
                                maxLength={6}
                                value={newFormulation.value}
                                onChange={(e) => setNewFormulation((p) => ({ ...p, value: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="form_desc">Descrição *</Label>
                              <Input
                                id="form_desc"
                                placeholder="Ex: Microemulsão"
                                value={newFormulation.label}
                                onChange={(e) => setNewFormulation((p) => ({ ...p, label: e.target.value }))}
                              />
                            </div>
                            <Button onClick={handleAddFormulation} className="w-full">
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod_unit">Unidade *</Label>
                    <Select
                      value={prodForm.unit}
                      onValueChange={(v) => setProdForm((p) => ({ ...p, unit: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Litros (L)</SelectItem>
                        <SelectItem value="KG">Quilogramas (KG)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prod_size">Tamanho da Embalagem *</Label>
                    <Input
                      id="prod_size"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="Ex: 5"
                      value={prodForm.package_size}
                      onChange={(e) => setProdForm((p) => ({ ...p, package_size: e.target.value }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Peso (KG) ou Volume (L) da embalagem
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingProductId && (
                    <Button type="button" variant="outline" onClick={handleCancelEditProduct}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit">
                    {editingProductId ? (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Atualizar
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {products.length > 0 && (
            <Card className="mt-6 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Produtos Cadastrados ({products.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome Comercial</TableHead>
                        <TableHead>Formulação</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Embalagem</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.commercial_name}</TableCell>
                          <TableCell>{p.formulation}</TableCell>
                          <TableCell>{p.unit}</TableCell>
                          <TableCell>{p.package_size} {p.unit}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => handleEditProduct(p)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteProduct(p.id)}
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

        {/* ÁREAS TAB */}
        <TabsContent value="areas">
          <Card className="shadow-lg mb-6">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Map className="h-5 w-5 text-primary" />
                  {editingAreaId ? "Editar Área" : "Cadastrar Área"}
                </div>
                {editingAreaId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCancelEditArea}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancelar Edição
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddArea} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="area_nome">Nome da Área *</Label>
                    <Input
                      id="area_nome"
                      placeholder="Ex: Fazenda Boa Vista"
                      value={areaForm.nome}
                      onChange={(e) => setAreaForm((p) => ({ ...p, nome: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area_codigo">Código da Área</Label>
                    <Input
                      id="area_codigo"
                      placeholder="Ex: F-01"
                      value={areaForm.codigo}
                      onChange={(e) => setAreaForm((p) => ({ ...p, codigo: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area_municipio">Município *</Label>
                    <Input
                      id="area_municipio"
                      placeholder="Ex: Ribeirão Preto - SP"
                      value={areaForm.municipio}
                      onChange={(e) => setAreaForm((p) => ({ ...p, municipio: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area_coord">Coordenadas (Lat, Long)</Label>
                    <Input
                      id="area_coord"
                      placeholder="-23.550520, -46.633308"
                      value={areaForm.coordenadas}
                      onChange={(e) => setAreaForm((p) => ({ ...p, coordenadas: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area_talhoes">Total de Talhões *</Label>
                    <Input
                      id="area_talhoes"
                      type="number"
                      min="1"
                      placeholder="Ex: 5"
                      value={areaForm.quantidadeTalhoes}
                      onChange={(e) => handleQuantidadeTalhoesChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {talhoesForm.length > 0 && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/20">
                    <h4 className="text-sm font-semibold mb-3">Configuração dos Talhões</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {talhoesForm.map((t, idx) => (
                        <div key={t.id} className="p-3 border rounded bg-background flex flex-col gap-2">
                          <Label className="text-xs font-semibold">Talhão {idx + 1}</Label>
                          <div>
                            <Label className="text-xs text-muted-foreground">Número/Nome</Label>
                            <Input
                              value={t.numero}
                              onChange={(e) => updateTalhaoForm(idx, "numero", e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Tamanho (ha)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={t.tamanhoHectares || ""}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                updateTalhaoForm(idx, "tamanhoHectares", val);

                                // Calcular a nova área total e o carreador
                                const updatedTalhoes = [...talhoesForm];
                                updatedTalhoes[idx] = { ...updatedTalhoes[idx], tamanhoHectares: val };
                                const totalHa = updatedTalhoes.reduce((s, curr) => s + (curr.tamanhoHectares || 0), 0);
                                setAreaForm(p => ({ ...p, areaCarreador: Number((totalHa * 0.1).toFixed(2)) }));
                              }}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="area_carreador" className="text-sm font-semibold text-primary">
                          Área de Carreador (10% da área total)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="area_carreador"
                            type="number"
                            step="0.01"
                            value={areaForm.areaCarreador}
                            onChange={(e) => setAreaForm(p => ({ ...p, areaCarreador: parseFloat(e.target.value) || 0 }))}
                            className="bg-primary/5 border-primary/20 font-bold"
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">ha</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          Calculado automaticamente: {(talhoesForm.reduce((s, t) => s + (t.tamanhoHectares || 0), 0) * 0.1).toFixed(2)} ha
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {editingAreaId && (
                    <Button type="button" variant="outline" onClick={handleCancelEditArea}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit">
                    {editingAreaId ? (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Atualizar
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {areas.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Áreas Cadastradas ({areas.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Município</TableHead>
                        <TableHead>Talhões (Qtd)</TableHead>
                        <TableHead>Área Total (ha)</TableHead>
                        <TableHead>Carreador (ha)</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areas.map((a) => {
                        const totalArea = a.talhoes.reduce((acc, curr) => acc + (curr.tamanhoHectares || 0), 0);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium text-xs sm:text-sm">{a.nome}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{a.codigo || "—"}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{a.municipio || "—"}</TableCell>
                            <TableCell className="text-xs sm:text-sm">{a.quantidadeTalhoes}</TableCell>
                            <TableCell className="text-xs sm:text-sm font-semibold">{totalArea.toFixed(2)}</TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {a.areaCarreador ? (
                                <span className="text-primary font-medium">{a.areaCarreador.toFixed(2)} ha</span>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              {a.coordenadas ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary/80 h-7 text-[10px] sm:text-xs"
                                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.coordenadas)}`, "_blank")}
                                >
                                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> Rota
                                </Button>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary"
                                  onClick={() => handleEditArea(a)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteArea(a.id)}
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
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* TIPOS DE APLICAÇÃO TAB */}
        <TabsContent value="tipos_aplicacao">
          <Card className="shadow-lg">
            <CardHeader className="border-b border-border" id="form-tipo-aplicacao">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  {editingTipoId ? "Editar Tipo de Aplicação" : "Cadastrar Tipo de Aplicação"}
                </div>
                {editingTipoId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCancelEditTipoAplicacao}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancelar Edição
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddTipoAplicacao} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_nome">Tipo de Aplicação *</Label>
                    <Input
                      id="tipo_nome"
                      placeholder="Ex: Pulverização Terrestre"
                      value={tipoForm.nome}
                      onChange={(e) => setTipoForm((p) => ({ ...p, nome: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tipo_codigo">Código da Aplicação *</Label>
                    <Input
                      id="tipo_codigo"
                      placeholder="Ex: T-01"
                      value={tipoForm.codigo}
                      onChange={(e) => setTipoForm((p) => ({ ...p, codigo: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingTipoId && (
                    <Button type="button" variant="outline" onClick={handleCancelEditTipoAplicacao}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit">
                    {editingTipoId ? (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Atualizar
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {tiposAplicacao.length > 0 && (
            <Card className="mt-6 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Tipos de Aplicação Cadastrados ({tiposAplicacao.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de Aplicação</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiposAplicacao.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.nome}</TableCell>
                          <TableCell>{t.codigo}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => handleEditTipoAplicacao(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteTipoAplicacao(t.id)}
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

        {/* OPERADORES TAB */}
        <TabsContent value="operadores">
          <Card className="shadow-lg">
            <CardHeader className="border-b border-border" id="form-operador">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  {editingOperadorId ? "Editar Operador" : "Cadastrar Operador"}
                </div>
                {editingOperadorId && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCancelEditOperador}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancelar Edição
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddOperador} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="op_nome">Nome do Operador *</Label>
                    <Input
                      id="op_nome"
                      placeholder="Ex: João da Silva"
                      value={operadorForm.nome}
                      onChange={(e) => setOperadorForm((p) => ({ ...p, nome: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="op_cracha">Crachá *</Label>
                    <Input
                      id="op_cracha"
                      placeholder="Ex: 123456"
                      value={operadorForm.cracha}
                      onChange={(e) => setOperadorForm((p) => ({ ...p, cracha: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="op_funcao">Função *</Label>
                    <Select
                      value={operadorForm.funcao}
                      onValueChange={(v: 'Operador' | 'Motorista' | 'Gestor') => setOperadorForm((p) => ({ ...p, funcao: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Operador">Operador</SelectItem>
                        <SelectItem value="Motorista">Motorista</SelectItem>
                        <SelectItem value="Gestor">Gestor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="op_setor">Setor</Label>
                    <Input
                      id="op_setor"
                      placeholder="Ex: Agrícola"
                      value={operadorForm.setor}
                      onChange={(e) => setOperadorForm((p) => ({ ...p, setor: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {editingOperadorId && (
                    <Button type="button" variant="outline" onClick={handleCancelEditOperador}>
                      Cancelar
                    </Button>
                  )}
                  <Button type="submit">
                    {editingOperadorId ? (
                      <>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Atualizar
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Cadastrar
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {operadores.length > 0 && (
            <Card className="mt-6 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Operadores Cadastrados ({operadores.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Crachá</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operadores.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">{o.nome}</TableCell>
                          <TableCell>{o.cracha}</TableCell>
                          <TableCell>{o.funcao}</TableCell>
                          <TableCell>{o.setor || "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                onClick={() => handleEditOperador(o)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteOperador(o.id)}
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
