import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  centroCustoEmUso,
  criarContaPlano,
  criarCentroCusto,
  getAllCentrosCusto,
  getAllContasPlano,
  contasDependentes,
  contaEmUso,
  deleteCentroCusto,
  deleteContaPlano,
  semearPlanoDeContas,
  updateCentroCusto,
  updateContaPlano,
  type ContaPlano,
  type CentroCusto,
} from "@/lib/planoContasStorage";

const VAZIO = "__vazio";

type Aba = "plano" | "centros";

const TIPO_LABEL: Record<ContaPlano["tipo"], string> = {
  despesa: "Despesa",
  receita: "Receita",
};

const TIPO_CLASS: Record<ContaPlano["tipo"], string> = {
  despesa: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  receita: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

type FormConta = {
  id?: string;
  codigo: string;
  nome: string;
  tipo: ContaPlano["tipo"];
  parentId: string;
  ativo: boolean;
};

type FormCentro = {
  id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  padrao: boolean;
  ativo: boolean;
};

type Exclusao =
  | { tipo: "conta"; item: ContaPlano }
  | { tipo: "centro"; item: CentroCusto };

export default function PlanoContas() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>("plano");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  const [contas, setContas] = useState<ContaPlano[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);

  const [formConta, setFormConta] = useState<FormConta | null>(null);
  const [formCentro, setFormCentro] = useState<FormCentro | null>(null);
  const [exclusao, setExclusao] = useState<Exclusao | null>(null);

  const carregar = async () => {
    setCarregando(true);
    try {
      const [c, s] = await Promise.all([getAllContasPlano(), getAllCentrosCusto()]);
      setContas(c);
      setCentros(s);
    } catch {
      toast.error("Falha ao carregar o plano de contas");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const semear = async () => {
    setProcessando(true);
    try {
      await semearPlanoDeContas();
      toast.success("Plano de contas padrão criado");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar o plano padrão");
    } finally {
      setProcessando(false);
    }
  };

  const salvarConta = async () => {
    if (!formConta) return;
    if (!formConta.codigo.trim()) {
      toast.error("Informe o código da conta");
      return;
    }
    if (!formConta.nome.trim()) {
      toast.error("Informe o nome da conta");
      return;
    }
    setProcessando(true);
    try {
      const payload = {
        codigo: formConta.codigo.trim(),
        nome: formConta.nome.trim(),
        tipo: formConta.tipo,
        parentId: formConta.parentId === VAZIO ? undefined : formConta.parentId,
      };
      if (formConta.id) {
        await updateContaPlano(formConta.id, { ...payload, ativo: formConta.ativo });
        toast.success("Conta atualizada");
      } else {
        await criarContaPlano(payload);
        toast.success("Conta criada");
      }
      setFormConta(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a conta");
    } finally {
      setProcessando(false);
    }
  };

  const salvarCentro = async () => {
    if (!formCentro) return;
    if (!formCentro.codigo.trim()) {
      toast.error("Informe o código do centro de custo");
      return;
    }
    if (!formCentro.nome.trim()) {
      toast.error("Informe o nome do centro de custo");
      return;
    }
    setProcessando(true);
    try {
      if (formCentro.id) {
        await updateCentroCusto(formCentro.id, {
          codigo: formCentro.codigo.trim(),
          nome: formCentro.nome.trim(),
          descricao: formCentro.descricao.trim(),
          padrao: formCentro.padrao,
          ativo: formCentro.ativo,
        });
        toast.success("Centro de custo atualizado");
      } else {
        await criarCentroCusto({
          codigo: formCentro.codigo.trim(),
          nome: formCentro.nome.trim(),
          descricao: formCentro.descricao.trim() || undefined,
        });
        toast.success("Centro de custo criado");
      }
      setFormCentro(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar o centro de custo");
    } finally {
      setProcessando(false);
    }
  };

  const excluir = async () => {
    if (!exclusao || processando) return;
    setProcessando(true);
    try {
      if (exclusao.tipo === "conta") {
        const dependentes = await contasDependentes(exclusao.item.id);
        if (dependentes > 0) {
          toast.error(`A conta tem ${dependentes} subconta(s). Exclua ou mova-as antes.`);
          return;
        }
        if (await contaEmUso(exclusao.item.id)) {
          toast.error("A conta está em uso em lançamentos. Inative-a em vez de excluir.");
          return;
        }
        await deleteContaPlano(exclusao.item.id);
        toast.success("Conta excluída");
      } else {
        if (await centroCustoEmUso(exclusao.item.id)) {
          toast.error("O centro de custo está em uso em lançamentos. Inative-o em vez de excluir.");
          return;
        }
        await deleteCentroCusto(exclusao.item.id);
        toast.success("Centro de custo excluído");
      }
      setExclusao(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setProcessando(false);
    }
  };

  const raizes = useMemo(
    () => contas.filter((c) => !c.parentId).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [contas]
  );

  const filhasDe = (id: string) =>
    contas
      .filter((c) => c.parentId === id)
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

  /** Contas que podem ser pai: mesmo tipo, sem ser a própria conta nem descendente. */
  const candidatasPai = (() => {
    if (!formConta) return [];
    const excluirIds = new Set<string>();
    const caminhar = (id: string) => {
      excluirIds.add(id);
      contas
        .filter((c) => c.parentId === id)
        .forEach((f) => caminhar(f.id));
    };
    if (formConta.id) caminhar(formConta.id);
    return contas.filter((c) => c.tipo === formConta.tipo && !excluirIds.has(c.id));
  })();

  const renderLinha = (conta: ContaPlano, nivel: number) => (
    <div key={conta.id}>
      <div className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors">
        <span style={{ width: nivel * 18 }} />
        <span className="font-mono text-xs text-muted-foreground w-14">{conta.codigo}</span>
        <span className="flex-1 text-sm font-medium">{conta.nome}</span>
        <Badge variant="outline" className={`text-[10px] ${TIPO_CLASS[conta.tipo]}`}>
          {TIPO_LABEL[conta.tipo]}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[10px] ${
            conta.ativo
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
              : "bg-muted text-muted-foreground border-border/60"
          }`}
        >
          {conta.ativo ? "Ativa" : "Inativa"}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Editar conta"
            onClick={() =>
              setFormConta({
                id: conta.id,
                codigo: conta.codigo,
                nome: conta.nome,
                tipo: conta.tipo,
                parentId: conta.parentId || VAZIO,
                ativo: conta.ativo,
              })
            }
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            title="Excluir conta"
            onClick={() => setExclusao({ tipo: "conta", item: conta })}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {filhasDe(conta.id).map((f) => renderLinha(f, nivel + 1))}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/financeiro")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-foreground">Plano de Contas e Centros de Custo</h1>
            <p className="text-sm text-muted-foreground">
              Em que rubrica a despesa entra e de qual departamento ela é
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {contas.length === 0 && (
            <Button size="sm" variant="outline" onClick={semear} disabled={processando}>
              {processando ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Criar plano padrão
            </Button>
          )}
          <LinkButton
            to="/conciliacao"
            label="Conciliação"
          />
          <LinkButton to="/boletos" label="Boletos" />
        </div>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
        <TabsList className="mb-4">
          <TabsTrigger value="plano" className="gap-2">
            <BookOpen className="h-4 w-4" /> Plano de contas
          </TabsTrigger>
          <TabsTrigger value="centros" className="gap-2">
            <Layers className="h-4 w-4" /> Centros de custo ({centros.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plano" className="mt-0">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Contas ({contas.length})
              </CardTitle>
              <Button
                size="sm"
                onClick={() =>
                  setFormConta({
                    codigo: "",
                    nome: "",
                    tipo: "despesa",
                    parentId: "",
                    ativo: true,
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Nova conta
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : contas.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Nenhuma conta cadastrada. Crie com{" "}
                  <button type="button" className="text-primary underline" onClick={semear}>
                    o plano padrão
                  </button>{" "}
                  ou monte a sua árvore com Nova conta.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {raizes.map((r) => renderLinha(r, 0))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="centros" className="mt-0">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Departamentos ({centros.length})
              </CardTitle>
              <Button
                size="sm"
                onClick={() =>
                  setFormCentro({ codigo: "", nome: "", descricao: "", padrao: false, ativo: true })
                }
              >
                <Plus className="h-4 w-4 mr-1" /> Novo centro de custo
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : centros.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground italic">
                  Nenhum centro de custo. Cadastre os departamentos da empresa para poder
                  classificar as despesas.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Código</th>
                        <th className="px-4 py-3 text-left font-semibold">Departamento</th>
                        <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                        <th className="px-4 py-3 text-center font-semibold">Padrão</th>
                        <th className="px-4 py-3 text-center font-semibold">Status</th>
                        <th className="px-4 py-3 text-center font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {centros.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{c.codigo}</td>
                          <td className="px-4 py-3 font-medium">{c.nome}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {c.descricao || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {c.padrao && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30"
                              >
                                Padrão
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                c.ativo
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : "bg-muted text-muted-foreground border-border/60"
                              }`}
                            >
                              {c.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar"
                                onClick={() =>
                                  setFormCentro({
                                    id: c.id,
                                    codigo: c.codigo,
                                    nome: c.nome,
                                    descricao: c.descricao || "",
                                    padrao: c.padrao,
                                    ativo: c.ativo,
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                title="Excluir"
                                onClick={() => setExclusao({ tipo: "centro", item: c })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
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
      </Tabs>

      {/* Dialog: conta do plano */}
      <Dialog open={!!formConta} onOpenChange={(open) => !open && !processando && setFormConta(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {formConta?.id ? "Editar conta" : "Nova conta do plano"}
            </DialogTitle>
            <DialogDescription>
              A conta define em qual rubrica o valor entra nos relatórios por natureza.
            </DialogDescription>
          </DialogHeader>
          {formConta && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ct-codigo">Código *</Label>
                  <Input
                    id="ct-codigo"
                    placeholder="Ex: 3.1.02"
                    value={formConta.codigo}
                    onChange={(e) => setFormConta({ ...formConta, codigo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={formConta.tipo}
                    onValueChange={(v) =>
                      setFormConta({ ...formConta, tipo: v as ContaPlano["tipo"], parentId: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="receita">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ct-nome">Nome *</Label>
                <Input
                  id="ct-nome"
                  placeholder="Ex: Manutenção de frota"
                  value={formConta.nome}
                  onChange={(e) => setFormConta({ ...formConta, nome: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Conta pai (opcional)</Label>
                <Select
                  value={formConta.parentId || VAZIO}
                  onValueChange={(v) => setFormConta({ ...formConta, parentId: v === VAZIO ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nível superior" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VAZIO}>Nenhuma (conta raiz)</SelectItem>
                    {candidatasPai.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo} · {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formConta.ativo}
                  onCheckedChange={(v) => setFormConta({ ...formConta, ativo: v === true })}
                />
                Conta ativa
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormConta(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={salvarConta} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {formConta?.id ? "Salvar" : "Criar conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: centro de custo */}
      <Dialog open={!!formCentro} onOpenChange={(open) => !open && !processando && setFormCentro(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {formCentro?.id ? "Editar centro de custo" : "Novo centro de custo"}
            </DialogTitle>
            <DialogDescription>
              O centro de custo é o departamento responsável pela despesa — obrigatório em todo lançamento.
            </DialogDescription>
          </DialogHeader>
          {formCentro && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cc-codigo">Código *</Label>
                  <Input
                    id="cc-codigo"
                    placeholder="Ex: ADM"
                    value={formCentro.codigo}
                    onChange={(e) => setFormCentro({ ...formCentro, codigo: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cc-nome">Nome *</Label>
                  <Input
                    id="cc-nome"
                    placeholder="Ex: Administrativo"
                    value={formCentro.nome}
                    onChange={(e) => setFormCentro({ ...formCentro, nome: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc-desc">Descrição (opcional)</Label>
                <Input
                  id="cc-desc"
                  placeholder="Ex: custos administrativos da matriz"
                  value={formCentro.descricao}
                  onChange={(e) => setFormCentro({ ...formCentro, descricao: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formCentro.padrao}
                  onCheckedChange={(v) => setFormCentro({ ...formCentro, padrao: v === true })}
                />
                Usar como departamento padrão
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={formCentro.ativo}
                  onCheckedChange={(v) => setFormCentro({ ...formCentro, ativo: v === true })}
                />
                Centro de custo ativo
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormCentro(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button onClick={salvarCentro} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {formCentro?.id ? "Salvar" : "Criar centro de custo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!exclusao} onOpenChange={(open) => !open && !processando && setExclusao(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir {exclusao?.tipo === "conta" ? "conta" : "centro de custo"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {exclusao?.tipo === "conta"
                ? `Excluir a conta "${exclusao.item.codigo} · ${exclusao.item.nome}"? Confira antes se ela não é usada em lançamentos.`
                : `Excluir o centro de custo "${exclusao?.item.codigo} · ${exclusao?.item.nome}"? Confira antes se ele não é usado em lançamentos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setExclusao(null)} disabled={processando}>
              Voltar
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={excluir}
              disabled={processando}
            >
              {processando ? "Processando..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Atalho de navegação usado na barra de ações do cabeçalho. */
function LinkButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <Button variant="outline" size="sm" onClick={() => navigate(to)}>
      {label}
    </Button>
  );
}
