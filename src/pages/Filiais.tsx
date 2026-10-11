import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2, Plus, Pencil, Users, Loader2, MapPin, Power,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { UserProfile } from "@/lib/auth-roles";

interface BranchOverview {
  branch_id: string;
  nome: string;
  codigo: string;
  is_hq: boolean;
  status: string;
  usuarios: number;
  ordens: number;
  saldo_itens: number;
}

export default function Filiais() {
  const { company, isPlatformAdmin, profile } = useAuth();

  const [linhas, setLinhas] = useState<BranchOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [editando, setEditando] = useState<BranchOverview | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ nome: "", codigo: "" });

  const [usuariosTarget, setUsuariosTarget] = useState<BranchOverview | null>(null);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  /** Filiais de cada usuário, para gravar o conjunto completo sem apagar as demais. */
  const [vinculosPorUsuario, setVinculosPorUsuario] = useState<Map<string, Set<string>>>(new Map());

  /*
   * As regras de quem pode criar, renomear ou desativar uma filial estão no
   * banco (create_branch/update_branch exigem master). Aqui a tela só esconde o
   * que não pode ser feito — se alguém chamar a RPC direto, o banco recusa.
   */
  const podeEditar = profile?.role === "master";

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("branch_overview");
    if (error) {
      toast.error(error.message);
    } else {
      setLinhas((data ?? []) as BranchOverview[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNova = () => {
    setForm({ nome: "", codigo: "" });
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (b: BranchOverview) => {
    setForm({ nome: b.nome, codigo: b.codigo || "" });
    setCriando(false);
    setEditando(b);
  };

  const salvar = async () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome da filial");
      return;
    }
    setSalvando(true);

    const { error } = editando
      ? await supabase.rpc("update_branch", {
          p_branch: editando.branch_id,
          p_name: form.nome,
          p_code: form.codigo,
          p_status: editando.status,
        })
      : await supabase.rpc("create_branch", { p_name: form.nome, p_code: form.codigo });

    setSalvando(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editando ? "Filial atualizada!" : "Filial criada!");
    setCriando(false);
    setEditando(null);
    await carregar();
  };

  const alternarStatus = async (b: BranchOverview) => {
    const novo = b.status === "active" ? "inactive" : "active";
    setSalvando(true);
    const { error } = await supabase.rpc("update_branch", {
      p_branch: b.branch_id,
      p_name: b.nome,
      p_code: b.codigo,
      p_status: novo,
    });
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(novo === "active" ? "Filial reativada!" : "Filial desativada.");
    await carregar();
  };

  const abrirUsuarios = async (b: BranchOverview) => {
    setUsuariosTarget(b);
    const [lista, vinculos] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_branches").select("user_id, branch_id"),
    ]);
    if (lista.error) {
      toast.error(lista.error.message);
      return;
    }

    const mapa = new Map<string, Set<string>>();
    for (const v of vinculos.data ?? []) {
      const atual = mapa.get(v.user_id) ?? new Set<string>();
      atual.add(v.branch_id);
      mapa.set(v.user_id, atual);
    }

    setUsuarios((lista.data ?? []) as UserProfile[]);
    setVinculosPorUsuario(mapa);
    setSelecionados(
      new Set(
        [...mapa.entries()]
          .filter(([, filiais]) => filiais.has(b.branch_id))
          .map(([userId]) => userId)
      )
    );
  };

  const alternarVinculo = (userId: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(userId)) novo.delete(userId);
      else novo.add(userId);
      return novo;
    });
  };

  /*
   * A RPC substitui o conjunto de filiais do usuário inteiro. Como o diálogo
   * edita uma filial por vez, reaplicamos todas as filiais de cada usuário com
   * a diferença desta — sem isso, salvar desmarcaria o acesso às demais.
   */
  const salvarVinculos = async () => {
    if (!usuariosTarget) return;
    setSalvando(true);

    const branchId = usuariosTarget.branch_id;
    let alterados = 0;

    for (const u of usuarios) {
      const antes = vinculosPorUsuario.get(u.id) ?? new Set<string>();
      const depois = new Set(antes);
      if (selecionados.has(u.id)) depois.add(branchId);
      else depois.delete(branchId);

      const iguais =
        antes.size === depois.size && [...depois].every((b) => antes.has(b));
      if (iguais) continue;

      const { error } = await supabase.rpc("set_user_branches", {
        p_target: u.id,
        p_branches: Array.from(depois),
      });
      if (error) {
        toast.error(`${u.full_name}: ${error.message}`);
      } else {
        alterados++;
      }
    }

    setSalvando(false);
    toast.success(
      alterados > 0
        ? `Acesso de ${alterados} usuário(s) atualizado.`
        : "Nenhuma alteração."
    );
    setUsuariosTarget(null);
    await carregar();
  };

  const totais = useMemo(
    () => ({
      ativas: linhas.filter((l) => l.status === "active").length,
      usuarios: linhas.reduce((s, l) => s + Number(l.usuarios), 0),
    }),
    [linhas]
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
            <Building2 className="h-8 w-8 text-emerald-600" />
            Filiais
          </h1>
          <p className="text-muted-foreground mt-1">
            Estrutura da empresa <strong>{company?.name ?? ""}</strong>. Cada filial tem
            os próprios dados operacionais e o seu próprio estoque.
          </p>
        </div>
        <Button
          onClick={abrirNova}
          disabled={!podeEditar}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" /> Nova Filial
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Filiais ativas</p>
            <p className="text-3xl font-heading mt-1">{totais.ativas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Vínculos de acesso</p>
            <p className="text-3xl font-heading mt-1">{totais.usuarios}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total de filiais</p>
            <p className="text-3xl font-heading mt-1">{linhas.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg overflow-hidden border-none bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Filial</TableHead>
              <TableHead className="font-bold">Situação</TableHead>
              <TableHead className="font-bold text-right">Usuários</TableHead>
              <TableHead className="font-bold text-right">OS</TableHead>
              <TableHead className="font-bold text-right">Itens em estoque</TableHead>
              <TableHead className="font-bold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhuma filial cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              linhas.map((b) => (
                <TableRow key={b.branch_id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-2">
                        {b.nome}
                        {b.is_hq && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Matriz</Badge>}
                      </span>
                      {b.codigo && (
                        <span className="text-xs text-muted-foreground">{b.codigo}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      b.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {b.status === "active" ? "Ativa" : "Inativa"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.usuarios}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.ordens}</TableCell>
                  <TableCell className="text-right tabular-nums">{b.saldo_itens}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => abrirUsuarios(b)} title="Usuários com acesso"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => abrirEdicao(b)} title="Editar" disabled={!podeEditar}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!b.is_hq && (
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => alternarStatus(b)} title={b.status === "active" ? "Desativar" : "Reativar"}
                          disabled={!podeEditar || salvando}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {isPlatformAdmin && (
        <p className="text-xs text-muted-foreground mt-4">
          Você também é administrador da plataforma — a gestão de clientes fica em{" "}
          <strong>/plataforma</strong>.
        </p>
      )}

      {/* Criar / editar filial */}
      <Dialog open={criando || !!editando} onOpenChange={(o) => { if (!o) { setCriando(false); setEditando(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
              {editando ? "Editar filial" : "Nova filial"}
            </DialogTitle>
            <DialogDescription>
              A filial passa a ter os próprios dados operacionais e o próprio
              estoque. O cadastro comercial continua compartilhado na empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da filial</Label>
              <Input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Filial do Interior"
              />
            </div>
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                placeholder="Ex: INT"
                maxLength={12}
              />
              <p className="text-xs text-muted-foreground">
                Sigla curta e única dentro da empresa. Deixe vazio se não usar.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCriando(false); setEditando(null); }}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usuários com acesso */}
      <Dialog open={!!usuariosTarget} onOpenChange={(o) => !o && setUsuariosTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              Acessos  {usuariosTarget?.nome}
            </DialogTitle>
            <DialogDescription>
              Marque quem pode ver os dados operacionais desta filial. O
              administrador master enxerga todas as filiais automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto space-y-1">
            {usuarios.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum usuário na empresa.
              </p>
            )}
            {usuarios.map((u) => (
              <label
                key={u.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{u.full_name}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </span>
                <Checkbox
                  checked={u.role === "master" || selecionados.has(u.id)}
                  disabled={u.role === "master"}
                  onCheckedChange={() => alternarVinculo(u.id)}
                />
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUsuariosTarget(null)}>Cancelar</Button>
            <Button onClick={salvarVinculos} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}