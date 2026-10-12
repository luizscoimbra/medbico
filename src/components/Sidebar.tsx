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
  Banknote,
  Fuel,
  Boxes,
  MapPin,
  ShieldCheck,
  Building,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/SidebarContext";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { ModuleId } from "@/modules/registry";
import { toast } from "sonner";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  group: string;
  module: ModuleId;
}

const navItems: NavItem[] = [
  { path: "/", label: "Início", icon: Home, group: "Principal", module: "principal" },
  { path: "/visao-geral", label: "Visão Geral", icon: LayoutDashboard, group: "Principal", module: "principal" },
  { path: "/nova-medicao", label: "Nova Medição", icon: Plus, group: "Operações", module: "operacoes" },
  { path: "/calculadora-calda", label: "Calculadora de Calda", icon: FlaskConical, group: "Operações", module: "operacoes" },
  { path: "/aferir-vazao", label: "Aferir Vazão", icon: Activity, group: "Operações", module: "operacoes" },
  { path: "/ordem-servico", label: "Ordem de Serviço", icon: FileText, group: "Operações", module: "operacoes" },
  { path: "/estoque", label: "Estoque", icon: Boxes, group: "Operações", module: "estoque" },
  { path: "/area-motorista", label: "Área do Motorista", icon: Truck, group: "Operações", module: "motorista" },
  { path: "/historico", label: "Histórico", icon: History, group: "Consultas", module: "consultas" },
  { path: "/tabela-referencia", label: "Tabela ISO", icon: BookOpen, group: "Consultas", module: "consultas" },
  { path: "/acessos", label: "Gestão de Acessos", icon: Shield, group: "Configurações", module: "acessos" },
  { path: "/empresa", label: "Empresa", icon: Building, group: "Configurações", module: "acessos" },
  { path: "/tributacao", label: "Tributação", icon: Calculator, group: "Configurações", module: "cadastros" },
  { path: "/filiais", label: "Filiais", icon: MapPin, group: "Configurações", module: "acessos" },
  { path: "/plataforma", label: "Plataforma", icon: ShieldCheck, group: "Configurações", module: "plataforma" },
  { path: "/financeiro", label: "Financeiro", icon: Banknote, group: "Financeiro", module: "financeiro" },
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

const groups = ["Principal", "Operações", "Financeiro", "Consultas", "Configurações"];

const FROTAS_PATHS = [
  "/frotas",
  "/equipamentos",
  "/manutencao-equipamentos",
  "/gestao-abastecimento",
  "/drones",
  "/flight-log",
  "/battery-management",
  "/maintenance",
];

const EQUIP_PATHS = ["/equipamentos", "/manutencao-equipamentos", "/gestao-abastecimento"];
const DRONE_PATHS = ["/drones", "/flight-log", "/battery-management", "/maintenance"];
const EQUIP_MENU_PATHS = [...EQUIP_PATHS, ...DRONE_PATHS];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, mobileOpen, toggleCollapse, toggleMobile, closeMobile } = useSidebar();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { profile, can } = useAuth();
  const [cadastrosOpen, setCadastrosOpen] = useState(() => location.pathname === "/cadastros");
  const [dronesOpen, setDronesOpen] = useState(() => FROTAS_PATHS.includes(location.pathname));
  const [dronesAereosOpen, setDronesAereosOpen] = useState(() => DRONE_PATHS.includes(location.pathname));
  const [equipamentosOpen, setEquipamentosOpen] = useState(() => EQUIP_MENU_PATHS.includes(location.pathname));
  const [frotaTerrestreOpen, setFrotaTerrestreOpen] = useState(() => EQUIP_PATHS.includes(location.pathname));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate("/auth");
  };

  const filteredItems = navItems.filter(item => {
    if (!profile) return item.path === "/" || item.path === "/auth";
    return can(item.module);
  });

  const renderFrotasSubmenu = (isMobile: boolean) => {
    if (!can("drones")) return null;

    return (
      <>
        <button
          onClick={() => setDronesOpen(!dronesOpen)}
          className={cn(
            "sidebar-nav-item flex items-center gap-3 rounded-xl transition-all duration-200 relative overflow-hidden w-full text-left",
            collapsed && !isMobile
              ? "justify-center px-3 py-3"
              : "px-4 py-3",
            FROTAS_PATHS.includes(location.pathname) && !dronesOpen
              ? "bg-white/[0.08] text-white"
              : "text-white/50 hover:text-white/90 hover:bg-white/[0.04]"
          )}
        >
          {FROTAS_PATHS.includes(location.pathname) && !dronesOpen && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          )}
          <Truck
            className={cn(
              "shrink-0 transition-all duration-200",
              collapsed && !isMobile ? "h-5 w-5" : "h-[18px] w-[18px]",
              FROTAS_PATHS.includes(location.pathname) && !dronesOpen ? "text-emerald-400" : ""
            )}
          />
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap transition-all duration-300 flex-1",
              collapsed && !isMobile ? "w-0 opacity-0 hidden" : "w-auto opacity-100",
              FROTAS_PATHS.includes(location.pathname) && !dronesOpen ? "text-white" : ""
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
            dronesOpen && !collapsed ? "max-h-[700px] opacity-100" : "max-h-0 opacity-0"
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

            {/* Equipamentos - sub-submenu */}
            <div>
              <button
                onClick={() => setEquipamentosOpen(!equipamentosOpen)}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2.5 text-sm w-full text-left",
                  EQUIP_MENU_PATHS.includes(location.pathname) && !equipamentosOpen
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                )}
              >
                <Settings
                  className={cn(
                    "h-4 w-4 shrink-0",
                    EQUIP_MENU_PATHS.includes(location.pathname) && !equipamentosOpen ? "text-emerald-400" : ""
                  )}
                />
                <span className="whitespace-nowrap flex-1">Equipamentos</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200 shrink-0",
                    equipamentosOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-300",
                  equipamentosOpen && !collapsed ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="flex flex-col gap-0.5 pl-4">
                  {/* Frota terrestre - sub-sub-submenu */}
                  <div>
                    <button
                      onClick={() => setFrotaTerrestreOpen(!frotaTerrestreOpen)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2.5 text-sm w-full text-left",
                        EQUIP_PATHS.includes(location.pathname) && !frotaTerrestreOpen
                          ? "bg-white/[0.08] text-white"
                          : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                      )}
                    >
                      <Truck
                        className={cn(
                          "h-4 w-4 shrink-0",
                          EQUIP_PATHS.includes(location.pathname) && !frotaTerrestreOpen
                            ? "text-emerald-400"
                            : ""
                        )}
                      />
                      <span className="whitespace-nowrap flex-1">Frota terrestre</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform duration-200 shrink-0",
                          frotaTerrestreOpen ? "rotate-0" : "-rotate-90"
                        )}
                      />
                    </button>
                    <div
                      className={cn(
                        "overflow-hidden transition-all duration-300",
                        frotaTerrestreOpen && !collapsed ? "max-h-[240px] opacity-100" : "max-h-0 opacity-0"
                      )}
                    >
                      <div className="flex flex-col gap-0.5 pl-4">
                        <Link
                          to="/equipamentos"
                          className={cn(
                            "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2 text-sm",
                            location.pathname === "/equipamentos"
                              ? "bg-white/[0.08] text-white"
                              : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                          )}
                        >
                          <Settings
                            className={cn(
                              "h-4 w-4 shrink-0",
                              location.pathname === "/equipamentos" ? "text-emerald-400" : ""
                            )}
                          />
                          <span className="whitespace-nowrap">Equipamentos</span>
                        </Link>
                        <Link
                          to="/manutencao-equipamentos"
                          className={cn(
                            "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2 text-sm",
                            location.pathname === "/manutencao-equipamentos"
                              ? "bg-white/[0.08] text-white"
                              : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                          )}
                        >
                          <Wrench
                            className={cn(
                              "h-4 w-4 shrink-0",
                              location.pathname === "/manutencao-equipamentos" ? "text-emerald-400" : ""
                            )}
                          />
                          <span className="whitespace-nowrap">Manutenção</span>
                        </Link>
                        <Link
                          to="/gestao-abastecimento"
                          className={cn(
                            "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2 text-sm",
                            location.pathname === "/gestao-abastecimento"
                              ? "bg-white/[0.08] text-white"
                              : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                          )}
                        >
                          <Fuel
                            className={cn(
                              "h-4 w-4 shrink-0",
                              location.pathname === "/gestao-abastecimento" ? "text-emerald-400" : ""
                            )}
                          />
                          <span className="whitespace-nowrap">Gestão de abastecimento</span>
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Frota de Drones - sub-submenu */}
                  <div>
                    <button
                      onClick={() => setDronesAereosOpen(!dronesAereosOpen)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl transition-all duration-200 px-4 py-2.5 text-sm w-full text-left",
                        DRONE_PATHS.includes(location.pathname) && !dronesAereosOpen
                          ? "bg-white/[0.08] text-white"
                          : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
                      )}
                    >
                      <Plane className={cn("h-4 w-4 shrink-0", DRONE_PATHS.includes(location.pathname) && !dronesAereosOpen ? "text-emerald-400" : "")} />
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
            </div>
          </div>
        </div>
      </>
    );
  };

  // Close mobile menu on route change (pathname or query string)
  useEffect(() => {
    closeMobile();
  }, [location.pathname, location.search, closeMobile]);

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
      <div className="flex items-center justify-center border-b border-white/[0.06] shrink-0 transition-all duration-300 py-0 px-0">
        <img
          src="/herbilog_sidebar.png"
          alt="HerbiLog"
          className="w-4/5 max-w-full h-auto max-h-[28vh] object-contain mx-auto drop-shadow-lg select-none"
          draggable={false}
        />
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
        {can("cadastros") && (
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
                onClick={() => {
                  setCadastrosOpen(!cadastrosOpen);
                  navigate("/visao-geral");
                }}
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
        )}
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

      {/* Collapse button  desktop only */}
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
          <img
            src="/herbilog_sidebar.png"
            alt="HerbiLog"
            className="h-9 w-auto object-contain select-none"
            draggable={false}
          />
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
