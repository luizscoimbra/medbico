import { useEffect, useState } from "react";
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
import { Loader2, Plus, Split, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { digitosParaMoeda, formatBRL, moedaParaCentavos } from "@/lib/utils";
import {
  getRateio,
  removerRateio,
  salvarRateio,
  type CentroCusto,
  type RateioItem,
} from "@/lib/planoContasStorage";

const VAZIO = "__vazio";

interface Linha {
  centroCustoId: string;
  valor: string;
}

/**
 * Rateio de um título entre departamentos.
 *
 * O percentual é consequência dos valores (valor ÷ total do título), e não um
 * campo à parte: gravar dois percentuais que não fecham 100% é um erro clássico,
 * enquanto fechar valores sempre dá 100%. A soma é conferida antes de gravar.
 */
interface RateioEditorProps {
  payableId: string;
  valorTitulo: number;
  centros: CentroCusto[];
  onAlterado?: () => void;
}

export function RateioEditor({ payableId, valorTitulo, centros, onAlterado }: RateioEditorProps) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    getRateio(payableId)
      .then((itens) => {
        if (!ativo) return;
        setLinhas(
          itens.map((i) => ({
            centroCustoId: i.centroCustoId,
            valor: digitosParaMoeda(String(Math.round(i.valor * 100))),
          }))
        );
      })
      .catch(() => setLinhas([]))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [payableId]);

  const soma = linhas.reduce((s, l) => s + moedaParaCentavos(l.valor) / 100, 0);
  const diferenca = soma - valorTitulo;

  const alterar = (idx: number, patch: Partial<Linha>) =>
    setLinhas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const adicionar = () =>
    setLinhas((prev) => [...prev, { centroCustoId: "", valor: "" }]);

  const remover = (idx: number) => setLinhas((prev) => prev.filter((_, i) => i !== idx));

  const gravar = async () => {
    const usados = new Set(linhas.map((l) => l.centroCustoId).filter(Boolean));
    if (usados.size !== linhas.filter((l) => l.centroCustoId).length) {
      toast.error("Cada linha do rateio precisa de um departamento diferente");
      return;
    }
    const itens: RateioItem[] = linhas.map((l) => ({
      centroCustoId: l.centroCustoId,
      valor: moedaParaCentavos(l.valor) / 100,
      percentual: 0,
    }));
    setSalvando(true);
    try {
      await salvarRateio(payableId, valorTitulo, itens);
      toast.success(itens.length ? "Rateio salvo" : "Rateio removido");
      onAlterado?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar o rateio");
    } finally {
      setSalvando(false);
    }
  };

  const limpar = async () => {
    setSalvando(true);
    try {
      await removerRateio(payableId);
      setLinhas([]);
      toast.success("Rateio removido");
      onAlterado?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover o rateio");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Split className="h-4 w-4 text-primary" />
          <Label className="text-sm">Rateio entre departamentos (opcional)</Label>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Título {formatBRL(valorTitulo)}
        </span>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Carregando rateio...
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {linhas.map((linha, idx) => {
              const pct = valorTitulo > 0 ? ((moedaParaCentavos(linha.valor) / 100) / valorTitulo) * 100 : 0;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <Select
                    value={linha.centroCustoId || VAZIO}
                    onValueChange={(v) => alterar(idx, { centroCustoId: v === VAZIO ? "" : v })}
                  >
                    <SelectTrigger className="flex-1 h-9">
                      <SelectValue placeholder="Departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {centros
                        .filter((c) => c.ativo)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.codigo} · {c.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Input
                    className="w-32 h-9"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={linha.valor}
                    onChange={(e) => alterar(idx, { valor: digitosParaMoeda(e.target.value) })}
                  />

                  <span className="w-14 text-right text-xs text-muted-foreground font-mono">
                    {pct.toFixed(1)}%
                  </span>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    title="Remover linha"
                    onClick={() => remover(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={adicionar}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar departamento
            </Button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Soma <span className="font-mono font-semibold text-foreground">{formatBRL(soma)}</span>
                {linhas.length > 0 && (
                  <span className={Math.abs(diferenca) > 0.009 ? "text-destructive" : "text-emerald-600"}>
                    {" "}({diferenca > 0 ? "+" : ""}{formatBRL(diferenca)})
                  </span>
                )}
              </span>
              {linhas.length > 0 && (
                <Button variant="ghost" size="sm" onClick={limpar} disabled={salvando}>
                  Limpar
                </Button>
              )}
              <Button size="sm" onClick={gravar} disabled={salvando}>
                {salvando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Salvar rateio
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            O rateio precisa somar exatamente o valor do título. Sem rateio, o
            departamento escolhido no título é usado por inteiro.
          </p>
        </>
      )}
    </div>
  );
}
