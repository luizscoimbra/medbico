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
  ChevronDown,
  Menu,
  X,
  Droplets,
  Truck,
  Shield,
  LogOut,
  Plane,
  Battery,
  Wrench,
  LayoutDashboard,
  Settings,
  Map,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/SidebarContext";
import { useState, useEffect as useEffectReact } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getUserProfile, UserProfile } from "@/lib/auth-roles";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllEquipments, Equipment } from "@/lib/equipmentStorage";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  group: string;
}

const navItems: NavItem[] = [
  { path: "/", label: "Início", icon: Home, group: "Principal" },
  { path: "/visao-geral", label: "Visão Geral", icon: LayoutDashboard, group: "Principal" },
  { path: "/nova-medicao", label: "Nova Medição", icon: Plus, group: "Operações" },
  { path: "/calculadora-calda", label: "Calculadora de Calda", icon: FlaskConical, group: "Operações" },
  { path: "/aferir-vazao", label: "Aferir Vazão", icon: Activity, group: "Operações" },
  { path: "/ordem-servico", label: "Ordem de Serviço", icon: FileText, group: "Operações" },
  { path: "/area-motorista", label: "Área do Motorista", icon: Truck, group: "Operações" },
  { path: "/historico", label: "Histórico", icon: History, group: "Consultas" },
  { path: "/tabela-referencia", label: "Tabela ISO", icon: BookOpen, group: "Consultas" },
  { path: "/acessos", label: "Gestão de Acessos", icon: Shield, group: "Configurações" },
];

interface CadastroSubItem {
  label: string;
  icon: React.ElementType;
  tab: string;
}

const cadastroSubItems: CadastroSubItem[] = [
  { label: "Equipamentos", icon: Settings, tab: "equipamentos" },
  { label: "Caminhão Pipa", icon: Truck, tab: "caminhoes_pipa" },
  { label: "Produtos", icon: FlaskConical, tab: "produtos" },
  { label: "Serviços", icon: FileText, tab: "servicos" },
  { label: "Áreas", icon: Map, tab: "areas" },
  { label: "Tipos de Aplicação", icon: Activity, tab: "tipos_aplicacao" },
  { label: "Operadores", icon: Users, tab: "operadores" },
  { label: "Clientes", icon: Users, tab: "clientes" },
];

interface DroneSubItem {
  label: string;
  icon: React.ElementType;
  path: string;
}

const droneSubItems: DroneSubItem[] = [
  { label: "Frota de Drones", icon: Plane, path: "/drones" },
  { label: "Logbook de Voo", icon: BookOpen, path: "/flight-log" },
  { label: "Gestão de Baterias", icon: Battery, path: "/battery-management" },
  { label: "Manutenção Drones", icon: Wrench, path: "/maintenance" },
];

const groups = ["Principal", "Operações", "Consultas", "Configurações"];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, mobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cadastrosOpen, setCadastrosOpen] = useState(() => location.pathname === "/cadastros");
  const [dronesOpen, setDronesOpen] = useState(() => ["/frotas", "/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname));
  const [dronesAereosOpen, setDronesAereosOpen] = useState(() => ["/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname));
  const [equipamentosDialogOpen, setEquipamentosDialogOpen] = useState(false);
  const [equipmentsList, setEquipmentsList] = useState<Equipment[]>([]);

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      const p = await getUserProfile(userId);
      setProfile(p);
    };

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) fetchProfile(user.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffectReact(() => {
    getAllEquipments().then(setEquipmentsList).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate("/auth");
  };

  const filteredItems = navItems.filter(item => {
    // Show all items if user is logged in (profile exists)
    if (!profile) return item.path === "/" || item.path === "/auth";
    return true;
  });

  const renderFrotasSubmenu = (isMobile: boolean) => (
    <>
      <button
        onClick={() => setDronesOpen(!dronesOpen)}
        className={cn(
          "sidebar-nav-item flex items-center gap-3 rounded-xl transition-all duration-200 relative overflow-hidden w-full text-left",
          collapsed && !isMobile
            ? "justify-center px-3 py-3"
            : "px-4 py-3",
          ["/frotas", "/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname) && !dronesOpen
            ? "bg-white/[0.08] text-white"
            : "text-white/50 hover:text-white/90 hover:bg-white/[0.04]"
        )}
      >
        {["/frotas", "/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname) && !dronesOpen && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
        )}
        <Truck
          className={cn(
            "shrink-0 transition-all duration-200",
            collapsed && !isMobile ? "h-5 w-5" : "h-[18px] w-[18px]",
            ["/frotas", "/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname) && !dronesOpen ? "text-emerald-400" : ""
          )}
        />
        <span
          className={cn(
            "text-sm font-medium whitespace-nowrap transition-all duration-300 flex-1",
            collapsed && !isMobile ? "w-0 opacity-0 hidden" : "w-auto opacity-100",
            ["/frotas", "/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname) && !dronesOpen ? "text-white" : ""
          )}
        >
          Gestão de Frotas
        </span>
        {!collapsed && !isMobile && (
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200 shrink-0",
              dronesOpen ? "rotate-0" : "-rotate-90"
            )}
          />
        )}
      </button>

      {/* Submenu items */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          dronesOpen && !collapsed ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="flex flex-col gap-0.5 pl-4">
          {/* Frotas - link direto */}
          <Link
            to="/frotas"
            className={cn(
              "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2.5 text-sm",
              location.pathname === "/frotas"
                ? "bg-white/[0.08] text-white"
                : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
            )}
          >
            <Truck className={cn("h-4 w-4 shrink-0", location.pathname === "/frotas" ? "text-emerald-400" : "")} />
            <span className="whitespace-nowrap">Frotas</span>
          </Link>

          {/* Equipamentos - abre dialog */}
          <button
            onClick={() => setEquipamentosDialogOpen(true)}
            className={cn(
              "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2.5 text-sm w-full text-left",
              "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">Equipamentos</span>
          </button>

          {/* Frota de Drones - sub-submenu */}
          <div>
            <button
              onClick={() => setDronesAereosOpen(!dronesAereosOpen)}
              className={cn(
                "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2.5 text-sm w-full text-left",
                ["/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname) && !dronesAereosOpen
                  ? "bg-white/[0.08] text-white"
                  : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
              )}
            >
              <Plane className={cn("h-4 w-4 shrink-0", ["/drones", "/flight-log", "/battery-management", "/maintenance"].includes(location.pathname) && !dronesAereosOpen ? "text-emerald-400" : "")} />
              <span className="whitespace-nowrap flex-1">Frota de Drones</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform duration-200 shrink-0",
                  dronesAereosOpen ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                dronesAereosOpen && !collapsed ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="flex flex-col gap-0.5 pl-4">
                {droneSubItems.map((sub) => {
                  const isSubActive = location.pathname === sub.path;
                  const SubIcon = sub.icon;
                  return (
                    <Link
                      key={sub.path}
                      to={sub.path}
                      className={cn(
                        "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2 text-sm",
                        isSubActive
                          ? "bg-white/[0.08] text-white"
                          : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                      )}
                    >
                      <SubIcon className={cn("h-4 w-4 shrink-0", isSubActive ? "text-emerald-400" : "")} />
                      <span className="whitespace-nowrap">{sub.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

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
                {group === "Operações" && renderFrotasSubmenu(isMobile)}
              </div>
            </div>
          );
        })}

        {/* Cadastros Submenu */}
        <div className="mb-2">
          <div
            className={cn(
              "overflow-hidden transition-all duration-300",
              collapsed && !isMobile ? "h-0 opacity-0 px-0 py-0" : "h-auto opacity-100 px-5 py-2"
            )}
          >
            <span className="text-[10px] font-semibold tracking-widest uppercase text-white/25">
              Configurações
            </span>
          </div>
          {collapsed && !isMobile && (
            <div className="mx-auto my-2 w-6 h-px bg-white/[0.06]" />
          )}
          <div className="flex flex-col gap-0.5 px-3">
            <button
              onClick={() => setCadastrosOpen(!cadastrosOpen)}
              className={cn(
                "sidebar-nav-item flex items-center gap-3 rounded-xl transition-all duration-200 relative overflow-hidden w-full text-left",
                collapsed && !isMobile
                  ? "justify-center px-3 py-3"
                  : "px-4 py-3",
                location.pathname === "/cadastros" && !cadastrosOpen
                  ? "bg-white/[0.08] text-white"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.04]"
              )}
            >
              {location.pathname === "/cadastros" && !cadastrosOpen && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
              )}
              <ClipboardList
                className={cn(
                  "shrink-0 transition-all duration-200",
                  collapsed && !isMobile ? "h-5 w-5" : "h-[18px] w-[18px]",
                  location.pathname === "/cadastros" && !cadastrosOpen ? "text-emerald-400" : ""
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium whitespace-nowrap transition-all duration-300 flex-1",
                  collapsed && !isMobile ? "w-0 opacity-0 hidden" : "w-auto opacity-100",
                  location.pathname === "/cadastros" && !cadastrosOpen ? "text-white" : ""
                )}
              >
                Cadastros
              </span>
              {!collapsed && !isMobile && (
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200 shrink-0",
                    cadastrosOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              )}
            </button>

            {/* Submenu items */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-300",
                cadastrosOpen && !collapsed ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <div className="flex flex-col gap-0.5 pl-4">
                {cadastroSubItems.map((sub) => {
                  const isSubActive = location.pathname === "/cadastros" &&
                    new URLSearchParams(location.search).get("tab") === sub.tab;
                  const SubIcon = sub.icon;

                  return (
                    <Link
                      key={sub.tab}
                      to={`/cadastros?tab=${sub.tab}`}
                      className={cn(
                        "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2.5 text-sm",
                        isSubActive
                          ? "bg-white/[0.08] text-white"
                          : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                      )}
                    >
                      <SubIcon className={cn("h-4 w-4 shrink-0", isSubActive ? "text-emerald-400" : "")} />
                      <span className="whitespace-nowrap">{sub.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
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

      {/* Dialog de Equipamentos */}
      <Dialog open={equipamentosDialogOpen} onOpenChange={setEquipamentosDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Equipamentos Cadastrados
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {equipmentsList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum equipamento cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {equipmentsList.map((eq) => (
                  <div key={eq.id} className="border rounded-lg p-3 bg-muted/30 space-y-1">
                    <p className="font-semibold text-sm">{eq.equipment_model || eq.tractor_model || "Sem nome"}</p>
                    {eq.license_plate && <p className="text-xs text-muted-foreground">Placa: {eq.license_plate}</p>}
                    {eq.fleet_number && <p className="text-xs text-muted-foreground">Frota: {eq.fleet_number}</p>}
                    {eq.category && <p className="text-xs text-muted-foreground">Categoria: {eq.category}</p>}
                    {eq.status && (
                      <span className={cn(
                        "inline-block text-[10px] px-2 py-0.5 rounded-full font-medium",
                        eq.status === "ativo" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {eq.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
