import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Settings,
  Truck,
  FlaskConical,
  FileText,
  Map,
  Activity,
  Users,
  Plane,
  BookOpen,
  Battery,
  Wrench,
  ArrowRight,
} from "lucide-react";

interface CadastroCard {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
  color: string;
  bgColor: string;
}

const cadastros: CadastroCard[] = [
  {
    icon: Settings,
    title: "Equipamentos",
    description: "Tratores, pulverizadores e implementos agrícolas",
    path: "/cadastros?tab=equipamentos",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Truck,
    title: "Caminhão Pipa",
    description: "Cisternas e caminhões de abastecimento",
    path: "/cadastros?tab=caminhoes_pipa",
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
  {
    icon: FlaskConical,
    title: "Produtos",
    description: "Produtos agroquímicos, fertilizantes e insumos",
    path: "/cadastros?tab=produtos",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    icon: FileText,
    title: "Serviços",
    description: "Serviços prestados e tabela de preços",
    path: "/cadastros?tab=servicos",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  {
    icon: Map,
    title: "Áreas",
    description: "Propriedades, talhões e áreas de cultivo",
    path: "/cadastros?tab=areas",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    icon: Activity,
    title: "Tipos de Aplicação",
    description: "Códigos e descrição dos tipos de aplicação",
    path: "/cadastros?tab=tipos_aplicacao",
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
  },
  {
    icon: Users,
    title: "Operadores",
    description: "Operadores, motoristas e gestores de campo",
    path: "/cadastros?tab=operadores",
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
  },
  {
    icon: Users,
    title: "Clientes",
    description: "Pessoas físicas e jurídicas clientes",
    path: "/cadastros?tab=clientes",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
  },
  {
    icon: Plane,
    title: "Frota de Drones",
    description: "Aeronaves, componentes, baterias e pilotos",
    path: "/drones",
    color: "text-sky-500",
    bgColor: "bg-sky-500/10",
  },
  {
    icon: BookOpen,
    title: "Logbook de Voo",
    description: "Registros de voos da frota aérea",
    path: "/flight-log",
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  {
    icon: Battery,
    title: "Gestão de Baterias",
    description: "Saúde, ciclos e vida útil das baterias",
    path: "/battery-management",
    color: "text-lime-500",
    bgColor: "bg-lime-500/10",
  },
  {
    icon: Wrench,
    title: "Manutenção Drones",
    description: "Agenda preventiva e histórico de manutenção",
    path: "/maintenance",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
];

export default function VisaoGeral() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-3xl font-heading text-foreground mb-2">
          Visão Geral
        </h1>
        <p className="text-muted-foreground">
          Acesso rápido a todos os cadastros e módulos do sistema.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cadastros.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="group text-left"
            >
              <Card className="h-full transition-all duration-200 hover:shadow-md hover:border-primary/50 hover:translate-y-[-2px] cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center mb-4`}
                    >
                      <Icon className={`h-6 w-6 ${item.color}`} />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
