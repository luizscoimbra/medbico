import { Fragment, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  History,
  Pencil,
  PlusCircle,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  labelCampoAgrofit,
  listarExecucoesSync,
  type SyncCadastroDiff,
  type SyncExecucao,
} from "@/lib/agrofitSyncStorage";

const ORIGENS: Record<string, string> = {
  rotina_diaria: "Diário",
  manual: "Manual",
  importacao_inicial: "Importação inicial",
};

function statusBadge(status: SyncExecucao["status"]) {
  if (status === "aplicado")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600">Aplicado</Badge>;
  if (status === "falha")
    return <Badge variant="destructive">Falha</Badge>;
  return <Badge variant="secondary">Sem alterações</Badge>;
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Contador({
  valor,
  className = "",
  titulo,
}: {
  valor: number;
  className?: string;
  titulo: string;
}) {
  return (
    <span
      title={titulo}
      className={`inline-flex items-center gap-1 tabular-nums font-medium ${
        valor > 0 ? className : "text-muted-foreground"
      }`}
    >
      {valor}
    </span>
  );
}

function AmostraLinha({
  marca,
  registro,
  cultura,
  praga,
}: {
  marca: string;
  registro: string;
  cultura?: string | null;
  praga?: string | null;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 text-sm">
      <span className="font-medium text-foreground">{marca}</span>
      <span className="text-xs text-muted-foreground">reg. {registro || "—"}</span>
      {cultura && <span className="text-xs text-muted-foreground">· {cultura}</span>}
      {praga && <span className="text-xs text-muted-foreground">· {praga}</span>}
    </li>
  );
}

function CadastroDiff({ diff }: { diff: SyncCadastroDiff }) {
  return (
    <li className="border border-border rounded-md p-3 text-sm space-y-1.5">
      <div className="font-medium text-foreground">{diff.produto}</div>
      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <span className="font-semibold text-foreground">Antes:</span> reg.{" "}
          {diff.de.registro || "—"} · {diff.de.formulacao || "—"}
        </div>
        <div>
          <span className="font-semibold text-foreground">Depois:</span> reg.{" "}
          {diff.para.registro || "—"} · {diff.para.formulacao || "—"}
        </div>
      </div>
      {diff.para.ingredientes && (
        <div className="text-xs">
          <span className="font-semibold text-foreground">Ingredientes:</span>{" "}
          <span className="text-muted-foreground">{diff.para.ingredientes}</span>
        </div>
      )}
    </li>
  );
}

function DetalhesExecucao({ exec }: { exec: SyncExecucao }) {
  const { adicionados, removidos, modificados, cadastro } = exec.detalhes;
  const vazio =
    adicionados.length === 0 &&
    removidos.length === 0 &&
    modificados.length === 0 &&
    cadastro.length === 0;

  return (
    <div className="bg-muted/40 px-4 py-4 sm:px-6">
      {exec.mensagem && (
        <p className="mb-3 text-sm text-muted-foreground">{exec.mensagem}</p>
      )}
      {vazio && (
        <p className="text-sm text-muted-foreground">
          Nenhuma alteração registrada nesta execução.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {adicionados.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <PlusCircle className="h-4 w-4 text-emerald-600" />
                Adicionados à base
                <span className="font-normal text-muted-foreground">
                  ({exec.adicionados} no total{adicionados.length < exec.adicionados ? `, ${adicionados.length} exibidos` : ""})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y divide-border/60">
                {adicionados.map((a, i) => (
                  <AmostraLinha key={`${a.registro}-${i}`} {...a} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {modificados.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Pencil className="h-4 w-4 text-amber-600" />
                Modificados
                <span className="font-normal text-muted-foreground">
                  ({exec.modificados} no total{modificados.length < exec.modificados ? `, ${modificados.length} exibidos` : ""})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {modificados.map((m, i) => (
                <div key={`${m.registro}-${i}`} className="border border-border rounded-md p-3 bg-background">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium text-foreground">{m.marca}</span>
                    <span className="text-xs text-muted-foreground">reg. {m.registro || "—"}</span>
                    {m.cultura && <span className="text-xs text-muted-foreground">· {m.cultura}</span>}
                    {m.praga && <span className="text-xs text-muted-foreground">· {m.praga}</span>}
                  </div>
                  {m.campos.length > 0 && (
                    <table className="mt-2 w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="py-1 pr-2 text-left font-semibold">Campo</th>
                          <th className="py-1 pr-2 text-left font-semibold">Antes</th>
                          <th className="py-1 text-left font-semibold">Depois</th>
                        </tr>
                      </thead>
                      <tbody>
                        {m.campos.map((c, j) => (
                          <tr key={c.campo + j} className="border-t border-border/60">
                            <td className="py-1 pr-2 font-medium text-foreground">
                              {labelCampoAgrofit(c.campo)}
                            </td>
                            <td className="py-1 pr-2 text-muted-foreground break-words">
                              {c.de === null || c.de === "" ? "—" : String(c.de)}
                            </td>
                            <td className="py-1 text-foreground break-words">
                              {c.para === null || c.para === "" ? "—" : String(c.para)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {removidos.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Trash2 className="h-4 w-4 text-red-600" />
                Removidos da base
                <span className="font-normal text-muted-foreground">
                  ({exec.removidos} no total{removidos.length < exec.removidos ? `, ${removidos.length} exibidos` : ""})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y divide-border/60">
                {removidos.map((a, i) => (
                  <AmostraLinha key={`${a.registro}-${i}`} {...a} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {cadastro.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-sky-600" />
                Produtos do cadastro atualizados
                <span className="font-normal text-muted-foreground">
                  ({exec.cadastroAtualizados} no total)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {cadastro.map((c, i) => (
                  <CadastroDiff key={`${c.produto}-${i}`} diff={c} />
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function AgrofitHistorico() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [execucoes, setExecucoes] = useState<SyncExecucao[]>([]);
  const [aberta, setAberta] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setExecucoes(await listarExecucoesSync());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o histórico");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ultima = execucoes[0];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-heading text-foreground mb-2">
          Atualizações da Base Agrofit
        </h1>
        <p className="text-muted-foreground">
          Verificação diária automática da base oficial de agrotóxicos do MAPA (dados
          abertos). Cada execução registra aqui o que foi adicionado, modificado e
          removido, além dos produtos do cadastro que receberam registro MAPA,
          formulação e ingredientes ativos.
        </p>
      </div>

      {ultima && (
        <div className="mb-6 flex flex-wrap items-center gap-3 animate-slide-up">
          <Card className="flex-1 min-w-56">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Última execução</div>
              <div className="flex items-center gap-2">
                {statusBadge(ultima.status)}
                <span className="text-sm text-muted-foreground">
                  {formatarData(ultima.executadoEm)} · {ORIGENS[ultima.origem] ?? ultima.origem}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-56">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Linhas na base</div>
              <div className="text-2xl font-heading tabular-nums">
                {ultima.totalFinal.toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
          <Card className="flex-1 min-w-56">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">
                Últimas alterações (+/~/−)
              </div>
              <div className="flex items-center gap-3 text-sm font-medium tabular-nums">
                <span className="text-emerald-600">+{ultima.adicionados}</span>
                <span className="text-amber-600">~{ultima.modificados}</span>
                <span className="text-red-600">−{ultima.removidos}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {erro && (
        <Card className="mb-6 border-destructive/50">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {erro}
          </CardContent>
        </Card>
      )}

      <Card className="animate-slide-up">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Execuções registradas
          </CardTitle>
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            title="Recarregar"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar
          </button>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : execucoes.length === 0 ? (
            <div className="p-8 text-center">
              <Download className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-heading mb-1">Nenhuma execução registrada</h3>
              <p className="text-sm text-muted-foreground">
                O sincronizador diário (GitHub Actions) grava aqui cada verificação da
                fonte oficial. Você também pode executar localmente{" "}
                <code className="px-1 rounded bg-muted">node scripts/agrofit-sync.mjs</code>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Executado em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">+Adicionados</TableHead>
                    <TableHead className="text-right">~Modificados</TableHead>
                    <TableHead className="text-right">−Removidos</TableHead>
                    <TableHead className="text-right">Cadastros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {execucoes.map((exec) => {
                    const expandida = aberta === exec.id;
                    return (
                      <Fragment key={exec.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setAberta(expandida ? null : exec.id)}
                        >
                          <TableCell className="pr-0">
                            {expandida ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatarData(exec.executadoEm)}
                          </TableCell>
                          <TableCell>{statusBadge(exec.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {ORIGENS[exec.origem] ?? exec.origem}
                          </TableCell>
                          <TableCell>
                            {exec.fonteAlterada ? (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                                Atualizada
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">inalterada</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {exec.totalFinal.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            <Contador valor={exec.adicionados} className="text-emerald-600" titulo="Adicionados" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Contador valor={exec.modificados} className="text-amber-600" titulo="Modificados" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Contador valor={exec.removidos} className="text-red-600" titulo="Removidos" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Contador valor={exec.cadastroAtualizados} className="text-sky-600" titulo="Cadastros atualizados" />
                          </TableCell>
                        </TableRow>
                        {expandida && (
                          <TableRow>
                            <TableCell colSpan={10} className="p-0">
                              <DetalhesExecucao exec={exec} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
