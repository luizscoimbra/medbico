import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function EmailConfirmada() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-8 space-y-6 text-center">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-2 bg-emerald-500/20 rounded-full blur-md animate-pulse" />
              <img
                src="/herbilog_3d.png"
                alt="HerbiLog"
                className="relative h-24 w-auto drop-shadow-xl"
                draggable={false}
              />
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute -inset-1.5 bg-emerald-500/15 rounded-full blur-md" />
              <CheckCircle2 className="relative h-14 w-14 text-emerald-600" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-heading">E-mail confirmado!</h1>
            <p className="text-muted-foreground">
              Bem-vindo(a) ao <span className="font-semibold text-foreground">HerbiLog</span>!
              <br />
              Sua conta foi ativada e já está pronta para uso.
            </p>
          </div>

          <Button asChild size="lg" className="w-full">
            <a href="https://medbico.pages.dev/">
              Ir para o login <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
