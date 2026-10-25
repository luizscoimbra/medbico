import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getUserProfile } from "@/lib/auth-roles";
import { homePathFor, resolveModules } from "@/lib/permissions";
import { useAuth } from "@/context/AuthContext";
import { supportsFullscreen, useFullscreen } from "@/hooks/useFullscreen";

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading, homePath } = useAuth();
  const { enter: enterFullscreen } = useFullscreen();
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
    if (!authLoading && user) {
      // Sessão já válida (auto-login): sempre cai na tela de início.
      void enterFullscreen();
      navigate(homePath, { replace: true });
    }
  }, [authLoading, user, homePath, navigate, enterFullscreen]);

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
      const modules = resolveModules(profile?.role ?? "operador", profile?.modules);
      navigate(homePathFor(modules));

      /*
       * Tela cheia logo após o login: o clique em "Entrar" dá ao navegador o
       * gesto que a Fullscreen API exige. Se ainda assim bloquear (ou o
       * dispositivo não suportar a API), oferecemos o caminho manual.
       */
      void enterFullscreen().then((ok) => {
        if (!ok && supportsFullscreen()) {
          toast.message("Não foi possível abrir em tela cheia automaticamente.", {
            description: "Use o botão “Tela cheia” do menu lateral.",
            action: { label: "Ativar agora", onClick: () => void enterFullscreen() },
            duration: 8000,
          });
        }
      });
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

    /*
     * O cadastro público é self-service: o gatilho handle_new_user() cria uma
     * empresa isolada para esta pessoa e já a registra como master dela.
     *
     * O trigger ignora de propósito qualquer empresa ou função enviada nos
     * metadados — esse objeto é gravado pelo próprio usuário. Sem essa trava,
     * dava para se cadastrar com o nome de outra empresa e cair nos dados
     * dela, ou se auto-promover a administrador.
     */
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          phone: form.phone,
          company_name: form.company,
        },
        emailRedirectTo: `${window.location.origin}/email-confirmada`,
      },
    });

    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    setLoading(false);
    toast.success("Cadastro realizado! Verifique seu e-mail para confirmar.");
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2">
          <div className="flex justify-center mb-2">
            <img
              src="/herbilogosf.png"
              alt="HerbiLog"
              className="h-20 w-auto object-contain drop-shadow-xl"
            />
          </div>
          <div className="text-center space-y-2">
            {!isLogin && (
              <CardTitle className="text-2xl font-heading">Criar Conta</CardTitle>
            )}
            <CardDescription>
              {isLogin
                ? "Entre com seu e-mail e senha"
                : "Preencha os dados para se cadastrar"}
            </CardDescription>
          </div>
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
                  <p className="text-xs text-muted-foreground">
                    Cria a sua empresa e você entra como administrador dela,
                    com acesso a todos os módulos. Ninguém mais enxerga os
                    dados que você cadastrar aqui.
                  </p>
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

          <div className="mt-6 pt-4 border-t border-border/60 text-center">
            <Button
              type="button"
              variant="outline"
              className="w-full border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40 font-medium"
              onClick={() => {
                localStorage.setItem("herbilog_demo_mode", "true");
                window.location.href = "/";
              }}
            >
              🚀 Acessar Demonstração Comercial Completa
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Ambiente de demonstração comercial com todos os módulos liberados
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
