import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getUserProfile, type UserProfile } from "@/lib/auth-roles";
import { homePathFor, resolveModules } from "@/lib/permissions";
import type { ModuleId } from "@/modules/registry";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  modules: Set<ModuleId>;
  can: (moduleId: ModuleId) => boolean;
  homePath: string;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let active = true;

    const applySession = (nextUser: User | null) => {
      if (!active) return;
      setUser(nextUser);
      setSessionReady(true);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user ?? null);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => applySession(session?.user ?? null))
      .catch(() => applySession(null));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      setProfileReady(true);
      return;
    }

    let active = true;
    setProfileReady(false);
    getUserProfile(user.id).then((p) => {
      if (!active) return;
      setProfile(p);
      setProfileReady(true);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    const p = await getUserProfile(user.id);
    setProfile(p);
    setProfileReady(true);
  }, [user?.id]);

  const modules = useMemo(
    () => resolveModules(profile?.role ?? "operador", profile?.modules),
    [profile?.role, profile?.modules]
  );

  const can = useCallback((moduleId: ModuleId) => modules.has(moduleId), [modules]);

  const homePath = useMemo(() => homePathFor(modules), [modules]);

  const loading = !sessionReady || (!!user && !profileReady);

  const value = useMemo(
    () => ({ user, profile, loading, modules, can, homePath, refreshProfile }),
    [user, profile, loading, modules, can, homePath, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
