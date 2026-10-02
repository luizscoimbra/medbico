import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/lib/auth-roles";
import { useAuth } from "@/context/AuthContext";
import { moduleForRoute, type ModuleId } from "@/modules/registry";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: ReactNode;
  module?: ModuleId;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, module, allowedRoles }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading, modules, homePath } = useAuth();
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
      supabase.auth.signOut();
      toast.error("Seu acesso está bloqueado.");
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

  return <>{children}</>;
}
