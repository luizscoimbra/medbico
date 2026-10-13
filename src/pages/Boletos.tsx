import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  CreditCard,
  Eye,
  Landmark,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Ticket,
  Trash2,
} from "lucide-react";
import { toDataURL as qrToDataURL } from "qrcode";
import { toast } from "sonner";
import { formatBRL, digitosParaMoeda, moedaParaCentavos } from "@/lib/utils";
import { codigoBarrasSvg } from "@/lib/barcode";
import { getAllClientes, type Cliente } from "@/lib/clienteStorage";
import {
  getAllContasBancarias,
  type ContaBancaria,
} from "@/lib/bankAccountsStorage";
import {
  baixarBoleto,
  cancelarBoleto,
  criarCarteira,
  deleteCarteira,
  emitirBoleto,
  getAllCarteiras,
  getAllDocumentos,
  getEventos,
  updateCarteira,
  type CarteiraCobranca,
  type DocumentoCobranca,
  type EventoCobranca,
} from "@/lib/boletoStorage";

const VAZIO = "__vazio";
const HOJE = () => new Date().toISOString().slice(0, 10);
const vencimentoPadrao = () => {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
};

const STATUS_DOC: Record<DocumentoCobranca["status"], { label: string; classe: string }> = {
  rascunho: { label: "Rascunho", classe: "bg-muted text-muted-foreground border-border/60" },
  emitido: { label: "Emitido", classe: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  pago: { label: "Pago", classe: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  cancelado: { label: "Cancelado", classe: "bg-destructive/10 text-destructive border-destructive/30" },
};

const nomeCliente = (c: Cliente) =>
  c.razaoSocial || c.nomeFantasia || c.nomeCompleto || "Cliente";

type FormCarteira = {
  id?: string;
  statusHomologacao?: CarteiraCobranca["statusHomologacao"];
  bankAccountId: string;
  nome: string;
  carteiraCodigo: string;
  convenio: string;
  modalidade: "boleto" | "hibrido";
  aceitaQrPix: boolean;
  chavePix: string;
  ambiente: "homologacao" | "producao";
  registroRemoto: boolean;
  ativo: boolean;
  observacao: string;
};

type FormEmissao = {
  bankAccountId: string;
  portfolioId: string;
  clienteId: string;
  sacadoNome: string;
  sacadoDocumento: string;
  sacadoEndereco: string;
  sacadoCidade: string;
  valor: string;
  vencimento: string;
  instrucoes: string;
};

const formCarteiraVazio = (contaId: string): FormCarteira => ({
  statusHomologacao: "pendente",
  bankAccountId: contaId,
  nome: "",
  carteiraCodigo: "",
  convenio: "",
  modalidade: "hibrido",
  aceitaQrPix: true,
  chavePix: "",
  ambiente: "homologacao",
  registroRemoto: false,
  ativo: true,
  observacao: "",
});

export default function Boletos() {
  const navigate = useNavigate();

  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [carteiras, setCarteiras] = useState<CarteiraCobranca[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCobranca[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  const [formCarteira, setFormCarteira] = useState<FormCarteira | null>(null);
  const [formEmissao, setFormEmissao] = useState<FormEmissao | null>(null);
  const [detalhe, setDetalhe] = useState<DocumentoCobranca | null>(null);
  const [eventos, setEventos] = useState<EventoCobranca[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [emissaoErro, setEmissaoErro] = useState("");

  const carregar = async () => {
    setCarregando(true);
    try {
      const [c, p, d] = await Promise.all([
        getAllContasBancarias(),
        getAllCarteiras(),
        getAllDocumentos(),
      ]);
      setContas(c);
      setCarteiras(p);
      setDocumentos(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar os boletos");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    getAllClientes()
      .then(setClientes)
      .catch(() => setClientes([]));
  }, []);

  // ── Carteiras ───────────────────────────────────────────────────────────
  const salvarCarteira = async () => {
    if (!formCarteira) return;
    if (!formCarteira.nome.trim()) {
      toast.error("Informe o nome da carteira");
      return;
    }
    if (!formCarteira.carteiraCodigo.trim()) {
      toast.error("Informe o código da carteira (ex.: 17, 109, 175)");
      return;
    }
    if (!formCarteira.bankAccountId) {
      toast.error("Selecione a conta bancária emissora");
      return;
    }
    setProcessando(true);
    try {
      const payload = {
        bankAccountId: formCarteira.bankAccountId,
        nome: formCarteira.nome.trim(),
        carteiraCodigo: formCarteira.carteiraCodigo.trim(),
        convenio: formCarteira.convenio.trim() || undefined,
        modalidade: formCarteira.modalidade,
        aceitaQrPix: formCarteira.aceitaQrPix,
        chavePix: formCarteira.chavePix.trim() || undefined,
        ambiente: formCarteira.ambiente,
        registroRemoto: formCarteira.registroRemoto,
        ativo: formCarteira.ativo,
        observacao: formCarteira.observacao.trim() || undefined,
      };
      if (formCarteira.id) {
        await updateCarteira(formCarteira.id, payload);
        toast.success("Carteira atualizada");
      } else {
        await criarCarteira(payload);
        toast.success("Carteira criada");
      }
      setFormCarteira(null);
      setCarteiras(await getAllCarteiras());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a carteira");
    } finally {
      setProcessando(false);
    }
  };

  const excluirCarteira = async () => {
    if (!formCarteira?.id) return;
    setProcessando(true);
    try {
      await deleteCarteira(formCarteira.id);
      toast.success("Carteira excluída");
      setFormCarteira(null);
      setCarteiras(await getAllCarteiras());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir a carteira");
    } finally {
      setProcessando(false);
    }
  };

  // ── Emissão ─────────────────────────────────────────────────────────────
  const abrirEmissao = () => {
    setEmissaoErro("");
    const conta = contas.find((c) => c.ativo) || contas[0];
    const carteiraPadrao = carteiras.find((p) => p.ativo && p.bankAccountId === conta?.id);
    setFormEmissao({
      bankAccountId: conta?.id || "",
      portfolioId: carteiraPadrao?.id || "",
      clienteId: "",
      sacadoNome: "",
      sacadoDocumento: "",
      sacadoEndereco: "",
      sacadoCidade: "",
      valor: "",
      vencimento: vencimentoPadrao(),
      instrucoes: "",
    });
  };

  const carteirasDaConta = carteiras.filter((p) => p.bankAccountId === formEmissao?.bankAccountId);

  /** Bloqueios reais: impedem a emissão. Avisos informativos ficam à parte. */
  const bloqueiosEmissao = useMemo(() => {
    if (!formEmissao) return [];
    const carteira = carteiras.find((p) => p.id === formEmissao.portfolioId);
    const conta = contas.find((c) => c.id === formEmissao.bankAccountId);
    const problemas: string[] = [];
    if (!conta) {
      problemas.push("Selecione a conta emissora.");
      return problemas;
    }
    if (!carteira) {
      problemas.push("Cadastre e selecione uma carteira de cobrança registrada no banco.");
      return problemas;
    }
    if (!carteira.ativo) problemas.push("A carteira está inativa.");
    if (carteira.modalidade === "hibrido" && !carteira.aceitaQrPix) {
      problemas.push("A carteira não aceita QR Code Pix (contrate a Cobrança Pix junto ao banco).");
    }
    if (carteira.modalidade === "hibrido" && !carteira.chavePix && !conta.chavePix) {
      problemas.push("Cadastre a chave Pix da carteira (ou da conta) para emitir o boleto híbrido.");
    }
    return problemas;
  }, [formEmissao, carteiras, contas]);

  /** O que não impede emitir, mas precisa estar visível antes de assinar. */
  const avisosEmissao = useMemo(() => {
    if (!formEmissao) return [];
    const carteira = carteiras.find((p) => p.id === formEmissao.portfolioId);
    if (!carteira) return [];
    const avisos: string[] = [];
    if (carteira.statusHomologacao !== "homologado") {
      avisos.push(
        "Carteira em homologação: os testes de emissão e baixa são justamente a etapa de homologação junto ao banco."
      );
    }
    if (carteira.ambiente === "homologacao") {
      avisos.push("Emissão em ambiente de homologação (sem valor legal).");
    }
    if (!formEmissao.instrucoes.trim()) {
      avisos.push("Sem instruções no boleto (multa/juros podem ser exigidas pelo banco).");
    }
    return avisos;
  }, [formEmissao, carteiras]);

  const emitir = async () => {
    if (!formEmissao) return;
    if (!formEmissao.portfolioId) {
      toast.error("Selecione a carteira de cobrança");
      return;
    }
    if (!formEmissao.sacadoNome.trim()) {
      toast.error("Informe o sacado");
      return;
    }
    const valor = moedaParaCentavos(formEmissao.valor) / 100;
    if (valor <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    setProcessando(true);
    setEmissaoErro("");
    try {
      const doc = await emitirBoleto({
        bankAccountId: formEmissao.bankAccountId,
        portfolioId: formEmissao.portfolioId,
        valor,
        vencimento: formEmissao.vencimento,
        sacadoNome: formEmissao.sacadoNome.trim(),
        sacadoDocumento: formEmissao.sacadoDocumento.trim() || undefined,
        sacadoEndereco: formEmissao.sacadoEndereco.trim() || undefined,
        sacadoCidade: formEmissao.sacadoCidade.trim() || undefined,
        instrucoes: formEmissao.instrucoes.trim() || undefined,
      });
      toast.success(`Boleto nº ${doc.numeroDocumento} emitido`);
      setFormEmissao(null);
      await carregar();
      abrirDetalhe(doc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao emitir o boleto";
      setEmissaoErro(msg);
      toast.error(msg);
    } finally {
      setProcessando(false);
    }
  };

  // ── Detalhe / impressão ─────────────────────────────────────────────────
  const abrirDetalhe = async (doc: DocumentoCobranca) => {
    setDetalhe(doc);
    setQrDataUrl("");
    setEventos([]);
    try {
      const [ev, qr] = await Promise.all([
        getEventos(doc.id),
        doc.qrCodePix
          ? qrToDataURL(doc.qrCodePix, { errorCorrectionLevel: "M", margin: 1, width: 220 })
          : Promise.resolve(""),
      ]);
      setEventos(ev);
      setQrDataUrl(qr);
    } catch {
      // QR/código de barras continuam indisponíveis; os dados numéricos ficam.
    }
  };

  const marcarPago = async (doc: DocumentoCobranca) => {
    setProcessando(true);
    try {
      await baixarBoleto(doc.id, "Baixa manual pela tela de boletos");
      toast.success("Boleto baixado como pago");
      await carregar();
      setDetalhe(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar o boleto");
    } finally {
      setProcessando(false);
    }
  };

  const cancelarDocumento = async (doc: DocumentoCobranca) => {
    setProcessando(true);
    try {
      await cancelarBoleto(doc.id, "Cancelado pela tela de boletos");
      toast.success("Boleto cancelado");
      await carregar();
      setDetalhe(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar o boleto");
    } finally {
      setProcessando(false);
    }
  };

  const codigoBarrasHtml = useMemo(() => {
    if (!detalhe) return "";
    try {
      return codigoBarrasSvg(detalhe.codigoBarras, { altura: 60, escala: 2 });
    } catch {
      return "";
    }
  }, [detalhe]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/financeiro")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-foreground">Boletos e Cobrança</h1>
            <p className="text-sm text-muted-foreground">
              Emissão com QR Code Pix (boleto híbrido) registrado no banco
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/plano-de-contas">
            <Button variant="outline" size="sm">Plano de contas</Button>
          </Link>
          <Link to="/conciliacao">
            <Button variant="outline" size="sm">Conciliação</Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="boletos">
        <TabsList className="mb-4 no-print">
          <TabsTrigger value="boletos" className="gap-2">
            <Ticket className="h-4 w-4" /> Boletos ({documentos.length})
          </TabsTrigger>
          <TabsTrigger value="carteiras" className="gap-2">
            <Layers className="h-4 w-4" /> Carteiras ({carteiras.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Boletos ─────────────────────────────────────────────────── */}
        <TabsContent value="boletos" className="mt-0">
          <div className="flex justify-end mb-4 no-print">
            <Button size="sm" onClick={abrirEmissao} disabled={carregando}>
              <Plus className="h-4 w-4 mr-1" /> Emitir boleto
            </Button>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Documentos de cobrança
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : documentos.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Nenhum boleto emitido. Cadastre a carteira do banco e clique em{" "}
                  <strong>Emitir boleto</strong>.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Nosso nº</th>
                        <th className="px-4 py-3 text-left font-semibold">Sacado</th>
                        <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                        <th className="px-4 py-3 text-right font-semibold">Valor</th>
                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                        <th className="px-4 py-3 text-center font-semibold">Ambiente</th>
                        <th className="px-4 py-3 text-center font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {documentos.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-xs">
                            {d.nossoNumero}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{d.sacadoNome}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {d.sacadoDocumento || "s/ documento"}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(d.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap">
                            {formatBRL(d.valor)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${STATUS_DOC[d.status].classe}`}>
                              {STATUS_DOC[d.status].label}
                            </Badge>
                            {d.qrCodePix && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                QR {d.qrCodeModo === "dinamico" ? "dinâmico" : "estático"}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {d.ambiente}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Ver boleto"
                                onClick={() => abrirDetalhe(d)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {d.status === "emitido" && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-emerald-600"
                                    title="Marcar como pago"
                                    onClick={() => marcarPago(d)}
                                    disabled={processando}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    title="Cancelar boleto"
                                    onClick={() => cancelarDocumento(d)}
                                    disabled={processando}
                                  >
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
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

        {/* ── Carteiras ───────────────────────────────────────────────── */}
        <TabsContent value="carteiras" className="mt-0">
          <div className="flex justify-end mb-4">
            <Button
              size="sm"
              onClick={() => setFormCarteira(formCarteiraVazio(contas[0]?.id || ""))}
              disabled={!contas.length}
            >
              <Plus className="h-4 w-4 mr-1" /> Nova carteira
            </Button>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Landmark className="h-5 w-5 text-primary" />
                Carteiras de cobrança
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!contas.length && !carregando ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Cadastre uma conta bancária na{" "}
                  <Link to="/conciliacao" className="text-primary underline">
                    Conciliação
                  </Link>{" "}
                  antes de criar a carteira.
                </div>
              ) : carteiras.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Nenhuma carteira. A carteira é o convênio de cobrança registrado no banco —
                  sem ela o sistema não tem como gerar nosso número nem código de barras.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Nome</th>
                        <th className="px-4 py-3 text-left font-semibold">Conta</th>
                        <th className="px-4 py-3 text-left font-semibold">Carteira</th>
                        <th className="px-4 py-3 text-left font-semibold">Convênio</th>
                        <th className="px-4 py-3 text-center font-semibold">Modalidade</th>
                        <th className="px-4 py-3 text-center font-semibold">Homologação</th>
                        <th className="px-4 py-3 text-center font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {carteiras.map((p) => {
                        const conta = contas.find((c) => c.id === p.bankAccountId);
                        return (
                          <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{p.nome}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {conta ? `${conta.codigoBanco} · ${conta.nomeBanco}` : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">{p.carteiraCodigo}</td>
                            <td className="px-4 py-3 font-mono text-xs">{p.convenio || "—"}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  p.modalidade === "hibrido"
                                    ? "bg-violet-500/10 text-violet-600 border-violet-500/30"
                                    : "bg-muted text-muted-foreground border-border/60"
                                }`}
                              >
                                {p.modalidade === "hibrido" ? "Boleto + Pix" : "Somente boleto"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  p.statusHomologacao === "homologado"
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                    : p.statusHomologacao === "reprovado"
                                      ? "bg-destructive/10 text-destructive border-destructive/30"
                                      : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                }`}
                              >
                                {p.statusHomologacao === "homologado"
                                  ? "Homologada"
                                  : p.statusHomologacao === "reprovado"
                                    ? "Reprovada"
                                    : "Em homologação"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Editar carteira"
                                  onClick={() =>
                                    setFormCarteira({
                                      id: p.id,
                                      bankAccountId: p.bankAccountId,
                                      nome: p.nome,
                                      carteiraCodigo: p.carteiraCodigo,
                                      convenio: p.convenio || "",
                                      modalidade: p.modalidade,
                                      aceitaQrPix: p.aceitaQrPix,
                                      chavePix: p.chavePix || "",
                                      ambiente: p.ambiente,
                                      registroRemoto: p.registroRemoto,
                                      ativo: p.ativo,
                                      observacao: p.observacao || "",
                                    })
                                  }
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  title="Excluir carteira"
                                  onClick={() =>
                                    setFormCarteira({
                                      ...formCarteiraVazio(p.bankAccountId),
                                      id: p.id,
                                      nome: p.nome,
                                    })
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: carteira */}
      <Dialog open={!!formCarteira} onOpenChange={(open) => !open && !processando && setFormCarteira(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              {formCarteira?.id ? "Editar carteira" : "Nova carteira de cobrança"}
            </DialogTitle>
            <DialogDescription>
              Dados do convênio informados pelo banco na contratação da cobrança.
            </DialogDescription>
          </DialogHeader>
          {formCarteira && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>Conta bancária emissora *</Label>
                <Select
                  value={formCarteira.bankAccountId || VAZIO}
                  onValueChange={(v) =>
                    setFormCarteira({
                      ...formCarteira,
                      bankAccountId: v === VAZIO ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VAZIO}>Selecione...</SelectItem>
                    {contas.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigoBanco} · {c.nomeBanco} · {c.conta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="pf-nome">Nome da carteira *</Label>
                  <Input
                    id="pf-nome"
                    placeholder="Ex: Cobrança CNAB 400"
                    value={formCarteira.nome}
                    onChange={(e) => setFormCarteira({ ...formCarteira, nome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pf-cod">Carteira *</Label>
                  <Input
                    id="pf-cod"
                    placeholder="17"
                    value={formCarteira.carteiraCodigo}
                    onChange={(e) => setFormCarteira({ ...formCarteira, carteiraCodigo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pf-conv">Convênio</Label>
                  <Input
                    id="pf-conv"
                    placeholder="Ex: 123456"
                    value={formCarteira.convenio}
                    onChange={(e) => setFormCarteira({ ...formCarteira, convenio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select
                    value={formCarteira.ambiente}
                    onValueChange={(v) =>
                      setFormCarteira({ ...formCarteira, ambiente: v as "homologacao" | "producao" })
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

              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select
                  value={formCarteira.modalidade}
                  onValueChange={(v) =>
                    setFormCarteira({ ...formCarteira, modalidade: v as "boleto" | "hibrido" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hibrido">Boleto híbrido (com QR Code Pix)</SelectItem>
                    <SelectItem value="boleto">Somente boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pf-pix">Chave Pix da carteira (QR estático)</Label>
                <Input
                  id="pf-pix"
                  placeholder="CNPJ, e-mail ou aleatória"
                  value={formCarteira.chavePix}
                  onChange={(e) => setFormCarteira({ ...formCarteira, chavePix: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Fica vazio para usar a chave da conta. Em QR dinâmico a chave vem da API do banco.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Situação junto ao banco</Label>
                <Select
                  value={formCarteira.statusHomologacao || "pendente"}
                  onValueChange={(v) =>
                    setFormCarteira({
                      ...formCarteira,
                      statusHomologacao: v as CarteiraCobranca["statusHomologacao"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Em homologação</SelectItem>
                    <SelectItem value="homologado">Homologada (liberada para produção)</SelectItem>
                    <SelectItem value="reprovado">Reprovada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formCarteira.aceitaQrPix}
                    onCheckedChange={(v) => setFormCarteira({ ...formCarteira, aceitaQrPix: v === true })}
                  />
                  Aceita QR Code Pix
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formCarteira.registroRemoto}
                    onCheckedChange={(v) =>
                      setFormCarteira({ ...formCarteira, registroRemoto: v === true })
                    }
                  />
                  Registro remoto no banco
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formCarteira.ativo}
                    onCheckedChange={(v) => setFormCarteira({ ...formCarteira, ativo: v === true })}
                  />
                  Ativa
                </label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pf-obs">Observação</Label>
                <Input
                  id="pf-obs"
                  value={formCarteira.observacao}
                  onChange={(e) => setFormCarteira({ ...formCarteira, observacao: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {formCarteira?.id && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={excluirCarteira}
                disabled={processando}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
            <Button variant="ghost" onClick={() => setFormCarteira(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={salvarCarteira} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {formCarteira?.id ? "Salvar" : "Criar carteira"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: emissão */}
      <Dialog open={!!formEmissao} onOpenChange={(open) => !open && !processando && setFormEmissao(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-primary" />
              Emitir boleto
            </DialogTitle>
            <DialogDescription>
              Gera nosso número, código de barras, linha digitável e o QR Code Pix.
            </DialogDescription>
          </DialogHeader>
          {formEmissao && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Conta emissora *</Label>
                  <Select
                    value={formEmissao.bankAccountId || VAZIO}
                    onValueChange={(v) =>
                      setFormEmissao({
                        ...formEmissao,
                        bankAccountId: v === VAZIO ? "" : v,
                        portfolioId: "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VAZIO}>Selecione...</SelectItem>
                      {contas
                        .filter((c) => c.ativo)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.codigoBanco} · {c.nomeBanco} · {c.conta}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Carteira *</Label>
                  <Select
                    value={formEmissao.portfolioId || VAZIO}
                    onValueChange={(v) =>
                      setFormEmissao({ ...formEmissao, portfolioId: v === VAZIO ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={VAZIO}>Selecione...</SelectItem>
                      {carteirasDaConta
                        .filter((p) => p.ativo)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} · carteira {p.carteiraCodigo}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sacado (cliente)</Label>
                <Select
                  value={formEmissao.clienteId || VAZIO}
                  onValueChange={(v) => {
                    const id = v === VAZIO ? "" : v;
                    const c = clientes.find((x) => x.id === id);
                    setFormEmissao({
                      ...formEmissao,
                      clienteId: id,
                      sacadoNome: c ? nomeCliente(c) : formEmissao.sacadoNome,
                      sacadoDocumento: c ? c.cnpj || c.cpf || "" : formEmissao.sacadoDocumento,
                      sacadoEndereco: c ? c.endereco || "" : formEmissao.sacadoEndereco,
                      sacadoCidade: c ? c.cidade || "" : formEmissao.sacadoCidade,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher do cadastro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VAZIO}>Digitar manualmente</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {nomeCliente(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="em-nome">Nome do sacado *</Label>
                  <Input
                    id="em-nome"
                    value={formEmissao.sacadoNome}
                    onChange={(e) => setFormEmissao({ ...formEmissao, sacadoNome: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="em-doc">CPF/CNPJ</Label>
                  <Input
                    id="em-doc"
                    value={formEmissao.sacadoDocumento}
                    onChange={(e) => setFormEmissao({ ...formEmissao, sacadoDocumento: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="em-end">Endereço</Label>
                  <Input
                    id="em-end"
                    value={formEmissao.sacadoEndereco}
                    onChange={(e) => setFormEmissao({ ...formEmissao, sacadoEndereco: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="em-cid">Município</Label>
                  <Input
                    id="em-cid"
                    value={formEmissao.sacadoCidade}
                    onChange={(e) => setFormEmissao({ ...formEmissao, sacadoCidade: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="em-valor">Valor (R$) *</Label>
                  <Input
                    id="em-valor"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formEmissao.valor}
                    onChange={(e) => setFormEmissao({ ...formEmissao, valor: digitosParaMoeda(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="em-venc">Vencimento *</Label>
                  <Input
                    id="em-venc"
                    type="date"
                    value={formEmissao.vencimento}
                    onChange={(e) => setFormEmissao({ ...formEmissao, vencimento: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="em-inst">Instruções no boleto</Label>
                <Input
                  id="em-inst"
                  placeholder="Ex: Multa de 2% após o vencimento"
                  value={formEmissao.instrucoes}
                  onChange={(e) => setFormEmissao({ ...formEmissao, instrucoes: e.target.value })}
                />
              </div>

              {(avisosEmissao.length > 0 || emissaoErro || bloqueiosEmissao.length > 0) && (
                <div
                  className={`rounded-lg border p-3 text-xs space-y-1 ${
                    bloqueiosEmissao.length > 0 || emissaoErro
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-700"
                  }`}
                >
                  <p className="font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {bloqueiosEmissao.length > 0 || emissaoErro ? "Não é possível emitir" : "Antes de emitir"}
                  </p>
                  {emissaoErro && <p>{emissaoErro}</p>}
                  {bloqueiosEmissao.map((p) => (
                    <p key={p}>• {p}</p>
                  ))}
                  {avisosEmissao.map((p) => (
                    <p key={p}>• {p}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormEmissao(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={emitir} disabled={processando || bloqueiosEmissao.length > 0}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Emitir boleto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: detalhe / impressão */}
      <Dialog
        open={!!detalhe}
        onOpenChange={(open) => {
          if (!open) setDetalhe(null);
        }}
      >
        <DialogContent className="boleto-dialog sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Boleto nº {detalhe?.numeroDocumento}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              {detalhe && (
                <Badge variant="outline" className={`text-[10px] ${STATUS_DOC[detalhe.status].classe}`}>
                  {STATUS_DOC[detalhe.status].label}
                </Badge>
              )}
              {detalhe && (
                <span className="text-xs capitalize">
                  {detalhe.ambiente} · gerado {detalhe.geracao === "local" ? "localmente" : "pelo banco"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detalhe && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Beneficiário</p>
                  <p className="font-medium">{detalhe.beneficiarioNome}</p>
                  {detalhe.beneficiarioDocumento && (
                    <p className="text-[11px] text-muted-foreground">{detalhe.beneficiarioDocumento}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Sacado</p>
                  <p className="font-medium">{detalhe.sacadoNome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[detalhe.sacadoDocumento, detalhe.sacadoEndereco, detalhe.sacadoCidade]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="font-medium">
                    {new Date(detalhe.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-heading font-bold text-lg">{formatBRL(detalhe.valor)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nosso número</p>
                  <p className="font-mono font-medium">{detalhe.nossoNumero}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Espécie / aceite</p>
                  <p className="font-medium">
                    {detalhe.especie} · {detalhe.aceite === "S" ? "Aceito" : "Não aceito"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground mb-1">Linha digitável</p>
                <p className="font-mono text-sm font-semibold break-all">{detalhe.linhaDigitavel}</p>
              </div>

              {codigoBarrasHtml && (
                <div
                  className="rounded-lg border border-border/60 p-2 flex justify-center overflow-hidden [&>svg]:w-full [&>svg]:max-w-[420px]"
                  dangerouslySetInnerHTML={{ __html: codigoBarrasHtml }}
                />
              )}

              {qrDataUrl ? (
                <div className="flex items-center gap-4 rounded-lg border border-border/60 p-3">
                  <img src={qrDataUrl} alt="QR Code Pix" className="h-40 w-40" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground flex items-center gap-1 text-sm">
                      <QrCode className="h-4 w-4" /> Pague com Pix
                    </p>
                    <p>
                      QR Code {detalhe.qrCodeModo === "dinamico" ? "dinâmico (API do banco)" : "estático (chave Pix da conta)"}.
                    </p>
                    <p className="break-all">{detalhe.qrCodePix}</p>
                  </div>
                </div>
              ) : (
                detalhe.qrCodePix && (
                  <div className="rounded-lg border border-border/60 p-3 text-xs break-all">
                    BR Code: {detalhe.qrCodePix}
                  </div>
                )
              )}

              {detalhe.instrucoes && (
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Instruções</p>
                  <p>{detalhe.instrucoes}</p>
                </div>
              )}

              {eventos.length > 0 && (
                <div className="no-print">
                  <p className="text-xs text-muted-foreground mb-1">Histórico do boleto</p>
                  <ul className="space-y-1 text-xs">
                    {eventos.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <span>
                          <span className="font-medium capitalize">{e.evento}</span>
                          {e.detalhe ? ` · ${e.detalhe}` : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(e.criadoEm).toLocaleString("pt-BR")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="no-print gap-2 sm:gap-0 flex-wrap">
            <Button variant="outline" onClick={() => setDetalhe(null)}>
              Fechar
            </Button>
            {detalhe?.status === "emitido" && (
              <>
                <Button
                  variant="outline"
                  className="text-emerald-600 border-emerald-500/40"
                  onClick={() => marcarPago(detalhe)}
                  disabled={processando}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Baixar (pago)
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/40"
                  onClick={() => cancelarDocumento(detalhe)}
                  disabled={processando}
                >
                  <Ban className="h-4 w-4 mr-1" /> Cancelar
                </Button>
              </>
            )}
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
