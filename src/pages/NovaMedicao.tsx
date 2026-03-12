import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMeasurement } from "@/context/MeasurementContext";
import { ArrowRight, Tractor, Settings, Calendar, Hash, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface EquipmentOption {
  id: string;
  equipment_model: string;
  tractor_model: string;
  fleet_number: string;
  total_nozzles: number;
}

export default function NovaMedicao() {
  const navigate = useNavigate();
  const { updateEquipmentInfo, resetMeasurement } = useMeasurement();

  const [formData, setFormData] = useState({
    equipmentModel: "",
    tractorModel: "",
    fleetNumber: "",
    totalNozzles: "",
    workingPressure: "3",
    measurementDate: new Date().toISOString().split("T")[0],
    technicianName: "",
  });

  // Fleet autocomplete
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [fleetSearch, setFleetSearch] = useState("");
  const [showFleetSuggestions, setShowFleetSuggestions] = useState(false);
  const [filteredEquipments, setFilteredEquipments] = useState<EquipmentOption[]>([]);
  const fleetInputRef = useRef<HTMLInputElement>(null);
  const fleetSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEquipments = async () => {
      const { data } = await supabase.from("equipment").select("*").order("fleet_number");
      if (data) setEquipments(data as EquipmentOption[]);
    };
    fetchEquipments();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fleetSuggestionsRef.current && !fleetSuggestionsRef.current.contains(e.target as Node) &&
        fleetInputRef.current && !fleetInputRef.current.contains(e.target as Node)
      ) {
        setShowFleetSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFleetSearchChange = (value: string) => {
    setFleetSearch(value);
    setFormData((prev) => ({ ...prev, fleetNumber: value }));
    if (value.trim().length > 0) {
      const filtered = equipments.filter((eq) =>
        eq.fleet_number.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredEquipments(filtered);
      setShowFleetSuggestions(true);
    } else {
      setFilteredEquipments(equipments);
      setShowFleetSuggestions(equipments.length > 0);
    }
  };

  const handleSelectEquipment = (eq: EquipmentOption) => {
    setFleetSearch(eq.fleet_number);
    setFormData((prev) => ({
      ...prev,
      fleetNumber: eq.fleet_number,
      equipmentModel: eq.equipment_model,
      tractorModel: eq.tractor_model || "",
      totalNozzles: String(eq.total_nozzles),
    }));
    setShowFleetSuggestions(false);
    toast.success(`Equipamento ${eq.fleet_number} selecionado`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const totalNozzles = parseInt(formData.totalNozzles);
    if (isNaN(totalNozzles) || totalNozzles < 1 || totalNozzles > 200) {
      toast.error("Quantidade de bicos deve ser entre 1 e 200");
      return;
    }

    if (!formData.equipmentModel.trim()) {
      toast.error("Informe o modelo do equipamento");
      return;
    }

    resetMeasurement();
    updateEquipmentInfo({
      equipmentModel: formData.equipmentModel,
      tractorModel: formData.tractorModel,
      fleetNumber: formData.fleetNumber,
      totalNozzles: totalNozzles,
      workingPressure: parseFloat(formData.workingPressure) || 3,
      measurementDate: new Date(formData.measurementDate),
      technicianName: formData.technicianName,
      readings: [],
    });

    toast.success("Informações salvas! Vamos para a entrada de dados.");
    navigate("/entrada-dados");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">
              Etapa 1 de 3
            </span>
            <span>Informações do Equipamento</span>
          </div>
          <h1 className="text-3xl font-heading text-foreground mb-2">
            Nova Medição
          </h1>
          <p className="text-muted-foreground">
            Preencha as informações do equipamento para iniciar a avaliação.
          </p>
        </div>

        <Card className="shadow-lg animate-slide-up">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Dados do Equipamento
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Fleet number search */}
              <div className="space-y-2 relative">
                <Label htmlFor="fleetSearch" className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  Buscar por Número da Frota
                </Label>
                <Input
                  ref={fleetInputRef}
                  id="fleetSearch"
                  placeholder="Digite o número da frota para buscar..."
                  value={fleetSearch}
                  onChange={(e) => handleFleetSearchChange(e.target.value)}
                  onFocus={() => {
                    if (equipments.length > 0) {
                      setFilteredEquipments(
                        fleetSearch.trim()
                          ? equipments.filter((eq) =>
                              eq.fleet_number.toLowerCase().includes(fleetSearch.toLowerCase())
                            )
                          : equipments
                      );
                      setShowFleetSuggestions(true);
                    }
                  }}
                  autoComplete="off"
                />
                {showFleetSuggestions && filteredEquipments.length > 0 && (
                  <div
                    ref={fleetSuggestionsRef}
                    className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md"
                  >
                    {filteredEquipments.map((eq) => (
                      <button
                        key={eq.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                        onClick={() => handleSelectEquipment(eq)}
                      >
                        <span className="font-medium">{eq.fleet_number}</span>
                        <span className="text-xs text-muted-foreground">
                          {eq.equipment_model} • {eq.total_nozzles} bicos
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {equipments.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selecione uma frota cadastrada ou preencha manualmente abaixo
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="equipmentModel" className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Modelo do Pulverizador *
                  </Label>
                  <Input
                    id="equipmentModel"
                    name="equipmentModel"
                    placeholder="Ex: Jacto Uniport 3030"
                    value={formData.equipmentModel}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tractorModel" className="flex items-center gap-2">
                    <Tractor className="h-4 w-4 text-muted-foreground" />
                    Modelo do Trator
                  </Label>
                  <Input
                    id="tractorModel"
                    name="tractorModel"
                    placeholder="Ex: John Deere 8R 410"
                    value={formData.tractorModel}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fleetNumber" className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    Número da Frota
                  </Label>
                  <Input
                    id="fleetNumber"
                    name="fleetNumber"
                    placeholder="Ex: FR-001"
                    value={formData.fleetNumber}
                    onChange={handleChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="totalNozzles">
                    Quantidade de Bicos *
                  </Label>
                  <Input
                    id="totalNozzles"
                    name="totalNozzles"
                    type="number"
                    min="1"
                    max="200"
                    placeholder="Ex: 48"
                    value={formData.totalNozzles}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workingPressure">
                    Pressão de Trabalho (bar)
                  </Label>
                  <Input
                    id="workingPressure"
                    name="workingPressure"
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    placeholder="3"
                    value={formData.workingPressure}
                    onChange={handleChange}
                  />
                  <p className="text-xs text-muted-foreground">
                    Padrão: 3 bar (valores de referência ISO)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="measurementDate" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Data da Medição
                  </Label>
                  <Input
                    id="measurementDate"
                    name="measurementDate"
                    type="date"
                    value={formData.measurementDate}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="technicianName">
                  Nome do Técnico
                </Label>
                <Input
                  id="technicianName"
                  name="technicianName"
                  placeholder="Seu nome"
                  value={formData.technicianName}
                  onChange={handleChange}
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <Button type="submit" size="lg">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
