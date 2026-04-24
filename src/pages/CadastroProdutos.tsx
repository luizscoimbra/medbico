import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, FlaskConical, Download, Upload } from "lucide-react";

interface Product {
  id: string;
  name: string;
  type: string;
  dose: string;
  culture: string;
  manufacturer: string;
  withholding_period: string;
  unit: string;
  package_size: number;
}

const CadastroProdutos = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "",
    dose: "",
    culture: "",
    manufacturer: "",
    withholding_period: "",
    unit: "L",
    package_size: 0,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/");
      return;
    }
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive" });
    } else {
      setProducts(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.type || !form.dose || !form.culture || !form.manufacturer || !form.withholding_period) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Usuário não autenticado", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("products").insert({
      user_id: user.id,
      name: form.name,
      type: form.type,
      dose: form.dose,
      culture: form.culture,
      manufacturer: form.manufacturer,
      withholding_period: form.withholding_period,
      unit: form.unit,
      package_size: form.package_size,
    });

    if (error) {
      toast({ title: "Erro ao cadastrar produto", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto cadastrado com sucesso!" });
      setForm({ name: "", type: "", dose: "", culture: "", manufacturer: "", withholding_period: "", unit: "L", package_size: 0 });
      fetchProducts();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto excluído" });
      fetchProducts();
    }
  };

  const handleDownloadTemplate = () => {
    const headers = "nome;tipo;dose;cultura;fabricante;carencia;unidade;tamanho_embalagem\n";
    const example = "Exemplo Glifosato;herbicida;2.5;Soja;Monsanto;14 dias;L;20\n";
    const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "modelo_produtos.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Usuário não autenticado", variant: "destructive" });
      setLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(';');
        if (cols.length >= 8) {
          const { error } = await supabase.from("products").insert({
            user_id: user.id,
            name: cols[0].trim(),
            type: cols[1].trim().toLowerCase() === 'fungicida' ? 'fungicida' : 'herbicida',
            dose: cols[2].trim(),
            culture: cols[3].trim(),
            manufacturer: cols[4].trim(),
            withholding_period: cols[5].trim(),
            unit: cols[6].trim().toUpperCase() === 'KG' ? 'KG' : 'L',
            package_size: parseFloat(cols[7].trim()) || 0,
          });

          if (error) {
            console.error("CSV Import Error:", error);
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          errorCount++;
        }
      }

      toast({ 
        title: "Importação Concluída", 
        description: `${successCount} produtos cadastrados. ${errorCount} erros/linhas ignoradas.`,
        variant: errorCount > 0 ? "default" : "default" 
      });
      fetchProducts();
      setLoading(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="mb-8">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Cadastro de Produtos</CardTitle>
              <CardDescription>Cadastre herbicidas e fungicidas</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Modelo CSV
            </Button>
            <div>
              <input 
                type="file" 
                id="csv-upload" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload}
              />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('csv-upload')?.click()} disabled={loading}>
                <Upload className="h-4 w-4 mr-2" />
                Importar CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do produto" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="herbicida">Herbicida</SelectItem>
                  <SelectItem value="fungicida">Fungicida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dose">Dose</Label>
              <Input id="dose" value={form.dose} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="Ex: 2 L/ha" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="culture">Cultura</Label>
              <Input id="culture" value={form.culture} onChange={(e) => setForm({ ...form, culture: e.target.value })} placeholder="Ex: Soja, Milho" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input id="manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Nome do fabricante" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="withholding_period">Período de Carência</Label>
              <Input id="withholding_period" value={form.withholding_period} onChange={(e) => setForm({ ...form, withholding_period: e.target.value })} placeholder="Ex: 14 dias" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unidade</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Litros (L)</SelectItem>
                  <SelectItem value="KG">Quilos (KG)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="package_size">Tamanho da Embalagem</Label>
              <Input id="package_size" type="number" value={form.package_size || ""} onChange={(e) => setForm({ ...form, package_size: parseFloat(e.target.value) || 0 })} placeholder="Ex: 20" />
            </div>

            <div className="md:col-span-2 mt-2">
              <Button type="submit" disabled={loading} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {loading ? "Cadastrando..." : "Cadastrar Produto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {products.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produtos Cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Dose</TableHead>
                  <TableHead>Cultura</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Embalagem</TableHead>
                  <TableHead>Carência</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="capitalize">{p.type}</TableCell>
                    <TableCell>{p.dose}</TableCell>
                    <TableCell>{p.culture}</TableCell>
                    <TableCell>{p.manufacturer}</TableCell>
                    <TableCell>{p.package_size} {p.unit}</TableCell>
                    <TableCell>{p.withholding_period}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CadastroProdutos;
