import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Destino do link de confirmação de e-mail.
 *
 * O Supabase redireciona para cá com a sessão já pronta no fragmento da URL. A
 * tela não detectava sessão em lugar nenhum: mostrava "E-mail confirmado!"
 * incondicionalmente e oferecia um botão apontando para a URL fixa de produção.
 * Quem testava em localhost era jogado para o site hospedado, e quem abria o
 * link num navegador sem sessão via-lo para uma tela morta.
 */
export default function EmailConfirmada() {
  const { user, loading, homePath } = useAuth();
  const navigate = useNavigate();

  // Redireciona sozinho assim que a sessão estiver disponível.
  useEffect(() => {
    if (loading || !user) return;
    navigate(homePath || "/", { replace: true });
  }, [user, loading, homePath, navigate]);

  const semSessao = !loading && !user;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-md animate-pulse" />
              <img
                src="/herbilog_3d.png"
                alt="HerbiLog"
                className="relative h-24 w-auto drop-shadow-xl"
                draggable={false}
              />
            </div>
          </div>

          {!loading && user ? (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-1.5 bg-emerald-500/15 rounded-full blur-md" />
                  <CheckCircle2 className="relative h-14 w-14 text-emerald-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-heading">E-mail confirmado!</h1>
                <p className="text-muted-foreground">
                  Bem-vindo(a) ao{" "}
                  <span className="font-semibold text-foreground">HerbiLog</span>!
                  <br />
                  Entrando no sistema...
                </p>
              </div>
            </>
          ) : semSessao ? (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-1.5 bg-amber-500/15 rounded-full blur-md" />
                  <AlertTriangle className="relative h-14 w-14 text-amber-600" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-heading">Não foi possível entrar</h1>
                <p className="text-muted-foreground">
                  O link de confirmação expirou ou já foi usado. Faça login
                  normalmente para continuar — sua conta já está confirmada.
                </p>
              </div>

              <Button asChild size="lg" className="w-full">
                <a href="/auth">
                  Ir para o login <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </>
          ) : (
            <>
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-heading">Confirmando seu e-mail</h1>
                <p className="text-muted-foreground">
                  Aguarde um instante enquanto validamos sua conta.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}