import { Menu, X, Home, Plus, FlaskConical, Activity, History, BookOpen, ClipboardList, FileText, ChevronDown, Building2, Check } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const mainNavItems = [
  { path: "/",                 label: "Home",              icon: Home },
  { path: "/nova-medicao",     label: "Nova Medição",     icon: Plus },
  { path: "/calculadora-calda", label: "Calculadora",      icon: FlaskConical },
  { path: "/aferir-vazao",     label: "Aferir Vazão",      icon: Activity },
  { path: "/historico",        label: "Histórico",         icon: History },
  { path: "/tabela-referencia",label: "Tabela ISO",        icon: BookOpen },
  { path: "/cadastros",        label: "Cadastros",         icon: ClipboardList },
  { path: "/ordem-servico",    label: "Ordem de Serviço",  icon: FileText },
];

export function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { branches, activeBranch, setActiveBranchId, company, suspended } = useAuth();
  const [branchOpen, setBranchOpen] = useState(false);
  const branchRef = useRef<HTMLDivElement>(null);

  // Itens visíveis na barra (primeiros 4) e no dropdown (restantes)
  const visibleItems = mainNavItems.slice(0, 4);
  const dropdownItems = mainNavItems.slice(4);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setBranchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Trocar de filial recarrega a tela: as telas buscaram os dados já na filial
  // anterior, e recarregar garante que ninguém veja uma mistura das duas.
  const trocarFilial = (id: string) => {
    setBranchOpen(false);
    setActiveBranchId(id);
    window.location.reload();
  };

  const isDropdownActive = dropdownItems.some(i => i.path === location.pathname);

  return (
    <header className="sticky top-0 z-50 glass-effect border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center group shrink-0">
            <img
              src="/herbilog_logo.png"
              alt="HerbiLog"
              className="h-11 w-auto object-contain group-hover:opacity-90 transition-opacity duration-200"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-end">
            {visibleItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}

            {/* Dropdown "Mais" */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isDropdownActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                Mais
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", dropdownOpen && "rotate-180")} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-popover shadow-xl animate-slide-up z-50 overflow-hidden">
                  {dropdownItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setDropdownOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors duration-150",
                        location.pathname === item.path
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          {/* Seletor de filial */}
          {branches.length > 0 && !suspended && (
            <div className="relative shrink-0 hidden sm:block" ref={branchRef}>
              <button
                onClick={() => setBranchOpen(!branchOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                title={`Empresa: ${company?.name ?? ""}`}
              >
                <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium max-w-[9rem] truncate">
                  {activeBranch?.name ?? "Filial"}
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", branchOpen && "rotate-180")} />
              </button>

              {branchOpen && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-popover shadow-xl animate-slide-up z-50 overflow-hidden">
                  <div className="px-4 py-2 border-b border-border bg-muted/40">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                      {company?.name ?? "Empresa"}
                    </p>
                  </div>
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => trocarFilial(b.id)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium transition-colors text-left",
                        b.id === activeBranch?.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      )}
                    >
                      <span className="flex flex-col">
                        <span>{b.name}</span>
                        {b.code && (
                          <span className="text-[10px] uppercase text-muted-foreground">{b.code}</span>
                        )}
                      </span>
                      {b.id === activeBranch?.id && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                  <div className="px-4 py-2 border-t border-border text-[10px] text-muted-foreground bg-muted/20">
                    Trocar de filial recarrega a tela.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Filiais no menu mobile */}
        {mobileMenuOpen && branches.length > 1 && !suspended && (
          <div className="md:hidden px-4 py-3 border-b border-border">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
              Filial
            </p>
            <div className="flex flex-wrap gap-2">
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => trocarFilial(b.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border",
                    b.id === activeBranch?.id
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "border-border hover:bg-accent"
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-3 border-t border-border animate-slide-up">
            <div className="flex flex-col gap-1">
              {mainNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    location.pathname === item.path
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
