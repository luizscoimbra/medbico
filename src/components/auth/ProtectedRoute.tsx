import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getUserProfile, UserProfile, UserRole } from "@/lib/auth-roles";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const userProfile = await getUserProfile(user.id);
      
      if (!userProfile) {
        // Fallback or re-fetch profile if just signed up
        setLoading(false);
        return;
      }

      if (userProfile.status === 'blocked') {
        await supabase.auth.signOut();
        toast.error("Seu acesso está bloqueado.");
        navigate("/auth");
        return;
      }

      setProfile(userProfile);

      if (allowedRoles && !allowedRoles.includes(userProfile.role)) {
        toast.error("Você não tem permissão para acessar esta página.");
        
        // Redirect operators to their only allowed page
        if (userProfile.role === 'operador' || userProfile.role === 'motorista') {
          navigate("/ordem-servico");
        } else {
          navigate("/");
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, [navigate, allowedRoles]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
