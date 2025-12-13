import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMeasurement } from "@/context/MeasurementContext";
import { calculateOverallDiagnosis } from "@/lib/nozzleData";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  Search, 
  Calendar, 
  Tractor, 
  CheckCircle, 
  Wrench, 
  AlertTriangle,
  FileText,
  Plus
} from "lucide-react";

export default function Historico() {
  const { savedMeasurements } = useMeasurement();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredMeasurements = savedMeasurements.filter((m) => {
    const search = searchTerm.toLowerCase();
    return (
      m.equipmentModel.toLowerCase().includes(search) ||
      m.tractorModel?.toLowerCase().includes(search) ||
      m.fleetNumber?.toLowerCase().includes(search) ||
      m.technicianName?.toLowerCase().includes(search)
    );
  });

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-heading text-foreground mb-2">
            Histórico de Medições
          </h1>
          <p className="text-muted-foreground">
            Consulte as medições realizadas anteriormente.
          </p>
        </div>

        {/* Search */}
        <div className="mb-6 animate-slide-up">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por equipamento, trator, frota ou técnico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Empty State */}
        {savedMeasurements.length === 0 && (
          <Card className="animate-slide-up">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-heading text-foreground mb-2">
                Nenhuma medição encontrada
              </h3>
              <p className="text-muted-foreground mb-6">
                Você ainda não realizou nenhuma medição. Comece agora!
              </p>
              <Button asChild>
                <Link to="/nova-medicao">
                  <Plus className="h-4 w-4" />
                  Nova Medição
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {savedMeasurements.length > 0 && filteredMeasurements.length === 0 && (
          <Card className="animate-slide-up">
            <CardContent className="p-12 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-heading text-foreground mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-muted-foreground">
                Tente buscar com outros termos.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Measurements List */}
        <div className="space-y-4">
          {filteredMeasurements.map((measurement, index) => {
            const diagnosis = calculateOverallDiagnosis(measurement.readings);

            return (
              <Card 
                key={measurement.id} 
                className="shadow-md hover:shadow-lg transition-shadow animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-heading text-foreground">
                          {measurement.equipmentModel}
                        </h3>
                        {diagnosis.needsFullReplacement && (
                          <span className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs font-medium">
                            Substituição Total
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {formatDate(measurement.measurementDate)}
                        </span>
                        {measurement.tractorModel && (
                          <span className="flex items-center gap-1.5">
                            <Tractor className="h-4 w-4" />
                            {measurement.tractorModel}
                          </span>
                        )}
                        {measurement.fleetNumber && (
                          <span className="flex items-center gap-1.5">
                            #{measurement.fleetNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-success">
                          <CheckCircle className="h-4 w-4" />
                          {diagnosis.totalOk}
                        </span>
                        <span className="flex items-center gap-1.5 text-warning">
                          <Wrench className="h-4 w-4" />
                          {diagnosis.totalCleaning}
                        </span>
                        <span className="flex items-center gap-1.5 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          {diagnosis.totalReplacement}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
