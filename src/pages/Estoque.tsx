import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Coins,
  ExternalLink,
  Fuel,
  History,
  Loader2,
  Package,
  Pencil,
  Plus,
  Puzzle,
  Search,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { getAllAbastecimentos, type Abastecimento } from "@/lib/equipmentFuelStorage";
import { getAllItens, type ItemManutencao, type RegistroManutencao, getAllRegistros } from "@/lib/equipmentMaintenanceStorage";
import { getMaintenanceRecords, type MaintenanceRecord } from "@/lib/droneStorage";
import { getAllComponentes, type ComponenteCatalogo } from "@/lib/componenteStorage";
import { getAllOS, type OrdemServico } from "@/lib/osStorage";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularKpis,
  createEntrada,
  deleteEntrada,
  getAllConfigs,
  getAllEntradas,
  montarEstoque,
  updateEntrada,
  upsertConfig,
  CATEGORIA_LABELS,
  type CategoriaEstoque,
  type ConfigEstoque,
  type DadosEstoque,
  type EntradaEstoque,
  type ItemEstoque,
} from "@/lib/stockStorage";

const HOJE = () => new Date().toISOString().slice(0, 10);

const dataBR = (iso: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";

const numBR = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** Link para o módulo correspondente de cada categoria. */
const MODULO_LINK: Record<CategoriaEstoque, { rota: string; label: string }> = {
  produto: { rota: "/cadastros", label: "Cadastro de produtos" },
  peca: { rota: "/manutencao-equipamentos", label: "Cadastro de manutenção" },
  acessorio: { rota: "/maintenance", label: "Componentes de drones" },
  combustivel: { rota: "/gestao-abastecimento", label: "Gestão de abastecimento" },
};

interface FormEntrada {
  id?: string;
  itemKey: string;
  quantidade: string;
  valor: string;
  data: string;
  fornecedor: string;
  observacao: string;
}

const formVazio = (): FormEntrada => ({
  itemKey: "",
  quantidade: "",
  valor: "",
  data: HOJE(),
  fornecedor: "",
  observacao: "",
});

export default function Estoque() {
  const navigate = useNavigate();

  const [dados, setDados] = useState<DadosEstoque | null>(null);
  const [entradas, setEntradas] = useState<EntradaEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [tab, setTab] = useState<CategoriaEstoque>("produto");
  const [busca, setBusca] = useState("");

  const [entradaDialog, setEntradaDialog] = useState(false);
  const [form, setForm] = useState<FormEntrada>(formVazio());

  const [detalhe, setDetalhe] = useState<ItemEstoque | null>(null);
  const [minimoItem, setMinimoItem] = useState<ItemEstoque | null>(null);
  const [minimoValor, setMinimoValor] = useState("");
  const [excluindo, setExcluindo] = useState<EntradaEstoque | null>(null);
  const [processando, setProcessando] = useState(false);

  const load = async () => {
    try {
      const [
        produtos,
        itensManutencao,
        acessorios,
        entradasList,
        configs,
        oss,
        registros,
        registrosDrone,
        abastecimentos,
      ] = await Promise.all([
        supabase
          .from("registered_products")
          .select("id, commercial_name, unit, package_size, preco_unitario")
          .order("commercial_name"),
        getAllItens().catch(() => [] as ItemManutencao[]),
        getAllComponentes().catch(() => [] as ComponenteCatalogo[]),
        getAllEntradas().catch(() => [] as EntradaEstoque[]),
        getAllConfigs().catch(() => [] as ConfigEstoque[]),
        getAllOS().catch(() => [] as OrdemServico[]),
        getAllRegistros().catch(() => [] as RegistroManutencao[]),
        getMaintenanceRecords().catch(() => [] as MaintenanceRecord[]),
        getAllAbastecimentos().catch(() => [] as Abastecimento[]),
      ]);
      if (produtos.error) throw produtos.error;

      setEntradas(entradasList);
      setDados(
        montarEstoque({
          produtos: (produtos.data || []) as Array<{
            id: string;
            commercial_name: string;
            unit: string;
            package_size: number;
            preco_unitario: number;
          }>,
          pecas: itensManutencao.filter((i) => i.tipo === "peca"),
          acessorios,
          entradas: entradasList,
          configs,
          oss,
          registrosManutencao: registros,
          registrosDrone,
          abastecimentos,
        })
      );
    } catch {
      toast.error("Erro ao carregar os dados do estoque");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const itens = useMemo(() => {
    if (!dados) return [] as ItemEstoque[];
    return dados[tab];
  }, [dados, tab]);

  const itensFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) => i.nome.toLowerCase().includes(q) || i.detalhe.toLowerCase().includes(q)
    );
  }, [itens, busca]);

  const kpis = useMemo(() => {
    if (!dados) return { totalItens: 0, abaixoMinimo: 0, valorEntradas: 0 };
    const todas = [...dados.produto, ...dados.peca, ...dados.acessorio, ...dados.combustivel];
    const base = calcularKpis(todas);
    return {
      totalItens: base.totalItens,
      abaixoMinimo: base.abaixoMinimo,
      valorEntradas: entradas.reduce((s, e) => s + (e.valor_total || 0), 0),
    };
  }, [dados, entradas]);

  const abrirEntrada = (item?: ItemEstoque) => {
    const vazio = formVazio();
    vazio.itemKey = item ? item.itemKey : itens[0]?.itemKey || "";
    setForm(vazio);
    setEntradaDialog(true);
  };

  const editarEntrada = (e: EntradaEstoque) => {
    setForm({
      id: e.id,
      itemKey: e.item_key,
      quantidade: String(e.quantidade),
      valor: e.valor_total ? String(e.valor_total) : "",
      data: e.data,
      fornecedor: e.fornecedor || "",
      observacao: e.observacao || "",
    });
    setDetalhe(null);
    setEntradaDialog(true);
  };

  const salvarEntrada = async () => {
    const qtd = parseFloat(form.quantidade.replace(",", ".")) || 0;
    if (!form.itemKey) {
      toast.error("Selecione o item do estoque");
      return;
    }
    if (qtd <= 0) {
      toast.error("Informe uma quantidade maior que zero");
      return;
    }
    const item = itens.find((i) => i.itemKey === form.itemKey);
    const valor = parseFloat(form.valor.replace(",", ".")) || 0;

    setSalvando(true);
    try {
      const payload = {
        categoria: tab,
        item_key: form.itemKey,
        item_nome: item?.nome || "",
        quantidade: qtd,
        valor_total: valor,
        data: form.data,
        fornecedor: form.fornecedor,
        observacao: form.observacao,
      };
      if (form.id) {
        await updateEntrada(form.id, payload);
        toast.success("Entrada atualizada");
      } else {
        await createEntrada(payload);
        toast.success("Entrada registrada");
      }
      setEntradaDialog(false);
      await load();
    } catch {
      toast.error("Erro ao salvar a entrada");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    setProcessando(true);
    try {
      await deleteEntrada(excluindo.id);
      toast.success("Entrada excluída (saldo atualizado)");
      setExcluindo(null);
      await load();
    } catch {
      toast.error("Erro ao excluir a entrada");
    } finally {
      setProcessando(false);
    }
  };

  const salvarMinimo = async () => {
    if (!minimoItem) return;
    const valor = parseFloat(minimoValor.replace(",", ".")) || 0;
    if (valor < 0) {
      toast.error("O mínimo não pode ser negativo");
      return;
    }
    setSalvando(true);
    try {
      await upsertConfig(minimoItem.itemKey, minimoItem.categoria, valor);
      toast.success("Estoque mínimo atualizado");
      setMinimoItem(null);
      await load();
    } catch {
      toast.error("Erro ao salvar o estoque mínimo");
    } finally {
      setSalvando(false);
    }
  };

  const entradasDoItem = useMemo(
    () => (detalhe ? entradas.filter((e) => e.item_key === detalhe.itemKey) : []),
    [entradas, detalhe]
  );

  const iconTab: Record<CategoriaEstoque, typeof Package> = {
    produto: Package,
    peca: Wrench,
    acessorio: Puzzle,
    combustivel: Fuel,
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Boxes className="h-6 w-6 text-emerald-500" />
              Estoque
            </h1>
            <p className="text-sm text-muted-foreground">
              Produtos, peças, acessórios e combustível — saldo = entradas − consumo dos módulos
            </p>
          </div>
        </div>
        <Button onClick={() => abrirEntrada()}>
          <Plus className="mr-2 h-4 w-4" />
          Nova entrada
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Itens controlados</p>
                <p className="text-2xl font-bold">{kpis.totalItens}</p>
              </div>
              <Boxes className="h-8 w-8 text-emerald-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card className={kpis.abaixoMinimo > 0 ? "border-red-500/60" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Abaixo do mínimo</p>
                <p
                  className={`text-2xl font-bold ${kpis.abaixoMinimo > 0 ? "text-red-500" : ""}`}
                >
                  {kpis.abaixoMinimo}
                </p>
              </div>
              <AlertTriangle
                className={`h-8 w-8 ${kpis.abaixoMinimo > 0 ? "text-red-500" : "text-muted-foreground/60"}`}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Entradas (total)</p>
                <p className="text-2xl font-bold">{formatBRL(kpis.valorEntradas)}</p>
              </div>
              <Coins className="h-8 w-8 text-emerald-500/60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as CategoriaEstoque);
          setBusca("");
        }}
      >
        <TabsList>
          {(Object.keys(CATEGORIA_LABELS) as CategoriaEstoque[]).map((c) => {
            const Icon = iconTab[c];
            const count = dados ? dados[c].length : 0;
            return (
              <TabsTrigger key={c} value={c}>
                <Icon className="mr-1.5 h-4 w-4" />
                {CATEGORIA_LABELS[c]}
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(CATEGORIA_LABELS) as CategoriaEstoque[]).map((categoria) => (
          <TabsContent key={categoria} value={categoria} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  className="pl-8"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(MODULO_LINK[categoria].rota)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {MODULO_LINK[categoria].label}
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Saída total</TableHead>
                      <TableHead>Última entrada</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          {busca
                            ? "Nenhum item encontrado"
                            : "Nenhum item neste cadastro — cadastre no módulo correspondente"}
                        </TableCell>
                      </TableRow>
                    )}
                    {itensFiltrados.map((item) => (
                      <TableRow key={item.itemKey} className={item.abaixoDoMinimo ? "bg-red-500/5" : ""}>
                        <TableCell>
                          <button
                            className="text-left font-medium hover:underline"
                            onClick={() => setDetalhe(item)}
                          >
                            {item.nome}
                          </button>
                          {item.detalhe && (
                            <div className="text-xs text-muted-foreground">{item.detalhe}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {numBR(item.saldo)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            {item.unidade}
                          </span>
                          {item.abaixoDoMinimo && (
                            <Badge variant="destructive" className="ml-2">
                              Abaixo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.temConfig ? numBR(item.minimo) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {numBR(item.saidaTotal)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.dataUltimaEntrada ? dataBR(item.dataUltimaEntrada) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Registrar entrada"
                              onClick={() => abrirEntrada(item)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Definir estoque mínimo"
                              onClick={() => {
                                setMinimoItem(item);
                                setMinimoValor(item.temConfig ? String(item.minimo) : "");
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Detalhes e entradas"
                              onClick={() => setDetalhe(item)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* DIALOG: NOVA/EDITAR ENTRADA */}
      <Dialog open={entradaDialog} onOpenChange={setEntradaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar entrada" : "Nova entrada"}</DialogTitle>
            <DialogDescription>
              Registre a compra/reposição de {CATEGORIA_LABELS[tab].toLowerCase()} no estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select
                value={form.itemKey}
                onValueChange={(v) => setForm((f) => ({ ...f, itemKey: v }))}
                disabled={!!form.id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o item" />
                </SelectTrigger>
                <SelectContent>
                  {itens.map((i) => (
                    <SelectItem key={i.itemKey} value={i.itemKey}>
                      {i.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={form.quantidade}
                  onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Valor total (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor</Label>
                <Input
                  placeholder="Posto, loja, distribuidora..."
                  value={form.fornecedor}
                  onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                rows={2}
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntradaDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvarEntrada()} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: DETALHE DO ITEM */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detalhe?.nome}</DialogTitle>
            <DialogDescription>
              {CATEGORIA_LABELS[tab]} · {detalhe?.detalhe || "—"}
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p
                      className={`text-xl font-bold ${detalhe.abaixoDoMinimo ? "text-red-500" : ""}`}
                    >
                      {numBR(detalhe.saldo)} {detalhe.unidade}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-xs text-muted-foreground">Entradas</p>
                    <p className="text-xl font-bold">{numBR(detalhe.entradasTotal)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-xs text-muted-foreground">
                      Saída (módulos)
                    </p>
                    <p className="text-xl font-bold">{numBR(detalhe.saidaTotal)}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <p className="mb-1 font-medium">Módulo vinculado</p>
                <p className="text-muted-foreground">
                  A saída é calculada automaticamente em{" "}
                  <strong>{MODULO_LINK[detalhe.categoria].label}</strong>. Saldo = entradas abaixo −
                  consumo registrado no módulo.
                </p>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <p className="text-sm font-semibold">Entradas</p>
                  <Button size="sm" variant="outline" onClick={() => abrirEntrada(detalhe)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Entrada
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Obs.</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradasDoItem.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                          Nenhuma entrada registrada
                        </TableCell>
                      </TableRow>
                    )}
                    {entradasDoItem.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{dataBR(e.data)}</TableCell>
                        <TableCell className="text-right">{numBR(e.quantidade)}</TableCell>
                        <TableCell className="text-right">
                          {e.valor_total ? formatBRL(e.valor_total) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{e.fornecedor || "—"}</TableCell>
                        <TableCell className="max-w-40 truncate text-sm text-muted-foreground">
                          {e.observacao || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar"
                              onClick={() => editarEntrada(e)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir"
                              onClick={() => setExcluindo(e)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DIALOG: ESTOQUE MÍNIMO */}
      <Dialog open={!!minimoItem} onOpenChange={(o) => !o && setMinimoItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Estoque mínimo</DialogTitle>
            <DialogDescription>{minimoItem?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Quantidade mínima ({minimoItem?.unidade})</Label>
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={minimoValor}
              onChange={(e) => setMinimoValor(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              O item será destacado quando o saldo ficar abaixo deste valor.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMinimoItem(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void salvarMinimo()} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAR EXCLUSÃO */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              A entrada de {excluindo ? numBR(excluindo.quantidade) : ""} em{" "}
              {excluindo ? dataBR(excluindo.data) : ""} será removida e o saldo recalculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmarExclusao()} disabled={processando}>
              {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
