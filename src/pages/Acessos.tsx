import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  Trash2, 
  MessageSquare, 
  Lock, 
  Unlock,
  Key,
  Puzzle,
  RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile, UserRole, UserStatus, ROLE_LABELS } from "@/lib/auth-roles";
import {
  DEFAULT_ROLE_MODULES,
  resolveModules,
  type ModuleOverrides,
} from "@/lib/permissions";
import { MODULES, MODULE_IDS, type ModuleId } from "@/modules/registry";
import { useAuth } from "@/context/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Acessos() {
  const { user, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [modulesTarget, setModulesTarget] = useState<UserProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [draftModules, setDraftModules] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "operador" as UserRole,
    company: "",
  });

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (error) {
      toast.error("Erro ao carregar usuários");
    } else {
      setProfiles(data as UserProfile[]);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
          company: form.company,
          role: form.role,
        }
      }
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      toast.success("Usuário criado com sucesso!");
      sendWhatsApp(form.phone, form.email, form.password);
      setForm({ email: "", password: "", full_name: "", phone: "", role: "operador", company: "" });
      setShowAddForm(false);
      fetchProfiles();
    }
    setLoading(false);
  };

  const sendWhatsApp = (phone: string, email: string, pass: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = `Olá! Seu acesso ao sistema HerbiLog foi criado.%0A%0ALink: ${window.location.origin}%0A%0AUsuário: ${email}%0ASenha: ${pass}%0A%0ASeja bem-vindo(a)!`;
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
    toast.info("Abrindo WhatsApp para envio das credenciais...");
  };

  const handleUpdateStatus = async (userId: string, status: UserStatus) => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', userId);

    if (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error(`Erro ao atualizar status: ${error.message}`);
    } else {
      toast.success(status === 'active' ? "Usuário liberado!" : "Usuário bloqueado!");
      await fetchProfiles();
    }
    setLoading(false);
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error("Erro ao atualizar função:", error);
      toast.error(`Erro ao atualizar função: ${error.message}`);
    } else {
      toast.success("Função atualizada!");
      await fetchProfiles();
    }
    setLoading(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    const targetId = deleteTarget.id;

    const { error } = await supabase.rpc("delete_user", { target: targetId });

    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
    } else {
      toast.success("Usuário excluído!");
      setDeleteTarget(null);
      setProfiles((prev) => prev.filter((p) => p.id !== targetId));
      fetchProfiles();
    }
    setDeleting(false);
  };

  const effectiveModules = (p: UserProfile): Set<ModuleId> =>
    resolveModules(p.role, p.modules);

  const openModulesDialog = (p: UserProfile) => {
    const effective = effectiveModules(p);
    const draft: Record<string, boolean> = {};
    MODULE_IDS.forEach((id) => {
      draft[id] = effective.has(id);
    });
    setDraftModules(draft);
    setModulesTarget(p);
  };

  const persistModules = async (modules: ModuleOverrides | null) => {
    if (!modulesTarget) return;
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ modules })
      .eq('id', modulesTarget.id);

    if (error) {
      toast.error(`Erro ao salvar módulos: ${error.message}`);
    } else {
      toast.success("Módulos atualizados!");
      if (modulesTarget.id === user?.id) {
        await refreshProfile();
      }
      setModulesTarget(null);
      await fetchProfiles();
    }
    setLoading(false);
  };

  const handleSaveModules = async () => {
    if (!modulesTarget) return;
    const roleDefaults = new Set<ModuleId>(DEFAULT_ROLE_MODULES[modulesTarget.role]);
    const overrides: ModuleOverrides = {};
    MODULE_IDS.forEach((id) => {
      const desired = draftModules[id] === true;
      if (desired !== roleDefaults.has(id)) {
        overrides[id] = desired;
      }
    });
    await persistModules(Object.keys(overrides).length > 0 ? overrides : null);
  };

  const handleResetModules = async () => {
    await persistModules(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
            <Shield className="h-8 w-8 text-emerald-600" />
            Gestão de Acessos
          </h1>
          <p className="text-muted-foreground mt-1">Controle quem pode acessar o sistema e quais são suas permissões.</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-emerald-600 hover:bg-emerald-700">
          <UserPlus className="h-4 w-4 mr-2" /> 
          {showAddForm ? "Fechar Formulário" : "Novo Usuário"}
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-8 border-emerald-100 shadow-md animate-slide-up">
          <CardHeader>
            <CardTitle className="text-lg">Cadastrar Novo Usuário</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input 
                    required 
                    value={form.full_name} 
                    onChange={e => setForm({...form, full_name: e.target.value})}
                    placeholder="Ex: Pedro Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp (com DDD)</Label>
                  <Input 
                    required 
                    value={form.phone} 
                    onChange={e => setForm({...form, phone: e.target.value})}
                    placeholder="Ex: 11988887777"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail (Usuário)</Label>
                  <Input 
                    required 
                    type="email"
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})}
                    placeholder="exemplo@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha Inicial</Label>
                  <Input 
                    required 
                    type="password"
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Função no Sistema</Label>
                  <Select value={form.role} onValueChange={(v: UserRole) => setForm({...form, role: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Empresa/Fazenda</Label>
                  <Input 
                    value={form.company} 
                    onChange={e => setForm({...form, company: e.target.value})}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={loading} className="w-full md:w-auto">
                  {loading ? "Processando..." : "Criar Usuário e Enviar WhatsApp"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg overflow-hidden border-none bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Usuário</TableHead>
              <TableHead className="font-bold">WhatsApp</TableHead>
              <TableHead className="font-bold">Função</TableHead>
              <TableHead className="font-bold">Módulos</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{p.full_name}</span>
                      <span className="text-xs text-muted-foreground">{p.company}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3 w-3 text-emerald-500" />
                      <span className="text-sm">{p.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={p.role} onValueChange={(v: UserRole) => handleUpdateRole(p.id, v)} disabled={loading}>
                      <SelectTrigger className="h-8 text-xs border-none bg-primary/5 hover:bg-primary/10 transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([val, label]) => (
                          <SelectItem key={val} value={val}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => openModulesDialog(p)}
                      title="Definir módulos"
                    >
                      <Puzzle className="h-3.5 w-3.5 text-emerald-600" />
                      {effectiveModules(p).size}/{MODULE_IDS.length}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {p.status === 'active' ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      {p.status === 'active' ? 'Ativo' : 'Bloqueado'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary"
                        onClick={() => handleUpdateStatus(p.id, p.status === 'active' ? 'blocked' : 'active')}
                        title={p.status === 'active' ? "Bloquear" : "Desbloquear"}
                      >
                        {p.status === 'active' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteTarget(p)}
                        disabled={deleting || p.id === user?.id}
                        title={p.id === user?.id ? "Você não pode excluir seu próprio acesso" : "Excluir"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={!!modulesTarget}
        onOpenChange={(open) => {
          if (!open) setModulesTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-emerald-600" />
              Módulos de {modulesTarget?.full_name}
            </DialogTitle>
          </DialogHeader>

          {modulesTarget && (
            <div className="space-y-2">
              {MODULES.map((m) => {
                const isRoleDefault = DEFAULT_ROLE_MODULES[modulesTarget.role].includes(m.id);
                const checked = draftModules[m.id] === true;
                const isException = checked !== isRoleDefault;

                return (
                  <label
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-3 text-sm font-medium">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          setDraftModules((prev) => ({ ...prev, [m.id]: value === true }))
                        }
                      />
                      {m.label}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {isException && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          exceção
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {isRoleDefault ? "padrão do papel" : "fora do padrão"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={handleResetModules}
              disabled={loading || !modulesTarget}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar padrão
            </Button>
            <Button
              onClick={handleSaveModules}
              disabled={loading || !modulesTarget}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o acesso de{" "}
            <span className="font-medium text-foreground">{deleteTarget?.full_name}</span>?
            A conta e o login serão removidos permanentemente. Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
