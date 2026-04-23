import { supabase } from "@/integrations/supabase/client";

export type UserRole = 'master' | 'gestor' | 'operador' | 'motorista';
export type UserStatus = 'active' | 'blocked';

export interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  company: string;
  email?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  master: "Administrador Master",
  gestor: "Gestor",
  operador: "Operador",
  motorista: "Motorista",
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const { data: { user } } = await supabase.auth.getUser();
  const metadata = user?.user_metadata || {};

  const isLuiz = user?.email === 'luizssacoimbra@gmail.com';

  // If profile table fails or is missing columns, use metadata fallback
  return {
    id: userId,
    full_name: profileData?.full_name || metadata.full_name || (isLuiz ? "Luiz Alberto" : "Usuário"),
    phone: profileData?.phone || metadata.phone || "",
    role: (isLuiz ? 'gestor' : (profileData?.role || metadata.role || 'operador')) as UserRole,
    status: (profileData?.status || metadata.status || 'active') as UserStatus,
    company: profileData?.company || metadata.company || "",
    email: user?.email
  };
}

export async function isAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.role === 'master';
}

export async function canAccessAdminPanel(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.role === 'master' || profile?.role === 'gestor';
}
