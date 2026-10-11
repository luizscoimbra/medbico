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
import { homePathFor, resolveModulesWithPlatform } from "@/lib/permissions";
import { setActiveBranch as setActiveBranchIdDb, clearUserCache } from "@/lib/db";
import {
  EMPTY_COMPANY_CONTEXT,
  fetchCompanyContext,
  type Branch,
  type Company,
  type CompanyContext,
} from "@/lib/companyStorage";
import type { ModuleId } from "@/modules/registry";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  /** Empresa do usuário — o tenant que a RLS usa para filtrar tudo. */
  company: Company | null;
  /** Filiais da empresa às quais o usuário tem acesso. */
  branches: Branch[];
  /** Filial em que o operador está trabalhando. */
  activeBranch: Branch | null;
  setActiveBranchId: (branchId: string) => void;
  isPlatformAdmin: boolean;
  loading: boolean;
  suspended: boolean;
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
  const [empresa, setEmpresa] = useState<CompanyContext>(EMPTY_COMPANY_CONTEXT);

useEffect(() => {
    let active = true;
    let usuarioAtual: string | null = null;

    const applySession = (nextUser: User | null) => {
      if (!active) return;
      const nextId = nextUser?.id ?? null;
      // A camada de dados memoriza o id do usuário para não repetir uma ida ao
      // servidor a cada leitura. Trocar de sessão precisa invalidar essa
      // memória: sem isso, um segundo login na mesma aba continua gravando o
      // user_id de quem saiu, e a RLS passa a rejeitar as gravações.
      if (nextId !== usuarioAtual) {
        usuarioAtual = nextId;
        clearUserCache();
      }
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
      setEmpresa(EMPTY_COMPANY_CONTEXT);
      return;
    }

    let active = true;
    setProfileReady(false);

    getUserProfile(user.id).then((p) => {
      if (!active) return;
      setProfile(p);
      setProfileReady(true);
    });

    fetchCompanyContext(user.id)
      .then((ctx) => {
        if (active) setEmpresa(ctx);
      })
      .catch(() => {
        if (active) setEmpresa({ ...EMPTY_COMPANY_CONTEXT, loading: false });
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
    const [p, ctx] = await Promise.all([
      getUserProfile(user.id),
      fetchCompanyContext(user.id).catch(() => EMPTY_COMPANY_CONTEXT),
    ]);
    setProfile(p);
    setEmpresa(ctx);
    setProfileReady(true);
  }, [user?.id]);

const modules = useMemo(
    () =>
      resolveModulesWithPlatform(
        profile?.role ?? "operador",
        profile?.modules,
        empresa.isPlatformAdmin
      ),
    [profile?.role, profile?.modules, empresa.isPlatformAdmin]
  );

  const can = useCallback((moduleId: ModuleId) => modules.has(moduleId), [modules]);

  const homePath = useMemo(() => homePathFor(modules), [modules]);

  /*
   * Filial ativa.
   *
   * A escolha fica em localStorage por usuário: quem trabalha na sede e depois
   * vai para a filial do interior não deve perder a选中 filial ao recarregar a
   * página. Sem escolha explícita, assume a Matriz.
   */
  const storageKey = user?.id ? `herbilog:filial:${user.id}` : null;
  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (!storageKey) {
      setBranchId(null);
      setActiveBranchId(null);
      return;
    }
    const salva = localStorage.getItem(storageKey);
    setBranchId(salva);
    setActiveBranchIdDb(salva);
  }, [storageKey]);

  const setActiveBranchId = useCallback(
    (novo: string) => {
      setBranchId(novo);
      setActiveBranchIdDb(novo);
      if (storageKey) localStorage.setItem(storageKey, novo);
    },
    [storageKey]
  );

  const activeBranch = useMemo(
    () => empresa.branches.find((b) => b.id === branchId) ?? empresa.branches[0] ?? null,
    [empresa.branches, branchId]
  );

  // Mantém o storage de escopo em sincronia para os módulos que gravam fora do
  // React (a empresa é carregada em paralelo e pode chegar depois).
  useEffect(() => {
    if (!empresa.branches.length) return;
    const alvo = empresa.branches.find((b) => b.id === branchId) ?? empresa.branches[0];
    if (alvo && alvo.id !== branchId) {
      setBranchId(alvo.id);
      setActiveBranchIdDb(alvo.id);
      if (storageKey) localStorage.setItem(storageKey, alvo.id);
    }
  }, [empresa.branches, branchId, storageKey]);

  const loading = !sessionReady || (!!user && !profileReady);
  const suspended = empresa.company?.status === "suspended";

  const value = useMemo(
    () => ({
      user,
      profile,
      company: empresa.company,
      branches: empresa.branches,
      activeBranch,
      setActiveBranchId,
      isPlatformAdmin: empresa.isPlatformAdmin,
      suspended,
      loading,
      modules,
      can,
      homePath,
      refreshProfile,
    }),
    [
      user,
      profile,
      empresa.company,
      empresa.branches,
      empresa.isPlatformAdmin,
      activeBranch,
      setActiveBranchId,
      suspended,
      loading,
      modules,
      can,
      homePath,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
