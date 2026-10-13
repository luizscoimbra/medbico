import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowDownLeft,
  Building2,
  CheckCircle2,
  KeyRound,
  Landmark,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { digitosParaMoeda, formatBRL, moedaParaCentavos } from "@/lib/utils";
import {
  BANCOS,
  criarContaBancaria,
  deleteContaBancaria,
  getAllContasBancarias,
  getStatusCredencial,
  nomeBancoPorCodigo,
  salvarCredencial,
  updateContaBancaria,
  validarIntegracao,
  type ContaBancaria,
  type TipoContaBancaria,
} from "@/lib/bankAccountsStorage";
import {
  aplicarRegras,
  carregarTitulosParaBatimento,
  classificarMovimento,
  conciliarMovimento,
  criarRegra,
  deleteRegra,
  desconciliarMovimento,
  excluirMovimento,
  getAllRegras,
  getExtrato,
  getUltimasImportacoes,
  importarOfx,
  resumirExtrato,
  semearRegras,
  sugerirTitulo,
  updateRegra,
  type MovimentoExtrato,
  type RegraConciliacao,
} from "@/lib/conciliacaoStorage";
import {
  getAllCentrosCusto,
  getAllContasPlano,
  type CentroCusto,
  type ContaPlano,
} from "@/lib/planoContasStorage";

const VAZIO = "__vazio";
const HOJE = () => new Date().toISOString().slice(0, 10);

const CATEGORIAS = [
  "Insumos",
  "Manutenção",
  "Combustível",
  "Serviços",
  "Pessoal",
  "Impostos",
  "Aluguel",
  "Receitas",
  "Financeiro",
  "Outros",
];

const FORMAS = ["Pix", "Dinheiro", "Transferência", "Boleto", "Cartão", "Cheque", "Outro"];

const TIPO_CONTA: { valor: TipoContaBancaria; label: string }[] = [
  { valor: "corrente", label: "Conta corrente" },
  { valor: "poupanca", label: "Poupança" },
  { valor: "caixa", label: "Caixa" },
  { valor: "pagamento", label: "Conta de pagamento" },
];

const STATUS_INTEGRACAO: Record<string, { label: string; classe: string }> = {
  desconectado: { label: "Sem credenciais", classe: "bg-muted text-muted-foreground border-border/60" },
  pendente: { label: "Chaves registradas", classe: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  conectado: { label: "Conectado", classe: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  erro: { label: "Erro", classe: "bg-destructive/10 text-destructive border-destructive/30" },
};

type FormConta = {
  id?: string;
  codigoBanco: string;
  nomeBanco: string;
  agencia: string;
  agenciaDv: string;
  conta: string;
  contaDv: string;
  tipo: TipoContaBancaria;
  saldoInicial: string;
  chavePix: string;
  ativo: boolean;
};

type FormCredencial = {
  clientId: string;
  clientSecret: string;
  webhookUrl: string;
  ambiente: "homologacao" | "producao";
};

type FormRegra = {
  id?: string;
  nome: string;
  matchTipo: RegraConciliacao["matchTipo"];
  matchValor: string;
  formaPagamento: string;
  categoria: string;
  planoContaId: string;
  centroCustoId: string;
  prioridade: number;
  ativo: boolean;
};

const formContaVazio = (): FormConta => ({
  codigoBanco: "",
  nomeBanco: "",
  agencia: "",
  agenciaDv: "",
  conta: "",
  contaDv: "",
  tipo: "corrente",
  saldoInicial: "",
  chavePix: "",
  ativo: true,
});

export default function ConciliacaoBancaria() {
  const navigate = useNavigate();

  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [contaSel, setContaSel] = useState("");
  const [movimentos, setMovimentos] = useState<MovimentoExtrato[]>([]);
  const [regras, setRegras] = useState<RegraConciliacao[]>([]);
  const [importacoes, setImportacoes] = useState<
    { id: string; arquivoNome: string; linhas: number; importadoEm: string }[]
  >([]);
  const [contasPlano, setContasPlano] = useState<ContaPlano[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "aberto" | "sim">("todos");

  const [formConta, setFormConta] = useState<FormConta | null>(null);
  const [formCred, setFormCred] = useState<FormCredencial | null>(null);
  const [formRegra, setFormRegra] = useState<FormRegra | null>(null);
  const [conciliando, setConciliando] = useState<MovimentoExtrato | null>(null);
  const [classificando, setClassificando] = useState<MovimentoExtrato | null>(null);

  const [titulosPag, setTitulosPag] = useState<
    { id: string; nome: string; valor: number; vencimento: string }[]
  >([]);
  const [titulosRec, setTitulosRec] = useState<
    { id: string; nome: string; valor: number; vencimento: string }[]
  >([]);
  const [tituloEscolhido, setTituloEscolhido] = useState("");
  const [dataBaixa, setDataBaixa] = useState(HOJE());
  const [formaBaixa, setFormaBaixa] = useState("Pix");

  const [catForm, setCatForm] = useState({
    categoria: "",
    formaPagamento: "",
    planoContaId: "",
    centroCustoId: "",
    observacao: "",
  });

  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [c, r] = await Promise.all([getAllContasBancarias(), getAllRegras()]);
      setContas(c);
      setRegras(r);
      setContaSel((prev) => prev || c[0]?.id || "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar as contas bancárias");
    } finally {
      setCarregando(false);
    }
  };

  const carregarMovimentos = async () => {
    if (!contaSel) {
      setMovimentos([]);
      setImportacoes([]);
      return;
    }
    try {
      const [m, i] = await Promise.all([
        getExtrato(contaSel, {
          de: filtroDe || undefined,
          ate: filtroAte || undefined,
        }),
        getUltimasImportacoes(contaSel, 3),
      ]);
      const filtrados = m.filter((x) =>
        filtroStatus === "todos" ? true : filtroStatus === "sim" ? x.conciliado : !x.conciliado
      );
      setMovimentos(filtrados);
      setImportacoes(i.map((x) => ({ id: x.id, arquivoNome: x.arquivoNome, linhas: x.linhas, importadoEm: x.importadoEm })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar o extrato");
    }
  };

  useEffect(() => {
    carregar();
    getAllContasPlano().then(setContasPlano).catch(() => undefined);
    getAllCentrosCusto().then(setCentros).catch(() => undefined);
  }, []);

  useEffect(() => {
    carregarMovimentos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contaSel, filtroDe, filtroAte, filtroStatus]);

  const resumo = useMemo(() => resumirExtrato(movimentos, 0), [movimentos]);
  const contaAtual = contas.find((c) => c.id === contaSel);

  /** Extrato visível: período/status já filtrados na carga, texto aqui. */
  const visiveis = useMemo(() => {
    const s = filtroTexto.trim().toLowerCase();
    if (!s) return movimentos;
    return movimentos.filter((m) =>
      [m.historico, m.doc, m.favorecido, m.categoria, m.formaPagamento]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [movimentos, filtroTexto]);

  // ── Contas bancárias ────────────────────────────────────────────────────
  const salvarConta = async () => {
    if (!formConta) return;
    if (!formConta.codigoBanco.trim()) {
      toast.error("Informe o banco");
      return;
    }
    if (!formConta.conta.trim()) {
      toast.error("Informe o número da conta");
      return;
    }
    setProcessando(true);
    try {
      const codigo = formConta.codigoBanco.padStart(3, "0");
      const nomeBanco =
        formConta.nomeBanco.trim() || nomeBancoPorCodigo(codigo) || `Banco ${codigo}`;
      const payload = {
        codigoBanco: codigo,
        nomeBanco,
        agencia: formConta.agencia.trim() || "0000",
        agenciaDv: formConta.agenciaDv.trim() || undefined,
        conta: formConta.conta.trim(),
        contaDv: formConta.contaDv.trim() || undefined,
        tipo: formConta.tipo,
        saldoInicial: moedaParaCentavos(formConta.saldoInicial) / 100,
        chavePix: formConta.chavePix.trim() || undefined,
        ativo: formConta.ativo,
        integracaoTipo: "ofx" as const,
      };
      if (formConta.id) {
        await updateContaBancaria(formConta.id, payload);
        toast.success("Conta bancária atualizada");
      } else {
        const nova = await criarContaBancaria(payload);
        setContaSel(nova.id);
        toast.success("Conta bancária criada");
      }
      setFormConta(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a conta bancária");
    } finally {
      setProcessando(false);
    }
  };

  const excluirConta = async () => {
    if (!formConta?.id) return;
    setProcessando(true);
    try {
      await deleteContaBancaria(formConta.id);
      toast.success("Conta bancária excluída");
      setFormConta(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir a conta");
    } finally {
      setProcessando(false);
    }
  };

  const abrirCredenciais = async () => {
    if (!contaSel) return;
    try {
      const st = await getStatusCredencial(contaSel);
      setFormCred({
        clientId: st?.clientId || "",
        clientSecret: "",
        webhookUrl: st?.webhookUrl || "",
        ambiente: st?.ambiente || "homologacao",
      });
    } catch {
      setFormCred({ clientId: "", clientSecret: "", webhookUrl: "", ambiente: "homologacao" });
    }
  };

  const salvarCredenciais = async () => {
    if (!formCred || !contaSel) return;
    setProcessando(true);
    try {
      await salvarCredencial(contaSel, {
        bankAccountId: contaSel,
        provider: contaAtual?.nomeBanco || "banco",
        clientId: formCred.clientId.trim() || undefined,
        clientSecret: formCred.clientSecret.trim() || undefined,
        webhookUrl: formCred.webhookUrl.trim() || undefined,
        ambiente: formCred.ambiente,
      });
      const r = await validarIntegracao(contaSel);
      if (r.ok) {
        toast.success("Credenciais registradas. A conexão passa a valer após a liberação do banco.");
      } else {
        toast.warning(`Credenciais salvas. Faltando: ${r.faltando.join(", ")}.`);
      }
      setFormCred(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar as credenciais");
    } finally {
      setProcessando(false);
    }
  };

  const validar = async () => {
    if (!contaSel) return;
    setProcessando(true);
    try {
      const r = await validarIntegracao(contaSel);
      if (r.ok) toast.success("Chaves conferidas e registradas.");
      else toast.warning(`Ainda falta configurar: ${r.faltando.join(", ")}.`);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao validar a integração");
    } finally {
      setProcessando(false);
    }
  };

  // ── Importação OFX ──────────────────────────────────────────────────────
  const importarArquivo = async (file: File) => {
    if (!contaSel) {
      toast.error("Selecione uma conta bancária antes de importar");
      return;
    }
    setProcessando(true);
    try {
      const texto = await file.text();
      const r = await importarOfx({
        bankAccountId: contaSel,
        arquivoNome: file.name,
        texto,
      });
      toast.success(
        `${r.inseridos} lançamento(s) importado(s)${r.ignorados ? ` · ${r.ignorados} já existente(s)` : ""}`
      );
      await carregarMovimentos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar o extrato");
    } finally {
      setProcessando(false);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  };

  // ── Conciliação ─────────────────────────────────────────────────────────
  const abrirConciliacao = async (mov: MovimentoExtrato) => {
    setConciliando(mov);
    setTituloEscolhido("");
    setDataBaixa(mov.data || HOJE());
    setFormaBaixa(mov.formaPagamento || "Pix");
    try {
      const { pagar, receber } = await carregarTitulosParaBatimento();
      const mapPag = pagar.map((t) => ({
        id: t.id,
        nome: `${t.numero} · ${t.fornecedorNome} · vence ${t.dataVencimento || "s/ data"}`,
        valor: t.valor,
        vencimento: t.dataVencimento || "",
      }));
      const mapRec = receber.map((t) => ({
        id: t.id,
        nome: `${t.numero} · ${t.clienteNome} · vence ${t.dataVencimento || "s/ data"}`,
        valor: t.valor,
        vencimento: t.dataVencimento || "",
      }));
      setTitulosPag(mapPag);
      setTitulosRec(mapRec);
      const sug = sugerirTitulo(mov, { pagar, receber });
      if (sug) setTituloEscolhido(sug.id);
    } catch {
      setTitulosPag([]);
      setTitulosRec([]);
    }
  };

  const confirmarConciliacao = async () => {
    if (!conciliando) return;
    setProcessando(true);
    try {
      const pagavel = titulosPag.some((t) => t.id === tituloEscolhido);
      const recebivel = titulosRec.some((t) => t.id === tituloEscolhido);
      if (!pagavel && !recebivel) {
        toast.error("Escolha o título que corresponde ao lançamento");
        return;
      }
      await conciliarMovimento({
        statementId: conciliando.id,
        payableId: pagavel ? tituloEscolhido : undefined,
        receivableId: recebivel ? tituloEscolhido : undefined,
        dataPagamento: dataBaixa,
        formaPagamento: formaBaixa,
      });
      toast.success("Lançamento conciliado e título baixado");
      setConciliando(null);
      await carregarMovimentos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao conciliar");
    } finally {
      setProcessando(false);
    }
  };

  const abrirClassificacao = (mov: MovimentoExtrato) => {
    setClassificando(mov);
    setCatForm({
      categoria: mov.categoria || "",
      formaPagamento: mov.formaPagamento || "",
      planoContaId: "",
      centroCustoId: "",
      observacao: mov.observacao || "",
    });
  };

  const salvarClassificacao = async () => {
    if (!classificando) return;
    setProcessando(true);
    try {
      await classificarMovimento(classificando.id, catForm);
      toast.success("Movimento classificado");
      setClassificando(null);
      await carregarMovimentos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao classificar");
    } finally {
      setProcessando(false);
    }
  };

  const desconciliar = async (mov: MovimentoExtrato) => {
    setProcessando(true);
    try {
      await desconciliarMovimento(mov);
      toast.success("Conciliação desfeita");
      await carregarMovimentos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao desfazer a conciliação");
    } finally {
      setProcessando(false);
    }
  };

  const excluirMov = async (mov: MovimentoExtrato) => {
    setProcessando(true);
    try {
      await excluirMovimento(mov.id);
      toast.success("Movimento excluído");
      await carregarMovimentos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir o movimento");
    } finally {
      setProcessando(false);
    }
  };

  // ── Regras ──────────────────────────────────────────────────────────────
  const semearRegrasPadrao = async () => {
    setProcessando(true);
    try {
      await semearRegras();
      setRegras(await getAllRegras());
      toast.success("Regras padrão criadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar as regras padrão");
    } finally {
      setProcessando(false);
    }
  };

  const salvarRegra = async () => {
    if (!formRegra) return;
    if (!formRegra.matchValor.trim()) {
      toast.error("Informe o texto a procurar no lançamento");
      return;
    }
    setProcessando(true);
    try {
      const payload = {
        nome: formRegra.nome.trim() || formRegra.matchValor,
        matchTipo: formRegra.matchTipo,
        matchValor: formRegra.matchValor.trim(),
        formaPagamento: formRegra.formaPagamento || undefined,
        categoria: formRegra.categoria || undefined,
        planoContaId: formRegra.planoContaId || undefined,
        centroCustoId: formRegra.centroCustoId || undefined,
        prioridade: formRegra.prioridade,
        ativo: formRegra.ativo,
      };
      if (formRegra.id) {
        await updateRegra(formRegra.id, payload);
        toast.success("Regra atualizada");
      } else {
        await criarRegra(payload);
        toast.success("Regra criada");
      }
      setFormRegra(null);
      setRegras(await getAllRegras());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a regra");
    } finally {
      setProcessando(false);
    }
  };

  const excluirRegra = async (id: string) => {
    setProcessando(true);
    try {
      await deleteRegra(id);
      setRegras(await getAllRegras());
      toast.success("Regra excluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir a regra");
    } finally {
      setProcessando(false);
    }
  };

  const sugestaoRegra = useMemo(() => {
    if (!conciliando) return null;
    const classe = aplicarRegras(
      {
        dtposted: conciliando.data,
        trnamt: conciliando.valor,
        memo: conciliando.historico,
        doc: conciliando.doc,
      },
      regras
    );
    return Object.values(classe).some(Boolean) ? classe : null;
  }, [conciliando, regras]);

  const titulosSugeridos = conciliando
    ? conciliando.valor < 0
      ? titulosPag
      : titulosRec
    : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/financeiro")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-foreground">Conciliação Bancária</h1>
            <p className="text-sm text-muted-foreground">
              Importe o extrato em OFX e bata com os títulos lançados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/plano-de-contas">
            <Button variant="outline" size="sm">Plano de contas</Button>
          </Link>
          <Link to="/boletos">
            <Button variant="outline" size="sm">Boletos</Button>
          </Link>
        </div>
      </div>

      {/* Conta + ações */}
      <Card className="mb-4 shadow-lg border-border/50">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <Label>Conta bancária</Label>
              <Select value={contaSel || VAZIO} onValueChange={(v) => setContaSel(v === VAZIO ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VAZIO}>Selecione...</SelectItem>
                  {contas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigoBanco} · {c.nomeBanco} · ag. {c.agencia} / {c.conta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => arquivoRef.current?.click()} disabled={!contaSel || processando}>
                {processando ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Importar OFX
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFormConta(formContaVazio())}>
                <Plus className="h-4 w-4 mr-1" /> Nova conta
              </Button>
              <Button size="sm" variant="outline" onClick={abrirCredenciais} disabled={!contaSel}>
                <KeyRound className="h-4 w-4 mr-1" /> Credenciais
              </Button>
              <Button size="sm" variant="outline" onClick={validar} disabled={!contaSel || processando}>
                <RefreshCw className="h-4 w-4 mr-1" /> Conferir chaves
              </Button>
            </div>
            <input
              ref={arquivoRef}
              type="file"
              accept=".ofx,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importarArquivo(f);
              }}
            />
          </div>

          {contaAtual && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge
                variant="outline"
                className={`text-[10px] ${STATUS_INTEGRACAO[contaAtual.integracaoStatus]?.classe || ""}`}
              >
                {STATUS_INTEGRACAO[contaAtual.integracaoStatus]?.label || contaAtual.integracaoStatus}
              </Badge>
              <span className="text-muted-foreground">{contaAtual.integracaoDetalhe}</span>
              {contaAtual.ultimaImportacao && (
                <span className="text-muted-foreground">
                  · última importação{" "}
                  {new Date(contaAtual.ultimaImportacao).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          )}

          {importacoes.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Importações recentes:{" "}
              {importacoes
                .map(
                  (i) =>
                    `${i.arquivoNome} (${i.linhas} linhas, ${new Date(i.importadoEm).toLocaleDateString("pt-BR")})`
                )
                .join(" · ")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        <Card className="border-t-4 border-t-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Créditos</p>
            <p className="text-xl font-heading font-bold text-emerald-600">
              {formatBRL(resumo.creditos)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-destructive">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Débitos</p>
            <p className="text-xl font-heading font-bold text-destructive">
              {formatBRL(resumo.debitos)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-primary">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Movimento líquido</p>
            <p className="text-xl font-heading font-bold">{formatBRL(resumo.saldo)}</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-warning">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-xl font-heading font-bold">{resumo.pendentes}</p>
            <p className="text-[10px] text-muted-foreground">{resumo.conciliados} conciliados</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="extrato">
        <TabsList className="mb-4">
          <TabsTrigger value="extrato" className="gap-2">
            <Landmark className="h-4 w-4" /> Extrato
          </TabsTrigger>
          <TabsTrigger value="regras" className="gap-2">
            <ListChecks className="h-4 w-4" /> Regras de categorização
          </TabsTrigger>
        </TabsList>

        <TabsContent value="extrato" className="mt-0">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por histórico, favorecido ou categoria..."
                className="pl-9"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
              />
            </div>
            <Input
              type="date"
              className="sm:w-40"
              value={filtroDe}
              onChange={(e) => setFiltroDe(e.target.value)}
            />
            <Input
              type="date"
              className="sm:w-40"
              value={filtroAte}
              onChange={(e) => setFiltroAte(e.target.value)}
            />
            <Select
              value={filtroStatus}
              onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)}
            >
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aberto">A conciliar</SelectItem>
                <SelectItem value="sim">Conciliados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                Extrato ({visiveis.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : !contaSel ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Selecione uma conta bancária (ou crie uma com Nova conta) para importar o extrato.
                </div>
              ) : movimentos.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Nenhum lançamento. Exporte o extrato no internet banking em OFX e use{" "}
                  <strong>Importar OFX</strong>.
                </div>
              ) : visiveis.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Nenhum lançamento corresponde aos filtros.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Data</th>
                        <th className="px-4 py-3 text-left font-semibold">Histórico</th>
                        <th className="px-4 py-3 text-right font-semibold">Valor</th>
                        <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                        <th className="px-4 py-3 text-center font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visiveis.map((m) => (
                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(m.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-xs">{m.historico}</p>
                            {m.favorecido && (
                              <p className="text-[11px] text-muted-foreground">{m.favorecido}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                            <span
                              className={
                                m.valor > 0 ? "text-emerald-600" : "text-destructive"
                              }
                            >
                              {m.valor > 0 ? "+" : ""}
                              {formatBRL(m.valor)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {m.categoria || "—"}
                            {m.formaPagamento ? ` · ${m.formaPagamento}` : ""}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                m.conciliado
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                              }`}
                            >
                              {m.conciliado ? "Conciliado" : "Pendente"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {!m.conciliado && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-emerald-600 hover:bg-emerald-500/10"
                                  onClick={() => abrirConciliacao(m)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" /> Conciliar
                                </Button>
                              )}
                              {m.conciliado && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => desconciliar(m)}
                                  disabled={processando}
                                  title="Desfazer conciliação"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Classificar"
                                onClick={() => abrirClassificacao(m)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:bg-destructive/10"
                                title="Excluir movimento"
                                onClick={() => excluirMov(m)}
                                disabled={processando}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/50 font-semibold">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase">
                          Total listado
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatBRL(visiveis.reduce((s, m) => s + m.valor, 0))}
                        </td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="regras" className="mt-0">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                Regras ({regras.length})
              </CardTitle>
              <div className="flex gap-2">
                {regras.length === 0 && (
                  <Button size="sm" variant="outline" onClick={semearRegrasPadrao} disabled={processando}>
                    <Sparkles className="h-4 w-4 mr-1" /> Criar regras padrão
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() =>
                    setFormRegra({
                      nome: "",
                      matchTipo: "historico_contem",
                      matchValor: "",
                      formaPagamento: "",
                      categoria: "",
                      planoContaId: "",
                      centroCustoId: "",
                      prioridade: (regras.length + 1) * 10,
                      ativo: true,
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Nova regra
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {regras.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  As regras classificam os lançamentos importados automaticamente (ex.: todo
                  histórico com "PIX" vira forma Pix e vai para a rubrica certa).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">#</th>
                        <th className="px-4 py-3 text-left font-semibold">Regra</th>
                        <th className="px-4 py-3 text-left font-semibold">Condição</th>
                        <th className="px-4 py-3 text-left font-semibold">Classifica em</th>
                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                        <th className="px-4 py-3 text-center font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {regras.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{r.prioridade}</td>
                          <td className="px-4 py-3 font-medium">{r.nome}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {r.matchTipo === "historico_contem"
                              ? "histórico contém"
                              : r.matchTipo === "historico_igual"
                                ? "histórico igual a"
                                : r.matchTipo === "favorecido_contem"
                                  ? "favorecido contém"
                                  : "documento igual a"}{" "}
                            <span className="font-mono">"{r.matchValor}"</span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {[r.formaPagamento, r.categoria].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                r.ativo
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border/60"
                              }`}
                            >
                              {r.ativo ? "Ativa" : "Inativa"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar"
                                onClick={() =>
                                  setFormRegra({
                                    id: r.id,
                                    nome: r.nome,
                                    matchTipo: r.matchTipo,
                                    matchValor: r.matchValor,
                                    formaPagamento: r.formaPagamento || "",
                                    categoria: r.categoria || "",
                                    planoContaId: r.planoContaId || "",
                                    centroCustoId: r.centroCustoId || "",
                                    prioridade: r.prioridade,
                                    ativo: r.ativo,
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                title="Excluir"
                                onClick={() => excluirRegra(r.id)}
                                disabled={processando}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: conta bancária */}
      <Dialog open={!!formConta} onOpenChange={(open) => !open && !processando && setFormConta(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {formConta?.id ? "Editar conta bancária" : "Nova conta bancária"}
            </DialogTitle>
            <DialogDescription>
              A conta é usada para importar o extrato (OFX) e emitir boletos.
            </DialogDescription>
          </DialogHeader>
          {formConta && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bk-codigo">Banco (código) *</Label>
                  <Select
                    value={formConta.codigoBanco || VAZIO}
                    onValueChange={(v) =>
                      setFormConta({
                        ...formConta,
                        codigoBanco: v === VAZIO ? "" : v,
                        nomeBanco: nomeBancoPorCodigo(v) || formConta.nomeBanco,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Código" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VAZIO}>Selecione...</SelectItem>
                      {BANCOS.map((b) => (
                        <SelectItem key={b.codigo} value={b.codigo}>
                          {b.codigo} · {b.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="bk-nome">Nome exibido</Label>
                  <Input
                    id="bk-nome"
                    placeholder="Preenchido pelo banco escolhido"
                    value={formConta.nomeBanco}
                    onChange={(e) => setFormConta({ ...formConta, nomeBanco: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bk-ag">Agência</Label>
                  <Input
                    id="bk-ag"
                    value={formConta.agencia}
                    onChange={(e) => setFormConta({ ...formConta, agencia: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bk-agdv">DV ag.</Label>
                  <Input
                    id="bk-agdv"
                    value={formConta.agenciaDv}
                    onChange={(e) => setFormConta({ ...formConta, agenciaDv: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bk-conta">Conta *</Label>
                  <Input
                    id="bk-conta"
                    value={formConta.conta}
                    onChange={(e) => setFormConta({ ...formConta, conta: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bk-contadv">DV conta</Label>
                  <Input
                    id="bk-contadv"
                    value={formConta.contaDv}
                    onChange={(e) => setFormConta({ ...formConta, contaDv: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formConta.tipo}
                    onValueChange={(v) => setFormConta({ ...formConta, tipo: v as TipoContaBancaria })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_CONTA.map((t) => (
                        <SelectItem key={t.valor} value={t.valor}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bk-saldo">Saldo inicial (R$)</Label>
                  <Input
                    id="bk-saldo"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formConta.saldoInicial}
                    onChange={(e) =>
                      setFormConta({ ...formConta, saldoInicial: digitosParaMoeda(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bk-pix">Chave Pix (opcional)</Label>
                  <Input
                    id="bk-pix"
                    placeholder="CNPJ, e-mail ou telefone"
                    value={formConta.chavePix}
                    onChange={(e) => setFormConta({ ...formConta, chavePix: e.target.value })}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formConta.ativo}
                  onCheckedChange={(v) => setFormConta({ ...formConta, ativo: v === true })}
                />
                Conta ativa
              </label>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {formConta?.id && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={excluirConta}
                disabled={processando}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
            <Button variant="ghost" onClick={() => setFormConta(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={salvarConta} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {formConta?.id ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: credenciais */}
      <Dialog open={!!formCred} onOpenChange={(open) => !open && !processando && setFormCred(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Credenciais da API do banco
            </DialogTitle>
            <DialogDescription>
              Os segredos são gravados protegidos e nunca são devolvidos à tela. A conexão passa a
              valer após a homologação junto à instituição.
            </DialogDescription>
          </DialogHeader>
          {formCred && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="cr-client">Client ID</Label>
                <Input
                  id="cr-client"
                  value={formCred.clientId}
                  onChange={(e) => setFormCred({ ...formCred, clientId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-secret">Client Secret {formCred.clientSecret ? "*" : "(vazio mantém o atual)"}</Label>
                <Input
                  id="cr-secret"
                  type="password"
                  placeholder="••••••••"
                  value={formCred.clientSecret}
                  onChange={(e) => setFormCred({ ...formCred, clientSecret: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-hook">Webhook (opcional)</Label>
                <Input
                  id="cr-hook"
                  placeholder="https://..."
                  value={formCred.webhookUrl}
                  onChange={(e) => setFormCred({ ...formCred, webhookUrl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select
                  value={formCred.ambiente}
                  onValueChange={(v) =>
                    setFormCred({ ...formCred, ambiente: v as "homologacao" | "producao" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormCred(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={salvarCredenciais} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar credenciais
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: conciliar */}
      <Dialog open={!!conciliando} onOpenChange={(open) => !open && !processando && setConciliando(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Conciliar lançamento
            </DialogTitle>
            <DialogDescription>
              Batendo o valor com o título, o sistema dá baixa nele e marca o movimento como
              conciliado em uma única operação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  {conciliando ? new Date(conciliando.data + "T00:00:00").toLocaleDateString("pt-BR") : ""}
                </span>
                <span className="font-mono font-semibold">
                  {conciliando ? formatBRL(conciliando.valor) : ""}
                </span>
              </div>
              <p className="mt-1 text-xs">{conciliando?.historico}</p>
              {sugestaoRegra && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Regra aplicada: {[sugestaoRegra.formaPagamento, sugestaoRegra.categoria].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Título correspondente *</Label>
              <Select value={tituloEscolhido || VAZIO} onValueChange={(v) => setTituloEscolhido(v === VAZIO ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o título" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VAZIO}>Selecione...</SelectItem>
                  {titulosSugeridos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome} · {formatBRL(t.valor)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sugestões com o mesmo valor do lançamento ({titulosSugeridos.length} em aberto).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do pagamento</Label>
                <Input
                  type="date"
                  value={dataBaixa}
                  onChange={(e) => setDataBaixa(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={formaBaixa} onValueChange={setFormaBaixa}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConciliando(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={confirmarConciliacao} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Conciliar e dar baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: classificar */}
      <Dialog open={!!classificando} onOpenChange={(open) => !open && !processando && setClassificando(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-primary" />
              Classificar lançamento
            </DialogTitle>
            <DialogDescription>
              Marca categoria, forma de pagamento e departamento do movimento sem dar baixa em título.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={catForm.categoria || VAZIO}
                  onValueChange={(v) => setCatForm({ ...catForm, categoria: v === VAZIO ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VAZIO}>Selecione...</SelectItem>
                    {CATEGORIAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select
                  value={catForm.formaPagamento || VAZIO}
                  onValueChange={(v) => setCatForm({ ...catForm, formaPagamento: v === VAZIO ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VAZIO}>Selecione...</SelectItem>
                    {FORMAS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conta do plano</Label>
                <Select
                  value={catForm.planoContaId || VAZIO}
                  onValueChange={(v) => setCatForm({ ...catForm, planoContaId: v === VAZIO ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VAZIO}>Selecione...</SelectItem>
                    {contasPlano
                      .filter((c) => c.ativo)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.codigo} · {c.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Centro de custo</Label>
                <Select
                  value={catForm.centroCustoId || VAZIO}
                  onValueChange={(v) => setCatForm({ ...catForm, centroCustoId: v === VAZIO ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VAZIO}>Selecione...</SelectItem>
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
            <div className="space-y-2">
              <Label htmlFor="cat-obs">Observação</Label>
              <Input
                id="cat-obs"
                value={catForm.observacao}
                onChange={(e) => setCatForm({ ...catForm, observacao: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClassificando(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={salvarClassificacao} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar classificação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: regra */}
      <Dialog open={!!formRegra} onOpenChange={(open) => !open && !processando && setFormRegra(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              {formRegra?.id ? "Editar regra" : "Nova regra de categorização"}
            </DialogTitle>
            <DialogDescription>
              Aplicada em ordem de prioridade a cada lançamento importado do extrato.
            </DialogDescription>
          </DialogHeader>
          {formRegra && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="rg-nome">Nome da regra</Label>
                  <Input
                    id="rg-nome"
                    placeholder="Ex: Pagamento a fornecedor"
                    value={formRegra.nome}
                    onChange={(e) => setFormRegra({ ...formRegra, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rg-prio">Prioridade</Label>
                  <Input
                    id="rg-prio"
                    type="number"
                    min={1}
                    value={formRegra.prioridade}
                    onChange={(e) =>
                      setFormRegra({ ...formRegra, prioridade: Number(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Quando</Label>
                  <Select
                    value={formRegra.matchTipo}
                    onValueChange={(v) =>
                      setFormRegra({ ...formRegra, matchTipo: v as RegraConciliacao["matchTipo"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="historico_contem">histórico contém</SelectItem>
                      <SelectItem value="historico_igual">histórico é igual a</SelectItem>
                      <SelectItem value="favorecido_contem">favorecido contém</SelectItem>
                      <SelectItem value="doc_igual">documento igual a</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="rg-valor">Texto procurado *</Label>
                  <Input
                    id="rg-valor"
                    placeholder="Ex: PIX, FORNECEDOR LTDA, 12345"
                    value={formRegra.matchValor}
                    onChange={(e) => setFormRegra({ ...formRegra, matchValor: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={formRegra.categoria || VAZIO}
                    onValueChange={(v) => setFormRegra({ ...formRegra, categoria: v === VAZIO ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VAZIO}>—</SelectItem>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <Select
                    value={formRegra.formaPagamento || VAZIO}
                    onValueChange={(v) => setFormRegra({ ...formRegra, formaPagamento: v === VAZIO ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VAZIO}>—</SelectItem>
                      {FORMAS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta do plano</Label>
                  <Select
                    value={formRegra.planoContaId || VAZIO}
                    onValueChange={(v) => setFormRegra({ ...formRegra, planoContaId: v === VAZIO ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VAZIO}>—</SelectItem>
                      {contasPlano
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Centro de custo</Label>
                  <Select
                    value={formRegra.centroCustoId || VAZIO}
                    onValueChange={(v) => setFormRegra({ ...formRegra, centroCustoId: v === VAZIO ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VAZIO}>—</SelectItem>
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
                <label className="flex items-end gap-2 pb-2 text-sm">
                  <Checkbox
                    checked={formRegra.ativo}
                    onCheckedChange={(v) => setFormRegra({ ...formRegra, ativo: v === true })}
                  />
                  Regra ativa
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormRegra(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={salvarRegra} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {formRegra?.id ? "Salvar" : "Criar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
