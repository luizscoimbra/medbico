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
import { Settings, FlaskConical, Plus, Trash2, Tractor, Hash, Truck, Map, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { saveArea, getAllAreas, deleteArea, AreaCadastro, AreaTalhao } from "@/lib/areaStorage";

interface Equipment {
  id: string;
  equipment_model: string;
  tractor_model: string;
  fleet_number: string;
  total_nozzles: number;
}

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
  driver: string;
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
    driver: "",
  });

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
    coordenadas: "",
    quantidadeTalhoes: "",
  });
  const [talhoesForm, setTalhoesForm] = useState<AreaTalhao[]>([]);

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
  }, [userId]);

  const fetchAreasList = async () => {
    const list = await getAllAreas();
    setAreas(list);
  };

  const fetchEquipments = async () => {
    const { data } = await supabase
      .from("equipment")
      .select("*")
      .order("fleet_number");
    if (data) setEquipments(data as Equipment[]);
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
    if (!eqForm.equipment_model.trim() || !eqForm.fleet_number.trim() || isNaN(nozzles) || nozzles < 1) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const { error } = await supabase.from("equipment").insert({
      user_id: userId,
      equipment_model: eqForm.equipment_model.trim(),
      tractor_model: eqForm.tractor_model.trim(),
      fleet_number: eqForm.fleet_number.trim(),
      total_nozzles: nozzles,
    });
    if (error) {
      if (error.code === "23505") toast.error("Número da frota já cadastrado");
      else toast.error("Erro ao cadastrar equipamento");
      return;
    }
    toast.success("Equipamento cadastrado!");
    setEqForm({ equipment_model: "", tractor_model: "", fleet_number: "", total_nozzles: "" });
    fetchEquipments();
  };

  const handleDeleteEquipment = async (id: string) => {
    await supabase.from("equipment").delete().eq("id", id);
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
    const { error } = await supabase.from("registered_products").insert({
      user_id: userId,
      commercial_name: prodForm.commercial_name.trim(),
      formulation: prodForm.formulation,
      unit: prodForm.unit,
      package_size: size,
    });
    if (error) {
      toast.error("Erro ao cadastrar produto");
      return;
    }
    toast.success("Produto cadastrado!");
    setProdForm({ commercial_name: "", formulation: "SL", unit: "L", package_size: "" });
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    await supabase.from("registered_products").delete().eq("id", id);
    toast.success("Produto removido");
    fetchProducts();
  };

  const handleAddWaterTruck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wtForm.fleet_number.trim() || !wtForm.driver.trim()) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const newTruck = {
      id: crypto.randomUUID(),
      fleet_number: wtForm.fleet_number.trim(),
      driver: wtForm.driver.trim(),
    };
    const updated = [...waterTrucks, newTruck];
    setWaterTrucks(updated);
    localStorage.setItem("waterTrucks", JSON.stringify(updated));
    toast.success("Caminhão Pipa cadastrado!");
    setWtForm({ fleet_number: "", driver: "" });
  };

  const handleDeleteWaterTruck = (id: string) => {
    const updated = waterTrucks.filter((t) => t.id !== id);
    setWaterTrucks(updated);
    localStorage.setItem("waterTrucks", JSON.stringify(updated));
    toast.success("Caminhão Pipa removido");
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

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaForm.nome.trim() || talhoesForm.length === 0) {
      toast.error("Preencha o nome da área e adicione pelo menos 1 talhão.");
      return;
    }
    const newArea: AreaCadastro = {
      id: crypto.randomUUID(),
      nome: areaForm.nome.trim(),
      coordenadas: areaForm.coordenadas.trim(),
      quantidadeTalhoes: talhoesForm.length,
      talhoes: talhoesForm,
      createdAt: new Date().toISOString()
    };
    await saveArea(newArea);
    toast.success("Área cadastrada!");
    setAreaForm({ nome: "", coordenadas: "", quantidadeTalhoes: "" });
    setTalhoesForm([]);
    fetchAreasList();
  };

  const handleDeleteArea = async (id: string) => {
    await deleteArea(id);
    toast.success("Área removida");
    fetchAreasList();
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="equipamentos" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="caminhoes_pipa" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Caminhão Pipa
          </TabsTrigger>
          <TabsTrigger value="produtos" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="areas" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Áreas
          </TabsTrigger>
        </TabsList>

        {/* EQUIPAMENTOS TAB */}
        <TabsContent value="equipamentos">
          <Card className="shadow-lg">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Cadastrar Equipamento
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
                    <Label htmlFor="eq_nozzles">Quantidade de Bicos *</Label>
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
                </div>
                <div className="flex justify-end">
                  <Button type="submit">
                    <Plus className="h-4 w-4" />
                    Cadastrar
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
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEquipment(eq.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
                    <Label htmlFor="wt_driver" className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      Motorista *
                    </Label>
                    <Input
                      id="wt_driver"
                      placeholder="Ex: João da Silva"
                      value={wtForm.driver}
                      onChange={(e) => setWtForm((p) => ({ ...p, driver: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit">
                    <Plus className="h-4 w-4" />
                    Cadastrar
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
                        <TableHead>Motorista</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waterTrucks.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">{t.fleet_number}</TableCell>
                          <TableCell>{t.driver}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteWaterTruck(t.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Cadastrar Produto
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
                <div className="flex justify-end">
                  <Button type="submit">
                    <Plus className="h-4 w-4" />
                    Cadastrar
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProduct(p.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
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
              <CardTitle className="text-lg flex items-center gap-2">
                <Map className="h-5 w-5 text-primary" />
                Cadastrar Área
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddArea} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                              value={t.tamanhoHectares}
                              onChange={(e) => updateTalhaoForm(idx, "tamanhoHectares", parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button type="submit">
                    <Plus className="h-4 w-4 mr-2" />
                    Cadastrar
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
                        <TableHead>Talhões (Qtd)</TableHead>
                        <TableHead>Área Total (ha)</TableHead>
                        <TableHead>Localização</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areas.map((a) => {
                        const totalArea = a.talhoes.reduce((acc, curr) => acc + (curr.tamanhoHectares || 0), 0);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.nome}</TableCell>
                            <TableCell>{a.quantidadeTalhoes}</TableCell>
                            <TableCell>{totalArea.toFixed(2)}</TableCell>
                            <TableCell>
                              {a.coordenadas ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary hover:text-primary/80"
                                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.coordenadas)}`, "_blank")}
                                >
                                  <MapPin className="h-4 w-4 mr-1" /> Ver Rota
                                </Button>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteArea(a.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
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
      </Tabs>
    </div>
  );
}
