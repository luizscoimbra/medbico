import { useEffect, useMemo, useState } from "react";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { digitosParaMoeda, formatBRL, moedaParaCentavos } from "@/lib/utils";
import type { StatusTitulo } from "@/lib/financeiroStorage";
import {
  CATEGORIAS_PAGAR,
  cancelarTituloPagar,
  criarTituloPagar,
  deleteTituloPagar,
  estornarTituloPagar,
  manutencoesComTitulo,
  pagarTitulo,
  updateTituloPagar,
  type TituloPagar,
} from "@/lib/contasPagarStorage";
import { getAllFornecedores, type Fornecedor } from "@/lib/fornecedorStorage";
import { getAllDrones, getMaintenanceRecords, type MaintenanceRecord } from "@/lib/droneStorage";
import {
  getAllRegistros as getAllRegistrosEquip,
} from "@/lib/equipmentMaintenanceStorage";
import { FornecedoresDialog } from "@/components/financeiro/FornecedoresDialog";
import { RateioEditor } from "@/components/financeiro/RateioEditor";
import {
  getAllCentrosCusto,
  getAllContasPlano,
  semearPlanoDeContas,
  type CentroCusto,
  type ContaPlano,
} from "@/lib/planoContasStorage";

const STATUS_LABEL: Record<StatusTitulo, string> = {
  aberto: "Em aberto",
  pago: "Pago",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<StatusTitulo, string> = {
  aberto: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  pago: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  cancelado: "bg-destructive/10 text-destructive border-destructive/30",
};

const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Transferência", "Boleto", "Cartão", "Cheque", "Outro"];
const LIVRE = "__livre";

const HOJE = () => new Date().toISOString().slice(0, 10);

const vencimentoPadrao = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

type AcaoConfirmar = "estornar" | "cancelar" | "excluir";

const CONFIRMACOES: Record<
  AcaoConfirmar,
  {
    titulo: string;
    botao: string;
    className?: string;
    Icone: LucideIcon;
    iconClass: string;
    descricao: (t: TituloPagar) => string;
  }
> = {
  estornar: {
    titulo: "Estornar pagamento",
    botao: "Confirmar estorno",
    Icone: RotateCcw,
    iconClass: "text-primary",
    descricao: (t) =>
      `Estornar o pagamento do título nº ${t.numero}? O valor volta para "A pagar".`,
  },
  cancelar: {
    titulo: "Cancelar título",
    botao: "Confirmar cancelamento",
    className: "bg-warning text-warning-foreground hover:opacity-90",
    Icone: Ban,
    iconClass: "text-warning",
    descricao: (t) => `Cancelar o título nº ${t.numero}? Esta ação não gera pagamento.`,
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

type Geravel = {
  id: string;
  origem: "drone" | "equipamento";
  titulo: string;
  contexto: string;
  data: string;
  custo: number;
  responsavel: string;
  fornecedorId?: string;
  fornecedorNome?: string;
  droneId?: string;
  equipmentId?: string;
};

type FormTitulo = {
  id?: string;
  numero?: string;
  fornId: string;
  fornNome: string;
  categoria: string;
  descricao: string;
  valor: string;
  dataVencimento: string;
  observacao: string;
  planoContaId: string;
  centroCustoId: string;
};

const formVazio = (fornId: string): FormTitulo => ({
  fornId,
  fornNome: "",
  categoria: CATEGORIAS_PAGAR[0],
  descricao: "",
  valor: "",
  dataVencimento: vencimentoPadrao(),
  observacao: "",
  planoContaId: "",
  centroCustoId: "",
});

interface ContasPagarProps {
  titulos: TituloPagar[];
  onReload: () => void | Promise<void>;
  onComprovante: (t: TituloPagar) => void;
}

export function ContasPagar({ titulos, onReload, onComprovante }: ContasPagarProps) {
  const [filtroStatus, setFiltroStatus] = useState<"todos" | StatusTitulo>("todos");
  const [busca, setBusca] = useState("");
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [fornDialogOpen, setFornDialogOpen] = useState(false);

  // Classificação obrigatória: conta do plano + departamento do título
  const [contasPlano, setContasPlano] = useState<ContaPlano[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);

  // Dialog de criação/edição
  const [form, setForm] = useState<FormTitulo | null>(null);

  // Dialog de pagamento (baixa)
  const [pagarRef, setPagarRef] = useState<TituloPagar | null>(null);
  const [dataPagamento, setDataPagamento] = useState(HOJE());
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [obsBaixa, setObsBaixa] = useState("");

  // Dialog de confirmação (estornar / cancelar / excluir)
  const [confirmacao, setConfirmacao] = useState<{ acao: AcaoConfirmar; titulo: TituloPagar } | null>(null);
  const [processando, setProcessando] = useState(false);

  // Dialog "Gerar de manutenções"
  const [gerarAberto, setGerarAberto] = useState(false);
  const [gerarCarregando, setGerarCarregando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [gerarLista, setGerarLista] = useState<Geravel[]>([]);
  const [gerarSel, setGerarSel] = useState<string[]>([]);
  const [gerarVenc, setGerarVenc] = useState(vencimentoPadrao());
  const [gerarFornId, setGerarFornId] = useState("");
  const [gerarCentroId, setGerarCentroId] = useState("");

  const loadFornecedores = async () => setFornecedores(await getAllFornecedores());

  /** Preenche o plano de contas e os centros de custo (pickers do formulário). */
  const loadClassificacao = async () => {
    try {
      const [c, s] = await Promise.all([getAllContasPlano(), getAllCentrosCusto()]);
      setContasPlano(c);
      setCentros(s);
      if (!c.length) {
        await semearPlanoDeContas();
        setContasPlano(await getAllContasPlano());
      }
      if (!s.length) {
        setCentros(await getAllCentrosCusto());
      }
    } catch {
      toast.error("Falha ao carregar o plano de contas e os centros de custo");
    }
  };

  useEffect(() => {
    loadFornecedores();
    loadClassificacao();
  }, []);

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return titulos.filter((t) => {
      if (filtroStatus !== "todos" && t.status !== filtroStatus) return false;
      if (!s) return true;
      return (
        (t.fornecedorNome || "").toLowerCase().includes(s) ||
        t.numero.toLowerCase().includes(s) ||
        (t.categoria || "").toLowerCase().includes(s) ||
        (t.descricao || "").toLowerCase().includes(s)
      );
    });
  }, [titulos, filtroStatus, busca]);

  const totalAberto = titulos.filter((t) => t.status === "aberto").reduce((s, t) => s + t.valor, 0);
  const totalPago = titulos.filter((t) => t.status === "pago").reduce((s, t) => s + t.valor, 0);
  const qtdAberto = titulos.filter((t) => t.status === "aberto").length;
  const vencidos = titulos.filter(
    (t) => t.status === "aberto" && t.dataVencimento && t.dataVencimento < HOJE()
  );

  const nomeFornecedorPorId = (id: string) => fornecedores.find((f) => f.id === id)?.nome || "";

  const abrirNovo = () => {
    const base = formVazio(LIVRE);
    const padrao = centros.find((c) => c.padrao && c.ativo);
    if (padrao) base.centroCustoId = padrao.id;
    setForm(base);
  };

  const abrirEditar = (t: TituloPagar) =>
    setForm({
      id: t.id,
      numero: t.numero,
      fornId: t.fornecedorId && fornecedores.some((f) => f.id === t.fornecedorId) ? t.fornecedorId : LIVRE,
      fornNome: t.fornecedorNome || "",
      categoria: t.categoria || CATEGORIAS_PAGAR[0],
      descricao: t.descricao || "",
      valor: t.valor ? digitosParaMoeda(String(Math.round(t.valor * 100))) : "",
      dataVencimento: t.dataVencimento || "",
      observacao: t.observacao || "",
      planoContaId: t.planoContaId || "",
      centroCustoId: t.centroCustoId || "",
    });

  const salvarForm = async () => {
    if (!form) return;
    const nome =
      form.fornId === LIVRE ? form.fornNome.trim() : nomeFornecedorPorId(form.fornId) || form.fornNome.trim();
    if (!nome) {
      toast.error("Informe o fornecedor");
      return;
    }
    if (!form.descricao.trim()) {
      toast.error("Informe a descrição");
      return;
    }
    const valor = moedaParaCentavos(form.valor) / 100;
    if (valor <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (!form.centroCustoId) {
      toast.error("Informe o departamento (centro de custo)");
      return;
    }
    if (!form.planoContaId) {
      toast.error("Informe a conta do plano de contas");
      return;
    }
    try {
      const fornecedorId = form.fornId === LIVRE ? undefined : form.fornId;
      if (form.id) {
        await updateTituloPagar(form.id, {
          fornecedorId,
          fornecedorNome: nome,
          categoria: form.categoria,
          descricao: form.descricao.trim(),
          valor,
          dataVencimento: form.dataVencimento || undefined,
          observacao: form.observacao.trim() || undefined,
          planoContaId: form.planoContaId,
          centroCustoId: form.centroCustoId,
        });
        toast.success("Título atualizado!");
      } else {
        const novo = await criarTituloPagar({
          fornecedorId,
          fornecedorNome: nome,
          categoria: form.categoria,
          descricao: form.descricao.trim(),
          valor,
          dataVencimento: form.dataVencimento || undefined,
          observacao: form.observacao.trim() || undefined,
          planoContaId: form.planoContaId,
          centroCustoId: form.centroCustoId,
        });
        toast.success(`Conta a pagar nº ${novo.numero} criada!`);
      }
      setForm(null);
      await onReload();
    } catch {
      toast.error("Erro ao salvar o título");
    }
  };

  const confirmarPagamento = async () => {
    if (!pagarRef) return;
    if (!dataPagamento) {
      toast.error("Informe a data do pagamento");
      return;
    }
    await pagarTitulo(pagarRef.id, {
      dataPagamento,
      formaPagamento,
      observacao: obsBaixa || undefined,
    });
    toast.success(`Título nº ${pagarRef.numero} pago com sucesso!`);
    setPagarRef(null);
    setObsBaixa("");
    await onReload();
  };

  const executarConfirmacao = async () => {
    if (!confirmacao || processando) return;
    const { acao, titulo } = confirmacao;
    setProcessando(true);
    try {
      if (acao === "estornar") {
        await estornarTituloPagar(titulo.id);
        toast.success("Pagamento estornado");
      } else if (acao === "cancelar") {
        await cancelarTituloPagar(titulo.id);
        toast.success("Título cancelado");
      } else {
        await deleteTituloPagar(titulo.id);
        toast.success("Título excluído");
      }
      setConfirmacao(null);
      await onReload();
    } catch {
      toast.error("Erro ao executar a operação");
    } finally {
      setProcessando(false);
    }
  };

  const confirmCfg = confirmacao ? CONFIRMACOES[confirmacao.acao] : null;

  // ── Gerar de manutenções ────────────────────────────────────────────
  const abrirGerar = async () => {
    setGerarAberto(true);
    setGerarCarregando(true);
    setGerarLista([]);
    setGerarSel([]);
    setGerarVenc(vencimentoPadrao());
    setGerarCentroId(centros.find((c) => c.padrao && c.ativo)?.id || "");
    try {
      const [vinculadas, mapaDrones] = await Promise.all([
        manutencoesComTitulo(),
        getAllDrones()
          .then((ds) => {
            const m: Record<string, string> = {};
            ds.forEach((d) => (m[d.id] = [d.marca, d.modelo].filter(Boolean).join(" ")));
            return m;
          })
          .catch(() => ({} as Record<string, string>)),
      ]);
      const lista: Geravel[] = [];

      let recs: MaintenanceRecord[] = [];
      try {
        recs = await getMaintenanceRecords();
      } catch {
        toast.error("Não foi possível carregar as manutenções de drones");
      }
      recs
        .filter((r) => (r.custo || 0) > 0 && !vinculadas.has(r.id))
        .forEach((r) => {
          lista.push({
            id: r.id,
            origem: "drone",
            titulo: (r.titulo || r.descricao || "Manutenção de drone").trim(),
            contexto: mapaDrones[r.drone_id] || "",
            data: r.data ? r.data.slice(0, 10) : "",
            custo: r.custo || 0,
            responsavel: r.responsavel || "",
            droneId: r.drone_id,
          });
        });

      try {
        const recsEq = await getAllRegistrosEquip();
        recsEq
          .filter((r) => (r.custo_total || 0) > 0 && !vinculadas.has(r.id))
          .forEach((r) => {
            lista.push({
              id: r.id,
              origem: "equipamento",
              titulo: (r.titulo || r.descricao || "Manutenção de equipamento").trim(),
              contexto: `Frota ${r.fleet_number}`,
              data: r.data ? r.data.slice(0, 10) : "",
              custo: r.custo_total || 0,
              responsavel: r.responsavel || "",
              fornecedorId: r.fornecedor_id || undefined,
              fornecedorNome: r.fornecedor_nome || undefined,
              equipmentId: r.equipment_id,
            });
          });
      } catch {
        toast.error("Não foi possível carregar as manutenções de equipamentos");
      }

      lista.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      setGerarLista(lista);
      setGerarSel(lista.map((x) => x.id));
    } finally {
      setGerarCarregando(false);
    }
  };

  const gerarTitulos = async () => {
    if (gerando) return;
    const escolhidas = gerarLista.filter((m) => gerarSel.includes(m.id));
    if (!escolhidas.length) {
      toast.error("Selecione ao menos uma manutenção");
      return;
    }
    if (!gerarCentroId) {
      toast.error("Informe o departamento para as contas geradas");
      return;
    }
    setGerando(true);
    try {
      for (const m of escolhidas) {
        const base = m.titulo || "Manutenção";
        const fornecedorId = m.fornecedorId || gerarFornId || undefined;
        const fornecedorNome =
          m.fornecedorNome ||
          (gerarFornId ? nomeFornecedorPorId(gerarFornId) : "") ||
          "Não informado";
        await criarTituloPagar({
          fornecedorId,
          fornecedorNome,
          categoria: "Manutenção",
          descricao: m.contexto ? `${base} (${m.contexto})` : base,
          valor: m.custo,
          dataEmissao: m.data || undefined,
          dataVencimento: gerarVenc || undefined,
          manutencaoId: m.id,
          droneId: m.droneId,
          equipmentId: m.equipmentId,
          centroCustoId: gerarCentroId,
        });
      }
      toast.success(`${escolhidas.length} conta(s) a pagar gerada(s) das manutenções!`);
      setGerarAberto(false);
      await onReload();
    } catch {
      toast.error("Erro ao gerar os títulos");
    } finally {
      setGerando(false);
    }
  };

  const toggleSelecao = (id: string) =>
    setGerarSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div>
      {/* Ações da aba */}
      <div className="flex flex-wrap items-center gap-2 mb-6 no-print">
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-1" /> Nova Conta a Pagar
        </Button>
        <Button variant="outline" size="sm" onClick={abrirGerar}>
          <Wrench className="h-4 w-4 mr-1" /> Gerar de manutenções
        </Button>
        <Button variant="outline" size="sm" onClick={() => setFornDialogOpen(true)}>
          <Building2 className="h-4 w-4 mr-1" /> Fornecedores
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-t-4 border-t-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A pagar</p>
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
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-xl font-heading font-bold">{formatBRL(totalPago)}</p>
                <p className="text-[10px] text-muted-foreground">total já liquidado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-t-4 ${vencidos.length > 0 ? "border-t-destructive" : "border-t-warning"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  vencidos.length > 0 ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                }`}
              >
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
            placeholder="Buscar por fornecedor, nº do título, categoria ou descrição..."
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
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="cancelado">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="border-b border-border/50 bg-muted/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-violet-600" />
            Contas a Pagar ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtrados.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic">
              Nenhuma conta a pagar. Cadastre com{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={abrirNovo}
              >
                Nova Conta a Pagar
              </button>{" "}
              ou gere a partir das manutenções.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Nº</th>
                    <th className="px-4 py-3 text-left font-semibold">Fornecedor</th>
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
                        <p className="font-medium">{t.fornecedorNome || ""}</p>
                        {t.categoria && (
                          <p className="text-[11px] text-muted-foreground">{t.categoria}</p>
                        )}
                        {(t.centroCustoId || t.planoContaId) && (
                          <p className="text-[10px] text-muted-foreground">
                            {[
                              t.centroCustoId
                                ? centros.find((c) => c.id === t.centroCustoId)?.nome
                                : undefined,
                              t.planoContaId
                                ? contasPlano.find((c) => c.id === t.planoContaId)?.nome
                                : undefined,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{t.descricao}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(t.dataEmissao + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {t.dataVencimento
                          ? new Date(t.dataVencimento + "T00:00:00").toLocaleDateString("pt-BR")
                          : ""}
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
                            onClick={() => onComprovante(t)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {t.status === "aberto" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Editar título"
                                className="h-8 w-8"
                                onClick={() => abrirEditar(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:bg-emerald-500/10"
                                onClick={() => {
                                  setPagarRef(t);
                                  setDataPagamento(HOJE());
                                  setFormaPagamento("Pix");
                                  setObsBaixa("");
                                }}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Pagar
                              </Button>
                            </>
                          )}
                          {t.status === "pago" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Estornar pagamento"
                              onClick={() => setConfirmacao({ acao: "estornar", titulo: t })}
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
                              onClick={() => setConfirmacao({ acao: "cancelar", titulo: t })}
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
                              onClick={() => setConfirmacao({ acao: "excluir", titulo: t })}
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

      {/* Dialog: nova / editar conta a pagar */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-violet-600" />
              {form?.id ? `Editar título nº ${form.numero}` : "Nova Conta a Pagar"}
            </DialogTitle>
            <DialogDescription>
              {form?.id
                ? "Ajuste os dados do título. O status não é alterado nesta tela."
                : "Registre um fornecedor, categoria, valor e vencimento."}
            </DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>Fornecedor *</Label>
                <Select value={form.fornId} onValueChange={(v) => setForm({ ...form, fornId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value={LIVRE}>Digitar manualmente&</SelectItem>
                  </SelectContent>
                </Select>
                {form.fornId === LIVRE && (
                  <Input
                    placeholder="Nome do fornecedor"
                    value={form.fornNome}
                    onChange={(e) => setForm({ ...form, fornNome: e.target.value })}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={form.categoria}
                    onValueChange={(v) => setForm({ ...form, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_PAGAR.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pag-valor">Valor *</Label>
                  <Input
                    id="pag-valor"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: digitosParaMoeda(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pag-desc">Descrição *</Label>
                <Input
                  id="pag-desc"
                  placeholder="Ex: Compra de óleo e filtros"
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </div>

              {/* Classificação obrigatória: sem conta e departamento o banco recusa o lançamento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="space-y-2">
                  <Label>Departamento (centro de custo) *</Label>
                  <Select
                    value={form.centroCustoId || "__nada"}
                    onValueChange={(v) => setForm({ ...form, centroCustoId: v === "__nada" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nada">Selecione...</SelectItem>
                      {centros
                        .filter((c) => c.ativo || c.id === form.centroCustoId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.codigo} · {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta do plano de contas *</Label>
                  <Select
                    value={form.planoContaId || "__nada"}
                    onValueChange={(v) => setForm({ ...form, planoContaId: v === "__nada" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a rubrica" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nada">Selecione...</SelectItem>
                      {contasPlano
                        .filter((c) => c.ativo || c.id === form.planoContaId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.codigo} · {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="col-span-full text-[11px] text-muted-foreground">
                  Toda despesa precisa dizer em que rubrica entra e de qual departamento ela é.
                  {form.id && " Abaixo dá para repartir o valor entre mais de um departamento (rateio)."}
                </p>
              </div>

              {form.id && form.centroCustoId && (
                <RateioEditor
                  payableId={form.id}
                  valorTitulo={moedaParaCentavos(form.valor) / 100}
                  centros={centros}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="pag-venc">Vencimento</Label>
                <Input
                  id="pag-venc"
                  type="date"
                  value={form.dataVencimento}
                  onChange={(e) => setForm({ ...form, dataVencimento: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pag-obs">Observação (opcional)</Label>
                <Input
                  id="pag-obs"
                  placeholder="Ex: pagar até o dia 10"
                  value={form.observacao}
                  onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarForm}>
              {form?.id ? "Salvar alterações" : "Criar título"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: registrar pagamento */}
      <Dialog open={!!pagarRef} onOpenChange={(open) => !open && setPagarRef(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Título nº {pagarRef?.numero} — {pagarRef?.fornecedorNome || "—"} ·{" "}
              {formatBRL(pagarRef?.valor || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dataPag2">Data do pagamento</Label>
              <Input
                id="dataPag2"
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
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs2">Observação (opcional)</Label>
              <Input
                id="obs2"
                placeholder="Ex: pagamento em 2 parcelas"
                value={obsBaixa}
                onChange={(e) => setObsBaixa(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagarRef(null)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmarPagamento}>
              Confirmar Pagamento
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

      {/* Dialog: gerar de manutenções */}
      <Dialog open={gerarAberto} onOpenChange={(open) => !open && !gerando && setGerarAberto(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-violet-600" />
              Gerar contas a pagar de manutenções
            </DialogTitle>
            <DialogDescription>
              Selecione as manutenções de drones e equipamentos com custo que ainda não
              geraram título. O vencimento pode ser ajustado antes de gerar.
            </DialogDescription>
          </DialogHeader>

          {gerarCarregando ? (
            <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando manutenções...
            </div>
          ) : gerarLista.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground italic">
              Nenhuma manutenção com custo pendente de gerar.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {gerarSel.length} de {gerarLista.length} selecionada(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGerarSel(gerarLista.map((m) => m.id))}
                  >
                    Marcar todas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setGerarSel([])}>
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="border border-border/60 rounded-lg max-h-64 overflow-y-auto divide-y divide-border">
                {gerarLista.map((m) => {
                  return (
                    <label
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={gerarSel.includes(m.id)}
                        onChange={() => toggleSelecao(m.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.titulo}
                          {m.contexto && (
                            <span className="text-muted-foreground font-normal"> · {m.contexto}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {m.origem === "drone" ? "Drone" : "Equipamento"} ·{" "}
                          {m.data ? new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR") : ""}{" "}
                          · {m.responsavel || "sem responsável"}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold whitespace-nowrap">
                        {formatBRL(m.custo || 0)}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gerar-venc">Vencimento padrão</Label>
                  <Input
                    id="gerar-venc"
                    type="date"
                    value={gerarVenc}
                    onChange={(e) => setGerarVenc(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor (opcional)</Label>
                  <Select value={gerarFornId || "__none"} onValueChange={(v) => setGerarFornId(v === "__none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Não informado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Não informado</SelectItem>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Departamento *</Label>
                  <Select
                    value={gerarCentroId || "__nada"}
                    onValueChange={(v) => setGerarCentroId(v === "__nada" ? "" : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nada">Selecione...</SelectItem>
                      {centros
                        .filter((c) => c.ativo)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.codigo} · {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setGerarAberto(false)} disabled={gerando}>
              Fechar
            </Button>
            <Button onClick={gerarTitulos} disabled={gerarCarregando || gerando || gerarSel.length === 0}>
              {gerando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...
                </>
              ) : (
                <>Gerar {gerarSel.length} título(s)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cadastro de fornecedores */}
      <FornecedoresDialog
        open={fornDialogOpen}
        onOpenChange={setFornDialogOpen}
        onAlterado={loadFornecedores}
      />
    </div>
  );
}
