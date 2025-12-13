import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NOZZLE_TYPES } from "@/lib/nozzleData";
import { NozzleColorBadge } from "@/components/NozzleColorBadge";
import { Info } from "lucide-react";

export default function TabelaReferencia() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl md:text-4xl font-heading text-foreground mb-4">
            Tabela de Referência ISO
          </h1>
          <p className="text-muted-foreground">
            Valores padrão de vazão para bicos pulverizadores conforme código de cores ISO.
            Todos os valores são referentes à pressão de trabalho de 3 bar.
          </p>
        </div>

        <Card className="shadow-lg animate-slide-up">
          <CardHeader className="bg-primary/5 border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Info className="h-4 w-4" />
              </div>
              Cores e Vazões Nominais
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-heading">Cor do Bico</TableHead>
                    <TableHead className="font-heading text-right">Vazão (gal/min)</TableHead>
                    <TableHead className="font-heading text-right">Vazão (L/min)</TableHead>
                    <TableHead className="font-heading text-right">Mín. -10%</TableHead>
                    <TableHead className="font-heading text-right">Máx. +10%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {NOZZLE_TYPES.map((nozzle, index) => {
                    const min = (nozzle.litersPerMin * 0.9).toFixed(3);
                    const max = (nozzle.litersPerMin * 1.1).toFixed(3);
                    
                    return (
                      <TableRow 
                        key={nozzle.id}
                        className="animate-slide-up"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <TableCell>
                          <NozzleColorBadge nozzle={nozzle} size="lg" />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {nozzle.gallonsPerMin.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary">
                          {nozzle.litersPerMin.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-warning">
                          {min}
                        </TableCell>
                        <TableCell className="text-right font-mono text-destructive">
                          {max}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <CardHeader>
              <CardTitle className="text-base">Regras de Avaliação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-success mt-1.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">OK:</strong> Vazão dentro da faixa de ±10% do valor nominal
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-warning mt-1.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Limpeza:</strong> Vazão abaixo do mínimo (-10%)
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-destructive mt-1.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Substituição:</strong> Vazão acima do máximo (+10%)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <CardHeader>
              <CardTitle className="text-base">Regra Especial</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-foreground">
                  Se mais de <strong>10% dos bicos</strong> apresentarem vazão acima do limite máximo, 
                  recomenda-se a <strong>substituição de todos os bicos</strong> do equipamento.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
