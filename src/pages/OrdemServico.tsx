import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OSForm } from "@/components/os/OSForm";
import { OSPreview } from "@/components/os/OSPreview";
import { OSApontamento } from "@/components/os/OSApontamento";
import { OSApontamentoPreview } from "@/components/os/OSApontamentoPreview";
import { generateOSId, saveOS, getAllOS, deleteOS, type OrdemServico as OSType, type TalhaoData } from "@/lib/osStorage";
import { Printer, FileDown, Share2, ArrowLeft, ArrowRight, History, ClipboardCheck, Trash2, Wallet, CheckCircle2, Banknote, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Link, useSearchParams } from "react-router-dom";
import { getAllEquipments, Equipment } from "@/lib/equipmentStorage";
import {
  abastecimentosDaOS,
  getAllAbastecimentos,
  totalAbastecimento,
  type Abastecimento,
} from "@/lib/equipmentFuelStorage";
import { getAllClientes, Cliente } from "@/lib/clienteStorage";
import { supabase } from "@/integrations/supabase/client";
import type { ServicoOS } from "@/lib/osStorage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/utils";
import {
  criarTituloReceber,
  getAllTitulos,
  TituloReceber,
  valorFaturavelOS,
} from "@/lib/financeiroStorage";

type View = "form" | "preview" | "history" | "apontamento" | "apontamento-preview";

// ── Máscara monetária "R$ 00.000,00" (duas casas decimais) ───────
// Se a 3ª casa decimal for maior que 5, o valor é arredondado para cima.
function arredondarDuasCasas(valor: number): number {
  if (!isFinite(valor)) return 0;
  const negativo = valor < 0;
  const abs = Math.abs(valor);
  const [inteiro, decimal = "0"] = abs.toFixed(6).split(".");
  const duasCasas = decimal.slice(0, 2).padEnd(2, "0");
  const terceiraCasa = Number(decimal[2] ?? "0");
  let centavos = Number(inteiro) * 100 + Number(duasCasas);
  if (terceiraCasa > 5) centavos += 1;
  return (negativo ? -centavos : centavos) / 100;
}

function mascaraMoeda(valor: number): string {
  return formatBRL(arredondarDuasCasas(valor));
}

/** Converte dígitos digitados (centavos) para o texto "R$ 0.000,00". */
function digitosParaMoeda(digitos: string): string {
  const limpo = digitos.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!limpo) return "";
  return formatBRL((parseInt(limpo, 10) || 0) / 100);
}

/** Extrai os centavos do texto mascarado "R$ 0.000,00". */
function moedaParaCentavos(texto: string): number {
  const limpo = texto.replace(/\D/g, "");
  return limpo ? parseInt(limpo, 10) : 0;
}

export default function OrdemServico() {
  const [view, setView] = useState<View>("form");
  const [currentOS, setCurrentOS] = useState<OSType | null>(null);
  const [historico, setHistorico] = useState<OSType[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const apontamentoRef = useRef<HTMLDivElement>(null);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);

  const loadAbastecimentos = async () => {
    try {
      setAbastecimentos(await getAllAbastecimentos());
    } catch {
      setAbastecimentos([]);
    }
  };

  // Form state
  const [propriedade, setPropriedade] = useState("");
  const [osExterna, setOsExterna] = useState("");
  const [codigoArea, setCodigoArea] = useState("");
  const [dataOS, setDataOS] = useState(new Date().toISOString().slice(0, 10));
  const [responsavelTecnico, setResponsavelTecnico] = useState("");
  const [tipoAplicacao, setTipoAplicacao] = useState("");
  const [codigoAplicacao, setCodigoAplicacao] = useState("");
  const [volumeCaldaHa, setVolumeCaldaHa] = useState("");
  const [coordenadas, setCoordenadas] = useState("");
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [selectedClienteNome, setSelectedClienteNome] = useState("");
  const [servicosDisponiveis, setServicosDisponiveis] = useState<any[]>([]);
  const [servicosOS, setServicosOS] = useState<ServicoOS[]>([]);
  const [talhoes, setTalhoes] = useState<TalhaoData[]>([
    { nome: "", area: "", produtos: [{ produto: "", dose: "" }], testemunho: false, testemunhoArea: "", testeProduto: false, produtoTeste: "", produtoTesteQtd: "" },
  ]);

  useEffect(() => {
    getAllEquipments().then(setEquipments);
    getAllClientes().then(setClientes);
    loadAbastecimentos();
    supabase.from("services").select("*").order("descricao").then(({ data }) => {
      if (data) setServicosDisponiveis(data);
    });
  }, []);

  // ── Faturamento — Contas a Receber ─────────────────────────────
  const [searchParams] = useSearchParams();
  const [titulos, setTitulos] = useState<TituloReceber[]>([]);
  const [showFaturarDialog, setShowFaturarDialog] = useState(false);
  const [fatValor, setFatValor] = useState("");
  const [fatVencimento, setFatVencimento] = useState("");
  const [fatObs, setFatObs] = useState("");
  const [fatStep, setFatStep] = useState<"form" | "resumo" | "ok">("form");
  const [fatSalvando, setFatSalvando] = useState(false);
  const [fatErro, setFatErro] = useState("");
  const [fatTituloOk, setFatTituloOk] = useState<TituloReceber | null>(null);

  const loadTitulos = async () => setTitulos(await getAllTitulos());

  useEffect(() => {
    loadTitulos();
  }, []);

  // Abre uma OS específica vinda do módulo financeiro (/ordem-servico?os=ID)
  useEffect(() => {
    const osId = searchParams.get("os");
    if (!osId) return;
    getAllOS().then((all) => {
      const found = all.find((o) => o.id === osId);
      if (found) {
        setCurrentOS(found);
        setView("preview");
      } else {
        toast.error(`OS ${osId} não encontrada`);
      }
    });
  }, [searchParams]);

  const tituloDaOS = currentOS ? titulos.find((t) => t.osId === currentOS.id) : undefined;

  // Abastecimentos vinculados à OS atual (custo agregado ao vivo)
  const abastecimentosOS = currentOS ? abastecimentosDaOS(abastecimentos, currentOS.id) : [];
  const totalAbastecimentosOS = totalAbastecimento(abastecimentosOS);

  const abrirFaturar = () => {
    if (!currentOS) return;
    if (currentOS.status !== "concluida") {
      toast.error("A OS precisa estar concluída para ser faturada");
      return;
    }
    const venc = new Date();
    venc.setDate(venc.getDate() + 30);
    setFatValor(mascaraMoeda(valorFaturavelOS(currentOS) + totalAbastecimentosOS));
    setFatVencimento(venc.toISOString().slice(0, 10));
    setFatObs("");
    setFatStep("form");
    setFatErro("");
    setFatSalvando(false);
    setFatTituloOk(null);
    setShowFaturarDialog(true);
  };

  // Etapa 1 → valida e abre o resumo de confirmação
  const irParaResumo = () => {
    if (!currentOS) return;
    const centavos = moedaParaCentavos(fatValor);
    if (centavos <= 0) {
      setFatErro(
        "Valor a cobrar não informado. Informe um valor maior que zero para faturar."
      );
      return;
    }
    setFatErro("");
    setFatStep("resumo");
  };

  // Etapa 2 → envia o título para o módulo Financeiro (Contas a Receber)
  const confirmarFaturar = async () => {
    if (!currentOS || fatSalvando) return;
    const valor = moedaParaCentavos(fatValor) / 100;
    if (valor <= 0) {
      setFatErro("Valor a cobrar não informado.");
      setFatStep("form");
      return;
    }
    setFatSalvando(true);
    try {
      const escrita = (async () => {
        const titulo = await criarTituloReceber({
          clienteId: currentOS.clienteId,
          clienteNome: currentOS.clienteNome || currentOS.propriedade || "Cliente não informado",
          descricao: `Faturamento OS ${currentOS.id}`,
          valor,
          osId: currentOS.id,
          dataVencimento: fatVencimento || undefined,
          observacao: fatObs || undefined,
        });
        await loadTitulos();
        return titulo;
      })();
      const titulo = await Promise.race([
        escrita,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Tempo esgotado ao gravar o título")), 8000)
        ),
      ]);
      setFatTituloOk(titulo);
      setFatStep("ok");
      toast.success(
        `OS ${currentOS.id} faturada! Título nº ${titulo.numero} enviado para o Financeiro — Contas a Receber.`
      );
    } catch (error) {
      console.error("Erro ao faturar OS:", error);
      setFatErro("Não foi possível faturar. Verifique o valor e tente novamente.");
      toast.error(
        `Erro ao faturar a OS: ${error instanceof Error ? error.message : "falha desconhecida"}`
      );
    } finally {
      setFatSalvando(false);
    }
  };

  // Bloco de faturamento (exibido somente em OS concluída)
  const FaturarBlock = currentOS?.status === "concluida" && (
    <div className="flex items-center gap-3 flex-wrap mb-4 no-print bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
      <Wallet className="h-4 w-4 text-emerald-600 shrink-0" />
      {tituloDaOS ? (
        <>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Faturada — Título nº {tituloDaOS.numero}
          </Badge>
          <span className="text-sm text-muted-foreground">{formatBRL(tituloDaOS.valor)}</span>
          <Link to="/financeiro" className="text-sm font-medium text-primary hover:underline">
            Ver no Financeiro
          </Link>
        </>
      ) : (
        <>
          <span className="text-sm text-muted-foreground flex-1 min-w-[180px]">
            OS concluída — gere a cobrança para o cliente.
          </span>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={abrirFaturar}>
            <Wallet className="h-4 w-4 mr-2" /> Faturar Ordem de Serviço
          </Button>
        </>
      )}
    </div>
  );

  const handleGenerate = async () => {
    if (!propriedade.trim()) {
      toast.error("Informe o nome da propriedade");
      return;
    }
    const id = await generateOSId();
    const os: OSType = {
      id,
      osExterna: osExterna || undefined,
      data: dataOS,
      propriedade,
      codigoArea,
      responsavelTecnico,
      aplicador: "",
      tipoAplicacao: tipoAplicacao || undefined,
      codigoAplicacao: codigoAplicacao || undefined,
      talhoes,
      createdAt: new Date().toISOString(),
      volumeCaldaHa: volumeCaldaHa || undefined,
      coordenadas,
      status: "aberta",
      equipamentos: selectedEquipments,
      clienteId: selectedClienteId || undefined,
      clienteNome: selectedClienteNome || undefined,
      servicos: servicosOS.length > 0 ? servicosOS : undefined,
    };
    await saveOS(os);
    setCurrentOS(os);
    setView("preview");
    toast.success(`OS ${id} gerada com sucesso!`);
  };

  const handlePrint = () => window.print();

  const handlePDF = async (targetRef: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!targetRef.current) return;
    toast.info("Gerando PDF...");
    const canvas = await html2canvas(targetRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;

    // Handle multi-page if content is taller than A4
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

    pdf.save(filename);
    toast.success("PDF salvo!");
  };

  const handleShare = async (targetRef: React.RefObject<HTMLDivElement>, title: string) => {
    if (!targetRef.current) return;
    try {
      const canvas = await html2canvas(targetRef.current, { scale: 2, useCORS: true });
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const file = new File([blob], `${title}.png`, { type: "image/png" });

      if (navigator.share) {
        await navigator.share({ title, files: [file] });
      } else {
        toast.error("Compartilhamento não suportado neste navegador");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Erro ao compartilhar");
    }
  };

  const loadHistorico = async () => {
    const all = await getAllOS();
    setHistorico(all);
    setView("history");
  };

  const viewOS = (os: OSType) => {
    setCurrentOS(os);
    setView("preview");
  };

  const handleDeleteOS = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja excluir a OS ${id}?`)) {
      await deleteOS(id);
      const all = await getAllOS();
      setHistorico(all);
      toast.success(`OS ${id} excluída com sucesso!`);
    }
  };

  const resetForm = () => {
    setPropriedade("");
    setOsExterna("");
    setCodigoArea("");
    setDataOS(new Date().toISOString().slice(0, 10));
    setResponsavelTecnico("");
    setTipoAplicacao("");
    setCodigoAplicacao("");
    setVolumeCaldaHa("");
    setCoordenadas("");
    setTalhoes([{ nome: "", area: "", produtos: [{ produto: "", dose: "" }], testemunho: false, testemunhoArea: "", testeProduto: false, produtoTeste: "", produtoTesteQtd: "" }]);
    setSelectedEquipments([]);
    setSelectedClienteId("");
    setSelectedClienteNome("");
    setServicosOS([]);
    setCurrentOS(null);
    setView("form");
  };

  const ExportButtons = ({ targetRef, filename }: { targetRef: React.RefObject<HTMLDivElement>; filename: string }) => (
    <div className="flex flex-wrap gap-2 mb-4 no-print">
      <Button onClick={handlePrint} variant="outline" size="sm">
        <Printer className="h-4 w-4 mr-1" /> Imprimir
      </Button>
      <Button onClick={() => handlePDF(targetRef, `${filename}.pdf`)} variant="outline" size="sm">
        <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
      </Button>
      <Button onClick={() => handleShare(targetRef, filename)} variant="outline" size="sm">
        <Share2 className="h-4 w-4 mr-1" /> Compartilhar
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-2xl font-heading text-foreground">Ordem de Serviço</h1>
        </div>
        <div className="flex gap-2">
          {view !== "form" && (
            <Button variant="outline" size="sm" onClick={resetForm}>Nova OS</Button>
          )}
          <Button variant="secondary" size="sm" onClick={loadHistorico}>
            <History className="h-4 w-4 mr-1" /> Histórico
          </Button>
        </div>
      </div>

      {/* Form View */}
      {view === "form" && (
        <OSForm
          propriedade={propriedade} setPropriedade={setPropriedade}
          osExterna={osExterna} setOsExterna={setOsExterna}
          codigoArea={codigoArea} setCodigoArea={setCodigoArea}
          dataOS={dataOS} setDataOS={setDataOS}
          responsavelTecnico={responsavelTecnico} setResponsavelTecnico={setResponsavelTecnico}
          tipoAplicacao={tipoAplicacao} setTipoAplicacao={setTipoAplicacao}
          codigoAplicacao={codigoAplicacao} setCodigoAplicacao={setCodigoAplicacao}
          talhoes={talhoes} setTalhoes={setTalhoes}
          volumeCaldaHa={volumeCaldaHa} setVolumeCaldaHa={setVolumeCaldaHa}
          coordenadas={coordenadas} setCoordenadas={setCoordenadas}
          equipamentos={selectedEquipments} setEquipamentos={setSelectedEquipments}
          availableEquipments={equipments}
          clientes={clientes}
          selectedClienteId={selectedClienteId} setSelectedClienteId={setSelectedClienteId}
          selectedClienteNome={selectedClienteNome} setSelectedClienteNome={setSelectedClienteNome}
          servicosDisponiveis={servicosDisponiveis}
          servicosOS={servicosOS} setServicosOS={setServicosOS}
          onGenerate={handleGenerate}
        />
      )}

      {/* Preview View */}
      {view === "preview" && currentOS && (
        <div>
          <ExportButtons targetRef={printRef} filename={`OS-${currentOS.id}`} />
          <div className="flex gap-2 mb-4 no-print">
            <Button
              onClick={() => setView("apontamento")}
              variant="default"
              size="sm"
            >
              <ClipboardCheck className="h-4 w-4 mr-1" /> Apontamento
            </Button>
          </div>
          {FaturarBlock}
          <OSPreview
            ref={printRef}
            os={currentOS}
            abastecimentos={abastecimentosOS}
          />
        </div>
      )}

      {/* Apontamento View */}
      {view === "apontamento" && currentOS && (
        <div>
          {FaturarBlock}
          <OSApontamento
            os={currentOS}
            abastecimentos={abastecimentosOS}
            onAbastecimentosChange={loadAbastecimentos}
            onSaved={(updated) => setCurrentOS(updated)}
            onViewReport={() => setView("apontamento-preview")}
          />
        </div>
      )}

      {/* Apontamento Preview View */}
      {view === "apontamento-preview" && currentOS && (
        <div>
          <ExportButtons targetRef={apontamentoRef} filename={`Apontamento-OS-${currentOS.id}`} />
          <div className="flex gap-2 mb-4 no-print">
            <Button variant="outline" size="sm" onClick={() => setView("apontamento")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Apontamento
            </Button>
          </div>
          {FaturarBlock}
          <OSApontamentoPreview ref={apontamentoRef} os={currentOS} equipments={equipments} />
        </div>
      )}

      {/* History View */}
      {view === "history" && (
        <div className="space-y-3">
          {historico.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma OS salva ainda.
              </CardContent>
            </Card>
          ) : (
            historico.map((os) => (
              <Card
                key={os.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => viewOS(os)}
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-heading font-semibold">OS {os.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {os.propriedade} — {os.talhoes.length} talhões
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(os.data).toLocaleDateString("pt-BR")}
                      </p>
                      {os.status && os.status !== "aberta" && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          os.status === "concluida" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {os.status === "concluida" ? "Concluída" : "Em andamento"}
                        </span>
                      )}
                      {titulos.some((t) => t.osId === os.id) && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          Faturada
                        </span>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteOS(e, os.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Dialog — Faturar Ordem de Serviço (formulário → resumo) */}
      <Dialog open={showFaturarDialog} onOpenChange={(open) => {
        if (!open) {
          setShowFaturarDialog(false);
          setFatStep("form");
          setFatErro("");
          setFatTituloOk(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {fatStep === "form"
                ? "Faturar Ordem de Serviço"
                : fatStep === "resumo"
                ? "Resumo do Faturamento"
                : "Faturamento Confirmado"}
            </DialogTitle>
            <DialogDescription>
              {fatStep === "form"
                ? `OS ${currentOS?.id} — ${currentOS?.clienteNome || currentOS?.propriedade || "cliente não informado"}`
                : fatStep === "resumo"
                ? "Confira os dados abaixo antes de confirmar o faturamento."
                : "Título enviado para o módulo Financeiro — Contas a Receber."}
            </DialogDescription>
          </DialogHeader>

          {fatStep === "form" ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="fatValor">Valor a cobrar</Label>
                <Input
                  id="fatValor"
                  type="text"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={fatValor}
                  onChange={(e) => {
                    setFatValor(digitosParaMoeda(e.target.value));
                    setFatErro("");
                  }}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono font-bold text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Máscara <span className="font-mono">R$ 00.000,00</span> — apenas 2 casas decimais
                  (a 3ª casa maior que 5 arredonda para cima).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatVenc">Vencimento</Label>
                <Input
                  id="fatVenc"
                  type="date"
                  value={fatVencimento}
                  onChange={(e) => setFatVencimento(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fatObs">Observação (opcional)</Label>
                <Input
                  id="fatObs"
                  placeholder="Ex: pagamento em 30 dias"
                  value={fatObs}
                  onChange={(e) => setFatObs(e.target.value)}
                />
              </div>
              {fatErro && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {fatErro}
                </p>
              )}
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowFaturarDialog(false)}>
                  Cancelar
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={irParaResumo}>
                  <ArrowRight className="h-4 w-4 mr-1" /> Faturar
                </Button>
              </DialogFooter>
            </div>
          ) : fatStep === "resumo" ? (
            <div className="space-y-4 py-2">
              {/* Resumo do faturamento */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">OS</span>
                  <span className="font-semibold">{currentOS?.id}</span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Cliente</span>
                  <span className="font-semibold text-right">
                    {currentOS?.clienteNome || currentOS?.propriedade || "Cliente não informado"}
                  </span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Propriedade</span>
                  <span className="font-semibold text-right">{currentOS?.propriedade}</span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Vencimento</span>
                  <span className="font-semibold">
                    {fatVencimento
                      ? new Date(fatVencimento + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                </div>
                {fatObs.trim() && (
                  <div className="flex justify-between text-sm gap-3">
                    <span className="text-muted-foreground shrink-0">Observação</span>
                    <span className="font-semibold text-right">{fatObs}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-emerald-500/30 pt-2 mt-1">
                  <span className="text-sm font-bold">VALOR A COBRAR</span>
                  <span className="text-xl font-heading font-bold text-emerald-700">
                    {formatBRL(moedaParaCentavos(fatValor) / 100)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                <Banknote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Ao confirmar, o título será criado no módulo{" "}
                  <strong>Financeiro → Contas a Receber</strong>, com status{" "}
                  <strong>em aberto</strong>, para o cliente acima.
                </span>
              </div>

              {fatErro && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {fatErro}
                </p>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setFatStep("form")} disabled={fatSalvando}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={confirmarFaturar}
                  disabled={fatSalvando}
                >
                  <Wallet className="h-4 w-4 mr-1" />
                  {fatSalvando ? "Faturando..." : "Faturar"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2 text-center">
              <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <p className="font-heading font-bold text-lg">
                  OS {currentOS?.id} faturada com sucesso
                </p>
                <p className="text-sm text-muted-foreground">
                  Título nº <strong>{fatTituloOk?.numero}</strong> criado em Financeiro →
                  Contas a Receber
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-left">
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Cliente</span>
                  <span className="font-semibold text-right">{fatTituloOk?.clienteNome}</span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Vencimento</span>
                  <span className="font-semibold">
                    {fatTituloOk?.dataVencimento
                      ? new Date(fatTituloOk.dataVencimento + "T00:00:00").toLocaleDateString("pt-BR")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Status</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    Em aberto
                  </Badge>
                </div>
                <div className="flex justify-between items-center border-t border-emerald-500/30 pt-2 mt-1">
                  <span className="text-sm font-bold">VALOR FATURADO</span>
                  <span className="text-xl font-heading font-bold text-emerald-700">
                    {formatBRL(fatTituloOk?.valor ?? 0)}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowFaturarDialog(false)}>
                  Fechar
                </Button>
                <Button
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Link
                    to="/financeiro"
                    onClick={() => {
                      setShowFaturarDialog(false);
                      setFatStep("form");
                    }}
                  >
                    <Banknote className="h-4 w-4 mr-1" /> Ver no Financeiro
                  </Link>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
