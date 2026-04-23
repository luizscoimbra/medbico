import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getUserProfile, UserProfile } from "@/lib/auth-roles";

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    company: "",
    phone: "",
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) navigate("/cadastros");
    };
    checkUser();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user }, error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    
    if (error) {
      setLoading(false);
      toast.error(error.message === "Invalid login credentials" 
        ? "E-mail ou senha inválidos" 
        : error.message);
      return;
    }

    if (user) {
      const profile = await getUserProfile(user.id);
      if (profile && profile.status === 'blocked') {
        await supabase.auth.signOut();
        setLoading(false);
        toast.error("Seu acesso está bloqueado. Entre em contato com o administrador.");
        return;
      }
      
      toast.success("Login realizado com sucesso!");
      const target = profile?.role === 'operador' || profile?.role === 'motorista' ? "/ordem-servico" : "/cadastros";
      navigate(target);
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.company.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }
    setLoading(true);
    const { data: { user }, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company: form.company,
          phone: form.phone,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (user) {
      // Check if this is the first user to make them Master
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      const isFirstUser = count === 0;

      // Create profile record
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: form.full_name,
        phone: form.phone,
        company: form.company,
        role: isFirstUser ? 'master' : 'operador',
        status: 'active',
      });

      if (profileError) {
        console.error("Error creating profile:", profileError);
      }
    }

    setLoading(false);
    toast.success("Cadastro realizado! Verifique seu e-mail para confirmar.");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute -inset-1 bg-emerald-500/20 rounded-full blur-md animate-pulse" />
              <img src="/herbilog_3d.png" alt="HerbiLog" className="relative h-24 w-auto drop-shadow-xl" />
            </div>
          </div>
          <CardTitle className="text-2xl font-heading">
            {isLogin ? "Acessar HerbiLog" : "Criar Conta"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Entre com seu e-mail e senha"
              : "Preencha os dados para se cadastrar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    placeholder="Seu nome completo"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa / Fazenda</Label>
                  <Input
                    id="company"
                    placeholder="Nome da empresa ou fazenda"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp (com DDD) *</Label>
                  <Input
                    id="phone"
                    placeholder="Ex: 11999999999"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Aguarde..." : isLogin ? (
                <><LogIn className="mr-2 h-4 w-4" /> Entrar</>
              ) : (
                <><UserPlus className="mr-2 h-4 w-4" /> Cadastrar</>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
