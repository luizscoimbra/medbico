import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Plus,
  FlaskConical,
  Activity,
  History,
  BookOpen,
  ClipboardList,
  FileText,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Droplets,
  Truck,
  Shield,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/SidebarContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserProfile, UserProfile } from "@/lib/auth-roles";
import { toast } from "sonner";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  group: string;
}

const navItems: NavItem[] = [
  { path: "/", label: "Início", icon: Home, group: "Principal" },
  { path: "/nova-medicao", label: "Nova Medição", icon: Plus, group: "Operações" },
  { path: "/calculadora-calda", label: "Calculadora de Calda", icon: FlaskConical, group: "Operações" },
  { path: "/aferir-vazao", label: "Aferir Vazão", icon: Activity, group: "Operações" },
  { path: "/ordem-servico", label: "Ordem de Serviço", icon: FileText, group: "Operações" },
  { path: "/frotas", label: "Gestão de Frotas", icon: Truck, group: "Consultas" },
  { path: "/historico", label: "Histórico", icon: History, group: "Consultas" },
  { path: "/tabela-referencia", label: "Tabela ISO", icon: BookOpen, group: "Consultas" },
  { path: "/cadastros", label: "Cadastros", icon: ClipboardList, group: "Configurações" },
  { path: "/acessos", label: "Gestão de Acessos", icon: Shield, group: "Configurações" },
];

const groups = ["Principal", "Operações", "Consultas", "Configurações"];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, mobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const p = await getUserProfile(user.id);
        setProfile(p);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate("/auth");
  };

  const filteredItems = navItems.filter(item => {
    if (!profile) return item.path === "/" || item.path === "/auth";
    
    // Operators/Drivers only see OS and ISO Table
    if (profile.role === 'operador' || profile.role === 'motorista') {
      return item.path === "/ordem-servico" || item.path === "/tabela-referencia" || item.path === "/";
    }

    // Gestor sees everything except Acessos
    if (profile.role === 'gestor') {
      return item.path !== "/acessos";
    }

    // Master sees everything
    return true;
  });

  // Close mobile menu on route change
  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  // Close mobile menu on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [closeMobile]);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const renderNavContent = (isMobile: boolean) => (
    <div className="flex flex-col h-full">
      {/* Logo Area */}
      <div
        className={cn(
          "flex items-center border-b border-white/[0.06] shrink-0 transition-all duration-300",
          collapsed && !isMobile ? "justify-center px-2 py-5" : "gap-3 px-5 py-5"
        )}
      >
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Droplets className="h-5 w-5 text-white" />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            collapsed && !isMobile ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          <span className="text-lg font-heading text-white tracking-tight block leading-none whitespace-nowrap">
            HerbiLog
          </span>
          <span className="text-[10px] text-white/40 font-medium tracking-widest uppercase whitespace-nowrap">
            Agro System
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 sidebar-scrollbar">
        {groups.map((group) => {
          const items = filteredItems.filter((item) => item.group === group);
          if (items.length === 0) return null;

          return (
            <div key={group} className="mb-2">
              {/* Group label */}
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  collapsed && !isMobile ? "h-0 opacity-0 px-0 py-0" : "h-auto opacity-100 px-5 py-2"
                )}
              >
                <span className="text-[10px] font-semibold tracking-widest uppercase text-white/25">
                  {group}
                </span>
              </div>
              {collapsed && !isMobile && (
                <div className="mx-auto my-2 w-6 h-px bg-white/[0.06]" />
              )}
              <div className="flex flex-col gap-0.5 px-3">
                {items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const isHovered = hoveredItem === item.path;

                  return (
                    <div key={item.path} className="relative group/nav">
                      <Link
                        to={item.path}
                        onMouseEnter={() => setHoveredItem(item.path)}
                        onMouseLeave={() => setHoveredItem(null)}
                        className={cn(
                          "sidebar-nav-item flex items-center gap-3 rounded-xl transition-all duration-200 relative overflow-hidden",
                          collapsed && !isMobile
                            ? "justify-center px-3 py-3"
                            : "px-4 py-3",
                          isActive
                            ? "bg-white/[0.08] text-white"
                            : "text-white/50 hover:text-white/90 hover:bg-white/[0.04]"
                        )}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        )}

                        <item.icon
                          className={cn(
                            "shrink-0 transition-all duration-200",
                            collapsed && !isMobile ? "h-5 w-5" : "h-[18px] w-[18px]",
                            isActive ? "text-emerald-400" : ""
                          )}
                        />

                        <span
                          className={cn(
                            "text-sm font-medium whitespace-nowrap transition-all duration-300",
                            collapsed && !isMobile ? "w-0 opacity-0 hidden" : "w-auto opacity-100",
                            isActive ? "text-white" : ""
                          )}
                        >
                          {item.label}
                        </span>

                        {/* Subtle glow on hover/active */}
                        {(isHovered || isActive) && (
                          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/[0.04] to-transparent pointer-events-none" />
                        )}
                      </Link>

                      {/* Tooltip for collapsed state */}
                      {collapsed && !isMobile && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-150 shadow-xl z-[60] pointer-events-none border border-white/10">
                          {item.label}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Logout button */}
      <div className="shrink-0 px-3 py-2">
        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200",
            collapsed && !isMobile ? "justify-center" : ""
          )}
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span className={cn(
            "text-sm font-medium transition-all duration-300",
            collapsed && !isMobile ? "hidden" : "block"
          )}>
            Sair do Sistema
          </span>
        </button>
      </div>

      {/* Collapse button — desktop only */}
      {!isMobile && (
        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <button
            onClick={toggleCollapse}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-white/30 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs font-medium">Recolher</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ─── Mobile top bar ─── */}
      <div className="sidebar-mobile-header md:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-4 border-b border-border bg-background/95 backdrop-blur-md">
        <button
          onClick={toggleMobile}
          className="p-2 -ml-2 rounded-xl hover:bg-accent/50 transition-colors"
          aria-label="Menu"
        >
          {mobileOpen ? (
            <X className="h-5 w-5 text-foreground" />
          ) : (
            <Menu className="h-5 w-5 text-foreground" />
          )}
        </button>
        <Link to="/" className="ml-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center">
            <Droplets className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-heading text-foreground">HerbiLog</span>
        </Link>
      </div>

      {/* ─── Mobile overlay ─── */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMobile}
      />

      {/* ─── Mobile drawer ─── */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 shadow-2xl transition-transform duration-300 ease-out",
          "bg-gradient-to-b from-[#0f1a14] via-[#121f17] to-[#0d1610]",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {renderNavContent(true)}
      </aside>

      {/* ─── Desktop sidebar ─── */}
      <aside
        className={cn(
          "hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 border-r border-white/[0.04] transition-all duration-300 ease-out",
          "bg-gradient-to-b from-[#0f1a14] via-[#121f17] to-[#0d1610]",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {renderNavContent(false)}
      </aside>
    </>
  );
}
