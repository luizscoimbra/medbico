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
import { FlaskConical, Plus, Trash2, ListOrdered, Settings, Beaker, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Formulacao = "WP" | "WG" | "SC" | "EC" | "SL" | "ADJ";

interface Produto {
  id: string;
  nome: string;
  formulacao: Formulacao;
  dose: number;
  unidade: "L/ha" | "kg/ha";
}

const ORDEM_FORMULACAO: Record<Formulacao, { ordem: number; descricao: string; instrucao: string }> = {
  WP: { ordem: 1, descricao: "Pó Molhável", instrucao: "Dissolver bem antes do próximo" },
  WG: { ordem: 1, descricao: "Grânulos Dispersíveis", instrucao: "Dissolver bem antes do próximo" },
  SC: { ordem: 2, descricao: "Suspensão Concentrada", instrucao: "Agitar bem após adicionar" },
  EC: { ordem: 3, descricao: "Concentrado Emulsionável", instrucao: "Misturar até emulsionar" },
  SL: { ordem: 4, descricao: "Concentrado Solúvel", instrucao: "Adicionar e misturar" },
  ADJ: { ordem: 5, descricao: "Adjuvante / Óleo", instrucao: "Adicionar por último" },
};

const UNIDADE_PADRAO: Record<Formulacao, "L/ha" | "kg/ha"> = {
  WP: "kg/ha",
  WG: "kg/ha",
  SC: "L/ha",
  EC: "L/ha",
  SL: "L/ha",
  ADJ: "L/ha",
};

interface ProdutoCadastrado {
  id: string;
  name: string;
  type: string;
}

const FORMULACAO_MAP: Record<string, Formulacao> = {
  herbicida: "SL",
  fungicida: "SC",
};

export default function CalculadoraCalda() {
  const [talhao, setTalhao] = useState("");
  const [areaTalhao, setAreaTalhao] = useState<number>(0);
  const [vazaoTrabalho, setVazaoTrabalho] = useState<number>(0);
  const [capacidadeTanque, setCapacidadeTanque] = useState<number>(0);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaFormulacao, setNovaFormulacao] = useState<Formulacao>("SL");
  const [novaDose, setNovaDose] = useState<number>(0);
  const [novaUnidade, setNovaUnidade] = useState<"L/ha" | "kg/ha">("L/ha");

  const [mostrarResultado, setMostrarResultado] = useState(false);

  // Autocomplete state
  const [produtosCadastrados, setProdutosCadastrados] = useState<ProdutoCadastrado[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<ProdutoCadastrado[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("id, name, type");
      if (data) setProdutosCadastrados(data);
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
        p.name.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectProduct = (product: ProdutoCadastrado) => {
    setNovoNome(product.name);
    const mapped = FORMULACAO_MAP[product.type] || "SL";
    handleFormulacaoChange(mapped);
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
      (a, b) => ORDEM_FORMULACAO[a.formulacao].ordem - ORDEM_FORMULACAO[b.formulacao].ordem
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
    };
    setProdutos((prev) => [...prev, novoProduto]);
    setNovoNome("");
    setNovaDose(0);
    setMostrarResultado(false);
  };

  const handleRemoverProduto = (id: string) => {
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    setMostrarResultado(false);
  };

  const handleFormulacaoChange = (val: Formulacao) => {
    setNovaFormulacao(val);
    setNovaUnidade(UNIDADE_PADRAO[val]);
  };

  const podeCalcular = produtos.length > 0 && vazaoTrabalho > 0 && capacidadeTanque > 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
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
      <Card className="mb-6">
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
      <Card className="mb-6">
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
                    p.name.toLowerCase().includes(novoNome.toLowerCase())
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
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground capitalize">{p.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Formulação</Label>
              <Select value={novaFormulacao} onValueChange={(v) => handleFormulacaoChange(v as Formulacao)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORDEM_FORMULACAO) as Formulacao[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
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
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Produtos Adicionados ({produtos.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {produtos.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3"
              >
                <div>
                  <span className="font-medium text-foreground">{p.nome}</span>
                  <span className="ml-2 text-xs rounded-full px-2 py-0.5 bg-primary/10 text-primary font-mono">
                    {p.formulacao}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {p.dose} {p.unidade}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemoverProduto(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Separator className="my-4" />

            <Button
              onClick={() => setMostrarResultado(true)}
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

      {/* Resultado */}
      {mostrarResultado && podeCalcular && (
        <Card className="border-primary/30 shadow-lg animate-slide-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              Relatório de Mistura
            </CardTitle>
          <CardDescription>
              {talhao && <>Talhão: {talhao} — </>}
              Volume total: {volumeTotal.toLocaleString("pt-BR")} L para {areaTalhao} ha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Resumo de abastecimentos */}
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 space-y-1 text-sm">
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
              <>
                <Separator />
                <p className="font-heading text-foreground text-sm">
                  🟢 Dosagem por Tanque Cheio ({capacidadeTanque.toLocaleString("pt-BR")} L — {areaPorTanque.toFixed(1)} ha)
                </p>
                {produtosOrdenados.map((p, idx) => {
                  const doseCheio = areaPorTanque * p.dose;
                  const un = p.unidade === "L/ha" ? "L" : "kg";
                  const info = ORDEM_FORMULACAO[p.formulacao];
                  return (
                    <div key={`cheio-${p.id}`} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-heading text-sm">
                          {idx + 1}º
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading text-foreground">{p.nome}</span>
                            <span className="text-xs rounded-full px-2 py-0.5 bg-accent/20 text-accent-foreground font-mono">
                              {p.formulacao} — {info.descricao}
                            </span>
                          </div>
                          <p className="text-2xl font-mono font-bold text-primary mt-1">
                            {doseCheio.toFixed(2)} {un}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {info.instrucao}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Dosagem Tanque Parcial */}
            {volumeRestante > 0 && (
              <>
                <Separator />
                <p className="font-heading text-foreground text-sm">
                  🟡 Dosagem para Tanque Parcial ({volumeRestante.toLocaleString("pt-BR")} L — {(volumeRestante / vazaoTrabalho).toFixed(1)} ha)
                </p>
                {produtosOrdenados.map((p, idx) => {
                  const areaParcial = volumeRestante / vazaoTrabalho;
                  const doseParcial = areaParcial * p.dose;
                  const un = p.unidade === "L/ha" ? "L" : "kg";
                  const info = ORDEM_FORMULACAO[p.formulacao];
                  return (
                    <div key={`parcial-${p.id}`} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground font-heading text-sm">
                          {idx + 1}º
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-heading text-foreground">{p.nome}</span>
                            <span className="text-xs rounded-full px-2 py-0.5 bg-accent/20 text-accent-foreground font-mono">
                              {p.formulacao} — {info.descricao}
                            </span>
                          </div>
                          <p className="text-2xl font-mono font-bold text-warning mt-1">
                            {doseParcial.toFixed(2)} {un}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {info.instrucao}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
