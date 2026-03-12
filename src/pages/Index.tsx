import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Droplets, Plus, History, BookOpen, ArrowRight, Gauge, Shield, Zap, FlaskConical, Activity, ClipboardList } from "lucide-react";

const features = [
  {
    icon: Gauge,
    title: "Medição Precisa",
    description: "Avaliação baseada nos padrões ISO com tolerância de ±10%",
  },
  {
    icon: Shield,
    title: "Diagnóstico Automático",
    description: "Identificação automática de bicos que precisam de manutenção",
  },
  {
    icon: Zap,
    title: "Resultados Rápidos",
    description: "Relatórios instantâneos com recomendações de ação",
  },
];

const actionCards = [
  {
    to: "/nova-medicao",
    icon: Plus,
    title: "Nova Medição",
    description: "Iniciar uma nova avaliação de bicos",
    variant: "primary" as const,
  },
  {
    to: "/calculadora-calda",
    icon: FlaskConical,
    title: "Calculadora de Calda",
    description: "Ordem de mistura e dosagem por tanque",
    variant: "secondary" as const,
  },
  {
    to: "/aferir-vazao",
    icon: Activity,
    title: "Aferir Vazão",
    description: "Calibração de vazão do implemento",
    variant: "secondary" as const,
  },
  {
    to: "/historico",
    icon: History,
    title: "Histórico",
    description: "Ver medições anteriores",
    variant: "secondary" as const,
  },
  {
    to: "/tabela-referencia",
    icon: BookOpen,
    title: "Tabela ISO",
    description: "Consultar valores de referência",
    variant: "secondary" as const,
  },
];

export default function Index() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/20" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Droplets className="h-4 w-4" />
              Sistema de Avaliação Agrícola
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading text-foreground mb-6 animate-slide-up">
              Avaliação de{" "}
              <span className="text-gradient">Bicos Pulverizadores</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Meça, avalie e diagnostique a condição dos bicos do seu pulverizador 
              com precisão baseada nos padrões ISO de cores e vazões.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Button asChild variant="hero" size="xl">
                <Link to="/nova-medicao">
                  <Plus className="h-5 w-5" />
                  Iniciar Medição
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link to="/tabela-referencia">
                  <BookOpen className="h-5 w-5" />
                  Ver Tabela ISO
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-card/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={feature.title} 
                className="border-0 shadow-md bg-background animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-heading text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Action Cards Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-heading text-center text-foreground mb-10">
            O que você deseja fazer?
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {actionCards.map((card, index) => (
              <Link
                key={card.to}
                to={card.to}
                className="group animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <Card className={`h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  card.variant === "primary" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-card hover:border-primary/30"
                }`}>
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${
                      card.variant === "primary"
                        ? "bg-primary-foreground/20"
                        : "bg-primary/10 text-primary"
                    }`}>
                      <card.icon className="h-6 w-6" />
                    </div>
                    <h3 className={`text-lg font-heading mb-2 ${
                      card.variant === "primary" ? "" : "text-foreground"
                    }`}>
                      {card.title}
                    </h3>
                    <p className={`text-sm mb-4 flex-grow ${
                      card.variant === "primary" 
                        ? "text-primary-foreground/80" 
                        : "text-muted-foreground"
                    }`}>
                      {card.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all">
                      Acessar
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-heading text-foreground mb-4">
              Padrões ISO de Cores
            </h2>
            <p className="text-muted-foreground mb-6">
              Os bicos pulverizadores seguem um padrão internacional de cores que indica 
              a vazão nominal. Cada cor corresponde a um valor específico de vazão em 
              litros por minuto quando operando a 3 bar de pressão.
            </p>
            <Button asChild variant="outline">
              <Link to="/tabela-referencia">
                Ver tabela completa
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
