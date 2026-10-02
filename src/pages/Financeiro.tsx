import { useEffect, useMemo, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Banknote,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileDown,
  FileText,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { ComprovanteTitulo } from "@/components/financeiro/ComprovanteTitulo";
import { RelatorioMovimentacoes } from "@/components/financeiro/RelatorioMovimentacoes";
import { ContasPagar } from "@/components/financeiro/ContasPagar";
import { REL_FILTROS_PADRAO, dataReferencia, type RelFiltros } from "@/lib/relatorioFinanceiro";
import {
  toDocumentoPagar,
  toDocumentoReceber,
  type TituloDocumento,
} from "@/lib/tituloDocumento";
import { getAllTitulosPagar, type TituloPagar } from "@/lib/contasPagarStorage";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

type AcaoConfirmar = "estornar" | "cancelar" | "excluir";

const CONFIRMACOES: Record<
  AcaoConfirmar,
  {
    titulo: string;
    botao: string;
    className?: string;
    Icone: LucideIcon;
    iconClass: string;
    descricao: (t: TituloReceber) => string;
  }
> = {
  estornar: {
    titulo: "Estornar recebimento",
    botao: "Confirmar estorno",
    Icone: RotateCcw,
    iconClass: "text-primary",
    descricao: (t) =>
      `Estornar o recebimento do título nº ${t.numero}? O valor volta para "A receber".`,
  },
  cancelar: {
    titulo: "Cancelar título",
    botao: "Confirmar cancelamento",
    className: "bg-warning text-warning-foreground hover:opacity-90",
    Icone: Ban,
    iconClass: "text-warning",
    descricao: (t) => `Cancelar o título nº ${t.numero}? Esta ação não gera cobrança.`,
  },
  excluir: {
    titulo: "Excluir título",
    botao: "Excluir definitivamente",
    className: "bg-destructive text-destructive-foreground hover:opacity-90",
    Icone: Trash2,
    iconClass: "text-destructive",
    descricao: (t) =>
      `Excluir definitivamente o título nº ${t.numero}? Esta ação não pode ser desfeita.`,
  },
};

export default function Financeiro() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"receber" | "pagar">("receber");
  const [titulos, setTitulos] = useState<TituloReceber[]>([]);
  const [titulosPagar, setTitulosPagar] = useState<TituloPagar[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<"todos" | TituloReceber["status"]>("todos");
  const [busca, setBusca] = useState("");

  // Dialog de recebimento
  const [baixarRef, setBaixarRef] = useState<TituloReceber | null>(null);
  const [dataPagamento, setDataPagamento] = useState(HOJE());
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [obsBaixa, setObsBaixa] = useState("");

  // Dialog de confirmação (estornar / cancelar / excluir)
  const [confirmacao, setConfirmacao] = useState<{ acao: AcaoConfirmar; titulo: TituloReceber } | null>(null);
  const [processando, setProcessando] = useState(false);

  // Dialog do comprovante (impressão / PDF)
  const [comprovante, setComprovante] = useState<TituloDocumento | null>(null);
  const comprovantePrintRef = useRef<HTMLDivElement>(null);

  // Relatório de movimentações (impressão / PDF)
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [relFiltros, setRelFiltros] = useState<RelFiltros>(REL_FILTROS_PADRAO);
  const relatorioRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [a, b] = await Promise.all([getAllTitulos(), getAllTitulosPagar()]);
    setTitulos(a);
    setTitulosPagar(b);
  };

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

  const titulosRelatorio = useMemo(() => {
    const base =
      relFiltros.origem === "receber"
        ? titulos.map(toDocumentoReceber)
        : relFiltros.origem === "pagar"
          ? titulosPagar.map(toDocumentoPagar)
          : [
              ...titulos.map(toDocumentoReceber),
              ...titulosPagar.map(toDocumentoPagar),
            ];
    return base
      .filter((t) => {
        if (relFiltros.tipo === "recebimentos" && t.status !== "pago") return false;
        if (relFiltros.tipo === "cancelamentos" && t.status !== "cancelado") return false;
        if (relFiltros.tipo === "abertos" && t.status !== "aberto") return false;
        if (relFiltros.status !== "todos" && t.status !== relFiltros.status) return false;
        const d = dataReferencia(t);
        if (relFiltros.de && d && d < relFiltros.de) return false;
        if (relFiltros.ate && d && d > relFiltros.ate) return false;
        return true;
      })
      .sort((a, b) => (b.dataEmissao || "").localeCompare(a.dataEmissao || ""));
  }, [titulos, titulosPagar, relFiltros]);

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

  const handleEstornar = (t: TituloReceber) => setConfirmacao({ acao: "estornar", titulo: t });

  const handleCancelar = (t: TituloReceber) => setConfirmacao({ acao: "cancelar", titulo: t });

  const handleExcluir = (t: TituloReceber) => setConfirmacao({ acao: "excluir", titulo: t });

  const executarConfirmacao = async () => {
    if (!confirmacao || processando) return;
    const { acao, titulo } = confirmacao;
    setProcessando(true);
    try {
      if (acao === "estornar") {
        await estornarTitulo(titulo.id);
        toast.success("Recebimento estornado");
      } else if (acao === "cancelar") {
        await cancelarTitulo(titulo.id);
        toast.success("Título cancelado");
      } else {
        await deleteTitulo(titulo.id);
        toast.success("Título excluído");
      }
      setConfirmacao(null);
      await load();
    } catch {
      toast.error("Erro ao executar a operação");
    } finally {
      setProcessando(false);
    }
  };

  const confirmCfg = confirmacao ? CONFIRMACOES[confirmacao.acao] : null;

  const handlePrintComprovante = () => window.print();

  const handlePDFComprovante = async () => {
    const target = comprovantePrintRef.current;
    if (!target) return;
    try {
      toast.info("Gerando PDF...");
      const canvas = await html2canvas(target, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();

      if (pdfH <= pageH) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      } else {
        let position = 0;
        let remaining = pdfH;
        while (remaining > 0) {
          if (position > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -position, pdfW, pdfH);
          position += pageH;
          remaining -= pageH;
        }
      }

      pdf.save(`Comprovante-${comprovante?.numero || "titulo"}.pdf`);
      toast.success("PDF salvo!");
    } catch {
      toast.error("Erro ao gerar PDF");
    }
  };

  const abrirRelatorio = () => {
    setRelFiltros({ ...REL_FILTROS_PADRAO, origem: activeTab });
    setRelatorioAberto(true);
  };

  const handlePrintRelatorio = () => window.print();

  const handlePDFRelatorio = async () => {
    const target = relatorioRef.current;
    if (!target) return;
    try {
      toast.info("Gerando PDF do relatório...");
      const canvas = await html2canvas(target, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();

      if (pdfH <= pageH) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      } else {
        let position = 0;
        let remaining = pdfH;
        while (remaining > 0) {
          if (position > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -position, pdfW, pdfH);
          position += pageH;
          remaining -= pageH;
        }
      }

      pdf.save(`Relatorio-Financeiro-${HOJE()}.pdf`);
      toast.success("PDF do relatório salvo!");
    } catch {
      toast.error("Erro ao gerar PDF do relatório");
    }
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
            <p className="text-sm text-muted-foreground">
              {activeTab === "receber"
                ? "Contas a receber geradas pelas Ordens de Serviço"
                : "Contas a pagar, despesas e manutenções de drones"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={abrirRelatorio}>
            <FileText className="h-4 w-4 mr-1" /> Relatório
          </Button>
          <Link to="/ordem-servico">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" /> Ordens de Serviço
            </Button>
          </Link>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "receber" | "pagar")}
        className="animate-slide-up"
      >
      <TabsList className="mb-6 no-print">
        <TabsTrigger value="receber" className="gap-2">
          <Banknote className="h-4 w-4" />
          A Receber
        </TabsTrigger>
        <TabsTrigger value="pagar" className="gap-2">
          <Wallet className="h-4 w-4" />
          A Pagar
        </TabsTrigger>
      </TabsList>

      <TabsContent value="receber" className="mt-0">
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
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Comprovante"
                            className="h-8 w-8"
                            onClick={() => setComprovante(toDocumentoReceber(t))}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
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
                              <RotateCcw className="h-4 w-4" />
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
                              <Ban className="h-4 w-4" />
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

      </TabsContent>

      <TabsContent value="pagar" className="mt-0">
        <ContasPagar
          titulos={titulosPagar}
          onReload={load}
          onComprovante={(t) => setComprovante(toDocumentoPagar(t))}
        />
      </TabsContent>
      </Tabs>

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

      {/* Confirmação de estornar / cancelar / excluir */}
      <AlertDialog
        open={!!confirmacao}
        onOpenChange={(open) => {
          if (!open && !processando) setConfirmacao(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmCfg && <confirmCfg.Icone className={`h-5 w-5 ${confirmCfg.iconClass}`} />}
              {confirmCfg?.titulo}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao && confirmCfg?.descricao(confirmacao.titulo)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmacao(null)} disabled={processando}>
              Voltar
            </Button>
            <Button className={confirmCfg?.className} onClick={executarConfirmacao} disabled={processando}>
              {processando ? "Processando..." : confirmCfg?.botao}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comprovante (impressão / PDF) */}
      <Dialog
        open={!!comprovante}
        onOpenChange={(open) => {
          if (!open) setComprovante(null);
        }}
      >
        <DialogContent className="comprovante-dialog sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Comprovante
            </DialogTitle>
            <DialogDescription>
              Título nº {comprovante?.numero} — {comprovante?.contraparte || "—"}
            </DialogDescription>
          </DialogHeader>

          {comprovante && <ComprovanteTitulo ref={comprovantePrintRef} titulo={comprovante} />}

          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setComprovante(null)}>
              Fechar
            </Button>
            <Button variant="outline" onClick={handlePDFComprovante}>
              <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
            </Button>
            <Button onClick={handlePrintComprovante}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relatório de movimentações (impressão / PDF) */}
      <Dialog
        open={relatorioAberto}
        onOpenChange={(open) => {
          if (!open) setRelatorioAberto(false);
        }}
      >
        <DialogContent className="relatorio-dialog sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatório de Movimentações
            </DialogTitle>
            <DialogDescription>
              Escolha a origem, a operação, o status e o período para imprimir o
              relatório de movimentações.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 no-print">
            <div className="space-y-1">
              <Label>Origem</Label>
              <Select
                value={relFiltros.origem}
                onValueChange={(v) => setRelFiltros({ ...relFiltros, origem: v as RelFiltros["origem"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">A receber e a pagar</SelectItem>
                  <SelectItem value="receber">A receber</SelectItem>
                  <SelectItem value="pagar">A pagar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Operação</Label>
              <Select
                value={relFiltros.tipo}
                onValueChange={(v) => setRelFiltros({ ...relFiltros, tipo: v as RelFiltros["tipo"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as operações</SelectItem>
                  <SelectItem value="recebimentos">
                    {relFiltros.origem === "pagar"
                      ? "Pagamentos"
                      : relFiltros.origem === "receber"
                        ? "Recebimentos"
                        : "Recebimentos/Pagamentos"}
                  </SelectItem>
                  <SelectItem value="cancelamentos">Cancelamentos</SelectItem>
                  <SelectItem value="abertos">Em aberto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={relFiltros.status}
                onValueChange={(v) => setRelFiltros({ ...relFiltros, status: v as RelFiltros["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="aberto">Em aberto</SelectItem>
                  <SelectItem value="pago">Recebido / Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>De</Label>
              <Input
                type="date"
                value={relFiltros.de}
                onChange={(e) => setRelFiltros({ ...relFiltros, de: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input
                type="date"
                value={relFiltros.ate}
                onChange={(e) => setRelFiltros({ ...relFiltros, ate: e.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground no-print">
            {titulosRelatorio.length} título(s) no relatório · o período considera a data de
            pagamento quando existir, senão a data de emissão.
          </p>

          <div className="relatorio-preview rounded-lg border border-border/60 bg-card p-2 overflow-x-auto">
            <RelatorioMovimentacoes ref={relatorioRef} titulos={titulosRelatorio} filtros={relFiltros} />
          </div>

          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setRelatorioAberto(false)}>
              Fechar
            </Button>
            <Button variant="outline" onClick={handlePDFRelatorio}>
              <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
            </Button>
            <Button onClick={handlePrintRelatorio}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
