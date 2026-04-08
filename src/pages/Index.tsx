import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  FlaskConical,
  Activity,
  History,
  BookOpen,
  ClipboardList,
  FileText,
  ArrowRight,
  TrendingUp,
  Droplets,
  Gauge,
} from "lucide-react";

const quickActions = [
  {
    to: "/nova-medicao",
    icon: Plus,
    title: "Nova Medição",
    description: "Avaliar bicos pulverizadores",
    gradient: "from-emerald-500 to-green-600",
    shadowColor: "shadow-emerald-500/20",
  },
  {
    to: "/calculadora-calda",
    icon: FlaskConical,
    title: "Calculadora de Calda",
    description: "Dosagem e ordem de mistura",
    gradient: "from-blue-500 to-cyan-600",
    shadowColor: "shadow-blue-500/20",
  },
  {
    to: "/aferir-vazao",
    icon: Activity,
    title: "Aferir Vazão",
    description: "Calibração do implemento",
    gradient: "from-amber-500 to-orange-600",
    shadowColor: "shadow-amber-500/20",
  },
  {
    to: "/ordem-servico",
    icon: FileText,
    title: "Ordem de Serviço",
    description: "Gerar OS de aplicação",
    gradient: "from-violet-500 to-purple-600",
    shadowColor: "shadow-violet-500/20",
  },
];

const menuItems = [
  {
    to: "/historico",
    icon: History,
    title: "Histórico",
    description: "Ver medições anteriores",
  },
  {
    to: "/tabela-referencia",
    icon: BookOpen,
    title: "Tabela ISO",
    description: "Valores de referência",
  },
  {
    to: "/cadastros",
    icon: ClipboardList,
    title: "Cadastros",
    description: "Equipamentos e produtos",
  },
];

const statCards = [
  {
    icon: Gauge,
    label: "Avaliações",
    value: "—",
    subtitle: "precisão ISO",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: Droplets,
    label: "Bicos analisados",
    value: "—",
    subtitle: "total acumulado",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: TrendingUp,
    label: "Economia estimada",
    value: "—",
    subtitle: "em defensivos",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
];

export default function Index() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f1a14] via-[#162016] to-[#1a2b1e] p-6 md:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-green-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-4">
              <Droplets className="h-3 w-3" />
              Sistema de Avaliação Agrícola
            </div>
            <h1 className="text-2xl md:text-3xl font-heading text-white mb-2">
              Bem-vindo ao <span className="text-emerald-400">HerbiLog</span>
            </h1>
            <p className="text-white/50 text-sm md:text-base max-w-lg">
              Meça, avalie e diagnostique a condição dos bicos do seu pulverizador
              com precisão baseada nos padrões ISO.
            </p>
          </div>
          <div className="hidden md:block shrink-0">
            <img
              src="/herbilog_3d.png"
              alt="HerbiLog"
              className="w-40 h-auto drop-shadow-2xl hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <Card
            key={stat.label}
            className="border-border/50 bg-card/80 backdrop-blur-sm hover:shadow-md transition-all duration-300 animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center shrink-0`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-heading text-foreground leading-tight">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground/70">{stat.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-heading text-foreground mb-4 flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-emerald-500" />
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Link
              key={action.to}
              to={action.to}
              className="group animate-slide-up"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <Card className="h-full border-border/50 bg-card/80 hover:bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${action.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <CardContent className="p-5">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} ${action.shadowColor} shadow-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-sm font-heading text-foreground mb-1 group-hover:text-foreground transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {action.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    Acessar
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Other Modules */}
      <div>
        <h2 className="text-lg font-heading text-foreground mb-4 flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-blue-500" />
          Consultas & Cadastros
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {menuItems.map((item, index) => (
            <Link
              key={item.to}
              to={item.to}
              className="group animate-slide-up"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <Card className="h-full border-border/50 bg-card/50 hover:bg-card hover:shadow-md hover:border-primary/20 transition-all duration-300">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-heading text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ISO Info Section */}
      <Card className="border-border/50 bg-gradient-to-r from-card to-card/50 overflow-hidden">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-heading text-foreground mb-2">
              Padrões ISO de Cores
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Os bicos pulverizadores seguem um padrão internacional de cores que indica
              a vazão nominal. Cada cor corresponde a um valor específico em L/min a 3 bar.
            </p>
            <Link
              to="/tabela-referencia"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Ver tabela completa
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="flex gap-1.5 shrink-0 flex-wrap">
            {[
              "bg-nozzle-orange",
              "bg-nozzle-green",
              "bg-nozzle-yellow",
              "bg-nozzle-lilac",
              "bg-nozzle-blue",
              "bg-nozzle-red",
              "bg-nozzle-brown",
              "bg-nozzle-gray",
            ].map((color) => (
              <div
                key={color}
                className={`w-6 h-6 rounded-full ${color} border border-white/20 shadow-sm`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
