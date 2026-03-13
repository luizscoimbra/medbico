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
import { Settings, FlaskConical, Plus, Trash2, Tractor, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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
  }, [userId]);

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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-heading text-foreground mb-2">Cadastros</h1>
        <p className="text-muted-foreground">
          Gerencie seus equipamentos e produtos para uso rápido nas medições e cálculos.
        </p>
      </div>

      <Tabs defaultValue="equipamentos" className="animate-slide-up">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="equipamentos" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Equipamentos
          </TabsTrigger>
          <TabsTrigger value="produtos" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Produtos
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
                    <Select
                      value={prodForm.formulation}
                      onValueChange={(v) => setProdForm((p) => ({ ...p, formulation: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WP">WP - Pó Molhável</SelectItem>
                        <SelectItem value="WG">WG - Grânulos Dispersíveis</SelectItem>
                        <SelectItem value="SC">SC - Suspensão Concentrada</SelectItem>
                        <SelectItem value="EC">EC - Concentrado Emulsionável</SelectItem>
                        <SelectItem value="SL">SL - Concentrado Solúvel</SelectItem>
                        <SelectItem value="ADJ">ADJ - Adjuvante / Óleo</SelectItem>
                      </SelectContent>
                    </Select>
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
      </Tabs>
    </div>
  );
}
