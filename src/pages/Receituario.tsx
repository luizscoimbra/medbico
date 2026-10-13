import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  FileSignature,
  Loader2,
  Plus,
  Save,
  ScrollText,
  Trash2,
} from "lucide-react";
import {
  assinarReceituario,
  criarReceituario,
  excluirReceituario,
  getReceituario,
  listarReceituarios,
  salvarReceituarioDados,
  type Receituario,
  type ReceituarioDados,
  type ReceituarioItem,
} from "@/lib/fieldVisitStorage";
import { gerarReceituarioPdf } from "@/lib/receituarioPdf";
import { AssinaturaOS, type AssinaturaOSValue } from "@/components/os/AssinaturaOS";
import { ProdutoAgrofitInput } from "@/components/receituario/ProdutoAgrofitInput";
import { useAuth } from "@/context/AuthContext";

const CONDICOES_PADRAO =
  "Utilizar EPI adequado (luvas, botinas, óculos e vestimenta de proteção). Evitar aplicação com vento acima de 10 km/h e no período de maior calor. Descartar as embalagens no ponto de recebimento autorizado (triângulo amarelo), observando os prazos da legislação vigente.";

const ITEM_VAZIO: ReceituarioItem = {
  nrRegistro: "",
  marca: "",
  ingrediente: "",
  dose: "",
  unidade: "L/ha",
  quantidade: "",
  intervaloSeguranca: "",
  reentrada: "",
};

export default function Receituario() {
  const { company } = useAuth();
  const [params, setParams] = useSearchParams();

  const [lista, setLista] = useState<Receituario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selId, setSelId] = useState<string | null>(params.get("id"));
  const [receituario, setReceituario] = useState<Receituario | null>(null);
  const [carregandoSel, setCarregandoSel] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [assinatura, setAssinatura] = useState<AssinaturaOSValue | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setLista(await listarReceituarios());
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao carregar os receituários");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrir = useCallback(async (id: string) => {
    setCarregandoSel(true);
    try {
      const r = await getReceituario(id);
      if (!r) {
        toast.error("Receituário não encontrado");
        return;
      }
      setReceituario(r);
      setAssinatura(
        r.assinaturaBase64
          ? {
              base64: r.assinaturaBase64,
              metodo: r.assinaturaMetodo ?? "toque",
              nome: r.assinadoPorNome ?? "",
            }
          : null
      );
      setConfirmandoExcluir(false);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao carregar o receituário");
    } finally {
      setCarregandoSel(false);
    }
  }, []);

  useEffect(() => {
    if (selId) void abrir(selId);
    else setReceituario(null);
    setParams(selId ? { id: selId } : {}, { replace: true });
  }, [selId, abrir, setParams]);

  const novo = async () => {
    try {
      const dados: ReceituarioDados = {
        tecnico: company
          ? {
              nome: company.tecnico_nome,
              titulo: company.tecnico_titulo,
              crea: company.tecnico_crea,
              art: company.tecnico_art,
            }
          : undefined,
        itens: [],
        condicoes: CONDICOES_PADRAO,
      };
      const r = await criarReceituario(dados);
      toast.success(`Receituário ${r.numero} criado`);
      await carregar();
      setSelId(r.id);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao criar o receituário");
    }
  };

  const setDados = (patch: Partial<ReceituarioDados>) => {
    setReceituario((atual) =>
      atual ? { ...atual, dados: { ...atual.dados, ...patch } } : atual
    );
  };

  const setItem = (indice: number, patch: Partial<ReceituarioItem>) => {
    setReceituario((atual) => {
      if (!atual) return atual;
      const itens = atual.dados.itens.map((item, i) =>
        i === indice ? { ...item, ...patch } : item
      );
      return { ...atual, dados: { ...atual.dados, itens } };
    });
  };

  const adicionarItem = () => {
    setReceituario((atual) => {
      if (!atual) return atual;
      return {
        ...atual,
        dados: { ...atual.dados, itens: [...atual.dados.itens, { ...ITEM_VAZIO }] },
      };
    });
  };

  const removerItem = (indice: number) => {
    setReceituario((atual) => {
      if (!atual) return atual;
      return {
        ...atual,
        dados: {
          ...atual.dados,
          itens: atual.dados.itens.filter((_, i) => i !== indice),
        },
      };
    });
  };

  const salvar = async (): Promise<Receituario | null> => {
    if (!receituario) return null;
    setSalvando(true);
    try {
      await salvarReceituarioDados(receituario.id, receituario.dados);
      toast.success("Receituário salvo");
      await carregar();
      return receituario;
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao salvar");
      return null;
    } finally {
      setSalvando(false);
    }
  };

  const assinar = async () => {
    if (!receituario) return;
    if (!assinatura) {
      toast.error("Assine o documento antes de emitir");
      return;
    }
    if (!receituario.dados.produtor?.nome?.trim()) {
      toast.error("Informe o produtor antes de emitir");
      return;
    }
    if (receituario.dados.itens.length === 0) {
      toast.error("Adicione ao menos um produto antes de emitir");
      return;
    }
    if (!receituario.dados.tecnico?.crea?.trim()) {
      toast.error("Cadastre o CREA do responsável técnico (menu Empresa) antes de emitir");
      return;
    }
    setSalvando(true);
    try {
      await salvarReceituarioDados(receituario.id, receituario.dados);
      await assinarReceituario(receituario.id, {
        base64: assinatura.base64,
        metodo: assinatura.metodo,
        nome: assinatura.nome,
      });
      toast.success(`Receituário ${receituario.numero} emitido e assinado`);
      await carregar();
      await abrir(receituario.id);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao assinar");
    } finally {
      setSalvando(false);
    }
  };

  const gerarPdf = async () => {
    if (!receituario) return;
    setGerandoPdf(true);
    try {
      await gerarReceituarioPdf(receituario);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao gerar o PDF");
    } finally {
      setGerandoPdf(false);
    }
  };

  const excluir = async () => {
    if (!receituario) return;
    try {
      await excluirReceituario(receituario.id);
      toast.success("Receituário excluído");
      setSelId(null);
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao excluir");
    }
  };

  // ------------------------------------------------------------------ lista
  if (!selId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
              <ScrollText className="h-8 w-8 text-emerald-600" />
              Receituário Agronômico
            </h1>
            <p className="text-muted-foreground mt-1">
              Documento legal da recomendação (Lei 7.802/1989 e 14.785/2023),
              com registro MAPA, CREA/ART e assinatura eletrônica.
            </p>
          </div>
          <Button onClick={() => void novo()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Novo receituário
          </Button>
        </div>

        <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base">Emitidos ({lista.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <div className="py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : lista.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                Nenhum receituário ainda. Gere um a partir de uma{" "}
                <strong>Visita de Campo</strong> com recomendações, ou clique em{" "}
                <strong>Novo receituário</strong>.
              </p>
            ) : (
              <div className="divide-y">
                {lista.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelId(r.id)}
                    className="w-full text-left py-3 px-2 hover:bg-muted/50 rounded-lg transition-colors flex flex-wrap items-center gap-3"
                  >
                    <span className="font-mono text-sm font-medium">{r.numero}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.dados.produtor?.nome ?? "Produtor não informado"}
                      {r.dados.propriedade?.nome && ` — ${r.dados.propriedade.nome}`}
                    </span>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {new Date(r.criadoEm).toLocaleDateString("pt-BR")}
                    </span>
                    <Badge variant={r.status === "emitida" ? "default" : "secondary"}>
                      {r.status === "emitida" ? "Emitido" : "Rascunho"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------- editor
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelId(null)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar
          </Button>
          <h1 className="text-2xl font-heading flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-emerald-600" />
            {receituario?.numero ?? "..."}
          </h1>
          {receituario && (
            <Badge variant={receituario.status === "emitida" ? "default" : "secondary"}>
              {receituario.status === "emitida" ? "Emitido" : "Rascunho"}
            </Badge>
          )}
        </div>
        {receituario && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void salvar()} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={() => void gerarPdf()} disabled={gerandoPdf}>
              {gerandoPdf ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <FileDown className="h-4 w-4 mr-1.5" />}
              Baixar PDF
            </Button>
            {receituario.status !== "emitida" && (
              <Button size="sm" onClick={() => void assinar()} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
                <FileSignature className="h-4 w-4 mr-1.5" /> Assinar e emitir
              </Button>
            )}
          </div>
        )}
      </div>

      {carregandoSel || !receituario ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">I — Produtor</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Nome do produtor *</Label>
                <Input
                  value={receituario.dados.produtor?.nome ?? ""}
                  onChange={(e) =>
                    setDados({
                      produtor: { nome: e.target.value, documento: receituario.dados.produtor?.documento ?? "", municipio: receituario.dados.produtor?.municipio, uf: receituario.dados.produtor?.uf },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>CPF / CNPJ</Label>
                <Input
                  value={receituario.dados.produtor?.documento ?? ""}
                  onChange={(e) =>
                    setDados({
                      produtor: { nome: receituario.dados.produtor?.nome ?? "", documento: e.target.value, municipio: receituario.dados.produtor?.municipio, uf: receituario.dados.produtor?.uf },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Município</Label>
                <Input
                  value={receituario.dados.produtor?.municipio ?? ""}
                  onChange={(e) =>
                    setDados({
                      produtor: { nome: receituario.dados.produtor?.nome ?? "", documento: receituario.dados.produtor?.documento ?? "", municipio: e.target.value, uf: receituario.dados.produtor?.uf },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">II — Propriedade / área</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Propriedade / talhão *</Label>
                <Input
                  value={receituario.dados.propriedade?.nome ?? ""}
                  onChange={(e) =>
                    setDados({
                      propriedade: { ...receituario.dados.propriedade, nome: e.target.value } as ReceituarioDados["propriedade"],
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Área (ha)</Label>
                <Input
                  value={receituario.dados.propriedade?.areaHa ?? ""}
                  onChange={(e) =>
                    setDados({
                      propriedade: { ...receituario.dados.propriedade, nome: receituario.dados.propriedade?.nome ?? "", areaHa: e.target.value } as ReceituarioDados["propriedade"],
                    })
                  }
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-2">
                <Label>CAR (opcional)</Label>
                <Input
                  value={receituario.dados.propriedade?.car ?? ""}
                  onChange={(e) =>
                    setDados({
                      propriedade: { ...receituario.dados.propriedade, nome: receituario.dados.propriedade?.nome ?? "", car: e.target.value } as ReceituarioDados["propriedade"],
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">III — Responsável técnico (CREA/ART)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Nome</Label>
                <Input
                  value={receituario.dados.tecnico?.nome ?? ""}
                  onChange={(e) =>
                    setDados({
                      tecnico: { nome: e.target.value, titulo: receituario.dados.tecnico?.titulo ?? "", crea: receituario.dados.tecnico?.crea ?? "", art: receituario.dados.tecnico?.art ?? "" },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={receituario.dados.tecnico?.titulo ?? ""}
                  onChange={(e) =>
                    setDados({
                      tecnico: { nome: receituario.dados.tecnico?.nome ?? "", titulo: e.target.value, crea: receituario.dados.tecnico?.crea ?? "", art: receituario.dados.tecnico?.art ?? "" },
                    })
                  }
                  placeholder="Eng. Agrônomo"
                />
              </div>
              <div className="space-y-2">
                <Label>CREA *</Label>
                <Input
                  value={receituario.dados.tecnico?.crea ?? ""}
                  onChange={(e) =>
                    setDados({
                      tecnico: { nome: receituario.dados.tecnico?.nome ?? "", titulo: receituario.dados.tecnico?.titulo ?? "", crea: e.target.value, art: receituario.dados.tecnico?.art ?? "" },
                    })
                  }
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>ART (nº)</Label>
                <Input
                  value={receituario.dados.tecnico?.art ?? ""}
                  onChange={(e) =>
                    setDados({
                      tecnico: { nome: receituario.dados.tecnico?.nome ?? "", titulo: receituario.dados.tecnico?.titulo ?? "", crea: receituario.dados.tecnico?.crea ?? "", art: e.target.value },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">IV — Diagnóstico fitossanitário</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={receituario.dados.diagnostico ?? ""}
                onChange={(e) => setDados({ diagnostico: e.target.value })}
                rows={3}
                placeholder="Alvo detectado, severidade, dano estimado..."
              />
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                V — Produtos e recomendações
                <Button size="sm" variant="outline" onClick={adicionarItem}>
                  <Plus className="h-4 w-4 mr-1.5" /> Adicionar item
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {receituario.dados.itens.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum produto. Itens vindos de uma visita são preenchidos
                  automaticamente; aqui você pode ajustar ou adicionar manualmente.
                </p>
              )}
              {receituario.dados.itens.map((item, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                      <div className="space-y-1.5">
                        <Label>Reg. MAPA</Label>
                        <Input
                          value={item.nrRegistro}
                          onChange={(e) => setItem(i, { nrRegistro: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Produto</Label>
                        <ProdutoAgrofitInput
                          value={item.marca}
                          cultura={item.cultura}
                          alvo={item.alvo}
                          placeholder="Digite o nome do produto..."
                          onTextoChange={(texto) => setItem(i, { marca: texto })}
                          onSelecionar={(p) =>
                            setItem(i, {
                              marca: p.marcaComercial,
                              nrRegistro: p.nrRegistro,
                              ingrediente: p.ingredienteAtivo ?? item.ingrediente,
                              forma: p.formulacao ?? item.forma,
                              empresa: p.titular ?? item.empresa,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ingrediente ativo</Label>
                        <Input
                          value={item.ingrediente}
                          onChange={(e) => setItem(i, { ingrediente: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Dose</Label>
                        <Input value={item.dose} onChange={(e) => setItem(i, { dose: e.target.value })} inputMode="decimal" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Unidade</Label>
                        <Input value={item.unidade} onChange={(e) => setItem(i, { unidade: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Quantidade total</Label>
                        <Input
                          value={item.quantidade}
                          onChange={(e) => setItem(i, { quantidade: e.target.value })}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Intervalo de segurança</Label>
                        <Input
                          value={item.intervaloSeguranca}
                          onChange={(e) => setItem(i, { intervaloSeguranca: e.target.value })}
                          placeholder="14 dias"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Período de reentrada</Label>
                        <Input
                          value={item.reentrada}
                          onChange={(e) => setItem(i, { reentrada: e.target.value })}
                          placeholder="48 horas"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Aplicação / volume</Label>
                        <Input
                          value={item.modoAplicacao ?? ""}
                          onChange={(e) => setItem(i, { modoAplicacao: e.target.value })}
                          placeholder="Terrestre — 100 L/ha"
                        />
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removerItem(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">VI — Condições de aplicação, EPI e descarte</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={receituario.dados.condicoes ?? ""}
                onChange={(e) => setDados({ condicoes: e.target.value })}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-base">VII — Assinatura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {receituario.status === "emitida" ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                  <p className="text-sm text-emerald-700 font-medium">
                    Emitido por {receituario.assinadoPorNome} em{" "}
                    {receituario.assinadoEm
                      ? new Date(receituario.assinadoEm).toLocaleString("pt-BR")
                      : "—"}{" "}
                    — {receituario.assinaturaMetodo === "biometrica" ? "assinatura biométrica" : "assinatura por toque"}
                  </p>
                  {receituario.assinaturaBase64 && (
                    <img
                      src={receituario.assinaturaBase64}
                      alt="Assinatura"
                      className="h-24 border bg-white rounded-lg px-4 py-2"
                    />
                  )}
                </div>
              ) : (
                <AssinaturaOS value={assinatura} onChange={setAssinatura} />
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Ao assinar, o documento é marcado como emitido e o PDF ganha
                  validade como receituário da aplicação.
                </p>
                {confirmandoExcluir ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" onClick={() => void excluir()}>
                      Confirmar exclusão
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmandoExcluir(false)}>
                      Não
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmandoExcluir(true)}>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
