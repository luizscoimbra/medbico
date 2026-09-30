import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import {
  baixarTitulo,
  cancelarTitulo,
  deleteTitulo,
  estornarTitulo,
  getAllTitulos,
  TituloReceber,
} from "@/lib/financeiroStorage";

const STATUS_LABEL: Record<TituloReceber["status"], string> = {
  aberto: "Em aberto",
  pago: "Recebido",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<TituloReceber["status"], string> = {
  aberto: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  pago: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
};

const HOJE = () => new Date().toISOString().slice(0, 10);

export default function Financeiro() {
  const navigate = useNavigate();
  const [titulos, setTitulos] = useState<TituloReceber[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | TituloReceber["status"]>("todos");
  const [busca, setBusca] = useState("");

  // Dialog de recebimento
  const [baixarRef, setBaixarRef] = useState<TituloReceber | null>(null);
  const [dataPagamento, setDataPagamento] = useState(HOJE());
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [obsBaixa, setObsBaixa] = useState("");

  const load = async () => setTitulos(await getAllTitulos());

  useEffect(() => {
    load();
  }, []);

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return titulos.filter((t) => {
      if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
      if (!s) return true;
      return (
        t.clienteNome.toLowerCase().includes(s) ||
        t.numero.toLowerCase().includes(s) ||
        (t.osId || "").toLowerCase().includes(s) ||
        (t.descricao || "").toLowerCase().includes(s)
      );
    });
  }, [titulos, filtroStatus, busca]);

  const totalAberto = titulos.filter((t) => t.status === "aberto").reduce((s, t) => s + t.valor, 0);
  const totalRecebido = titulos.filter((t) => t.status === "pago").reduce((s, t) => s + t.valor, 0);
  const qtdAberto = titulos.filter((t) => t.status === "aberto").length;
  const vencidos = titulos.filter(
    (t) => t.status === "aberto" && t.dataVencimento && t.dataVencimento < HOJE()
  );

  const confirmarBaixa = async () => {
    if (!baixarRef) return;
    if (!dataPagamento) {
      toast.error("Informe a data do recebimento");
      return;
    }
    await baixarTitulo(baixarRef.id, {
      dataPagamento,
      formaPagamento,
      observacao: obsBaixa || undefined,
    });
    toast.success(`Título nº ${baixarRef.numero} recebido com sucesso!`);
    setBaixarRef(null);
    setObsBaixa("");
    await load();
  };

  const handleEstornar = async (t: TituloReceber) => {
    if (!confirm(`Estornar o recebimento do título nº ${t.numero}?`)) return;
    await estornarTitulo(t.id);
    toast.success("Recebimento estornado");
    await load();
  };

  const handleCancelar = async (t: TituloReceber) => {
    if (!confirm(`Cancelar o título nº ${t.numero}? Esta ação não gera cobrança.`)) return;
    await cancelarTitulo(t.id);
    toast.success("Título cancelado");
    await load();
  };

  const handleExcluir = async (t: TituloReceber) => {
    if (!confirm(`Excluir definitivamente o título nº ${t.numero}?`)) return;
    await deleteTitulo(t.id);
    toast.success("Título excluído");
    await load();
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-foreground">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Contas a receber geradas pelas Ordens de Serviço</p>
          </div>
        </div>
        <Link to="/ordem-servico">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1" /> Ordens de Serviço
          </Button>
        </Link>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-t-4 border-t-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A receber</p>
                <p className="text-xl font-heading font-bold">{formatBRL(totalAberto)}</p>
                <p className="text-[10px] text-muted-foreground">{qtdAberto} título(s) em aberto</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-xl font-heading font-bold">{formatBRL(totalRecebido)}</p>
                <p className="text-[10px] text-muted-foreground">total já baixado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-t-4 ${vencidos.length > 0 ? "border-t-destructive" : "border-t-warning"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${vencidos.length > 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-xl font-heading font-bold">{vencidos.length}</p>
                <p className="text-[10px] text-muted-foreground">título(s) com vencimento passado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, nº do título ou OS..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Em aberto</SelectItem>
            <SelectItem value="pago">Recebidos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="border-b border-border/50 bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Contas a Receber ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic">
              Nenhum título a receber. Fature uma OS concluída em{" "}
              <Link to="/ordem-servico" className="text-primary underline">
                Ordem de Serviço
              </Link>
              .
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nº</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                    <th className="px-4 py-3 text-left font-semibold">Emissão</th>
                    <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-center font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtrados.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold">{t.numero}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{t.clienteNome || "—"}</p>
                        {t.osId && (
                          <Link
                            to={`/ordem-servico?os=${t.osId}`}
                            className="text-[11px] text-primary hover:underline"
                          >
                            OS {t.osId}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{t.descricao}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(t.dataEmissao + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.dataVencimento
                          ? new Date(t.dataVencimento + "T00:00:00").toLocaleDateString("pt-BR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                        {formatBRL(t.valor)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_CLASS[t.status]}`}>
                          {STATUS_LABEL[t.status]}
                        </Badge>
                        {t.status === "pago" && t.dataPagamento && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(t.dataPagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                            {t.formaPagamento ? ` · ${t.formaPagamento}` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {t.status === "aberto" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => {
                                setBaixarRef(t);
                                setDataPagamento(HOJE());
                                setFormaPagamento("Pix");
                                setObsBaixa("");
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Receber
                            </Button>
                          )}
                          {t.status === "pago" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Estornar recebimento"
                              onClick={() => handleEstornar(t)}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          {t.status !== "cancelado" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Cancelar título"
                              className="text-warning hover:bg-warning/10"
                              onClick={() => handleCancelar(t)}
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          )}
                          {t.status === "cancelado" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir título"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleExcluir(t)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-semibold">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right text-xs uppercase">
                      Total listado
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatBRL(filtrados.reduce((s, t) => s + t.valor, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de recebimento */}
      <Dialog open={!!baixarRef} onOpenChange={(open) => !open && setBaixarRef(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
            <DialogDescription>
              Título nº {baixarRef?.numero} — {baixarRef?.clienteNome} · {formatBRL(baixarRef?.valor || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dataPag">Data do recebimento</Label>
              <Input
                id="dataPag"
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Pix", "Dinheiro", "Transferência", "Boleto", "Cartão", "Cheque", "Outro"].map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observação (opcional)</Label>
              <Input
                id="obs"
                placeholder="Ex: recebido em parcelas"
                value={obsBaixa}
                onChange={(e) => setObsBaixa(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBaixarRef(null)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmarBaixa}>
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
