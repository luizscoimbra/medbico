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
import { FlaskConical, Plus, Trash2, ListOrdered, Settings, Beaker, AlertTriangle, History, Search, Calendar, ChevronDown, ChevronUp, Printer, Droplets } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type FormulacaoConhecida = "WP" | "WG" | "SC" | "EC" | "SL" | "ADJ";

interface Produto {
  id: string;
  nome: string;
  formulacao: string;
  dose: number;
  unidade: "L/ha" | "kg/ha";
  packageSize?: number;
  packageUnit?: string;
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

const HISTORICO_KEY = "historico_calda";

function loadHistorico(): HistoricoCalda[] {
  try {
    const saved = localStorage.getItem(HISTORICO_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveHistorico(list: HistoricoCalda[]) {
  localStorage.setItem(HISTORICO_KEY, JSON.stringify(list));
}

export default function CalculadoraCalda() {
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
  const [historico, setHistorico] = useState<HistoricoCalda[]>(loadHistorico);
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

  const handleAdicionarProduto = () => {
    if (!novoNome.trim() || novaDose <= 0) return;
    const novoProduto: Produto = {
      id: crypto.randomUUID(),
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

  const podeCalcular = produtos.length > 0 && vazaoTrabalho > 0 && capacidadeTanque > 0;

  const handleCalcular = () => {
    setMostrarResultado(true);
    // Save to history
    const entry: HistoricoCalda = {
      id: crypto.randomUUID(),
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
    };
    const updated = [entry, ...historico];
    setHistorico(updated);
    saveHistorico(updated);
  };

  const handleRemoverHistorico = (id: string) => {
    const updated = historico.filter((h) => h.id !== id);
    setHistorico(updated);
    saveHistorico(updated);
    if (expandedHistorico === id) setExpandedHistorico(null);
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

      {/* Configuração do Tanque */}
      <Card className="mb-6 print:hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="talhao">Talhão</Label>
              <Input
                id="talhao"
                placeholder="Ex: T-01"
                value={talhao}
                onChange={(e) => setTalhao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areaTalhao">Área (ha)</Label>
              <Input
                id="areaTalhao"
                type="number"
                min={0}
                step={0.1}
                placeholder="Ex: 50"
                value={areaTalhao || ""}
                onChange={(e) => setAreaTalhao(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vazao">Vazão (L/ha)</Label>
              <Input
                id="vazao"
                type="number"
                min={0}
                step={1}
                placeholder="Ex: 100"
                value={vazaoTrabalho || ""}
                onChange={(e) => setVazaoTrabalho(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tanque">Tanque (L)</Label>
              <Input
                id="tanque"
                type="number"
                min={0}
                step={100}
                placeholder="Ex: 2000"
                value={capacidadeTanque || ""}
                onChange={(e) => setCapacidadeTanque(Number(e.target.value))}
              />
            </div>
          </div>
          {areaPorTanque > 0 && (
            <div className="rounded-lg bg-primary/10 p-4 text-sm text-primary space-y-2">
              <p className="font-medium">
                Cada tanque cobre <span className="font-mono font-bold">{areaPorTanque.toFixed(1)} ha</span>
              </p>
              {volumeTotal > 0 && (
                <div className="space-y-1 border-t border-primary/20 pt-2">
                  <p className="font-medium">
                    Volume total necessário: <span className="font-mono font-bold">{volumeTotal.toLocaleString("pt-BR")} L</span>
                  </p>
                  <p className="font-medium">
                    👉 <span className="font-mono font-bold">{tanquesCheios}</span> tanque(s) cheio(s) de {capacidadeTanque.toLocaleString("pt-BR")} L
                    {volumeRestante > 0 && (
                      <> + <span className="font-mono font-bold">1 tanque parcial</span> com <span className="font-mono font-bold">{volumeRestante.toLocaleString("pt-BR")} L</span></>
                    )}
                  </p>
                  <p className="text-xs text-primary/70">
                    Total: <span className="font-mono">{tanquesNecessarios} abastecimento(s)</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adicionar Produtos */}
      <Card className="mb-6 print:hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Adicionar Produto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 relative">
            <Label htmlFor="nomeP">Nome Comercial</Label>
            <Input
              ref={inputRef}
              id="nomeP"
              placeholder="Digite para buscar ou cadastrar"
              value={novoNome}
              onChange={(e) => handleNomeChange(e.target.value)}
              onFocus={() => {
                if (novoNome.trim().length > 0) {
                  const filtered = produtosCadastrados.filter((p) =>
                    p.commercial_name.toLowerCase().includes(novoNome.toLowerCase())
                  );
                  setFilteredSuggestions(filtered);
                  setShowSuggestions(true);
                } else if (produtosCadastrados.length > 0) {
                  setFilteredSuggestions(produtosCadastrados);
                  setShowSuggestions(true);
                }
              }}
              autoComplete="off"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
              >
                {filteredSuggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                    onClick={() => handleSelectProduct(p)}
                  >
                    <span className="font-medium">{p.commercial_name}</span>
                    <span className="text-xs text-muted-foreground">{p.formulation}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Formulação</Label>
              <Select value={novaFormulacao} onValueChange={(v) => handleFormulacaoChange(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMULACAO_OPTIONS.map(([key, info]) => (
                    <SelectItem key={key} value={key}>
                      {key} — {info.descricao}
                    </SelectItem>
                  ))}
                  {novaFormulacao && !ORDEM_FORMULACAO[novaFormulacao] && (
                    <SelectItem value={novaFormulacao}>
                      {novaFormulacao}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doseP">Dose</Label>
              <Input
                id="doseP"
                type="number"
                min={0}
                step={0.1}
                placeholder="0"
                value={novaDose || ""}
                onChange={(e) => setNovaDose(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={novaUnidade} onValueChange={(v) => setNovaUnidade(v as "L/ha" | "kg/ha")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L/ha">L/ha</SelectItem>
                  <SelectItem value="kg/ha">kg/ha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleAdicionarProduto} disabled={!novoNome.trim() || novaDose <= 0} className="w-full">
            <Plus className="h-4 w-4" />
            Adicionar à Lista
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Produtos */}
      {produtos.length > 0 && (
        <Card className="mb-6 print:hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Produtos Adicionados ({produtos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {produtos.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{p.nome}</span>
                  <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-mono">
                    {p.formulacao}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {p.dose} {p.unidade}
                  </span>
                  {p.packageSize && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Emb: {p.packageSize} {p.packageUnit === "KG" ? "kg" : "L"})
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemoverProduto(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Separator className="my-4" />

            <Button
              onClick={handleCalcular}
              disabled={!podeCalcular}
              variant="hero"
              className="w-full"
            >
              <ListOrdered className="h-5 w-5" />
              Calcular Ordem de Mistura
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resultado / Relatório */}
      {mostrarResultado && podeCalcular && (
        <div ref={reportRef} className="print:p-0 print:m-0">
          {/* Print-only header with all field info */}
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-heading text-center mb-3 border-b-2 border-foreground pb-2">
              Relatório de Mistura — Ordem de Abastecimento
            </h1>
            <div className="grid grid-cols-4 gap-2 text-xs mb-3">
              <div className="border border-border rounded p-2">
                <span className="text-muted-foreground block">Talhão</span>
                <span className="font-bold">{talhao || "—"}</span>
              </div>
              <div className="border border-border rounded p-2">
                <span className="text-muted-foreground block">Área</span>
                <span className="font-bold font-mono">{areaTalhao} ha</span>
              </div>
              <div className="border border-border rounded p-2">
                <span className="text-muted-foreground block">Vazão</span>
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
                <Button variant="outline" size="sm" onClick={handlePrint} className="print:hidden">
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
              </div>
              <CardDescription>
                {talhao && <>Talhão: {talhao} — </>}
                Volume total: {volumeTotal.toLocaleString("pt-BR")} L para {areaTalhao} ha
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 print:p-0 print:space-y-2">
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
                  </p>
                  <div className="space-y-2 print:space-y-1">
                    {produtosOrdenados.map((p, idx) => {
                      const doseCheio = areaPorTanque * p.dose;
                      const un = p.unidade === "L/ha" ? "L" : "kg";
                      const info = getFormulacaoInfo(p.formulacao);
                      const galoes = p.packageSize ? doseCheio / p.packageSize : null;
                      return (
                        <div key={`cheio-${p.id}`} className="rounded-lg border border-border bg-card p-3 print:p-2 print:rounded-none break-inside-avoid">
                          <div className="flex items-center gap-3 print:gap-2">
                            <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-heading text-sm print:text-xs">
                              {idx + 1}º
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading text-foreground print:text-sm">{p.nome}</span>
                                <span className="text-xs rounded-full px-2 py-0.5 bg-accent/20 text-accent-foreground font-mono">
                                  {p.formulacao}
                                </span>
                              </div>
                              <p className="text-lg print:text-base font-mono font-bold text-primary mt-0.5">
                                {doseCheio.toFixed(2)} {un}
                              </p>
                              {galoes !== null && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                                  ≈ {galoes.toFixed(2)} embalagem(ns) de {p.packageSize} {p.packageUnit === "KG" ? "kg" : "L"}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground hidden print:block shrink-0">
                              {info.instrucao}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 print:hidden">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {info.instrucao}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dosagem Tanque Parcial */}
              {volumeRestante > 0 && (
                <div className="break-inside-avoid">
                  <Separator className="print:hidden" />
                  <p className="font-heading text-foreground text-sm py-1">
                    🟡 Dosagem para Tanque Parcial ({volumeRestante.toLocaleString("pt-BR")} L — {(volumeRestante / vazaoTrabalho).toFixed(1)} ha)
                  </p>
                  <div className="space-y-2 print:space-y-1">
                    {produtosOrdenados.map((p, idx) => {
                      const areaParcial = volumeRestante / vazaoTrabalho;
                      const doseParcial = areaParcial * p.dose;
                      const un = p.unidade === "L/ha" ? "L" : "kg";
                      const info = getFormulacaoInfo(p.formulacao);
                      const galoes = p.packageSize ? doseParcial / p.packageSize : null;
                      return (
                        <div key={`parcial-${p.id}`} className="rounded-lg border border-border bg-card p-3 print:p-2 print:rounded-none break-inside-avoid">
                          <div className="flex items-center gap-3 print:gap-2">
                            <div className="flex h-8 w-8 print:h-6 print:w-6 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground font-heading text-sm print:text-xs">
                              {idx + 1}º
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-heading text-foreground print:text-sm">{p.nome}</span>
                                <span className="text-xs rounded-full px-2 py-0.5 bg-accent/20 text-accent-foreground font-mono">
                                  {p.formulacao}
                                </span>
                              </div>
                              <p className="text-lg print:text-base font-mono font-bold text-warning mt-0.5">
                                {doseParcial.toFixed(2)} {un}
                              </p>
                              {galoes !== null && (
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                                  ≈ {galoes.toFixed(2)} embalagem(ns) de {p.packageSize} {p.packageUnit === "KG" ? "kg" : "L"}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground hidden print:block shrink-0">
                              {info.instrucao}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 print:hidden">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {info.instrucao}
                          </p>
                        </div>
                      );
                    })}
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
                          <p className="font-medium text-foreground text-sm">{h.talhao}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {formatDate(h.data)} — {h.areaTalhao} ha — {h.tanquesNecessarios} abast.
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
                              <span className="text-muted-foreground">Vazão:</span>{" "}
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
    </div>
  );
}
