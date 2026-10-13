import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Bug,
  ClipboardCheck,
  ClipboardList,
  FileSignature,
  Loader2,
  MapPin,
  PackagePlus,
  Plus,
  Search,
  Sprout,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import {
  adicionarDiagnostico,
  adicionarRecomendacao,
  atualizarRecomendacao,
  atualizarStatusVisita,
  buscarAgrofit,
  criarReceituario,
  comprimirFoto,
  excluirVisita,
  getVisita,
  listarCulturasAgrofit,
  listarDiagnosticos,
  listarRecomendacoes,
  listarVisitas,
  novaVisitaId,
  removerDiagnostico,
  removerRecomendacao,
  salvarVisita,
  type DiagnosticoVisita,
  type ProdutoAgrofit,
  type RecomendacaoVisita,
  type ReceituarioDados,
  type Severidade,
  type VisitaCampo,
  type VisitaFoto,
} from "@/lib/fieldVisitStorage";
import { getAllClientes, type Cliente } from "@/lib/clienteStorage";
import { buildItemKey, createEntrada } from "@/lib/stockStorage";
import { generateOSId, saveOS, type OrdemServico as OSTipo, type ProdutoDose } from "@/lib/osStorage";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const STATUS_LABEL: Record<VisitaCampo["status"], string> = {
  planejada: "Planejada",
  em_campo: "Em campo",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<VisitaCampo["status"], "default" | "secondary" | "destructive" | "outline"> = {
  planejada: "secondary",
  em_campo: "default",
  concluida: "outline",
  cancelada: "destructive",
};

const SEVERIDADE_LABEL: Record<Severidade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const UNIDADES_DOSE = ["L/ha", "kg/ha", "g/ha", "mL/ha", "dose/ha"];

function nomeCliente(cliente: Cliente): string {
  return cliente.nomeFantasia ?? cliente.razaoSocial ?? cliente.nomeCompleto ?? "Sem nome";
}

function documentoCliente(cliente: Cliente): string {
  return cliente.cnpj ?? cliente.cpf ?? "";
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Formata latitude/longitude com 6 casas (precisão de ~0,1 m). */
function formatarCoordenadas(pos: GeolocationPosition): string {
  return `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
}

export default function Visitas() {
  const navigate = useNavigate();
  const { company } = useAuth();

  const [visitas, setVisitas] = useState<VisitaCampo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [culturas, setCulturas] = useState<string[]>([]);

  // Nova visita
  const [novoAberto, setNovoAberto] = useState(false);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [formNovo, setFormNovo] = useState({
    data: hoje(),
    clienteId: "",
    areaNome: "",
    talhaoNome: "",
    cultura: "",
    faseFenologica: "",
    observacoes: "",
    coordenadas: "",
  });
  const [fotosNovo, setFotosNovo] = useState<VisitaFoto[]>([]);
  const [checkin, setCheckin] = useState(false);
  const [adicionandoFoto, setAdicionandoFoto] = useState(false);

  // Detalhe
  const [selId, setSelId] = useState<string | null>(null);
  const [visitaSel, setVisitaSel] = useState<VisitaCampo | null>(null);
  const [diagnosticos, setDiagnosticos] = useState<DiagnosticoVisita[]>([]);
  const [recomendacoes, setRecomendacoes] = useState<RecomendacaoVisita[]>([]);
  const [carregandoSel, setCarregandoSel] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  const [entrandoEstoque, setEntrandoEstoque] = useState<string | null>(null);
  const [abrindoOs, setAbrindoOs] = useState(false);

  // Diagnóstico novo
  const [diagForm, setDiagForm] = useState({
    alvoCientifico: "",
    alvoComum: "",
    severidade: "media" as Severidade,
    percentual: "",
    observacao: "",
  });

  // Recomendação nova (busca Agrofit)
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [alvoBusca, setAlvoBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<ProdutoAgrofit[]>([]);
  const [selecionado, setSelecionado] = useState<ProdutoAgrofit | null>(null);
  const [recForm, setRecForm] = useState({
    dose: "",
    unidade: "L/ha",
    areaHa: "",
    intervalo: "",
    reentrada: "",
    volume: "",
    modo: "",
    observacao: "",
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await listarVisitas();
      setVisitas(lista);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao carregar as visitas");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    void getAllClientes()
      .then(setClientes)
      .catch(() => setClientes([]));
    void listarCulturasAgrofit()
      .then(setCulturas)
      .catch(() => setCulturas([]));
  }, [carregar]);

  const carregarDetalhe = useCallback(async (id: string) => {
    setCarregandoSel(true);
    try {
      const [visita, diags, recs] = await Promise.all([
        getVisita(id),
        listarDiagnosticos(id),
        listarRecomendacoes(id),
      ]);
      setVisitaSel(visita ?? null);
      setDiagnosticos(diags);
      setRecomendacoes(recs);
      setConfirmandoExcluir(false);
      setBuscaAberta(false);
      setSelecionado(null);
      setResultados([]);
      if (diags.length > 0) {
        setAlvoBusca(diags[0].alvoCientifico);
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao carregar a visita");
      setSelId(null);
    } finally {
      setCarregandoSel(false);
    }
  }, []);

  useEffect(() => {
    if (selId) void carregarDetalhe(selId);
    else setVisitaSel(null);
  }, [selId, carregarDetalhe]);

  const setForm = (campo: keyof typeof formNovo, valor: string) =>
    setFormNovo((atual) => ({ ...atual, [campo]: valor }));

  const capturarCheckin = () => {
    if (!navigator.geolocation) {
      toast.error("Este dispositivo não tem GPS");
      return;
    }
    setCheckin(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm("coordenadas", formatarCoordenadas(pos));
        setCheckin(false);
        toast.success("Check-in GPS capturado");
      },
      () => {
        setCheckin(false);
        toast.error("Não foi possível capturar a localização");
      },
      { enableHighAccuracy: true, timeout: 15_000 }
    );
  };

  const adicionarFoto = async (arquivos: FileList | null) => {
    if (!arquivos || arquivos.length === 0) return;
    if (fotosNovo.length >= 3) {
      toast.error("Máximo de 3 fotos por visita");
      return;
    }
    setAdicionandoFoto(true);
    try {
      const novas: VisitaFoto[] = [];
      for (const arquivo of Array.from(arquivos)) {
        if (fotosNovo.length + novas.length >= 3) break;
        const base64 = await comprimirFoto(arquivo);
        novas.push({ base64, em: new Date().toISOString() });
      }
      setFotosNovo((atual) => [...atual, ...novas]);
    } catch {
      toast.error("Falha ao processar a foto");
    } finally {
      setAdicionandoFoto(false);
    }
  };

  const criarVisita = async () => {
    if (!formNovo.areaNome.trim()) {
      toast.error("Informe a área/talhão visitado");
      return;
    }
    const cliente = clientes.find((c) => c.id === formNovo.clienteId);
    setSalvandoNovo(true);
    try {
      const visita: VisitaCampo = {
        id: novaVisitaId(),
        data: formNovo.data,
        clienteId: cliente?.id,
        clienteNome: cliente ? nomeCliente(cliente) : undefined,
        areaNome: formNovo.areaNome.trim(),
        talhaoNome: formNovo.talhaoNome.trim() || undefined,
        coordenadas: formNovo.coordenadas.trim() || undefined,
        faseFenologica: formNovo.faseFenologica.trim() || undefined,
        cultura: formNovo.cultura.trim() || undefined,
        observacoes: formNovo.observacoes.trim() || undefined,
        fotos: fotosNovo,
        status: "em_campo",
        criadoEm: new Date().toISOString(),
      };
      await salvarVisita(visita);
      toast.success("Visita iniciada!");
      setNovoAberto(false);
      setFormNovo({
        data: hoje(),
        clienteId: "",
        areaNome: "",
        talhaoNome: "",
        cultura: "",
        faseFenologica: "",
        observacoes: "",
        coordenadas: "",
      });
      setFotosNovo([]);
      await carregar();
      setSelId(visita.id);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao salvar a visita");
    } finally {
      setSalvandoNovo(false);
    }
  };

  const mudarStatus = async (status: VisitaCampo["status"]) => {
    if (!visitaSel) return;
    try {
      await atualizarStatusVisita(visitaSel.id, status);
      setVisitaSel({ ...visitaSel, status });
      await carregar();
      toast.success(`Visita marcada como ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao atualizar a visita");
    }
  };

  const excluir = async () => {
    if (!visitaSel) return;
    try {
      await excluirVisita(visitaSel.id);
      toast.success("Visita excluída");
      setSelId(null);
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao excluir");
    }
  };

  const salvarDiagnostico = async () => {
    if (!visitaSel) return;
    if (!diagForm.alvoCientifico.trim()) {
      toast.error("Informe o alvo (nome científico do agente)");
      return;
    }
    try {
      const novo = await adicionarDiagnostico({
        visitId: visitaSel.id,
        alvoCientifico: diagForm.alvoCientifico.trim(),
        alvoComum: diagForm.alvoComum.trim() || undefined,
        severidade: diagForm.severidade,
        percentual: diagForm.percentual ? Number(diagForm.percentual.replace(",", ".")) : undefined,
        observacao: diagForm.observacao.trim() || undefined,
      });
      setDiagnosticos((atual) => [...atual, novo]);
      setDiagForm({ alvoCientifico: "", alvoComum: "", severidade: "media", percentual: "", observacao: "" });
      setAlvoBusca(novo.alvoCientifico);
      toast.success("Diagnóstico registrado");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao salvar o diagnóstico");
    }
  };

  const excluirDiagnostico = async (id: string) => {
    try {
      await removerDiagnostico(id);
      setDiagnosticos((atual) => atual.filter((d) => d.id !== id));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao remover");
    }
  };

  const buscarProdutos = async () => {
    if (!visitaSel) return;
    if (!alvoBusca.trim() && !termoBusca.trim()) {
      toast.error("Informe o alvo ou um termo de busca");
      return;
    }
    setBuscando(true);
    try {
      const achados = await buscarAgrofit({
        cultura: visitaSel.cultura,
        alvo: alvoBusca,
        busca: termoBusca,
        limite: 30,
      });
      setResultados(achados);
      if (achados.length === 0) {
        toast.info("Nenhum produto registrado na base Agrofit para esse filtro");
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha na consulta Agrofit");
    } finally {
      setBuscando(false);
    }
  };

  const adicionarRecomendacaoItem = async () => {
    if (!visitaSel || !selecionado) return;
    const dose = Number(recForm.dose.replace(",", "."));
    const area = Number(recForm.areaHa.replace(",", "."));
    if (!dose || dose <= 0) {
      toast.error("Informe a dose aplicada");
      return;
    }
    if (!area || area <= 0) {
      toast.error("Informe a área (ha) para calcular a quantidade total");
      return;
    }
    try {
      const novo = await adicionarRecomendacao({
        visitId: visitaSel.id,
        agrofitId: selecionado.id,
        nrRegistro: selecionado.nrRegistro,
        marcaComercial: selecionado.marcaComercial,
        ingredienteAtivo: selecionado.ingredienteAtivo,
        dose,
        doseUnidade: recForm.unidade,
        areaHa: area,
        quantidadeTotal: Math.round(dose * area * 1000) / 1000,
        intervaloSegurancaDias: recForm.intervalo ? Number(recForm.intervalo) : undefined,
        periodoReentradaDias: recForm.reentrada ? Number(recForm.reentrada) : undefined,
        modoAplicacao: recForm.modo.trim() || undefined,
        volumeCaldaLHa: recForm.volume ? Number(recForm.volume.replace(",", ".")) : undefined,
        observacao: recForm.observacao.trim() || undefined,
      });
      setRecomendacoes((atual) => [...atual, novo]);
      setSelecionado(null);
      setResultados([]);
      setTermoBusca("");
      setBuscaAberta(false);
      setRecForm({ dose: "", unidade: "L/ha", areaHa: "", intervalo: "", reentrada: "", volume: "", modo: "", observacao: "" });
      toast.success("Recomendação adicionada");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao adicionar a recomendação");
    }
  };

  const mudarStatusRecomendacao = async (id: string, status: RecomendacaoVisita["status"]) => {
    try {
      await atualizarRecomendacao(id, { status });
      setRecomendacoes((atual) => atual.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao atualizar");
    }
  };

  const excluirRecomendacaoItem = async (id: string) => {
    try {
      await removerRecomendacao(id);
      setRecomendacoes((atual) => atual.filter((r) => r.id !== id));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao remover");
    }
  };

  const gerarReceituario = async () => {
    if (!visitaSel) return;
    if (recomendacoes.length === 0) {
      toast.error("Adicione ao menos uma recomendação antes de emitir o receituário");
      return;
    }
    const cliente = clientes.find((c) => c.id === visitaSel.clienteId);
    const diagnosticoTexto = diagnosticos
      .map((d) => `${d.alvoCientifico}${d.alvoComum ? ` (${d.alvoComum})` : ""} — severidade ${SEVERIDADE_LABEL[d.severidade].toLowerCase()}${d.percentual ? `, ${d.percentual}%` : ""}`)
      .join("; ");

    const dados: ReceituarioDados = {
      produtor: cliente
        ? {
            nome: nomeCliente(cliente),
            documento: documentoCliente(cliente),
            municipio: cliente.cidade,
            uf: cliente.estado,
          }
        : undefined,
      propriedade: {
        nome: visitaSel.areaNome + (visitaSel.talhaoNome ? ` — Talhão ${visitaSel.talhaoNome}` : ""),
        municipio: cliente?.cidade,
        uf: cliente?.estado,
      },
      tecnico: company
        ? {
            nome: company.tecnico_nome,
            titulo: company.tecnico_titulo,
            crea: company.tecnico_crea,
            art: company.tecnico_art,
          }
        : undefined,
      diagnostico: diagnosticoTexto || visitaSel.observacoes || "",
      itens: recomendacoes.map((r) => ({
        nrRegistro: r.nrRegistro ?? "",
        marca: r.marcaComercial ?? "",
        ingrediente: r.ingredienteAtivo ?? "",
        cultura: visitaSel.cultura,
        alvo: diagnosticos[0]?.alvoCientifico,
        dose: `${r.dose ?? 0}`,
        unidade: r.doseUnidade,
        quantidade: `${r.quantidadeTotal ?? 0}`,
        intervaloSeguranca: r.intervaloSegurancaDias != null ? `${r.intervaloSegurancaDias} dias` : "",
        reentrada: r.periodoReentradaDias != null ? `${r.periodoReentradaDias} dias` : "",
        modoAplicacao: r.modoAplicacao,
        volumeCalda: r.volumeCaldaLHa != null ? `${r.volumeCaldaLHa} L/ha` : "",
      })),
      condicoes:
        "Utilizar EPI adequado (luvas, botinas, óculos e vestimenta de proteção). Evitar aplicação com vento acima de 10 km/h. Descartar as embalagens no ponto de recebimento autorizado (triângulo amarelo).",
    };

    try {
      const receituario = await criarReceituario(dados, visitaSel.id);
      toast.success(`Receituário ${receituario.numero} criado`);
      setSelId(null);
      navigate(`/receituario?id=${receituario.id}`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao criar o receituário");
    }
  };

  // ---------------------------------------------------------- Fase F ---

  /** Unidade de estoque correspondente à dose (L/ha → L, kg/ha → KG). */
  const unidadeDeDose = (doseUnidade: string): "L" | "KG" => {
    const u = doseUnidade.toLowerCase();
    if (u.startsWith("ml")) return "L";
    if (u.startsWith("kg") || u.startsWith("g")) return "KG";
    return "L";
  };

  /** mL/ha precisa virar L para bater com a unidade do estoque. */
  const doseEmUnidadeBase = (dose: number, doseUnidade: string): number =>
    doseUnidade.toLowerCase().startsWith("ml") ? dose / 1000 : dose;

  /**
   * Recomendação comprada → entrada no estoque.
   *
   * Tenta casar com o produto já cadastrado (registered_products) para manter
   * o vínculo `prod:<id>` do módulo de Estoque; sem casamento, cria a linha
   * com chave própria `prod:agrofit:<registro>` para o saldo não se perder.
   */
  const gerarEntradaEstoque = async (rec: RecomendacaoVisita) => {
    if (!visitaSel) return;
    if (!rec.quantidadeTotal || rec.quantidadeTotal <= 0) {
      toast.error("Recomendação sem quantidade total calculada");
      return;
    }
    setEntrandoEstoque(rec.id);
    try {
      const marca = (rec.marcaComercial ?? "").trim();
      const { data: cadastrados } = await supabase
        .from("registered_products")
        .select("id, commercial_name")
        .ilike("commercial_name", marca || "\u0000")
        .limit(5);

      const exato = (cadastrados ?? []).find(
        (p) => p.commercial_name.trim().toLowerCase() === marca.toLowerCase()
      );

      await createEntrada({
        categoria: "produto",
        item_key: exato
          ? buildItemKey("produto", exato.id)
          : `prod:agrofit:${rec.nrRegistro ?? rec.id}`,
        item_nome: exato?.commercial_name || marca || rec.nrRegistro || "Produto",
        quantidade: rec.quantidadeTotal,
        data: new Date().toISOString().slice(0, 10),
        fornecedor: "",
        observacao: `Entrada gerada da recomendação da visita ${visitaSel.id} — Reg. MAPA ${rec.nrRegistro ?? "—"}`,
      });

      if (rec.status !== "comprada") {
        await atualizarRecomendacao(rec.id, { status: "comprada" });
        setRecomendacoes((atual) =>
          atual.map((r) => (r.id === rec.id ? { ...r, status: "comprada" } : r))
        );
      }
      toast.success(`Entrada de ${rec.quantidadeTotal} registrada no estoque`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao registrar a entrada");
    } finally {
      setEntrandoEstoque(null);
    }
  };

  /** Visita com recomendações → nova Ordem de Serviço pré-preenchida. */
  const abrirOsDaVisita = async () => {
    if (!visitaSel) return;
    if (recomendacoes.length === 0) {
      toast.error("Adicione ao menos uma recomendação antes de abrir a OS");
      return;
    }
    setAbrindoOs(true);
    try {
      const id = await generateOSId();
      const produtos: ProdutoDose[] = recomendacoes
        .filter((r) => r.marcaComercial)
        .map((r) => ({
          produto: r.marcaComercial as string,
          dose: String(doseEmUnidadeBase(r.dose ?? 0, r.doseUnidade)),
          unit: unidadeDeDose(r.doseUnidade),
          preco_unitario: 0,
        }));
      const areaPrimeira = recomendacoes.find((r) => r.areaHa)?.areaHa;

      const os: OSTipo = {
        id,
        data: visitaSel.data,
        propriedade: visitaSel.clienteNome ?? visitaSel.areaNome,
        codigoArea: visitaSel.talhaoNome ?? "",
        responsavelTecnico: company?.tecnico_nome ?? "",
        aplicador: "",
        talhoes: [
          {
            nome: visitaSel.talhaoNome || visitaSel.areaNome,
            area: areaPrimeira != null ? String(areaPrimeira) : "",
            produtos,
            testemunho: false,
            testemunhoArea: "",
            testeProduto: false,
            produtoTeste: "",
            produtoTesteQtd: "",
          },
        ],
        createdAt: new Date().toISOString(),
        status: "aberta",
        clienteId: visitaSel.clienteId,
        clienteNome: visitaSel.clienteNome,
      };
      await saveOS(os);
      toast.success(`OS ${id} criada a partir da visita`);
      setSelId(null);
      navigate(`/ordem-servico?os=${id}`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao abrir a OS");
    } finally {
      setAbrindoOs(false);
    }
  };

  const visitaAberta = visitaSel && visitaSel.status !== "cancelada";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
            <Sprout className="h-8 w-8 text-emerald-600" />
            Visitas de Campo
          </h1>
          <p className="text-muted-foreground mt-1">
            Vistoria no talhão, diagnóstico fitossanitário, recomendação técnica
            com base oficial Agrofit e emissão do Receituário Agronômico.
          </p>
        </div>
        <Button onClick={() => setNovoAberto(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" /> Nova visita
        </Button>
      </div>

      <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            Visitas ({visitas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : visitas.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              Nenhuma visita registrada. Clique em <strong>Nova visita</strong> para começar o
              atendimento no campo.
            </p>
          ) : (
            <div className="divide-y">
              {visitas.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelId(v.id)}
                  className="w-full text-left py-3 px-2 hover:bg-muted/50 rounded-lg transition-colors flex flex-wrap items-center gap-3"
                >
                  <span className="font-mono text-xs text-muted-foreground w-36">{v.id}</span>
                  <span className="font-medium">{v.areaNome}</span>
                  {v.talhaoNome && <span className="text-sm text-muted-foreground">Talhão {v.talhaoNome}</span>}
                  {v.clienteNome && <span className="text-sm text-muted-foreground">{v.clienteNome}</span>}
                  <span className="text-sm text-muted-foreground ml-auto">{new Date(`${v.data}T12:00:00`).toLocaleDateString("pt-BR")}</span>
                  <Badge variant={STATUS_VARIANT[v.status]}>{STATUS_LABEL[v.status]}</Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ Nova visita --- */}
      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova visita de campo</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data da visita</Label>
              <Input
                type="date"
                value={formNovo.data}
                onChange={(e) => setForm("data", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Cliente (produtor)</Label>
              <Select
                value={formNovo.clienteId || undefined}
                onValueChange={(v) => setForm("clienteId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {nomeCliente(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Área / talhão visitado *</Label>
              <Input
                value={formNovo.areaNome}
                onChange={(e) => setForm("areaNome", e.target.value)}
                placeholder="Ex: Talhão 3 — Soja"
              />
            </div>
            <div className="space-y-2">
              <Label>Código do talhão</Label>
              <Input
                value={formNovo.talhaoNome}
                onChange={(e) => setForm("talhaoNome", e.target.value)}
                placeholder="Ex: T03"
              />
            </div>
            <div className="space-y-2">
              <Label>Cultura</Label>
              <Input
                value={formNovo.cultura}
                onChange={(e) => setForm("cultura", e.target.value)}
                placeholder="Ex: Soja"
                list="culturas-agrofit"
              />
              <datalist id="culturas-agrofit">
                {culturas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-2">
              <Label>Fase fenológica</Label>
              <Input
                value={formNovo.faseFenologica}
                onChange={(e) => setForm("faseFenologica", e.target.value)}
                placeholder="Ex: R5 (enchimento de grãos)"
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Check-in GPS</Label>
              <div className="flex gap-2">
                <Input
                  value={formNovo.coordenadas}
                  onChange={(e) => setForm("coordenadas", e.target.value)}
                  placeholder="-23.550500, -46.633300"
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={capturarCheckin} disabled={checkin}>
                  {checkin ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <MapPin className="h-4 w-4 mr-2" />
                  )}
                  Capturar
                </Button>
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Observações iniciais</Label>
              <Textarea
                value={formNovo.observacoes}
                onChange={(e) => setForm("observacoes", e.target.value)}
                rows={3}
                placeholder="Sintomas observados, histórico da lavoura, condições do local..."
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Fotos do local (máx. 3, comprimidas no dispositivo)</Label>
              <div className="flex flex-wrap items-center gap-2">
                {fotosNovo.map((f, i) => (
                  <div key={i} className="relative">
                    <img
                      src={f.base64}
                      alt={`Foto ${i + 1}`}
                      className="h-20 w-20 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => setFotosNovo((atual) => atual.filter((_, j) => j !== i))}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5"
                      aria-label="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-muted/50 text-sm">
                  {adicionandoFoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Adicionar foto
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    multiple
                    onChange={(e) => void adicionarFoto(e.target.files)}
                  />
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={criarVisita} disabled={salvandoNovo} className="bg-emerald-600 hover:bg-emerald-700">
              {salvandoNovo && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Iniciar visita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- Detalhe ------ */}
      <Dialog open={!!selId} onOpenChange={(aberto) => !aberto && setSelId(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {carregandoSel || !visitaSel ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  {visitaSel.areaNome}
                  <Badge variant={STATUS_VARIANT[visitaSel.status]}>{STATUS_LABEL[visitaSel.status]}</Badge>
                </DialogTitle>
              </DialogHeader>

              <Tabs defaultValue="sobre">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="sobre">Sobre</TabsTrigger>
                  <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
                  <TabsTrigger value="recomendacao">Recomendações</TabsTrigger>
                  <TabsTrigger value="fotos">Fotos</TabsTrigger>
                </TabsList>

                <TabsContent value="sobre" className="space-y-3 mt-4">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Identificador</dt>
                    <dd className="font-mono">{visitaSel.id}</dd>
                    <dt className="text-muted-foreground">Data</dt>
                    <dd>{new Date(`${visitaSel.data}T12:00:00`).toLocaleDateString("pt-BR")}</dd>
                    <dt className="text-muted-foreground">Cliente</dt>
                    <dd>{visitaSel.clienteNome ?? "—"}</dd>
                    <dt className="text-muted-foreground">Talhão</dt>
                    <dd>{visitaSel.talhaoNome ?? "—"}</dd>
                    <dt className="text-muted-foreground">Cultura</dt>
                    <dd>{visitaSel.cultura ?? "—"}</dd>
                    <dt className="text-muted-foreground">Fase fenológica</dt>
                    <dd>{visitaSel.faseFenologica ?? "—"}</dd>
                    <dt className="text-muted-foreground">Check-in</dt>
                    <dd className="font-mono text-xs">{visitaSel.coordenadas ?? "—"}</dd>
                  </dl>
                  {visitaSel.observacoes && (
                    <p className="text-sm bg-muted/60 rounded-lg p-3 whitespace-pre-wrap">
                      {visitaSel.observacoes}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {visitaSel.status !== "concluida" && (
                      <Button
                        size="sm"
                        onClick={() => void mudarStatus("concluida")}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <ClipboardCheck className="h-4 w-4 mr-1.5" /> Concluir visita
                      </Button>
                    )}
                    {visitaSel.status === "em_campo" && (
                      <Button size="sm" variant="outline" onClick={() => void mudarStatus("cancelada")}>
                        Cancelar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void gerarReceituario()}
                      disabled={!visitaAberta && visitaSel.status !== "concluida"}
                    >
                      <FileSignature className="h-4 w-4 mr-1.5" /> Gerar Receituário
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void abrirOsDaVisita()}
                      disabled={abrindoOs || recomendacoes.length === 0}
                    >
                      {abrindoOs ? (
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      ) : (
                        <ClipboardList className="h-4 w-4 mr-1.5" />
                      )}
                      Abrir OS
                    </Button>
                    {confirmandoExcluir ? (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => void excluir()}>
                          Confirmar exclusão
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmandoExcluir(false)}>
                          Não
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setConfirmandoExcluir(true)}>
                        <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                      </Button>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="diagnostico" className="space-y-4 mt-4">
                  {diagnosticos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum diagnóstico registrado ainda.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {diagnosticos.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-start gap-3 rounded-lg border p-3 text-sm"
                        >
                          <Bug className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{d.alvoCientifico}</p>
                            {d.alvoComum && <p className="text-muted-foreground">{d.alvoComum}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                              Severidade {SEVERIDADE_LABEL[d.severidade].toLowerCase()}
                              {d.percentual != null && ` — ${d.percentual}% de dano`}
                              {d.observacao && ` — ${d.observacao}`}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void excluirDiagnostico(d.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="rounded-lg border border-dashed p-4 space-y-3">
                    <p className="text-sm font-medium">Novo diagnóstico</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Alvo — nome científico *</Label>
                        <Input
                          value={diagForm.alvoCientifico}
                          onChange={(e) => setDiagForm({ ...diagForm, alvoCientifico: e.target.value })}
                          placeholder="Ex: Phakopsora pachyrhizi"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nome comum</Label>
                        <Input
                          value={diagForm.alvoComum}
                          onChange={(e) => setDiagForm({ ...diagForm, alvoComum: e.target.value })}
                          placeholder="Ex: ferrugem asiática"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Severidade</Label>
                        <Select
                          value={diagForm.severidade}
                          onValueChange={(v) => setDiagForm({ ...diagForm, severidade: v as Severidade })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Dano estimado (%)</Label>
                        <Input
                          value={diagForm.percentual}
                          onChange={(e) => setDiagForm({ ...diagForm, percentual: e.target.value })}
                          placeholder="Ex: 15"
                          inputMode="decimal"
                        />
                      </div>
                    </div>
                    <Textarea
                      value={diagForm.observacao}
                      onChange={(e) => setDiagForm({ ...diagForm, observacao: e.target.value })}
                      rows={2}
                      placeholder="Observações (sintomas, distribuição na lavoura...)"
                    />
                    <Button size="sm" onClick={() => void salvarDiagnostico()}>
                      <Plus className="h-4 w-4 mr-1.5" /> Adicionar diagnóstico
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="recomendacao" className="space-y-4 mt-4">
                  {recomendacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma recomendação ainda. Busque um produto registrado no MAPA para
                      o alvo diagnosticado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recomendacoes.map((r) => (
                        <div key={r.id} className="rounded-lg border p-3 text-sm space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{r.marcaComercial}</p>
                              <p className="text-muted-foreground text-xs">
                                Reg. MAPA {r.nrRegistro} — {r.ingredienteAtivo}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Select
                                value={r.status}
                                onValueChange={(v) =>
                                  void mudarStatusRecomendacao(r.id, v as RecomendacaoVisita["status"])
                                }
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="enviada">Enviada</SelectItem>
                                  <SelectItem value="comprada">Comprada</SelectItem>
                                  <SelectItem value="aplicada">Aplicada</SelectItem>
                                  <SelectItem value="cancelada">Cancelada</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="ghost" onClick={() => void excluirRecomendacaoItem(r.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Dose {r.dose} {r.doseUnidade} × {r.areaHa} ha ={" "}
                            <strong>{r.quantidadeTotal}</strong> por unidade de dose
                            {r.intervaloSegurancaDias != null && ` · Intervalo de segurança ${r.intervaloSegurancaDias} dias`}
                            {r.periodoReentradaDias != null && ` · Reentrada ${r.periodoReentradaDias} dias`}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void gerarEntradaEstoque(r)}
                            disabled={entrandoEstoque === r.id}
                          >
                            {entrandoEstoque === r.id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Warehouse className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            {r.status === "comprada"
                              ? "Repetir entrada no estoque"
                              : "Dar entrada no estoque"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {!buscaAberta ? (
                    <Button size="sm" variant="outline" onClick={() => setBuscaAberta(true)}>
                      <PackagePlus className="h-4 w-4 mr-1.5" /> Adicionar produto (base Agrofit)
                    </Button>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Alvo (diagnóstico)</Label>
                          <Input
                            value={alvoBusca}
                            onChange={(e) => setAlvoBusca(e.target.value)}
                            placeholder="Ex: Phakopsora pachyrhizi"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Buscar por marca / registro / ingrediente</Label>
                          <div className="flex gap-2">
                            <Input
                              value={termoBusca}
                              onChange={(e) => setTermoBusca(e.target.value)}
                              placeholder="Ex: 56825"
                              onKeyDown={(e) => e.key === "Enter" && void buscarProdutos()}
                            />
                            <Button variant="outline" onClick={() => void buscarProdutos()} disabled={buscando}>
                              {buscando ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Search className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cultura da visita: <strong>{visitaSel.cultura ?? "não informada"}</strong> —
                        a busca restringe aos produtos registrados (Agrofit/MAPA).
                      </p>

                      {resultados.length > 0 && (
                        <div className="max-h-52 overflow-y-auto space-y-1.5">
                          {resultados.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelecionado(p)}
                              className={`w-full text-left rounded-lg border p-2.5 text-sm transition-colors ${
                                selecionado?.id === p.id
                                  ? "border-emerald-600 bg-emerald-50"
                                  : "hover:bg-muted/60"
                              }`}
                            >
                              <span className="font-medium">{p.marcaComercial}</span>{" "}
                              <span className="text-xs text-muted-foreground">· Reg. {p.nrRegistro}</span>
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {p.ingredienteAtivo} — {p.titular}
                                {p.classeToxicologica && ` · Classe ${p.classeToxicologica}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {selecionado && (
                        <div className="rounded-lg bg-muted/60 p-3 space-y-3">
                          <p className="text-sm font-medium">
                            {selecionado.marcaComercial} — {selecionado.formulacao}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1.5">
                              <Label>Dose *</Label>
                              <Input
                                value={recForm.dose}
                                onChange={(e) => setRecForm({ ...recForm, dose: e.target.value })}
                                inputMode="decimal"
                                placeholder="0,5"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Unidade</Label>
                              <Select
                                value={recForm.unidade}
                                onValueChange={(v) => setRecForm({ ...recForm, unidade: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNIDADES_DOSE.map((u) => (
                                    <SelectItem key={u} value={u}>
                                      {u}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1.5">
                              <Label>Área (ha) *</Label>
                              <Input
                                value={recForm.areaHa}
                                onChange={(e) => setRecForm({ ...recForm, areaHa: e.target.value })}
                                inputMode="decimal"
                                placeholder="12,5"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Intervalo seg. (dias)</Label>
                              <Input
                                value={recForm.intervalo}
                                onChange={(e) => setRecForm({ ...recForm, intervalo: e.target.value })}
                                inputMode="numeric"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Reentrada (dias)</Label>
                              <Input
                                value={recForm.reentrada}
                                onChange={(e) => setRecForm({ ...recForm, reentrada: e.target.value })}
                                inputMode="numeric"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Volume calda (L/ha)</Label>
                              <Input
                                value={recForm.volume}
                                onChange={(e) => setRecForm({ ...recForm, volume: e.target.value })}
                                inputMode="decimal"
                              />
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                              <Label>Modo de aplicação</Label>
                              <Input
                                value={recForm.modo}
                                onChange={(e) => setRecForm({ ...recForm, modo: e.target.value })}
                                placeholder="Ex: terrestre, pulverização foliar"
                              />
                            </div>
                          </div>
                          {Number(recForm.dose.replace(",", ".")) > 0 &&
                            Number(recForm.areaHa.replace(",", ".")) > 0 && (
                              <p className="text-xs text-emerald-700">
                                Quantidade total:{" "}
                                <strong>
                                  {Math.round(
                                    Number(recForm.dose.replace(",", ".")) *
                                      Number(recForm.areaHa.replace(",", ".")) *
                                      1000
                                  ) / 1000}
                                </strong>{" "}
                                (dose × área)
                              </p>
                            )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => void adicionarRecomendacaoItem()}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              Adicionar recomendação
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setSelecionado(null)}>
                              Trocar produto
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="fotos" className="mt-4">
                  {visitaSel.fotos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem fotos nesta visita.</p>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {visitaSel.fotos.map((f, i) => (
                        <div key={i} className="space-y-1">
                          <img
                            src={f.base64}
                            alt={`Foto ${i + 1}`}
                            className="h-40 w-40 object-cover rounded-lg border"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(f.em).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
