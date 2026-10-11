import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { UserRole } from "@/lib/auth-roles";
import { useAuth } from "@/context/AuthContext";
import { moduleForRoute, type ModuleId } from "@/modules/registry";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: ReactNode;
  module?: ModuleId;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, module, allowedRoles }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, modules, homePath, suspended, company } = useAuth();
  const moduleId = module ?? moduleForRoute(location.pathname);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/auth");
      return;
    }

    if (!profile) {
      return;
    }

    if (profile.status === 'blocked') {
      navigate("/auth");
      return;
    }

    if (moduleId && !modules.has(moduleId)) {
      toast.error("Você não tem permissão para acessar esta página.");
      if (homePath !== location.pathname) {
        navigate(homePath, { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
      return;
    }

    if (allowedRoles && !allowedRoles.includes(profile.role)) {
      toast.error("Você não tem permissão para acessar esta página.");

      if (profile.role === 'operador' || profile.role === 'motorista') {
        navigate("/ordem-servico");
      } else {
        navigate("/");
      }
    }
  }, [user, profile, loading, modules, moduleId, homePath, location.pathname, navigate, allowedRoles]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  /*
   * Empresa suspensa: a RLS já devolve zero linhas para tudo. Em vez de deixar
   * o usuário diante de telas vazias sem explicação, mostramos o motivo.
   */
  if (suspended) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <div className="max-w-md w-full text-center space-y-5">
          <ShieldAlert className="h-14 w-14 mx-auto text-destructive" />
          <div className="space-y-2">
            <h1 className="text-2xl font-heading text-foreground">Acesso suspenso</h1>
            <p className="text-muted-foreground">
              A empresa <strong>{company?.name ?? "—"}</strong> está com o acesso
              suspenso. Os dados continuam guardados  nada foi apagado.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/auth", { replace: true })}>
            Sair da conta
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
