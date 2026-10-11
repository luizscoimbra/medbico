import { supabase } from "@/integrations/supabase/client";
import type { ModuleOverrides } from "@/lib/permissions";

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
  modules?: ModuleOverrides | null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  master: "Administrador Master",
  gestor: "Gestor",
  operador: "Operador",
  motorista: "Motorista",
};

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  const { data: { user } } = await supabase.auth.getUser();
  const metadata = user?.user_metadata || {};

  /*
   * Função, status, empresa e módulos vêm exclusivamente do perfil gravado no
   * banco.
   *
   * Eles NÃO podem vir de `user_metadata`: esse objeto é gravado pelo próprio
   * usuário no cadastro e é, portanto, controlado por ele. Ler o papel dali
   * permitia que qualquer pessoa se cadastrasse dizendo ser "master"  e que
   * um administrador promovesse a si mesmo com um update na própria linha.
   *
   * A empresa é o dado mais sensível de todos: as políticas de RLS derivam
   * dela o tenant que define o que a pessoa enxerga. Mantê-la fora dos
   * metadados é o que impede alguém de se cadastrar com o nome de outra
   * empresa e cair dentro dos dados dela.
   *
   * Os metadados sobram apenas como valor inicial de exibição (nome e
   * telefone), enquanto um administrador ajusta a função do usuário.
   */
  return {
    id: userId,
    full_name: profileData?.full_name || metadata.full_name || 'Usuário',
    phone: profileData?.phone || metadata.phone || '',
    role: (profileData?.role || 'operador') as UserRole,
    status: (profileData?.status || 'active') as UserStatus,
    company: profileData?.company || '',
    email: user?.email,
    modules: (profileData?.modules ?? null) as ModuleOverrides | null
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
