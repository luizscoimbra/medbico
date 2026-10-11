import { useState, useEffect, useRef } from "react";
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
  RotateCcw,
  DatabaseBackup,
  Download,
  Upload,
  Loader2,
  HardDriveDownload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile, UserRole, UserStatus, ROLE_LABELS } from "@/lib/auth-roles";
import {
  DEFAULT_ROLE_MODULES,
  resolveModules,
  type ModuleOverrides,
} from "@/lib/permissions";
import { MODULES, type ModuleId } from "@/modules/registry";
import { MODULOS_DA_EMPRESA } from "@/lib/permissions";
import { useAuth } from "@/context/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  downloadBackup,
  exportBackup,
  parseBackup,
  previewBackup,
  restoreBackup,
  totalRegistros,
  type BackupFile,
} from "@/lib/backup";
import { purgeLegacyLocalData, resetLegacyMigration } from "@/lib/legacyMigration";
import { toast } from "sonner";

export default function Acessos() {
  const { user, profile, company, refreshProfile } = useAuth();
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

  /*
   * Só o master da empresa pode criar ou promover outro administrador.
   * A regra é repetida no banco (link_user_to_tenant), mas replicá-la aqui evita
   * o pior desfecho: se a validação viesse depois do signUp, a conta já teria
   * sido criada e ficaria órfã — sem empresa, invisível na lista e impossível
   * de remover pela tela.
   */
  const ehMaster = profile?.role === "master";
  const FUNCOES_ATRIBUIVEIS: UserRole[] = ehMaster
    ? ["master", "gestor", "operador", "motorista"]
    : ["operador", "motorista"];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!FUNCOES_ATRIBUIVEIS.includes(form.role)) {
      toast.error(
        "Sua função não permite atribuir administrador. Escolha Operador ou Motorista."
      );
      return;
    }

    setLoading(true);

    /*
     * A conta é criada sem empresa e sem função: o gatilho handle_new_user()
     * ignora os metadados do usuário, justamente para que ninguém possa se
     * auto-promover a administrador nem entrar na empresa de outro.
     *
     * A empresa e a função são atribuídas em seguida por
     * public.link_user_to_tenant(), que valida dentro do banco que quem está
     * chamando é administrador daquela empresa. O rótulo "Empresa/Fazenda"
     * do formulário foi removido de propósito: ela é sempre a de quem cria.
     */
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
        }
      }
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (!data.user) {
      setLoading(false);
      toast.error("Conta criada, mas o Supabase não devolveu o usuário.");
      return;
    }

    const { error: linkError } = await supabase.rpc("link_user_to_tenant", {
      target: data.user.id,
      p_full_name: form.full_name,
      p_phone: form.phone,
      p_role: form.role,
    });

    if (linkError) {
      setLoading(false);
      toast.error(descreverErroVinculo(linkError.message));
      fetchProfiles();
      return;
    }

    toast.success("Usuário criado com sucesso!");
    sendWhatsApp(form.phone, form.email, form.password);
    setForm({ email: "", password: "", full_name: "", phone: "", role: "operador" });
    setShowAddForm(false);
    fetchProfiles();
    setLoading(false);
  };

  /** Traduz as recusas do banco para algo que o gestor consiga agir. */
  const descreverErroVinculo = (mensagem: string): string => {
    if (mensagem.includes("apenas o administrador master")) {
      return "Conta criada, mas não foi possível vincular: somente o administrador master da empresa pode atribuir a função de administrador. Abra o e-mail do novo usuário — ele foi cadastrado sem empresa e precisa ser removido.";
    }
    if (mensagem.includes("apenas administradores")) {
      return "Sua função não permite criar acessos. Peça ao administrador master da empresa.";
    }
    if (mensagem.includes("outra empresa")) {
      return "Este e-mail já pertence a outra empresa e não pode ser vinculado aqui.";
    }
    return `Conta criada, mas não foi possível vincular à empresa: ${mensagem}`;
  };

  const sendWhatsApp = (phone: string, email: string, pass: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const message = `Olá! Seu acesso ao sistema HerbiLog foi criado.%0A%0ALink: ${window.location.origin}%0A%0AUsuário: ${email}%0ASenha: ${pass}%0A%0ASeja bem-vindo(a)!`;
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
    toast.info("Abrindo WhatsApp para envio das credenciais...");
  };

  const handleUpdateStatus = async (userId: string, status: UserStatus) => {
    setLoading(true);
    const { error } = await supabase.rpc("set_user_status", { target: userId, p_status: status });

    if (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error(error.message);
    } else {
      toast.success(status === 'active' ? "Usuário liberado!" : "Usuário bloqueado!");
      await fetchProfiles();
    }
    setLoading(false);
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    setLoading(true);
    const { error } = await supabase.rpc("set_user_role", { target: userId, p_role: role });

    if (error) {
      console.error("Erro ao atualizar função:", error);
      toast.error(error.message);
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
    MODULOS_DA_EMPRESA.forEach((id) => {
      draft[id] = effective.has(id);
    });
    setDraftModules(draft);
    setModulesTarget(p);
  };

  const persistModules = async (modules: ModuleOverrides | null) => {
    if (!modulesTarget) return;
    setLoading(true);
    const { error } = await supabase.rpc("set_user_modules", {
      target: modulesTarget.id,
      p_modules: modules,
    });

    if (error) {
      toast.error(error.message);
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
    MODULOS_DA_EMPRESA.forEach((id) => {
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

  /* ======================================================================
     BACKUP E RESTAURAÇÃO
     ====================================================================== */

  const [backupAberto, setBackupAberto] = useState(false);
  const [backupProcessando, setBackupProcessando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [arquivoPreview, setArquivoPreview] = useState<ReturnType<typeof previewBackup> | null>(null);
  const [arquivoBackup, setArquivoBackup] = useState<BackupFile | null>(null);
  const [modoRestauracao, setModoRestauracao] = useState<"inserir" | "sobrescrever">("inserir");
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const handleExportar = async () => {
    setBackupProcessando(true);
    setProgresso("Coletando dados...");
    try {
      const backup = await exportBackup((tabela, done, total) =>
        setProgresso(`Lendo ${tabela} (${done}/${total})...`)
      );
      setProgresso("");
      const nome = downloadBackup(backup);
      toast.success(`Backup gerado: ${nome} (${totalRegistros(backup.resumo)} registros).`);
    } catch (e) {
      setProgresso("");
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o backup.");
    } finally {
      setBackupProcessando(false);
    }
  };

  const handleSelecionarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    try {
      const preview = previewBackup(await arquivo.text());
      setArquivoPreview(preview);
      setArquivoBackup(preview.valido ? parseBackup(await arquivo.text()) : null);
    } catch (err) {
      setArquivoPreview({ valido: false, erro: err instanceof Error ? err.message : "arquivo inválido" });
      setArquivoBackup(null);
    } finally {
      e.target.value = "";
    }
  };

  const handleRestaurar = async () => {
    if (!arquivoBackup) return;
    setBackupProcessando(true);
    setProgresso("Restaurando...");
    try {
      const relatorio = await restoreBackup(arquivoBackup, {
        modo: modoRestauracao,
        onProgress: (tabela, done, total) => setProgresso(`Restaurando ${tabela} (${done}/${total})...`),
      });

      setProgresso("");
      if (relatorio.totalFalha === 0) {
        toast.success(`Restauração concluída: ${relatorio.totalInserido} registros.`);
      } else {
        toast.warning(
          `${relatorio.totalInserido} restaurados, mas ${relatorio.totalFalha} tabela(s) falharam.`,
          { duration: 10000 }
        );
      }
      await fetchProfiles();
    } catch (e) {
      setProgresso("");
      toast.error(e instanceof Error ? e.message : "Falha ao restaurar o backup.");
    } finally {
      setBackupProcessando(false);
    }
  };

  const handleLimparLegado = async () => {
    await purgeLegacyLocalData();
    resetLegacyMigration();
    setConfirmarLimpeza(false);
    toast.success("Dados locais do navegador removidos. O sistema agora usa apenas a nuvem.");
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
                  <Select
                    value={FUNCOES_ATRIBUIVEIS.includes(form.role) ? form.role : "operador"}
                    onValueChange={(v: UserRole) => setForm({...form, role: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUNCOES_ATRIBUIVEIS.map((val) => (
                        <SelectItem key={val} value={val}>{ROLE_LABELS[val]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  O usuário entra na empresa <strong>{profile?.company || "—"}</strong>. O acesso é
                  atribuído pelo banco, não pelo navegador: ninguém consegue se
                  cadastrar em outra empresa nem se promover a administrador.
                </p>
                {!ehMaster && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                    <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Você pode criar acessos de <strong>Operador</strong> e{" "}
                      <strong>Motorista</strong>. Atribuir as funções de Gestor ou
                      Administrador Master é restrito ao administrador master da
                      empresa — e essa restrição é validada no banco, não apenas
                      nesta tela.
                    </span>
                  </p>
                )}
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

      <Card className="mb-8 border-emerald-100 shadow-md">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5 text-emerald-600" />
              Backup e restauração de dados
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Gera um arquivo <code>.json</code> com todos os módulos — OS, financeiro, cadastro,
              drones, estoque — e permite restaurar o sistema em outro navegador ou computador.
              Guarde uma cópia fora do servidor (pendrive, e-mail, nuvem).
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setBackupAberto(true)}
            className="shrink-0"
          >
            <HardDriveDownload className="h-4 w-4 mr-2" />
            Abrir
          </Button>
        </CardHeader>
      </Card>

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
                      {effectiveModules(p).size}/{MODULOS_DA_EMPRESA.length}
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

      <Dialog open={backupAberto} onOpenChange={(open) => !backupProcessando && setBackupAberto(open)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5 text-emerald-600" />
              Backup e restauração
            </DialogTitle>
            <DialogDescription>
              O arquivo contém todos os registros visíveis para a sua empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Exportar */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Download className="h-4 w-4 text-emerald-600" />
                Gerar backup
              </div>
              <p className="text-sm text-muted-foreground">
                Exporta ordens de serviço, apontamentos de campo, financeiro, cadastros,
                drones, frotas, estoque e usuários em um único arquivo JSON.
              </p>
              <Button
                onClick={handleExportar}
                disabled={backupProcessando}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {backupProcessando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Baixar backup
              </Button>
              {progresso && <p className="text-xs text-muted-foreground">{progresso}</p>}
            </div>

            {/* Restaurar */}
            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Upload className="h-4 w-4 text-emerald-600" />
                Restaurar a partir de um arquivo
              </div>

              <input
                ref={inputArquivoRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleSelecionarArquivo}
              />
              <Button variant="outline" onClick={() => inputArquivoRef.current?.click()} disabled={backupProcessando}>
                <Upload className="h-4 w-4 mr-2" />
                Selecionar arquivo de backup
              </Button>

              {arquivoPreview && !arquivoPreview.valido && (
                <p className="text-sm text-destructive">{arquivoPreview.erro}</p>
              )}

              {arquivoPreview?.valido && arquivoBackup && (
                <>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                    <div><strong>Gerado em:</strong> {new Date(arquivoPreview.geradoEm!).toLocaleString("pt-BR")}</div>
                    <div><strong>Empresa:</strong> {arquivoPreview.empresa || "—"}</div>
                    <div><strong>Registros no arquivo:</strong> {totalRegistros(arquivoPreview.resumo)}</div>
                  </div>

                  <div className="space-y-2">
                    <Label>Como aplicar?</Label>
                    <Select value={modoRestauracao} onValueChange={(v: "inserir" | "sobrescrever") => setModoRestauracao(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inserir">Somente ausentes (recomendado)</SelectItem>
                        <SelectItem value="sobrescrever">Substituir os dados atuais</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {modoRestauracao === "inserir"
                        ? "Mantém o que já existe na nuvem e acrescenta o que estiver faltando. Pode repetir sem risco."
                        : "Apaga os registros atuais antes de gravar os do arquivo. Use apenas para montar um ambiente novo."}
                    </p>
                  </div>

                  <Button onClick={handleRestaurar} disabled={backupProcessando}>
                    {backupProcessando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Restaurar agora
                  </Button>
                </>
              )}
            </div>

            {/* Limpeza do armazenamento local */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <ShieldAlert className="h-4 w-4" />
                Limpar dados antigos do navegador
              </div>
              <p className="text-sm text-amber-900/80">
                Todos os módulos já gravam no servidor. Este botão apaga a cópia antiga que ficou
                no armazenamento deste navegador. Só execute depois de gerar um backup com sucesso.
              </p>
              {confirmarLimpeza ? (
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={handleLimparLegado}>
                    Sim, apagar os dados locais
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirmarLimpeza(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmarLimpeza(true)}>
                  Limpar armazenamento local
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              {MODULES.filter((m) => MODULOS_DA_EMPRESA.includes(m.id)).map((m) => {
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
