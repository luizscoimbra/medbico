import { useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  FileCode2,
  Link2,
  Loader2,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  executarImportacao,
  carregarCatalogo,
  marcarJaImportados,
  montarLinhas,
  reverLinha,
  type LinhaImportacao,
  type ProdutoCatalogo,
} from "@/lib/nfeImport";
import { lerXmlNfe, type NfeDocumento } from "@/lib/nfeXmlParser";
import { formatBRL } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  onImported: () => void;
}

const fmtPercentual = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    signDisplay: "exceptZero",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v) + "%";

const fmtQuantidade = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(v);

function origemLabel(linha: LinhaImportacao): { texto: string; classe: string } {
  switch (linha.origem) {
    case "codigo_barras":
      return { texto: "Código de barras", classe: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case "nome_exato":
      return { texto: "Nome idêntico", classe: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case "nome_semelhante":
      return {
        texto: `Nome semelhante · ${fmtPercentual(linha.semelhanca * 100)}`,
        classe: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      };
    case "manual":
      return { texto: "Selecionado manualmente", classe: "bg-sky-500/15 text-sky-600 dark:text-sky-400" };
    default:
      return { texto: "Sem correspondência", classe: "bg-muted text-muted-foreground" };
  }
}

export function ImportarXmlNfeDialog({ open, onOpenChange, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<"arquivo" | "revisao">("arquivo");
  const [lendo, setLendo] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState("");
  const [doc, setDoc] = useState<NfeDocumento | null>(null);
  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>([]);
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);

  const reset = () => {
    setEtapa("arquivo");
    setLendo(false);
    setProcessando(false);
    setErro("");
    setDoc(null);
    setCatalogo([]);
    setLinhas([]);
  };

  const fechar = (aberto: boolean) => {
    if (!aberto && processando) return;
    onOpenChange(aberto);
    if (!aberto) reset();
  };

  const selecionarArquivo = async (file: File | undefined) => {
    if (!file) return;
    setErro("");
    setLendo(true);
    try {
      const texto = await file.text();
      const documento = lerXmlNfe(texto, file.name);
      const itens = await carregarCatalogo();
      const montadas = await marcarJaImportados(documento, montarLinhas(documento, itens));
      setDoc(documento);
      setCatalogo(itens);
      setLinhas(montadas);
      setEtapa("revisao");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo XML.");
    } finally {
      setLendo(false);
    }
  };

  const atualizar = (id: string, mudanca: Partial<LinhaImportacao>) => {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...mudanca } : l)));
  };

  const trocarProduto = (id: string, produtoId: string) => {
    const produto = catalogo.find((p) => p.id === produtoId) ?? null;
    setLinhas((atual) => atual.map((l) => (l.id === id ? reverLinha(l, produto) : l)));
  };

  const vincularTodos = () => {
    setLinhas((atual) =>
      atual.map((l) => (l.produto && l.status === "pendente" ? { ...l, status: "vincular" } : l)),
    );
  };

  const confirmados = linhas.filter((l) => l.status === "vincular" || l.status === "novo");
  const ignorados = linhas.filter((l) => l.status === "ignorar");
  const pendentes = linhas.filter((l) => l.status === "pendente");
  const comCorrecao = confirmados.filter((l) => l.aplicarCorrecao).length;

  const confirmar = async () => {
    if (!doc || !confirmados.length) return;
    setProcessando(true);
    try {
      const r = await executarImportacao(doc, linhas);
      if (r.erros.length) {
        toast.warning(
          `${r.entradas} entrada(s) registrada(s), ${r.erros.length} falha(s).`,
          { description: r.erros.slice(0, 3).join("\n") },
        );
      } else {
        toast.success(
          `Nota importada: ${r.entradas} entrada(s) em estoque` +
            (r.criados ? `, ${r.criados} produto(s) cadastrado(s)` : "") +
            (r.correcoes ? `, ${r.correcoes} preço(s) corrigido(s)` : "") +
            (r.ignorados ? `, ${r.ignorados} ignorado(s)` : ""),
        );
      }
      onImported();
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao importar a nota.");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-primary" />
            Importar XML da Nota Fiscal
          </DialogTitle>
          <DialogDescription>
            {etapa === "arquivo"
              ? "Selecione o arquivo XML da NF-e. O sistema confere se cada item já existe no cadastro (código de barras, descrição ou nome semelhante) antes de dar entrada no estoque."
              : "Confira cada item e confirme o vínculo com o produto cadastrado."}
          </DialogDescription>
        </DialogHeader>

        {etapa === "arquivo" && (
          <div className="space-y-4 py-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={lendo}
              className="w-full rounded-xl border-2 border-dashed border-border bg-muted/40 px-6 py-10 text-center transition-colors hover:border-primary/60 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              {lendo ? (
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              ) : (
                <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
              )}
              <div className="mt-3 text-sm font-medium">
                {lendo ? "Lendo arquivo..." : "Clique para selecionar o XML da NF-e"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Arquivo .xml (nfeProc ou NFe)</div>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                void selecionarArquivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {erro && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{erro}</span>
              </div>
            )}
          </div>
        )}

        {etapa === "revisao" && doc && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-4 text-sm sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Emitente</div>
                <div className="font-medium">{doc.emitente.nome || doc.emitente.fantasia || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">NF-e</div>
                <div className="font-medium">
                  {doc.numero || "—"}
                  {doc.serie ? ` / série ${doc.serie}` : ""}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Emissão</div>
                <div className="font-medium">
                  {new Date(`${doc.dataEmissao}T00:00:00`).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Valor total</div>
                <div className="font-medium">{formatBRL(doc.valorTotal)}</div>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <div className="text-xs text-muted-foreground">Chave de acesso</div>
                <div className="font-mono text-xs break-all">{doc.chave || "—"}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                {linhas.length} item(ns) na nota
              </div>
              <Button variant="outline" size="sm" onClick={vincularTodos}>
                <Link2 className="mr-2 h-4 w-4" />
                Vincular todos os identificados
              </Button>
            </div>

            <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
              {linhas.map((linha) => (
                <LinhaItem
                  key={linha.id}
                  linha={linha}
                  catalogo={catalogo}
                  onTrocarProduto={(id) => trocarProduto(linha.id, id)}
                  onMudanca={(mudanca) => atualizar(linha.id, mudanca)}
                  onReverter={() =>
                    atualizar(linha.id, { status: "pendente", aviso: "" })
                  }
                  onIgnorar={() => atualizar(linha.id, { status: "ignorar" })}
                  onVincular={() => atualizar(linha.id, { status: "vincular", aviso: "" })}
                  onNovo={() => atualizar(linha.id, { status: "novo", aviso: "" })}
                />
              ))}
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>{confirmados.length} confirmado(s)</span>
              <span>{pendentes.length} pendente(s)</span>
              <span>{ignorados.length} ignorado(s)</span>
              {comCorrecao > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {comCorrecao} correção(ões) de preço de custo
                </span>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {etapa === "revisao" && (
            <Button variant="outline" onClick={() => setEtapa("arquivo")} disabled={processando}>
              Trocar arquivo
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={processando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={processando || !confirmados.length}>
            {processando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmados.length
              ? `Confirmar importação (${confirmados.length})`
              : "Nenhum item confirmado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LinhaProps {
  linha: LinhaImportacao;
  catalogo: ProdutoCatalogo[];
  onTrocarProduto: (produtoId: string) => void;
  onMudanca: (mudanca: Partial<LinhaImportacao>) => void;
  onReverter: () => void;
  onIgnorar: () => void;
  onVincular: () => void;
  onNovo: () => void;
}

function LinhaItem({
  linha,
  catalogo,
  onTrocarProduto,
  onMudanca,
  onReverter,
  onIgnorar,
  onVincular,
  onNovo,
}: LinhaProps) {
  const { item } = linha;
  const confirmada = linha.status === "vincular" || linha.status === "novo";
  const variacao = linha.variacao;
  const temVariacao = variacao !== null && Math.abs(variacao) >= 0.01;
  const subiu = (variacao ?? 0) > 0;
  const origem = origemLabel(linha);

  return (
    <div
      className={
        "rounded-xl border p-4 transition-colors " +
        (linha.status === "ignorar"
          ? "border-border/60 bg-muted/30 opacity-60"
          : confirmada
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-border bg-card")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">#{item.numero}</span>
            <span className="font-medium leading-tight">{item.descricao}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.codigoFornecedor && <span>Cód. fornecedor: {item.codigoFornecedor}</span>}
            {item.ean && <span>EAN/GTIN: {item.ean}</span>}
            {item.ncm && <span>NCM: {item.ncm}</span>}
            <span>
              {fmtQuantidade(item.quantidade)} {item.unidade} × {formatBRL(item.valorUnitario)}
            </span>
            <span>Total: {formatBRL(item.valorTotal)}</span>
          </div>
        </div>
        <Badge variant="secondary" className={origem.classe + " shrink-0"}>
          {origem.texto}
        </Badge>
      </div>

      {linha.aviso && (
        <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {linha.aviso}
        </div>
      )}

      {confirmada ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <span className="text-muted-foreground">
              {linha.status === "novo" ? "Novo produto: " : "Vinculado a: "}
            </span>
            <span className="font-medium">{linha.produto?.commercial_name}</span>
            <span className="text-muted-foreground">
              {" "}· entrada de {fmtQuantidade(linha.quantidadeEstoque)}{" "}
              {linha.produto?.unit} · {formatBRL(linha.valorLiquido)}
            </span>
            {linha.aplicarCorrecao && (
              <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Preço de custo será corrigido de {formatBRL(linha.custoAtual)} para{" "}
                {formatBRL(linha.custoNota)}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onReverter} disabled={linha.aviso !== ""}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Desfazer
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {linha.produto ? (
            <>
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Produto cadastrado</div>
                <div className="text-sm font-medium">{linha.produto.commercial_name}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Custo atual</div>
                    <div>{linha.custoAtual > 0 ? formatBRL(linha.custoAtual) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Custo na nota</div>
                    <div className="font-medium">{formatBRL(linha.custoNota)}</div>
                  </div>
                  <div className="col-span-2 sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Variação</div>
                    {temVariacao ? (
                      <div
                        className={
                          "inline-flex items-center gap-1 font-medium " +
                          (subiu ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")
                        }
                      >
                        {subiu ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {fmtPercentual(variacao!)} {subiu ? "aumento" : "desconto"}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {linha.custoAtual > 0 ? "sem alteração" : "primeiro preço de custo"}
                      </span>
                    )}
                  </div>
                </div>

                {temVariacao && (
                  <Button
                    variant={linha.aplicarCorrecao ? "default" : "outline"}
                    size="sm"
                    className="mt-3"
                    onClick={() => onMudanca({ aplicarCorrecao: !linha.aplicarCorrecao })}
                  >
                    <Check className={"mr-2 h-4 w-4 " + (linha.aplicarCorrecao ? "" : "opacity-40")} />
                    {linha.aplicarCorrecao
                      ? "Correção de preço aplicada"
                      : "Aplicar correção ao preço de custo"}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Vincular a outro produto</Label>
                  <Select value={linha.produto.id} onValueChange={onTrocarProduto}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecionar produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {catalogo.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.commercial_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button className="flex-1" size="sm" onClick={onVincular}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Vincular e dar entrada
                  </Button>
                  <Button variant="outline" size="sm" onClick={onIgnorar}>
                    <Ban className="mr-2 h-4 w-4" />
                    Ignorar
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Produto não encontrado no cadastro.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do produto</Label>
                  <Input
                    className="h-9"
                    value={linha.novo.nome}
                    onChange={(e) =>
                      onMudanca({ novo: { ...linha.novo, nome: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Correspondência sugerida</Label>
                  <Select value="" onValueChange={onTrocarProduto}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecionar produto já cadastrado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(linha.candidatos.length ? linha.candidatos : catalogo.slice(0, 30)).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.commercial_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unidade</Label>
                  <Select
                    value={linha.novo.unidade}
                    onValueChange={(v) => onMudanca({ novo: { ...linha.novo, unidade: v } })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Litro (L)</SelectItem>
                      <SelectItem value="KG">Quilograma (KG)</SelectItem>
                      <SelectItem value="UN">Unidade (UN)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tamanho da embalagem</Label>
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    value={linha.novo.package_size}
                    onChange={(e) =>
                      onMudanca({ novo: { ...linha.novo, package_size: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preço de custo ({linha.novo.unidade})</Label>
                  <Input
                    className="h-9"
                    inputMode="decimal"
                    value={linha.novo.preco_custo}
                    onChange={(e) =>
                      onMudanca({ novo: { ...linha.novo, preco_custo: e.target.value } })
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button className="flex-1" size="sm" onClick={onNovo} disabled={!linha.novo.nome.trim()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Cadastrar e dar entrada
                  </Button>
                  <Button variant="outline" size="sm" onClick={onIgnorar}>
                    <Ban className="mr-2 h-4 w-4" />
                    Ignorar
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
