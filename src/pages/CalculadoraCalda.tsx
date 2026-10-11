import { useState, useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, Plus, Trash2, ListOrdered, Settings, Beaker, AlertTriangle, History, Search, Calendar, ChevronDown, ChevronUp, Printer, Droplets, FileText, X, CheckCircle2, MapPin, Package, Share2 } from "lucide-react";
import { getAllOS, OrdemServico, TalhaoData } from "@/lib/osStorage";
import { getAllEquipments, Equipment } from "@/lib/equipmentStorage";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteCalculoCalda,
  getAllCalculosCalda,
  saveCalculoCalda,
  type CalculoCaldaRecord,
} from "@/lib/caldaStorage";

type FormulacaoConhecida = "WP" | "WG" | "SC" | "EC" | "SL" | "ADJ";

// Terrestre = cálculo tradicional (100–200 L/ha) · Drone = baixo volume (5–20 L/ha)
type ModoAplicacao = "terrestre" | "drone";
type GrupoPh = "neutro" | "acido" | "alcalino";

interface Produto {
  id: string;
  nome: string;
  formulacao: string;
  dose: number;
  unidade: "L/ha" | "kg/ha";
  packageSize?: number;
  packageUnit?: string;
  phGrupo?: GrupoPh;
}

interface HistoricoCalda {
  id: string;
  data: string;
  talhao: string;
  areaTalhao: number;
  vazaoTrabalho: number;
  capacidadeTanque: number;
  produtos: Produto[];
  volumeTotal: number;
  tanquesCheios: number;
  volumeRestante: number;
  tanquesNecessarios: number;
  modo?: ModoAplicacao;
}

// Categorias com cores semânticas
type Categoria = "ÁGUA" | "ESPECIAIS_PRE" | "SÓLIDOS" | "SUSPENSÕES" | "INTERMEDIÁRIO" | "EMULSÕES" | "ALTA_SOLUBILIDADE" | "ESPECIAIS_POS";

const CATEGORIA_CONFIG: Record<Categoria, { label: string; cor: string; bgClass: string; textClass: string }> = {
  ÁGUA:              { label: "ÁGUA",              cor: "hsl(200 70% 55%)", bgClass: "bg-[hsl(200,70%,55%)]/15", textClass: "text-[hsl(200,70%,55%)]" },
  ESPECIAIS_PRE:     { label: "ESPECIAIS",         cor: "hsl(35 50% 60%)",  bgClass: "bg-[hsl(35,50%,60%)]/15",  textClass: "text-[hsl(35,50%,60%)]" },
  SÓLIDOS:           { label: "SÓLIDOS",           cor: "hsl(0 65% 50%)",   bgClass: "bg-destructive/10",        textClass: "text-destructive" },
  SUSPENSÕES:        { label: "SUSPENSÕES",        cor: "hsl(210 70% 50%)", bgClass: "bg-[hsl(210,70%,50%)]/15", textClass: "text-[hsl(210,70%,50%)]" },
  INTERMEDIÁRIO:     { label: "INTERMEDIÁRIO",     cor: "hsl(25 80% 55%)",  bgClass: "bg-[hsl(25,80%,55%)]/15",  textClass: "text-[hsl(25,80%,55%)]" },
  EMULSÕES:          { label: "EMULSÕES",          cor: "hsl(45 85% 50%)",  bgClass: "bg-warning/10",            textClass: "text-warning" },
  ALTA_SOLUBILIDADE: { label: "ALTA SOLUBILIDADE", cor: "hsl(145 55% 40%)", bgClass: "bg-success/10",            textClass: "text-success" },
  ESPECIAIS_POS:     { label: "ESPECIAIS",         cor: "hsl(35 50% 60%)",  bgClass: "bg-[hsl(35,50%,60%)]/15",  textClass: "text-[hsl(35,50%,60%)]" },
};

const ORDEM_FORMULACAO: Record<string, { ordem: number; descricao: string; instrucao: string; categoria: Categoria }> = {
  CORRETIVO:   { ordem: 1,  descricao: "Adjuvante Corretivo (pH, quelatizante)", instrucao: "Adicionar e aguardar correção do pH",          categoria: "ESPECIAIS_PRE" },
  SG:          { ordem: 2,  descricao: "Granulado Solúvel",                      instrucao: "Pré-diluir se necessário",                     categoria: "SÓLIDOS" },
  SP:          { ordem: 3,  descricao: "Pó Solúvel",                             instrucao: "Pré-diluir se necessário",                     categoria: "SÓLIDOS" },
  WP:          { ordem: 4,  descricao: "Pó Molhável",                            instrucao: "Pré-diluir se necessário. Aguardar dispersão", categoria: "SÓLIDOS" },
  WG:          { ordem: 5,  descricao: "Granulado Dispersível",                   instrucao: "Pré-diluir se necessário. Aguardar dispersão", categoria: "SÓLIDOS" },
  CS:          { ordem: 6,  descricao: "Suspensão de Encapsulado",               instrucao: "Agitar bem após adicionar",                    categoria: "SUSPENSÕES" },
  SC:          { ordem: 7,  descricao: "Suspensão Concentrada",                  instrucao: "Agitar bem após adicionar",                    categoria: "SUSPENSÕES" },
  OD:          { ordem: 8,  descricao: "Dispersão de Óleo",                      instrucao: "Agitar bem após adicionar",                    categoria: "SUSPENSÕES" },
  SE:          { ordem: 9,  descricao: "Suspo-Emulsão",                          instrucao: "Agitar até homogeneizar",                      categoria: "INTERMEDIÁRIO" },
  EC:          { ordem: 10, descricao: "Concentrado Emulsionável",               instrucao: "Misturar até emulsionar",                      categoria: "EMULSÕES" },
  ADJ_OLEO:    { ordem: 11, descricao: "Adjuvante em Óleo",                      instrucao: "Misturar até emulsionar",                      categoria: "EMULSÕES" },
  ADJ:         { ordem: 11, descricao: "Adjuvante em Óleo",                      instrucao: "Misturar até emulsionar",                      categoria: "EMULSÕES" },
  EO:          { ordem: 12, descricao: "Emulsão de Água em Óleo",               instrucao: "Misturar até emulsionar",                      categoria: "EMULSÕES" },
  EW:          { ordem: 13, descricao: "Emulsão de Óleo em Água",               instrucao: "Misturar até emulsionar",                      categoria: "EMULSÕES" },
  ME:          { ordem: 14, descricao: "Microemulsão",                           instrucao: "Misturar até emulsionar",                      categoria: "EMULSÕES" },
  SL:          { ordem: 15, descricao: "Concentrado Solúvel",                    instrucao: "Adicionar e misturar",                         categoria: "ALTA_SOLUBILIDADE" },
  SURFACTANTE: { ordem: 16, descricao: "Adjuvante Surfactante (Espalhante)",     instrucao: "Adicionar e misturar bem",                     categoria: "ESPECIAIS_POS" },
  FOLIARE:     { ordem: 17, descricao: "Fertilizante Foliar",                    instrucao: "Adicionar e misturar bem",                     categoria: "ESPECIAIS_POS" },
  REDUTOR:     { ordem: 18, descricao: "Adjuvante Redutor de Espuma",            instrucao: "Adicionar por último antes da água",            categoria: "ESPECIAIS_POS" },
};

const FORMULACAO_OPTIONS = Object.entries(ORDEM_FORMULACAO)
  .filter(([key]) => key !== "ADJ_OLEO") // avoid duplicate display (ADJ covers it)
  .sort((a, b) => a[1].ordem - b[1].ordem);

const DEFAULT_FORMULACAO_INFO = { ordem: 15, descricao: "Formulação customizada", instrucao: "Seguir recomendação do fabricante", categoria: "ALTA_SOLUBILIDADE" as Categoria };

function getFormulacaoInfo(f: string) {
  return ORDEM_FORMULACAO[f] || DEFAULT_FORMULACAO_INFO;
}

// ── Parâmetros do modo Drone (aplicação em baixo volume) ──────────────
const DRONE_V_MIN = 5;            // L/ha — início da faixa usual do drone
const DRONE_V_MAX = 20;           // L/ha  fim da faixa usual do drone
const FC_ALERTA = 15;             // % — concentração elevada (alerta amarelo)
const FC_CRITICO = 20;            // % — alerta vermelho de alta concentração
const AGUA_INICIAL_FRACAO = 0.7;  // 70% do tanque recebe água antes dos produtos
const FATOR_DILUICAO_PRE = 10;    // 10× o volume de pós e óleos na pré-mistura

const PH_GRUPO_LABEL: Record<GrupoPh, string> = {
  neutro: "pH neutro / sem restrição",
  acido: "Requer pH ácido (4,5–5,5)",
  alcalino: "Alcalino (pH > 7,5)",
};

// Formulações sólidas (pós) e oleosas entram no cálculo do volume mínimo de pré-mistura (10×)
const FORMULACOES_SOLIDAS = ["WP", "WG", "SG", "DF", "SP"];
const FORMULACOES_OLEOSAS = ["EC", "EW", "ME", "SE", "OD", "EO", "ADJ", "ADJ_OLEO"];
const FORMULACOES_SUSPENSAO = ["SC", "CS", "FS", "OD", "WP", "WG", "SG", "DF", "SP"];

// Ordem oficial de adição em pré-mistura — Regra WALES/DARE (drone / baixo volume)
const ORDEM_DRONE: Record<string, { grupo: number; etapa: string; instrucao: string }> = {
  CORRETIVO:   { grupo: 1, etapa: "Água + Corretivos/Condicionadores", instrucao: "Preparar 50% a 70% do volume de água e corrigir pH/condutividade antes de qualquer produto" },
  SG:          { grupo: 2, etapa: "Sólidos (WP / WG / SG / DF)", instrucao: "Exige pré-diluição vigorosa em água antes da junção ao tanque" },
  WP:          { grupo: 2, etapa: "Sólidos (WP / WG / SG / DF)", instrucao: "Exige pré-diluição vigorosa em água antes da junção ao tanque" },
  WG:          { grupo: 2, etapa: "Sólidos (WP / WG / SG / DF)", instrucao: "Exige pré-diluição vigorosa em água antes da junção ao tanque" },
  SP:          { grupo: 4, etapa: "Concentrados Solúveis (SL / SP)", instrucao: "Pré-diluir e adicionar com agitação constante" },
  CS:          { grupo: 3, etapa: "Suspensões (SC / CS / FS)", instrucao: "Partículas sólidas em meio líquido: adicionar com agitação constante" },
  SC:          { grupo: 3, etapa: "Suspensões (SC / CS / FS)", instrucao: "Partículas sólidas em meio líquido: adicionar com agitação constante" },
  OD:          { grupo: 3, etapa: "Suspensões (SC / CS / FS)", instrucao: "Partículas sólidas em meio líquido: adicionar com agitação constante" },
  SE:          { grupo: 5, etapa: "Óleos e Emulsões (EC / EW / ME / SE)", instrucao: "Formulações oleosas: adicionar após as suspensões até formar emulsão estável" },
  EC:          { grupo: 5, etapa: "Óleos e Emulsões (EC / EW / ME / SE)", instrucao: "Formulações oleosas: adicionar após as suspensões até formar emulsão estável" },
  EO:          { grupo: 5, etapa: "Óleos e Emulsões (EC / EW / ME / SE)", instrucao: "Formulações oleosas: adicionar após as suspensões até formar emulsão estável" },
  EW:          { grupo: 5, etapa: "Óleos e Emulsões (EC / EW / ME / SE)", instrucao: "Formulações oleosas: adicionar após as suspensões até formar emulsão estável" },
  ME:          { grupo: 5, etapa: "Óleos e Emulsões (EC / EW / ME / SE)", instrucao: "Formulações oleosas: adicionar após as suspensões até formar emulsão estável" },
  ADJ:         { grupo: 6, etapa: "Adjuvantes / Óleos", instrucao: "Adicionar por último para fixação e espalhamento" },
  ADJ_OLEO:    { grupo: 6, etapa: "Adjuvantes / Óleos", instrucao: "Adicionar por último para fixação e espalhamento" },
  SURFACTANTE: { grupo: 6, etapa: "Adjuvantes / Óleos", instrucao: "Adicionar por último para fixação e espalhamento" },
  REDUTOR:     { grupo: 6, etapa: "Adjuvantes / Óleos", instrucao: "Adicionar por último (antiespuma) antes de completar o volume" },
  FOLIARE:     { grupo: 4, etapa: "Concentrados Solúveis (SL / SP)", instrucao: "Adicionar com agitação — atenção ao pH do fertilizante" },
};

const DEFAULT_DRONE_INFO = { grupo: 4, etapa: "Concentrados Solúveis (SL / SP)", instrucao: "Pré-diluir e adicionar com agitação constante" };

function getDroneInfo(f: string) {
  return ORDEM_DRONE[f] || DEFAULT_DRONE_INFO;
}

const UNIDADE_PADRAO: Record<string, "L/ha" | "kg/ha"> = {
  CORRETIVO: "L/ha",
  SG: "kg/ha", SP: "kg/ha", WP: "kg/ha", WG: "kg/ha",
  CS: "L/ha", SC: "L/ha", OD: "L/ha",
  SE: "L/ha",
  EC: "L/ha", ADJ_OLEO: "L/ha", ADJ: "L/ha", EO: "L/ha", EW: "L/ha", ME: "L/ha",
  SL: "L/ha",
  SURFACTANTE: "L/ha", FOLIARE: "L/ha", REDUTOR: "L/ha",
};

interface ProdutoCadastrado {
  id: string;
  commercial_name: string;
  formulation: string;
  unit: string;
  package_size: number;
}

/**
 * O histórico de caldas migrou de `localStorage` para a tabela
 * `spray_mix_recipes` no PostgreSQL, para acompanhar oTalhão em qualquer
 * dispositivo. As duas formas abaixo traduzem entre o formato da tela e o
 * formato persistido.
 */
function toHistorico(record: CalculoCaldaRecord): HistoricoCalda {
  return {
    id: record.id,
    data: record.data,
    talhao: record.talhao,
    areaTalhao: record.areaTalhao,
    vazaoTrabalho: record.vazaoTrabalho,
    capacidadeTanque: record.capacidadeTanque,
    produtos: record.produtos as unknown as Produto[],
    volumeTotal: record.volumeTotalCalda,
    tanquesCheios: record.tanquesCheios,
    volumeRestante: record.volumeRestante,
    tanquesNecessarios: record.tanquesNecessarios,
    modo: record.modo as ModoAplicacao | undefined,
  };
}

export default function CalculadoraCalda() {
  const [modo, setModo] = useState<ModoAplicacao>("terrestre");
  const [talhao, setTalhao] = useState("");
  const [areaTalhao, setAreaTalhao] = useState<number>(0);
  const [vazaoTrabalho, setVazaoTrabalho] = useState<number>(0);
  const [capacidadeTanque, setCapacidadeTanque] = useState<number>(0);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaFormulacao, setNovaFormulacao] = useState<string>("SL");
  const [novaDose, setNovaDose] = useState<number>(0);
  const [novaUnidade, setNovaUnidade] = useState<"L/ha" | "kg/ha">("L/ha");

  const [mostrarResultado, setMostrarResultado] = useState(false);

  // History
  const [historico, setHistorico] = useState<HistoricoCalda[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [searchHistorico, setSearchHistorico] = useState("");
  const [expandedHistorico, setExpandedHistorico] = useState<string | null>(null);

  // Autocomplete state
  const [produtosCadastrados, setProdutosCadastrados] = useState<ProdutoCadastrado[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<ProdutoCadastrado[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // ── OS em aberto ──────────────────────────────────────────
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [osSearch, setOsSearch] = useState("");
  const [showOsSuggestions, setShowOsSuggestions] = useState(false);
  const [selectedOS, setSelectedOS] = useState<OrdemServico | null>(null);
  const [selectedTalhaoIdx, setSelectedTalhaoIdx] = useState<number | null>(null);
  const [showCapacityDialog, setShowCapacityDialog] = useState(false);
  const [availableCapacities, setAvailableCapacities] = useState<number[]>([]);
  const osInputRef = useRef<HTMLInputElement>(null);
  const osSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAllOS().then((all) => {
      const abertas = all.filter((o) => !o.status || o.status === "aberta" || o.status === "em_andamento");
      setOrdens(abertas);
    });
  }, []);

  useEffect(() => {
    getAllCalculosCalda()
      .then((lista) => setHistorico(lista.map(toHistorico)))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar o histórico de caldas."));
  }, []);

  const filteredOS = useMemo(() => {
    if (!osSearch.trim()) return ordens;
    const s = osSearch.toLowerCase();
    return ordens.filter((o) =>
      o.id.toLowerCase().includes(s) ||
      (o.osExterna || "").toLowerCase().includes(s) ||
      (o.propriedade || "").toLowerCase().includes(s)
    );
  }, [osSearch, ordens]);

  const handleSelectOS = (os: OrdemServico) => {
    setSelectedOS(os);
    setSelectedTalhaoIdx(null);
    setOsSearch(os.osExterna ? `${os.id}  ${os.osExterna}` : os.id);
    setShowOsSuggestions(false);
    setMostrarResultado(false);
  };

  // ── Cadastro de produtos (Supabase) ──────────────────────────────────
  const obterCadastro = async (): Promise<ProdutoCadastrado[]> => {
    if (produtosCadastrados.length > 0) return produtosCadastrados;
    const { data } = await supabase
      .from("registered_products")
      .select("id, commercial_name, formulation, unit, package_size");
    const lista = (data as ProdutoCadastrado[]) || [];
    if (lista.length > 0) setProdutosCadastrados(lista);
    return lista;
  };

  const normalizarNome = (nome: string) =>
    (nome || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

  // Devolve a formulação cadastrada para o produto (busca exata ou parcial), com fallback "SL"
  const resolverFormulacao = (
    nomeProduto: string,
    cadastro: ProdutoCadastrado[]
  ): { formulacao: string; encontrado: boolean } => {
    const alvo = normalizarNome(nomeProduto);
    if (!alvo) return { formulacao: "SL", encontrado: false };

    const encontrado =
      cadastro.find((p) => normalizarNome(p.commercial_name) === alvo) ||
      (alvo.length >= 3
        ? cadastro.find((p) => {
            const nome = normalizarNome(p.commercial_name);
            return nome.length >= 3 && (nome.includes(alvo) || alvo.includes(nome));
          })
        : undefined);

    const codigo = (encontrado?.formulation || "").trim().toUpperCase();
    if (codigo) return { formulacao: codigo, encontrado: true };
    return { formulacao: "SL", encontrado: false };
  };

  const handleSelectTalhao = async (talhaoData: TalhaoData, idx: number) => {
    setSelectedTalhaoIdx(idx);
    setTalhao(talhaoData.nome);
    setAreaTalhao(parseFloat(talhaoData.area) || 0);
    // Preenche vazão do cabeçalho da OS, se disponível
    if (selectedOS?.volumeCaldaHa) {
      setVazaoTrabalho(parseFloat(selectedOS.volumeCaldaHa) || 0);
    }
    // Importa produtos do talhão carregando a formulação do cadastro de produtos
    const cadastro = await obterCadastro();
    const resolvidos = talhaoData.produtos.map((p) => ({
      produto: p,
      ...resolverFormulacao(p.produto, cadastro),
    }));
    const produtosImportados: Produto[] = resolvidos.map(({ produto: p, formulacao }, i) => ({
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36) + i,
      nome: p.produto,
      formulacao,
      dose: parseFloat(p.dose) || 0,
      unidade: (p.unit === "KG" ? "kg/ha" : "L/ha") as "L/ha" | "kg/ha",
    }));
    const doCadastro = resolvidos.filter((r) => r.encontrado).length;
    const semCadastro = resolvidos.length - doCadastro;
    setProdutos(produtosImportados);
    setMostrarResultado(false);
    toast.success(`Talhão "${talhaoData.nome}" carregado com ${produtosImportados.length} produto(s)!`);
    if (doCadastro > 0) {
      toast.info(`Formulação carregada do cadastro para ${doCadastro} produto(s).`);
    }
    if (semCadastro > 0) {
      toast.warning(
        `${semCadastro} produto(s) não encontrados no cadastro — formulação padrão "SL" aplicada. Verifique a lista abaixo.`
      );
    }

    // Lógica de capacidade do tanque baseada nos equipamentos vinculados
    // (somente no modo terrestre — tanques de pulverizador não se aplicam a drones)
    if (modo !== "drone" && selectedOS?.equipamentos && selectedOS.equipamentos.length > 0) {
      getAllEquipments().then((all) => {
        const linked = all.filter(e => selectedOS.equipamentos?.includes(e.fleet_number));
        const capacities = Array.from(new Set(linked.map(e => e.tank_capacity))).filter(c => !!c);
        
        if (capacities.length === 1) {
          setCapacidadeTanque(capacities[0]);
          toast.info(`Capacidade do tanque definida para ${capacities[0]}L (Equipamento: ${linked[0].fleet_number})`);
        } else if (capacities.length > 1) {
          setAvailableCapacities(capacities);
          setShowCapacityDialog(true);
        }
      });
    }
  };

  const handleClearOS = () => {
    setSelectedOS(null);
    setSelectedTalhaoIdx(null);
    setOsSearch("");
    setTalhao("");
    setAreaTalhao(0);
    setProdutos([]);
    setMostrarResultado(false);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("registered_products").select("id, commercial_name, formulation, unit, package_size");
      if (data) setProdutosCadastrados(data as ProdutoCadastrado[]);
    };
    fetchProducts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (osSuggestionsRef.current && !osSuggestionsRef.current.contains(e.target as Node) &&
          osInputRef.current && !osInputRef.current.contains(e.target as Node)) {
        setShowOsSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNomeChange = (value: string) => {
    setNovoNome(value);
    if (value.trim().length > 0) {
      const filtered = produtosCadastrados.filter((p) =>
        p.commercial_name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const [selectedPackageSize, setSelectedPackageSize] = useState<number | undefined>();
  const [selectedPackageUnit, setSelectedPackageUnit] = useState<string | undefined>();

  const handleSelectProduct = (product: ProdutoCadastrado) => {
    setNovoNome(product.commercial_name);
    const mapped = product.formulation || "SL";
    handleFormulacaoChange(mapped);
    setNovaUnidade(product.unit === "KG" ? "kg/ha" : "L/ha");
    setSelectedPackageSize(product.package_size);
    setSelectedPackageUnit(product.unit);
    setShowSuggestions(false);
  };

  const areaPorTanque = useMemo(() => {
    if (vazaoTrabalho <= 0) return 0;
    return capacidadeTanque / vazaoTrabalho;
  }, [capacidadeTanque, vazaoTrabalho]);

  const volumeTotal = useMemo(() => areaTalhao * vazaoTrabalho, [areaTalhao, vazaoTrabalho]);

  const tanquesCheios = useMemo(() => {
    if (capacidadeTanque <= 0) return 0;
    return Math.floor(volumeTotal / capacidadeTanque);
  }, [volumeTotal, capacidadeTanque]);

  const volumeRestante = useMemo(() => {
    if (capacidadeTanque <= 0) return 0;
    return volumeTotal - tanquesCheios * capacidadeTanque;
  }, [volumeTotal, tanquesCheios, capacidadeTanque]);

  const tanquesNecessarios = useMemo(() => {
    if (capacidadeTanque <= 0 || volumeTotal <= 0) return 0;
    return Math.ceil(volumeTotal / capacidadeTanque);
  }, [volumeTotal, capacidadeTanque]);

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort(
      (a, b) => getFormulacaoInfo(a.formulacao).ordem - getFormulacaoInfo(b.formulacao).ordem
    );
  }, [produtos]);

  // Ordem de adição aplicada no relatório (drone usa a regra WALES/DARE, terrestre mantém a ordem tradicional)
  const listaOrdem = useMemo(() => {
    if (modo !== "drone") return produtosOrdenados;
    return [...produtos].sort((a, b) => {
      const ga = getDroneInfo(a.formulacao).grupo;
      const gb = getDroneInfo(b.formulacao).grupo;
      if (ga !== gb) return ga - gb;
      return getFormulacaoInfo(a.formulacao).ordem - getFormulacaoInfo(b.formulacao).ordem;
    });
  }, [modo, produtos, produtosOrdenados]);

  const atualizarProduto = (id: string, patch: Partial<Produto>) => {
    setProdutos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setMostrarResultado(false);
  };

  // ── Validações específicas do modo Drone ─────────────────────────────
  const droneChecks = useMemo(() => {
    const bloqueios: string[] = [];
    const alertas: { nivel: "critico" | "atencao"; texto: string }[] = [];
    const vazio = { bloqueios, alertas, fcTotal: 0, somaDoses: 0, volumeMinimoAgua: 0, aguaDisponivel: 0 };

    if (modo !== "drone") return vazio;

    const somaDoses = produtos.reduce((s, p) => s + (Number(p.dose) || 0), 0);
    // FC_total = (Σ P_tanque / C_tanque) × 100  —  como P_tanque = D_ha × C / V, simplifica para (Σ D_ha / V) × 100
    const fcTotal = vazaoTrabalho > 0 ? (somaDoses / vazaoTrabalho) * 100 : 0;
    const aguaDisponivel = capacidadeTanque * AGUA_INICIAL_FRACAO;
    const volumePosEOleos = produtos
      .filter((p) => FORMULACOES_SOLIDAS.includes(p.formulacao) || FORMULACOES_OLEOSAS.includes(p.formulacao))
      .reduce((s, p) => s + (Number(p.dose) || 0), 0);
    const volumeMinimoAgua = volumePosEOleos * FATOR_DILUICAO_PRE;

    // 1) Faixa de taxa de aplicação do drone
    if (vazaoTrabalho > 0 && vazaoTrabalho < DRONE_V_MIN) {
      alertas.push({
        nivel: "critico",
        texto: `Taxa de ${vazaoTrabalho} L/ha é inferior à faixa usual do drone (${DRONE_V_MIN}–${DRONE_V_MAX} L/ha): calda extremamente concentrada, risco de entupimento de bicos, precipitação e fitotoxicidade.`,
      });
    } else if (vazaoTrabalho > DRONE_V_MAX) {
      alertas.push({
        nivel: "atencao",
        texto: `Taxa de ${vazaoTrabalho} L/ha está acima da faixa usual do drone (${DRONE_V_MIN}–${DRONE_V_MAX} L/ha). Verifique a recomendação do fabricante do equipamento.`,
      });
    }

    // 2) Fator de Concentração (FC%)
    if (fcTotal > FC_CRITICO) {
      const vNecessaria = somaDoses / (FC_CRITICO / 100);
      const fcEmVMax = (somaDoses / DRONE_V_MAX) * 100;
      const passadas = Math.max(2, Math.ceil(fcEmVMax / FC_CRITICO));
      const sugestao =
        vNecessaria > vazaoTrabalho && vNecessaria <= DRONE_V_MAX
          ? `Aumente a taxa de aplicação para ${Math.ceil(vNecessaria)} L/ha.`
          : `Mesmo a ${DRONE_V_MAX} L/ha o FC seria ${fcEmVMax.toFixed(1)}%: aumente para ${DRONE_V_MAX} L/ha e fracione a aplicação em ${passadas} passadas de ${(areaTalhao / passadas).toFixed(1)} ha.`;
      alertas.push({
        nivel: "critico",
        texto: `FC ${fcTotal.toFixed(1)}% (limite crítico ${FC_CRITICO}%): alta concentração com risco de floculação, empelotamento e entupimento. ${sugestao}`,
      });
    } else if (fcTotal > FC_ALERTA) {
      alertas.push({
        nivel: "atencao",
        texto: `FC ${fcTotal.toFixed(1)}% (alerta a partir de ${FC_ALERTA}%): concentração elevada. Considere aumentar a taxa de aplicação para ${Math.ceil(somaDoses / (FC_CRITICO / 100))} L/ha ou fracionar em duas passadas.`,
      });
    }

    // 3) Choque de pH (ácido vs. alcalino)
    const temAcido = produtos.some((p) => p.phGrupo === "acido");
    const temAlcalino = produtos.some((p) => p.phGrupo === "alcalino");
    if (temAcido && temAlcalino) {
      bloqueios.push(
        "Choque de pH: produtos que exigem pH ácido (4,5–5,5) — ex.: inseticidas organofosforados — não devem ser misturados com produtos alcalinos (pH > 7,5) — ex.: fertilizantes foliares. Risco de hidrólise alcalina imediata. Bloqueada a mistura direta no mesmo tanque."
      );
    }

    // 4) Volume mínimo de água na pré-mistura: no mínimo 10× a soma de pós e óleos
    if (volumeMinimoAgua > 0 && aguaDisponivel < volumeMinimoAgua) {
      bloqueios.push(
        `Pré-mistura insuficiente: o volume de pós e óleos soma ${volumePosEOleos.toFixed(2)} e exige no mínimo ${volumeMinimoAgua.toFixed(1)} L de água (10×) na pré-mistura, mas há apenas ${aguaDisponivel.toFixed(1)} L iniciais no tanque de ${capacidadeTanque} L. Faça a pré-diluição em recipiente externo ou reduza o número de produtos.`
      );
    }

    // 5) EC + SC / WDG em baixo volume tende a quebrar a emulsão
    const temOleo = produtos.some((p) => FORMULACOES_OLEOSAS.includes(p.formulacao));
    const temSuspensao = produtos.some((p) => FORMULACOES_SUSPENSAO.includes(p.formulacao));
    if (temOleo && temSuspensao) {
      alertas.push({
        nivel: "atencao",
        texto: "Mistura de Concentrados Emulsionáveis (EC) com Suspensões Concentradas (SC) / pós em baixo volume: risco de quebra da emulsão e grumo no fundo do tanque. Adicione os sólidos antes, garanta o volume mínimo de água da pré-mistura e só então os produtos oleosos.",
      });
    }

    return { bloqueios, alertas, fcTotal, somaDoses, volumeMinimoAgua, aguaDisponivel };
  }, [modo, produtos, vazaoTrabalho, capacidadeTanque, areaTalhao]);

  const handleAdicionarProduto = () => {
    if (!novoNome.trim() || novaDose <= 0) return;
    const novoProduto: Produto = {
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      nome: novoNome.trim(),
      formulacao: novaFormulacao,
      dose: novaDose,
      unidade: novaUnidade,
      packageSize: selectedPackageSize,
      packageUnit: selectedPackageUnit,
    };
    setProdutos((prev) => [...prev, novoProduto]);
    setNovoNome("");
    setNovaDose(0);
    setSelectedPackageSize(undefined);
    setSelectedPackageUnit(undefined);
    setMostrarResultado(false);
  };

  const handleRemoverProduto = (id: string) => {
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    setMostrarResultado(false);
  };

  const handleFormulacaoChange = (val: string) => {
    setNovaFormulacao(val);
    setNovaUnidade(UNIDADE_PADRAO[val] || "L/ha");
  };

  const trocarModo = (novo: ModoAplicacao) => {
    if (novo === modo) return;
    setModo(novo);
    setMostrarResultado(false);
  };

  const podeCalcular =
    produtos.length > 0 &&
    vazaoTrabalho > 0 &&
    capacidadeTanque > 0 &&
    areaTalhao > 0 &&
    droneChecks.bloqueios.length === 0;

  const handleCalcular = async () => {
    setMostrarResultado(true);
    // Save to history
    const entry: HistoricoCalda = {
      id: Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
      data: new Date().toISOString(),
      talhao: talhao || "Sem nome",
      areaTalhao,
      vazaoTrabalho,
      capacidadeTanque,
      produtos: [...produtos],
      volumeTotal,
      tanquesCheios,
      volumeRestante,
      tanquesNecessarios,
      modo,
    };
    try {
      await saveCalculoCalda({
        id: entry.id,
        data: entry.data,
        talhao: entry.talhao,
        areaTalhao: entry.areaTalhao,
        vazaoTrabalho: entry.vazaoTrabalho,
        capacidadeTanque: entry.capacidadeTanque,
        produtos: entry.produtos as unknown as CalculoCaldaRecord["produtos"],
        volumeTotalCalda: entry.volumeTotal,
        tanquesCheios: entry.tanquesCheios,
        volumeRestante: entry.volumeRestante,
        tanquesNecessarios: entry.tanquesNecessarios,
        modo: entry.modo,
      });
      setHistorico((prev) => [entry, ...prev]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o histórico de caldas.");
    }
  };

  const handleShare = async () => {
    const cabecalhoDrone =
      modo === "drone"
        ? `🛸 *MODO DRONE (baixo volume)*\n` +
          `🧮 *Fórmula:* P_tanque = (D_ha × ${capacidadeTanque} L) / ${vazaoTrabalho} L/ha\n` +
          (droneChecks.fcTotal > 0 ? `⚖️ *FC (concentração):* ${droneChecks.fcTotal.toFixed(1)}%\n` : "")
        : "";
    const text = `📋 *RELATÓRIO DE MISTURA - MedBico*\n\n` +
      `📌 *Talhão:* ${talhao || "Não informado"}\n` +
      `📏 *Área:* ${areaTalhao} ha\n` +
      `💧 *${modo === "drone" ? "Taxa de aplicação" : "Vazão"}:* ${vazaoTrabalho} L/ha\n` +
      `🚜 *Capacidade Tanque:* ${capacidadeTanque.toLocaleString("pt-BR")} L\n` +
      cabecalhoDrone +
      `\n📋 *PLANO DE ABASTECIMENTO:*\n` +
      (tanquesCheios > 0 ? `👉 *${tanquesCheios}x* tanques cheios (${areaPorTanque.toFixed(1)} ha cada)\n` : "") +
      (volumeRestante > 0 ? `👉 *1x* tanque parcial com *${volumeRestante.toLocaleString("pt-BR")} L* (${(volumeRestante / vazaoTrabalho).toFixed(1)} ha)\n` : "") +
      `Total: ${tanquesNecessarios} abastecimento(s)\n\n` +
      `🧪 *ORDEM DE ADIÇÃO (por tanque cheio):*\n` +
      `1. Água (70%): ${(capacidadeTanque * AGUA_INICIAL_FRACAO).toLocaleString("pt-BR")} L\n` +
      listaOrdem.map((p, i) => {
        const doseCheio = areaPorTanque * p.dose;
        const un = p.unidade === "L/ha" ? "L" : "kg";
        return `${i + 2}. ${p.nome} (${p.formulacao}): *${(doseCheio % 1 === 0 ? doseCheio.toFixed(0) : doseCheio.toFixed(3))} ${un}*`;
      }).join("\n") +
      `\n${listaOrdem.length + 2}. Completar até ${capacidadeTanque.toLocaleString("pt-BR")} L\n\n` +
      `⚠ *Mantenha a agitação ligada!*` +
      (modo === "drone" ? `\n🛸 *Pré-dilua sólidos em recipiente externo e agite 30–60 s entre adições.*` : "");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Relatório de Mistura - ${talhao}`,
          text: text,
        });
      } catch (err) {
        console.error("Erro ao compartilhar:", err);
      }
    } else {
      // Fallback: Copy to clipboard or WhatsApp link
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    }
  };

  const handleRemoverHistorico = async (id: string) => {
    try {
      await deleteCalculoCalda(id);
      setHistorico((prev) => prev.filter((h) => h.id !== id));
      if (expandedHistorico === id) setExpandedHistorico(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir o registro.");
    }
  };

  const handleCarregarHistorico = (h: HistoricoCalda) => {
    setModo(h.modo || "terrestre");
    setTalhao(h.talhao);
    setAreaTalhao(h.areaTalhao);
    setVazaoTrabalho(h.vazaoTrabalho);
    setCapacidadeTanque(h.capacidadeTanque);
    setProdutos([...h.produtos]);
    setMostrarResultado(true);
    setExpandedHistorico(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Cálculo restaurado do histórico!");
  };

  const filteredHistorico = historico.filter((h) => {
    const s = searchHistorico.toLowerCase();
    if (!s) return true;
    return (
      h.talhao.toLowerCase().includes(s) ||
      h.produtos.some((p) => p.nome.toLowerCase().includes(s))
    );
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handlePrint = () => window.print();

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <FlaskConical className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-heading text-foreground">Calculadora de Calda</h1>
          <p className="text-sm text-muted-foreground">
            Ordem de mistura e dosagem por tanque
          </p>
        </div>
      </div>

      {/* ── Modo de aplicação: Terrestre × Drone ── */}
      <Card className="mb-6 print:hidden">
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Modo de aplicação</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => trocarModo("terrestre")}
              className={`rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${
                modo === "terrestre" ? "border-primary bg-primary/10" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading text-sm">🚜 Terrestre</p>
                  <p className="text-xs text-muted-foreground">100 a 200 L/ha</p>
                </div>
                {modo === "terrestre" && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
              </div>
            </button>
            <button
              type="button"
              onClick={() => trocarModo("drone")}
              className={`rounded-lg border p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5 ${
                modo === "drone" ? "border-primary bg-primary/10" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-heading text-sm">🛸 Drone</p>
                  <p className="text-xs text-muted-foreground">5 a 20 L/ha (baixo volume)</p>
                </div>
                {modo === "drone" && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
              </div>
            </button>
          </div>
          {modo === "drone" && (
            <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs text-foreground space-y-0.5">
              <p className="font-medium">⚠️ Volume de calda 5 a 10× menor que no terrestre — a concentração de defensivos na calda fica de 5 a 10 vezes maior.</p>
              <p className="text-muted-foreground">
                Isso aumenta o risco de incompatibilidade física e química (floculação, empelotamento, separação de fases, cristalização e entupimento de bicos). O sistema calcula a dosagem por tanque pela fórmula P = (D<sub>ha</sub> × C<sub>tanque</sub>) / V, valida o Índice de Saturação (FC%) e gera a ordem de mistura.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Importar de OS em Aberto ── */}
      <Card className="mb-6 print:hidden border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Importar de Ordem de Serviço
            {ordens.length > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {ordens.length} em aberto
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Busca OS */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={osInputRef}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Buscar OS por número, nº externo ou propriedade..."
                  value={osSearch}
                  onChange={(e) => {
                    setOsSearch(e.target.value);
                    setShowOsSuggestions(true);
                    if (!e.target.value) { setSelectedOS(null); setSelectedTalhaoIdx(null); }
                  }}
                  onFocus={() => setShowOsSuggestions(true)}
                  autoComplete="off"
                />
              </div>
              {selectedOS && (
                <button
                  type="button"
                  onClick={handleClearOS}
                  className="px-3 py-2 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors text-sm flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  Limpar
                </button>
              )}
            </div>

            {/* Dropdown de OS */}
            {showOsSuggestions && filteredOS.length > 0 && !selectedOS && (
              <div
                ref={osSuggestionsRef}
                className="absolute z-50 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
              >
                {filteredOS.map((os) => (
                  <button
                    key={os.id}
                    type="button"
                    className="w-full text-left px-4 py-3 text-sm hover:bg-accent hover:text-accent-foreground border-b border-border/50 last:border-0"
                    onClick={() => handleSelectOS(os)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium font-mono">{os.id}</span>
                        {os.osExterna && <span className="ml-2 text-xs text-muted-foreground">OS Ext: {os.osExterna}</span>}
                      </div>
                      <Badge variant="outline" className={`text-xs ${
                        os.status === "em_andamento" ? "border-warning/50 text-warning" : "border-success/50 text-success"
                      }`}>
                        {os.status === "em_andamento" ? "Em andamento" : "Aberta"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{os.propriedade || ""}</span>
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" />{os.talhoes?.length || 0} talhão(ões)</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {ordens.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2 text-center py-2">
                Nenhuma OS em aberto encontrada. Crie uma OS no módulo de Ordens de Serviço.
              </p>
            )}
          </div>

          {/* OS selecionada → listar talhões */}
          {selectedOS && (
            <div className="space-y-2 animate-fade-in">
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">OS {selectedOS.id}</span>
                    {selectedOS.osExterna && <span className="text-xs text-muted-foreground">" Ext: {selectedOS.osExterna}</span>}
                  </div>
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {selectedOS.talhoes?.length || 0} talhão(ões)
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{selectedOS.propriedade || ""}
                  {selectedOS.volumeCaldaHa && <> · <Droplets className="h-3 w-3" />{selectedOS.volumeCaldaHa} L/ha</>}
                </p>
              </div>

              <p className="text-xs font-medium text-muted-foreground px-1">Selecione o talhão para calcular:</p>
              <div className="grid gap-2">
                {(selectedOS.talhoes || []).map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectTalhao(t, idx)}
                    className={`w-full text-left rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-primary/5 ${
                      selectedTalhaoIdx === idx
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{t.nome || `Talhão ${idx + 1}`}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{t.area || ""} ha</span>
                          {t.produtos?.length > 0 && (
                            <span>{t.produtos.length} produto(s)</span>
                          )}
                          {t.testemunho && <span className="text-warning">Testemunho</span>}
                        </div>
                      </div>
                      {selectedTalhaoIdx === idx && (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      )}
                    </div>
                    {t.produtos?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.produtos.slice(0, 4).map((p, pi) => (
                          <span key={pi} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                            {p.produto}
                          </span>
                        ))}
                        {t.produtos.length > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">+{t.produtos.length - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Campos de vazão + tanque + botão Calcular — aparecem após talhão selecionado */}
              {selectedTalhaoIdx !== null && (
                <div className="space-y-3 pt-2 border-t border-border animate-fade-in">
                  <p className="text-xs font-medium text-muted-foreground">
                    {modo === "drone" ? "Parâmetros do drone:" : "Parâmetros do equipamento:"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="vazao-os" className="text-xs">
                        {modo === "drone" ? "Taxa de aplicação (L/ha)" : "Vazão de trabalho (L/ha)"}
                      </Label>
                      <Input
                        id="vazao-os"
                        type="number"
                        min={0}
                        step={modo === "drone" ? 1 : 100}
                        placeholder={modo === "drone" ? "Ex: 10" : "Ex: 100"}
                        value={vazaoTrabalho || ""}
                        onChange={(e) => setVazaoTrabalho(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="tanque-os" className="text-xs">
                        {modo === "drone" ? "Tanque do drone (L)" : "Capacidade do tanque (L)"}
                      </Label>
                      <Input
                        id="tanque-os"
                        type="number"
                        min={0}
                        step={modo === "drone" ? 10 : 100}
                        placeholder={modo === "drone" ? "Ex: 30" : "Ex: 2000"}
                        value={capacidadeTanque || ""}
                        onChange={(e) => setCapacidadeTanque(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Dicas do modo Drone */}
                  {modo === "drone" && (
                    <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-xs space-y-1.5">
                      <p className="text-foreground">
                        Faixa usual do drone: <span className="font-mono font-bold">{DRONE_V_MIN}–{DRONE_V_MAX} L/ha</span> · Tanques comuns: <span className="font-mono font-bold">5–50 L</span>
                        {" "}(terrestre: 100200 L/ha).
                      </p>
                      {vazaoTrabalho > 0 && (vazaoTrabalho < DRONE_V_MIN || vazaoTrabalho > DRONE_V_MAX) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-amber-700">
                            {vazaoTrabalho} L/ha está fora da faixa usual do drone.
                          </span>
                          <button
                            type="button"
                            className="rounded-full border border-warning/40 bg-background px-2 py-0.5 font-medium text-warning hover:bg-warning/10 transition-colors"
                            onClick={() => setVazaoTrabalho(10)}
                          >
                            Usar 10 L/ha
                          </button>
                        </div>
                      )}
                      {capacidadeTanque > 200 && (
                        <p className="text-amber-700">
                          Tanque de {capacidadeTanque.toLocaleString("pt-BR")} L parece ser de pulverizador terrestre  informe a capacidade real do drone.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Prévia de volumes */}
                  {areaPorTanque > 0 && volumeTotal > 0 && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-primary space-y-0.5">
                      <p className="font-medium">📋 Cada tanque cobre <span className="font-mono font-bold">{areaPorTanque.toFixed(1)} ha</span></p>
                      <p className="font-medium">Volume total: <span className="font-mono font-bold">{volumeTotal.toLocaleString("pt-BR")} L</span></p>
                      <p>
                        👉 <span className="font-mono font-bold">{tanquesCheios}</span> tanque(s) cheio(s)
                        {volumeRestante > 0 && <> + <span className="font-mono font-bold">1 parcial</span> de <span className="font-mono font-bold">{volumeRestante.toLocaleString("pt-BR")} L</span></>}
                      </p>
                    </div>
                  )}

                  {/* Lista de produtos importados */}
                  {produtos.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Produtos da OS ({produtos.length}):</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {produtos.map((p) => (
                          <div key={p.id} className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-foreground">{p.nome}</span>
                                <span className="ml-2 text-xs rounded-full px-1.5 py-0.5 bg-primary/10 text-primary font-mono">{p.formulacao}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{p.dose} {p.unidade}</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemoverProduto(p.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>

                            {/* Modo drone: código de formulação + pH (base da validação de compatibilidade) */}
                            {modo === "drone" && (
                              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-muted-foreground">Formulação</span>
                                  <Select value={p.formulacao} onValueChange={(v) => atualizarProduto(p.id, { formulacao: v })}>
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FORMULACAO_OPTIONS.map(([key, info]) => (
                                        <SelectItem key={key} value={key} className="text-xs">
                                          {key}  {info.descricao}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-muted-foreground">pH / compatibilidade</span>
                                  <Select
                                    value={p.phGrupo || "neutro"}
                                    onValueChange={(v) => atualizarProduto(p.id, { phGrupo: v as GrupoPh })}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {(Object.keys(PH_GRUPO_LABEL) as GrupoPh[]).map((g) => (
                                        <SelectItem key={g} value={g} className="text-xs">
                                          {PH_GRUPO_LABEL[g]}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pré-validação drone: bloqueios de compatibilidade */}
                  {modo === "drone" && droneChecks.bloqueios.length > 0 && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/40 p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <div className="text-xs text-destructive">
                        <p className="font-bold mb-1">Bloqueio de compatibilidade  mistura direta proibida:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {droneChecks.bloqueios.map((b, i) => (
                            <li key={`blk-${i}`}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Pré-validação drone: FC% e alertas de concentração */}
                  {modo === "drone" && vazaoTrabalho > 0 && (droneChecks.alertas.length > 0 || droneChecks.fcTotal > 0) && (
                    <div
                      className={`rounded-lg border p-3 text-xs space-y-1 ${
                        droneChecks.fcTotal > FC_CRITICO
                          ? "bg-destructive/10 border-destructive/40"
                          : droneChecks.fcTotal > FC_ALERTA
                          ? "bg-amber-50 border-amber-200"
                          : "bg-success/10 border-success/30"
                      }`}
                    >
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        <Beaker className="h-3.5 w-3.5" />
                        Índice de Saturação: FC {droneChecks.fcTotal.toFixed(1)}% (crítico acima de {FC_CRITICO}%)
                      </p>
                      {droneChecks.alertas.map((a, i) => (
                        <p key={`al-${i}`} className={a.nivel === "critico" ? "text-destructive" : "text-amber-700"}>
                          " {a.texto}
                        </p>
                      ))}
                      {droneChecks.alertas.length === 0 && (
                        <p className="text-success">• Concentração dentro do limite seguro para baixo volume.</p>
                      )}
                    </div>
                  )}

                  {!podeCalcular && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 animate-pulse">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-800">
                        <p className="font-bold mb-1">Pendências para calcular:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {produtos.length === 0 && <li>Adicione ou importe ao menos 1 produto</li>}
                          {!(vazaoTrabalho > 0) && <li>Informe a vazão de trabalho (L/ha)</li>}
                          {!(capacidadeTanque > 0) && <li>Informe a capacidade do tanque (L)</li>}
                          {!(areaTalhao > 0) && <li>A área do talhão deve ser maior que 0 ha</li>}
                        </ul>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleCalcular}
                    disabled={!podeCalcular}
                    variant="hero"
                    className="w-full"
                    size="lg"
                  >
                    <ListOrdered className="h-5 w-5" />
                    Calcular Ordem de Mistura
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>




      {/* Resultado / Relatório */}
      {mostrarResultado && podeCalcular && (
        <div ref={reportRef} className="print:p-0 print:m-0">
          {/* Print-only header with all field info */}
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-heading text-center mb-3 border-b-2 border-foreground pb-2">
              Relatório de Mistura — Ordem de Abastecimento
            </h1>
            <p className="text-center text-xs font-bold mb-3">
              Modo de aplicação: {modo === "drone" ? "🛸 DRONE (baixo volume — 5 a 20 L/ha)" : "🚜 TERRESTRE"}
              {modo === "drone" && ` · FC ${droneChecks.fcTotal.toFixed(1)}%`}
            </p>
            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
              <div className="border border-border rounded p-2">
                <span className="text-muted-foreground block">Talhão</span>
                <span className="font-bold">{talhao || ""}</span>
              </div>
              <div className="border border-border rounded p-2">
                <span className="text-muted-foreground block">Área</span>
                <span className="font-bold font-mono">{areaTalhao} ha</span>
              </div>
              <div className="border border-border rounded p-2">
                <span className="text-muted-foreground block">{modo === "drone" ? "Taxa" : "Vazão"}</span>
                <span className="font-bold font-mono">{vazaoTrabalho} L/ha</span>
              </div>
              <div className="border border-border rounded p-2">
                <span className="text-muted-foreground block">Tanque</span>
                <span className="font-bold font-mono">{capacidadeTanque.toLocaleString("pt-BR")} L</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-4">
              <div className="border border-border rounded p-2 text-center">
                <span className="text-muted-foreground block">Volume Total</span>
                <span className="font-bold font-mono text-sm">{volumeTotal.toLocaleString("pt-BR")} L</span>
              </div>
              <div className="border border-border rounded p-2 text-center">
                <span className="text-muted-foreground block">Tanques Cheios</span>
                <span className="font-bold font-mono text-sm">{tanquesCheios}x de {capacidadeTanque.toLocaleString("pt-BR")} L</span>
              </div>
              <div className="border border-border rounded p-2 text-center">
                <span className="text-muted-foreground block">Tanque Parcial</span>
                <span className="font-bold font-mono text-sm">
                  {volumeRestante > 0 ? `1x de ${volumeRestante.toLocaleString("pt-BR")} L` : "Nenhum"}
                </span>
              </div>
            </div>
          </div>

          <Card className="border-primary/30 shadow-lg animate-slide-up mb-6 overflow-visible print:shadow-none print:border-0">
            <CardHeader className="pb-3 print:hidden">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-primary" />
                  Relatório de Mistura
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleShare} className="print:hidden">
                    <Share2 className="h-4 w-4 mr-1" />
                    Compartilhar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                    <Printer className="h-4 w-4 mr-1" />
                    Imprimir
                  </Button>
                </div>
              </div>
              <CardDescription>
                {talhao && <>Talhão: {talhao} — </>}
                Volume total: {volumeTotal.toLocaleString("pt-BR")} L para {areaTalhao} ha
                {modo === "drone" && " — 🛸 Aplicação via Drone (baixo volume)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 print:p-0 print:space-y-2">
              {/* Agitation warning */}
              <div className="rounded-lg bg-warning/10 border border-warning/20 p-3 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <p className="font-medium text-foreground">
                  Mantenha a <strong>agitação ligada</strong> durante todo o processo de preparo da calda.
                </p>
              </div>

              {/* ── Bloco específico do modo Drone: fórmula, FC% e validações ── */}
              {modo === "drone" && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 break-inside-avoid">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading text-foreground text-sm flex items-center gap-2">
                      🛸 Dosagem por Tanque — Aplicação via Drone
                    </p>
                    <Badge variant="outline" className="text-xs border-primary/40 text-primary shrink-0">Drone</Badge>
                  </div>

                  {/* Fórmula aplicada */}
                  <div className="rounded-md bg-background border border-border p-2.5 text-xs font-mono text-foreground space-y-0.5">
                    <p className="font-bold">P_tanque = (D_ha × C_tanque) ÷ V</p>
                    <p className="text-muted-foreground">
                      P_tanque = (D_ha × {capacidadeTanque.toLocaleString("pt-BR")} L) ÷ {vazaoTrabalho} L/ha = D_ha × {areaPorTanque.toFixed(2)} ha/tanque
                    </p>
                  </div>

                  {/* Estatísticas */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded bg-background border border-border p-2 text-center">
                      <span className="text-muted-foreground block">Área/tanque</span>
                      <span className="font-bold font-mono text-sm">{areaPorTanque.toFixed(2)} ha</span>
                    </div>
                    <div className="rounded bg-background border border-border p-2 text-center">
                      <span className="text-muted-foreground block">Volume total</span>
                      <span className="font-bold font-mono text-sm">{volumeTotal.toLocaleString("pt-BR")} L</span>
                    </div>
                    <div className="rounded bg-background border border-border p-2 text-center">
                      <span className="text-muted-foreground block">Tanques</span>
                      <span className="font-bold font-mono text-sm">{tanquesNecessarios}x</span>
                    </div>
                  </div>

                  {/* Índice de Saturação (FC%) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">Fator de Concentração (FC)</span>
                      <span
                        className={`font-mono font-bold ${
                          droneChecks.fcTotal > FC_CRITICO
                            ? "text-destructive"
                            : droneChecks.fcTotal > FC_ALERTA
                            ? "text-warning"
                            : "text-success"
                        }`}
                      >
                        {droneChecks.fcTotal.toFixed(1)}% / {FC_CRITICO}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          droneChecks.fcTotal > FC_CRITICO
                            ? "bg-destructive"
                            : droneChecks.fcTotal > FC_ALERTA
                            ? "bg-warning"
                            : "bg-success"
                        }`}
                        style={{ width: `${Math.min(100, droneChecks.fcTotal)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      FC = (Σ produtos por tanque ÷ {capacidadeTanque.toLocaleString("pt-BR")} L) × 100 · alerta a partir de {FC_ALERTA}% · crítico acima de {FC_CRITICO}%
                    </p>
                  </div>

                  {/* Alertas e bloqueios de compatibilidade */}
                  {droneChecks.alertas.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {droneChecks.alertas.map((a, i) => (
                        <li
                          key={`rep-al-${i}`}
                          className={`flex items-start gap-1.5 ${a.nivel === "critico" ? "text-destructive" : "text-amber-700"}`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{a.texto}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {droneChecks.alertas.length === 0 && (
                    <p className="text-xs text-success flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Concentração e compatibilidade dentro dos limites seguros para baixo volume.
                    </p>
                  )}
                  {droneChecks.bloqueios.length > 0 && (
                    <ul className="space-y-1 text-xs text-destructive">
                      {droneChecks.bloqueios.map((b, i) => (
                        <li key={`rep-blk-${i}`} className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <p className="text-xs text-muted-foreground border-t border-border pt-2">
                    <strong>Ordem de mistura (WALES/DARE):</strong> água + corretivos (50–70%) → sólidos (WP/WG/SG/DF) pré-diluídos → suspensões (SC/CS) → solúveis (SL/SP) → oleosas (EC/EW/ME/SE) → adjuvantes/óleos por último. Agite 30–60 s entre cada adição e pré-dilua sólidos com no mínimo 10× o volume de pós e óleos.
                  </p>
                </div>
              )}

              {/* Resumo de abastecimentos - screen only */}
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 space-y-1 text-sm print:hidden">
                <p className="font-heading text-foreground">
                  📋 Plano de Abastecimento
                </p>
                {tanquesCheios > 0 && (
                  <p className="text-primary font-medium">
                    👉 <span className="font-mono font-bold">{tanquesCheios}x</span> tanque(s) cheio(s) de{" "}
                    <span className="font-mono font-bold">{capacidadeTanque.toLocaleString("pt-BR")} L</span>{" "}
                    ({areaPorTanque.toFixed(1)} ha cada)
                  </p>
                )}
                {volumeRestante > 0 && (
                  <p className="text-primary font-medium">
                    👉 <span className="font-mono font-bold">1x</span> tanque parcial com{" "}
                    <span className="font-mono font-bold">{volumeRestante.toLocaleString("pt-BR")} L</span>{" "}
                    ({(volumeRestante / vazaoTrabalho).toFixed(1)} ha)
                  </p>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Total: {tanquesNecessarios} abastecimento(s)
                </p>
              </div>

              {/* Dosagem Tanque Cheio */}
              {tanquesCheios > 0 && (
                <div className="break-inside-avoid">
                  <Separator className="print:hidden" />
                  <p className="font-heading text-foreground text-sm py-1">
                    🟢 Dosagem por Tanque Cheio ({capacidadeTanque.toLocaleString("pt-BR")} L — {areaPorTanque.toFixed(1)} ha)
                    {modo === "drone" && <span className="text-xs font-normal text-muted-foreground"> — P = (D_ha × {capacidadeTanque.toLocaleString("pt-BR")}) ÷ {vazaoTrabalho}</span>}
                  </p>
                  <div className="space-y-2 print:space-y-1">
                    {/* Passo 1: Água inicial */}
                    <div className={`rounded-lg border border-border p-3 print:p-2 print:rounded-none break-inside-avoid ${CATEGORIA_CONFIG.ÁGUA.bgClass}`}>
                      <div className="flex items-center gap-3 print:gap-2">
                        <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(200,70%,55%)] text-white font-heading text-sm print:text-xs">
                          <Droplets className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono rounded-full px-2 py-0.5 bg-[hsl(200,70%,55%)]/20 text-[hsl(200,70%,55%)]">ÁGUA</span>
                          </div>
                          <p className="font-heading text-foreground mt-0.5">
                            Encher o tanque com <span className="font-mono font-bold">{(capacidadeTanque * AGUA_INICIAL_FRACAO).toLocaleString("pt-BR")} L</span> de água (70%)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {modo === "drone" ? "Iniciar agitação máxima e manter (faixa ideal 50% a 70% do volume)" : "Iniciar agitação máxima e manter"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {listaOrdem.map((p, idx) => {
                      const doseCheio = areaPorTanque * p.dose;
                      const un = p.unidade === "L/ha" ? "L" : "kg";
                      const info = getFormulacaoInfo(p.formulacao);
                      const instrucao = modo === "drone" ? getDroneInfo(p.formulacao).instrucao : info.instrucao;
                      const etapaDrone = modo === "drone" ? getDroneInfo(p.formulacao).etapa : null;
                      const cat = CATEGORIA_CONFIG[info.categoria];
                      const galoes = p.packageSize ? doseCheio / p.packageSize : null;
                      return (
                        <div key={`cheio-${p.id}`} className={`rounded-lg border border-border p-3 print:p-2 print:rounded-none break-inside-avoid ${cat.bgClass}`}>
                          <div className="flex items-center gap-3 print:gap-2">
                            <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-heading text-sm print:text-xs">
                              {idx + 1}º
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading text-foreground print:text-sm">{p.nome}</span>
                                <span className={`text-xs rounded-full px-2 py-0.5 font-mono ${cat.bgClass} ${cat.textClass}`}>
                                  {p.formulacao}
                                </span>
                                <span className={`text-[10px] font-medium ${cat.textClass}`}>
                                  {cat.label}
                                </span>
                                {etapaDrone && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    {etapaDrone}
                                  </span>
                                )}
                              </div>
                              <p className="text-lg print:text-base font-mono font-bold text-primary mt-0.5">
                                {(doseCheio % 1 === 0 ? doseCheio.toFixed(0) : doseCheio.toFixed(3))} {un}
                              </p>
                              {galoes !== null && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                                  ≈ {galoes.toFixed(2)} embalagem(ns) de {p.packageSize} {p.packageUnit === "KG" ? "kg" : "L"}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground hidden print:block shrink-0">
                              {instrucao}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 print:hidden">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {instrucao}
                          </p>
                        </div>
                      );
                    })}

                    {/* Passo final: Água para completar */}
                    <div className={`rounded-lg border border-border p-3 print:p-2 print:rounded-none break-inside-avoid ${CATEGORIA_CONFIG.ÁGUA.bgClass}`}>
                      <div className="flex items-center gap-3 print:gap-2">
                        <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(200,70%,55%)] text-white font-heading text-sm print:text-xs">
                          <Droplets className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono rounded-full px-2 py-0.5 bg-[hsl(200,70%,55%)]/20 text-[hsl(200,70%,55%)]">ÁGUA</span>
                          </div>
                          <p className="font-heading text-foreground mt-0.5">
                            Completar o tanque até <span className="font-mono font-bold">{capacidadeTanque.toLocaleString("pt-BR")} L</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dosagem Tanque Parcial */}
              {volumeRestante > 0 && (
                <div className="break-inside-avoid">
                  <Separator className="print:hidden" />
                  <p className="font-heading text-foreground text-sm py-1">
                    🟡 Dosagem para Tanque Parcial ({volumeRestante.toLocaleString("pt-BR")} L — {(volumeRestante / vazaoTrabalho).toFixed(1)} ha)
                    {modo === "drone" && <span className="text-xs font-normal text-muted-foreground"> — P = (D_ha × {volumeRestante.toLocaleString("pt-BR")}) ÷ {vazaoTrabalho}</span>}
                  </p>
                  <div className="space-y-2 print:space-y-1">
                    {/* Passo 1: Água inicial parcial */}
                    <div className={`rounded-lg border border-border p-3 print:p-2 print:rounded-none break-inside-avoid ${CATEGORIA_CONFIG.ÁGUA.bgClass}`}>
                      <div className="flex items-center gap-3 print:gap-2">
                        <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(200,70%,55%)] text-white font-heading text-sm print:text-xs">
                          <Droplets className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono rounded-full px-2 py-0.5 bg-[hsl(200,70%,55%)]/20 text-[hsl(200,70%,55%)]">ÁGUA</span>
                          </div>
                          <p className="font-heading text-foreground mt-0.5">
                            Encher o tanque com <span className="font-mono font-bold">{(volumeRestante * AGUA_INICIAL_FRACAO).toLocaleString("pt-BR")} L</span> de água (70%)
                          </p>
                          <p className="text-xs text-muted-foreground">Iniciar agitação máxima e manter</p>
                        </div>
                      </div>
                    </div>

                    {listaOrdem.map((p, idx) => {
                      const areaParcial = volumeRestante / vazaoTrabalho;
                      const doseParcial = areaParcial * p.dose;
                      const un = p.unidade === "L/ha" ? "L" : "kg";
                      const info = getFormulacaoInfo(p.formulacao);
                      const instrucao = modo === "drone" ? getDroneInfo(p.formulacao).instrucao : info.instrucao;
                      const etapaDrone = modo === "drone" ? getDroneInfo(p.formulacao).etapa : null;
                      const cat = CATEGORIA_CONFIG[info.categoria];
                      const galoes = p.packageSize ? doseParcial / p.packageSize : null;
                      return (
                        <div key={`parcial-${p.id}`} className={`rounded-lg border border-border p-3 print:p-2 print:rounded-none break-inside-avoid ${cat.bgClass}`}>
                          <div className="flex items-center gap-3 print:gap-2">
                            <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground font-heading text-sm print:text-xs">
                              {idx + 1}º
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading text-foreground print:text-sm">{p.nome}</span>
                                <span className={`text-xs rounded-full px-2 py-0.5 font-mono ${cat.bgClass} ${cat.textClass}`}>
                                  {p.formulacao}
                                </span>
                                <span className={`text-[10px] font-medium ${cat.textClass}`}>
                                  {cat.label}
                                </span>
                                {etapaDrone && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    {etapaDrone}
                                  </span>
                                )}
                              </div>
                              <p className="text-lg print:text-base font-mono font-bold text-warning mt-0.5">
                                {(doseParcial % 1 === 0 ? doseParcial.toFixed(0) : doseParcial.toFixed(3))} {un}
                              </p>
                              {galoes !== null && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                                  ≈ {galoes.toFixed(2)} embalagem(ns) de {p.packageSize} {p.packageUnit === "KG" ? "kg" : "L"}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground hidden print:block shrink-0">
                              {instrucao}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 print:hidden">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {instrucao}
                          </p>
                        </div>
                      );
                    })}

                    {/* Passo final: Água para completar */}
                    <div className={`rounded-lg border border-border p-3 print:p-2 print:rounded-none break-inside-avoid ${CATEGORIA_CONFIG.ÁGUA.bgClass}`}>
                      <div className="flex items-center gap-3 print:gap-2">
                        <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(200,70%,55%)] text-white font-heading text-sm print:text-xs">
                          <Droplets className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono rounded-full px-2 py-0.5 bg-[hsl(200,70%,55%)]/20 text-[hsl(200,70%,55%)]">ÁGUA</span>
                          </div>
                          <p className="font-heading text-foreground mt-0.5">
                            Completar o tanque até <span className="font-mono font-bold">{volumeRestante.toLocaleString("pt-BR")} L</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Print footer */}
              <div className="hidden print:block pt-4 border-t border-border text-xs text-muted-foreground text-center">
                Gerado em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — MedBico
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Histórico */}
      <Card className="print:hidden">
        <CardHeader className="pb-4">
          <button
            type="button"
            className="flex items-center justify-between w-full"
            onClick={() => setShowHistorico(!showHistorico)}
          >
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Cálculos ({historico.length})
            </CardTitle>
            {showHistorico ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </button>
        </CardHeader>
        {showHistorico && (
          <CardContent className="space-y-4">
            {historico.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum cálculo registrado ainda.</p>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por talhão ou produto..."
                    value={searchHistorico}
                    onChange={(e) => setSearchHistorico(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredHistorico.map((h) => (
                    <div key={h.id} className="rounded-lg border border-border bg-muted/40">
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 flex items-center justify-between"
                        onClick={() => setExpandedHistorico(expandedHistorico === h.id ? null : h.id)}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-sm flex items-center gap-1.5">
                            {h.talhao}
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${h.modo === "drone" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
                              {h.modo === "drone" ? "🛸 Drone" : "🚜 Terrestre"}
                            </Badge>
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {formatDate(h.data)}  {h.areaTalhao} ha  {h.tanquesNecessarios} abast.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleRemoverHistorico(h.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                          {expandedHistorico === h.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      {expandedHistorico === h.id && (
                        <div className="px-4 pb-3 space-y-2 border-t border-border pt-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded bg-background p-2">
                              <span className="text-muted-foreground">{h.modo === "drone" ? "Taxa:" : "Vazão:"}</span>{" "}
                              <span className="font-mono font-medium">{h.vazaoTrabalho} L/ha</span>
                            </div>
                            <div className="rounded bg-background p-2">
                              <span className="text-muted-foreground">Tanque:</span>{" "}
                              <span className="font-mono font-medium">{h.capacidadeTanque.toLocaleString("pt-BR")} L</span>
                            </div>
                            <div className="rounded bg-background p-2">
                              <span className="text-muted-foreground">Vol. Total:</span>{" "}
                              <span className="font-mono font-medium">{h.volumeTotal.toLocaleString("pt-BR")} L</span>
                            </div>
                            <div className="rounded bg-background p-2">
                              <span className="text-muted-foreground">Abast.:</span>{" "}
                              <span className="font-mono font-medium">{h.tanquesCheios} cheio(s){h.volumeRestante > 0 ? ` + ${h.volumeRestante.toLocaleString("pt-BR")} L` : ""}</span>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-foreground">Produtos:</p>
                          {h.produtos.map((p) => (
                            <div key={p.id} className="text-xs flex items-center gap-2 rounded bg-background px-2 py-1.5">
                              <span className="font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">{p.formulacao}</span>
                              <span className="font-medium">{p.nome}</span>
                              <span className="text-muted-foreground ml-auto">{p.dose} {p.unidade}</span>
                            </div>
                          ))}
                          <div className="flex gap-2 mt-3 pt-2 border-t border-border/50">
                            <Button 
                              size="sm" 
                              variant="default" 
                              className="flex-1 h-8 text-xs font-semibold"
                              onClick={() => handleCarregarHistorico(h)}
                            >
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Visualizar / Carregar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/20"
                              onClick={(e) => { e.stopPropagation(); handleRemoverHistorico(h.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={showCapacityDialog} onOpenChange={setShowCapacityDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Selecionar Capacidade do Tanque
            </DialogTitle>
            <DialogDescription>
              A Ordem de Serviço possui equipamentos com capacidades diferentes vinculados. Selecione a capacidade desejada para o cálculo:
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {availableCapacities.map((cap) => (
              <Button
                key={cap}
                variant="outline"
                className="h-16 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5"
                onClick={() => {
                  setCapacidadeTanque(cap);
                  setShowCapacityDialog(false);
                  toast.success(`Capacidade de ${cap}L selecionada!`);
                }}
              >
                <span className="text-xl font-bold">{cap}</span>
                <span className="text-[10px] uppercase text-muted-foreground">Litros</span>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCapacityDialog(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
