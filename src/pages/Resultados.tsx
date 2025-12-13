import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMeasurement } from "@/context/MeasurementContext";
import { calculateOverallDiagnosis, calculateNozzleStatus, getNozzleById } from "@/lib/nozzleData";
import { NozzleColorBadge } from "@/components/NozzleColorBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  CheckCircle, 
  Wrench, 
  AlertTriangle, 
  FileDown, 
  RotateCcw, 
  AlertCircle,
  Printer
} from "lucide-react";
import { toast } from "sonner";

export default function Resultados() {
  const navigate = useNavigate();
  const { currentMeasurement, saveMeasurement, resetMeasurement } = useMeasurement();
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentMeasurement || currentMeasurement.readings.length === 0) {
      toast.error("Nenhuma medição encontrada. Inicie uma nova medição.");
      navigate("/nova-medicao");
    }
  }, [currentMeasurement, navigate]);

  if (!currentMeasurement || currentMeasurement.readings.length === 0) return null;

  const diagnosis = calculateOverallDiagnosis(currentMeasurement.readings);

  const handleSaveAndNew = () => {
    saveMeasurement(currentMeasurement);
    toast.success("Medição salva com sucesso!");
    resetMeasurement();
    navigate("/nova-medicao");
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 animate-fade-in print:hidden">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
              Etapa 3 de 3
            </span>
            <span>Resultados</span>
          </div>
          <h1 className="text-3xl font-heading text-foreground mb-2">
            Diagnóstico da Avaliação
          </h1>
          <p className="text-muted-foreground">
            Resultados detalhados e recomendações de manutenção.
          </p>
        </div>

        <div ref={reportRef}>
          {/* Equipment Info */}
          <Card className="shadow-lg mb-6 animate-slide-up">
            <CardHeader className="border-b border-border bg-muted/30">
              <CardTitle className="text-lg">Informações do Equipamento</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block">Pulverizador</span>
                  <span className="font-medium">{currentMeasurement.equipmentModel}</span>
                </div>
                {currentMeasurement.tractorModel && (
                  <div>
                    <span className="text-muted-foreground block">Trator</span>
                    <span className="font-medium">{currentMeasurement.tractorModel}</span>
                  </div>
                )}
                {currentMeasurement.fleetNumber && (
                  <div>
                    <span className="text-muted-foreground block">Frota</span>
                    <span className="font-medium">{currentMeasurement.fleetNumber}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground block">Data</span>
                  <span className="font-medium">{formatDate(currentMeasurement.measurementDate)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Pressão</span>
                  <span className="font-medium">{currentMeasurement.workingPressure} bar</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total de Bicos</span>
                  <span className="font-medium">{currentMeasurement.totalNozzles}</span>
                </div>
                {currentMeasurement.technicianName && (
                  <div>
                    <span className="text-muted-foreground block">Técnico</span>
                    <span className="font-medium">{currentMeasurement.technicianName}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Diagnosis Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-success/15 text-success flex items-center justify-center">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading text-success">{diagnosis.totalOk}</p>
                    <p className="text-sm text-muted-foreground">Bicos OK</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-warning/15 text-warning flex items-center justify-center">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading text-warning">{diagnosis.totalCleaning}</p>
                    <p className="text-sm text-muted-foreground">Precisam Limpeza</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-heading text-destructive">{diagnosis.totalReplacement}</p>
                    <p className="text-sm text-muted-foreground">Substituir</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Full Replacement Alert */}
          {diagnosis.needsFullReplacement && (
            <Card className="mb-6 border-destructive bg-destructive/5 animate-scale-in">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-heading text-destructive mb-2">
                      Substituição Total Recomendada
                    </h3>
                    <p className="text-sm text-foreground">
                      <strong>{diagnosis.percentageAbove.toFixed(1)}%</strong> dos bicos estão com vazão acima do limite máximo.
                      Como esse percentual é maior que 10%, recomenda-se a <strong>substituição de todos os bicos</strong> do equipamento para garantir uniformidade na aplicação.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Results Table */}
          <Card className="shadow-lg animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg">Resultados Detalhados</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-heading w-16">Nº</TableHead>
                      <TableHead className="font-heading">Cor</TableHead>
                      <TableHead className="font-heading text-right">Padrão</TableHead>
                      <TableHead className="font-heading text-right">Mín.</TableHead>
                      <TableHead className="font-heading text-right">Máx.</TableHead>
                      <TableHead className="font-heading text-right">Medido</TableHead>
                      <TableHead className="font-heading text-center">Status</TableHead>
                      <TableHead className="font-heading">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentMeasurement.readings.map((reading) => {
                      const nozzle = getNozzleById(reading.nozzleTypeId);
                      const result = calculateNozzleStatus(reading.nozzleTypeId, reading.measuredValue);

                      return (
                        <TableRow key={reading.nozzleNumber}>
                          <TableCell className="font-mono font-bold text-primary">
                            {reading.nozzleNumber}
                          </TableCell>
                          <TableCell>
                            {nozzle && <NozzleColorBadge nozzle={nozzle} size="sm" />}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {nozzle?.litersPerMin.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-warning">
                            {result.min.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-destructive">
                            {result.max.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {reading.measuredValue.toFixed(3)}
                          </TableCell>
                          <TableCell className="text-center">
                            <StatusBadge status={reading.status} size="sm" showIcon={false} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {reading.action}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8 print:hidden">
          <Button variant="outline" onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4" />
            Imprimir Relatório
          </Button>
          <Button onClick={handleSaveAndNew} className="flex-1">
            <RotateCcw className="h-4 w-4" />
            Salvar e Nova Medição
          </Button>
        </div>
      </div>
    </div>
  );
}
