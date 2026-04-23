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
  Key
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile, UserRole, UserStatus, ROLE_LABELS } from "@/lib/auth-roles";
import { toast } from "sonner";

export default function Acessos() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
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
    setLoading(true);
    
    // Also fetch emails from auth.users if possible (usually restricted, we might need a workaround or just rely on profiles)
    // For now, let's assume we store email in profile for convenience or just show ID
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 1. Sign up user via auth (Note: Admin usually uses a specific method, but here we use regular signup)
    // In a real app, you'd use a Supabase Edge Function to avoid logging out the admin
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
          company: form.company,
        }
      }
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // 2. Profile is usually created via trigger, but we'll do it manually here for safety
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        full_name: form.full_name,
        phone: form.phone,
        company: form.company,
        role: form.role,
        status: 'active',
      });

      if (profileError) {
        console.error("Profile error:", profileError);
      }

      toast.success("Usuário criado com sucesso!");
      
      // 3. Send WhatsApp
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
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', userId);

    if (error) {
      toast.error("Erro ao atualizar status");
    } else {
      toast.success(status === 'active' ? "Usuário liberado!" : "Usuário bloqueado!");
      fetchProfiles();
    }
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      toast.error("Erro ao atualizar função");
    } else {
      toast.success("Função atualizada!");
      fetchProfiles();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Deseja realmente excluir este acesso?")) return;
    
    // Note: Deleting from auth.users requires admin privileges
    const { error } = await supabase.from('profiles').delete().eq('id', userId);

    if (error) {
      toast.error("Erro ao excluir perfil");
    } else {
      toast.success("Perfil excluído!");
      fetchProfiles();
    }
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
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="font-bold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
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
                    <Select defaultValue={p.role} onValueChange={(v: UserRole) => handleUpdateRole(p.id, v)}>
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
                        onClick={() => handleDeleteUser(p.id)}
                        title="Excluir"
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
    </div>
  );
}
