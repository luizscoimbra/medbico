import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMeasurement } from "@/context/MeasurementContext";
import { NOZZLE_TYPES, NozzleReading, calculateNozzleStatus, getNozzleById } from "@/lib/nozzleData";
import { NozzleColorBadge } from "@/components/NozzleColorBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight, ArrowLeft, Droplets } from "lucide-react";
import { toast } from "sonner";

export default function EntradaDados() {
  const navigate = useNavigate();
  const { currentMeasurement, updateReadings } = useMeasurement();
  
  const [readings, setReadings] = useState<NozzleReading[]>([]);

  useEffect(() => {
    if (!currentMeasurement) {
      toast.error("Por favor, preencha as informações do equipamento primeiro.");
      navigate("/nova-medicao");
      return;
    }

    // Initialize readings array
    const initialReadings: NozzleReading[] = Array.from(
      { length: currentMeasurement.totalNozzles },
      (_, i) => ({
        nozzleNumber: i + 1,
        nozzleTypeId: "green", // Default to green
        measuredValue: 0,
        status: "ok",
        action: "OK",
      })
    );
    setReadings(initialReadings);
  }, [currentMeasurement, navigate]);

  const handleNozzleTypeChange = (index: number, nozzleTypeId: string) => {
    setReadings((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        nozzleTypeId,
      };
      // Recalculate status if there's a measured value
      if (updated[index].measuredValue > 0) {
        const result = calculateNozzleStatus(nozzleTypeId, updated[index].measuredValue);
        updated[index].status = result.status;
        updated[index].action = result.action;
      }
      return updated;
    });
  };

  const handleMeasuredValueChange = (index: number, value: string) => {
    const numValue = parseFloat(value) || 0;
    setReadings((prev) => {
      const updated = [...prev];
      const result = calculateNozzleStatus(updated[index].nozzleTypeId, numValue);
      updated[index] = {
        ...updated[index],
        measuredValue: numValue,
        status: result.status,
        action: result.action,
      };
      return updated;
    });
  };

  const handleSubmit = () => {
    // Check if all readings have values
    const emptyReadings = readings.filter((r) => r.measuredValue === 0);
    if (emptyReadings.length > 0) {
      toast.warning(`${emptyReadings.length} bico(s) sem valor medido. Deseja continuar mesmo assim?`, {
        action: {
          label: "Continuar",
          onClick: () => {
            updateReadings(readings);
            navigate("/resultados");
          },
        },
      });
      return;
    }

    updateReadings(readings);
    navigate("/resultados");
  };

  if (!currentMeasurement) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
              Etapa 2 de 3
            </span>
            <span>Entrada de Dados</span>
          </div>
          <h1 className="text-3xl font-heading text-foreground mb-2">
            Medição dos Bicos
          </h1>
          <p className="text-muted-foreground">
            Informe a cor e o valor medido para cada bico. 
            <strong> Equipamento:</strong> {currentMeasurement.equipmentModel}
          </p>
        </div>

        <Card className="shadow-lg animate-slide-up">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />
              Dados dos {currentMeasurement.totalNozzles} Bicos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
              {readings.map((reading, index) => {
                const nozzle = getNozzleById(reading.nozzleTypeId);
                const result = reading.measuredValue > 0 
                  ? calculateNozzleStatus(reading.nozzleTypeId, reading.measuredValue)
                  : null;

                return (
                  <div
                    key={reading.nozzleNumber}
                    className="p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      {/* Nozzle Number */}
                      <div className="flex items-center gap-3 min-w-[80px]">
                        <span className="h-8 w-8 rounded-full bg-primary/10 text-primary font-mono font-bold text-sm flex items-center justify-center">
                          {reading.nozzleNumber}
                        </span>
                        <span className="text-sm text-muted-foreground md:hidden">
                          Bico
                        </span>
                      </div>

                      {/* Nozzle Type Selector */}
                      <div className="flex-1 min-w-[180px]">
                        <Label className="text-xs text-muted-foreground mb-1.5 block md:hidden">
                          Cor do Bico
                        </Label>
                        <Select
                          value={reading.nozzleTypeId}
                          onValueChange={(value) => handleNozzleTypeChange(index, value)}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue>
                              {nozzle && <NozzleColorBadge nozzle={nozzle} size="sm" />}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-popover">
                            {NOZZLE_TYPES.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                <NozzleColorBadge nozzle={type} size="sm" />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Reference Value */}
                      <div className="hidden md:block min-w-[100px] text-center">
                        <span className="text-xs text-muted-foreground block">Ref.</span>
                        <span className="font-mono text-sm">
                          {nozzle?.litersPerMin.toFixed(3)} L/min
                        </span>
                      </div>

                      {/* Measured Value Input */}
                      <div className="flex-1 min-w-[150px]">
                        <Label className="text-xs text-muted-foreground mb-1.5 block md:hidden">
                          Valor Medido (L/min)
                        </Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={reading.measuredValue || ""}
                          onChange={(e) => handleMeasuredValueChange(index, e.target.value)}
                          className="font-mono bg-background"
                        />
                      </div>

                      {/* Status Badge */}
                      <div className="min-w-[120px] flex justify-end">
                        {reading.measuredValue > 0 ? (
                          <StatusBadge status={reading.status} size="sm" />
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Aguardando...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Mobile Reference */}
                    {result && (
                      <div className="md:hidden mt-2 text-xs text-muted-foreground">
                        Faixa: {result.min.toFixed(3)} - {result.max.toFixed(3)} L/min
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => navigate("/nova-medicao")}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={handleSubmit} size="lg">
            Ver Resultados
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
