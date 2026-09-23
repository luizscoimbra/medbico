import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMeasurement } from "@/context/MeasurementContext";
import { ArrowRight, ArrowLeft, Tractor, Settings, Calendar, Hash, Search, Plane, Droplets, CircleDot, Calculator, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { getAllEquipments, Equipment as EquipmentOption } from "@/lib/equipmentStorage";
import { getAllDrones, Drone } from "@/lib/droneStorage";

// ============================================
// FORMULAS
// ============================================

function calcVazaoLiquidos(V: number, W: number, v: number): number {
  return (V * W * v) / 600;
}

function calcVazaoSolidos(D: number, W: number, v: number): number {
  return (D * W * v) / 600;
}

// ============================================
// COMPONENT: TIPO SELECTION
// ============================================

function TipoSelection({ onSelect }: { onSelect: (tipo: "drone" | "solo") => void }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-heading text-foreground mb-2">Nova Medição</h1>
        <p className="text-muted-foreground">Selecione o tipo de equipamento para medição.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => onSelect("drone")}
          className="group p-8 rounded-xl border-2 border-dashed border-border hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left"
        >
          <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
            <Plane className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Drone Agrícola</h3>
          <p className="text-sm text-muted-foreground">
            Medição e calibração de vazão para drones de pulverização e distribuição de sólidos.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-blue-500 font-medium">
            Selecionar
            <ArrowRight className="h-4 w-4" />
          </div>
        </button>

        <button
          onClick={() => onSelect("solo")}
          className="group p-8 rounded-xl border-2 border-dashed border-border hover:border-emerald-500 hover:bg-emerald-500/5 transition-all text-left"
        >
          <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
            <Tractor className="h-7 w-7 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Equipamentos de Solo</h3>
          <p className="text-sm text-muted-foreground">
            Medição de vazão para tratores, pulverizadores autopropelidos e traílados.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-emerald-500 font-medium">
            Selecionar
            <ArrowRight className="h-4 w-4" />
          </div>
        </button>
      </div>
    </div>
  );
}

// ============================================
// COMPONENT: MEDICAO SOLO (existing form)
// ============================================

function MedicaoSolo() {
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

  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [fleetSearch, setFleetSearch] = useState("");
  const [showFleetSuggestions, setShowFleetSuggestions] = useState(false);
  const [filteredEquipments, setFilteredEquipments] = useState<EquipmentOption[]>([]);
  const fleetInputRef = useRef<HTMLInputElement>(null);
  const fleetSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEquipments = async () => {
      const data = await getAllEquipments();
      setEquipments(data);
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
      totalNozzles,
      workingPressure: parseFloat(formData.workingPressure) || 3,
      measurementDate: new Date(formData.measurementDate),
      technicianName: formData.technicianName,
      readings: [],
    });
    toast.success("Informações salvas! Vamos para a entrada de dados.");
    navigate("/entrada-dados");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="px-2 py-1 rounded bg-primary/10 text-primary font-medium">Etapa 1 de 3</span>
          <span>Informações do Equipamento</span>
        </div>
        <h1 className="text-3xl font-heading text-foreground mb-2">Medição — Equipamento de Solo</h1>
        <p className="text-muted-foreground">Preencha as informações do equipamento para iniciar a avaliação.</p>
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
                <Label htmlFor="totalNozzles">Quantidade de Bicos *</Label>
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
                <Label htmlFor="workingPressure">Pressão de Trabalho (bar)</Label>
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
                <p className="text-xs text-muted-foreground">Padrão: 3 bar</p>
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
              <Label htmlFor="technicianName">Nome do Técnico</Label>
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
  );
}

// ============================================
// COMPONENT: MEDICAO DRONE
// ============================================

function MedicaoDrone() {
  const navigate = useNavigate();
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selectedDroneId, setSelectedDroneId] = useState("");
  const [tipoMedicao, setTipoMedicao] = useState<"liquidos" | "solidos">("liquidos");
  const [metodoMedicao, setMetodoMedicao] = useState<"direto" | "sensores">("direto");

  // Form fields
  const [taxaAplicacao, setTaxaAplicacao] = useState("");
  const [faixaUtil, setFaixaUtil] = useState("");
  const [velocidadeVoo, setVelocidadeVoo] = useState("");
  const [quantidadeBicos, setQuantidadeBicos] = useState("");
  const [dataMedicao, setDataMedicao] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");

  // Solid-specific
  const [percentualComporta, setPercentualComporta] = useState("50");
  const [pesoEspecifico, setPesoEspecifico] = useState("");
  const [tempoEnsaio, setTempoEnsaio] = useState("60");
  const [massaColetada, setMassaColetada] = useState("");

  // Liquid-specific
  const [volumeColetado, setVolumeColetado] = useState("");
  const [tempoColeta, setTempoColeta] = useState("60");

  useEffect(() => {
    getAllDrones().then(setDrones).catch(() => {});
  }, []);

  const selectedDrone = drones.find(d => d.id === selectedDroneId);

  const vazaoCalculada = useMemo(() => {
    const V = parseFloat(taxaAplicacao) || 0;
    const W = parseFloat(faixaUtil) || 0;
    const v = parseFloat(velocidadeVoo) || 0;
    if (V <= 0 || W <= 0 || v <= 0) return 0;
    return tipoMedicao === "liquidos"
      ? calcVazaoLiquidos(V, W, v)
      : calcVazaoSolidos(V, W, v);
  }, [taxaAplicacao, faixaUtil, velocidadeVoo, tipoMedicao]);

  const vazaoPorBico = useMemo(() => {
    const bicos = parseInt(quantidadeBicos) || 1;
    return vazaoCalculada / bicos;
  }, [vazaoCalculada, quantidadeBicos]);

  const vazaoRealMedida = useMemo(() => {
    if (tipoMedicao === "liquidos") {
      const vol = parseFloat(volumeColetado) || 0;
      const tempo = parseFloat(tempoColeta) || 60;
      if (tempo <= 0) return 0;
      return vol / (tempo / 60);
    } else {
      const massa = parseFloat(massaColetada) || 0;
      const tempo = parseFloat(tempoEnsaio) || 60;
      if (tempo <= 0) return 0;
      return massa / (tempo / 60);
    }
  }, [volumeColetado, tempoColeta, massaColetada, tempoEnsaio, tipoMedicao]);

  const desvioPercentual = useMemo(() => {
    if (vazaoCalculada <= 0 || vazaoRealMedida <= 0) return 0;
    return Math.abs((vazaoRealMedida - vazaoCalculada) / vazaoCalculada) * 100;
  }, [vazaoCalculada, vazaoRealMedida]);

  const handleSave = () => {
    if (!selectedDroneId) {
      toast.error("Selecione um drone");
      return;
    }
    if (!taxaAplicacao || !faixaUtil || !velocidadeVoo) {
      toast.error("Preencha todos os campos de cálculo");
      return;
    }
    toast.success("Medição salva com sucesso!");
  };

  const unidade = tipoMedicao === "liquidos" ? "L/min" : "kg/min";
  const unidadeTaxa = tipoMedicao === "liquidos" ? "L/ha" : "kg/ha";

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-heading text-foreground mb-2">Medição — Drone Agrícola</h1>
          <p className="text-muted-foreground">
            Calibração de vazão para pulverização líquida ou distribuição de sólidos.
          </p>
        </div>
      </div>

      {/* Seleção do Drone */}
      <Card className="shadow-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plane className="h-5 w-5 text-blue-500" />
            Drone
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Drone *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={selectedDroneId}
                onChange={(e) => setSelectedDroneId(e.target.value)}
              >
                <option value="">Selecione o drone...</option>
                {drones.filter(d => d.status === "ativo").map(d => (
                  <option key={d.id} value={d.id}>{d.marca} {d.modelo} — {d.numero_serie}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Data da Medição</Label>
              <Input type="date" value={dataMedicao} onChange={(e) => setDataMedicao(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tipo de Medição */}
      <Card className="shadow-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            Tipo de Medição
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setTipoMedicao("liquidos")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                tipoMedicao === "liquidos"
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-border hover:border-blue-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <Droplets className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="font-semibold">Líquidos</p>
                  <p className="text-xs text-muted-foreground">Pulverização com líquidos (L/ha)</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setTipoMedicao("solidos")}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                tipoMedicao === "solidos"
                  ? "border-amber-500 bg-amber-500/5"
                  : "border-border hover:border-amber-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <CircleDot className="h-6 w-6 text-amber-500" />
                <div>
                  <p className="font-semibold">Sólidos</p>
                  <p className="text-xs text-muted-foreground">Grânulos, adubos, sementes (kg/ha)</p>
                </div>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <Label>Método de Medição</Label>
            <div className="flex gap-3">
              <button
                onClick={() => setMetodoMedicao("direto")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  metodoMedicao === "direto"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {tipoMedicao === "liquidos" ? "Volumétrico (Provetas)" : "Ensaio de Bancada"}
              </button>
              <button
                onClick={() => setMetodoMedicao("sensores")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  metodoMedicao === "sensores"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                Sensores / Fluxômetros
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parâmetros de Cálculo */}
      <Card className="shadow-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-500" />
            Parâmetros de Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Taxa de Aplicação Desejada ({unidadeTaxa}) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder={tipoMedicao === "liquidos" ? "Ex: 10" : "Ex: 30"}
                value={taxaAplicacao}
                onChange={(e) => setTaxaAplicacao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Faixa Útil de Trabalho (m) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="Ex: 6"
                value={faixaUtil}
                onChange={(e) => setFaixaUtil(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Largura efetiva, não envergadura</p>
            </div>
            <div className="space-y-2">
              <Label>Velocidade de Voo (km/h) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                placeholder="Ex: 20"
                value={velocidadeVoo}
                onChange={(e) => setVelocidadeVoo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Quantidade de Bicos / Discos</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ex: 4"
                value={quantidadeBicos}
                onChange={(e) => setQuantidadeBicos(e.target.value)}
              />
            </div>
            {tipoMedicao === "solidos" && (
              <>
                <div className="space-y-2">
                  <Label>Percentual de Comporta (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Ex: 50"
                    value={percentualComporta}
                    onChange={(e) => setPercentualComporta(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peso Específico (kg/m³)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="Ex: 750"
                    value={pesoEspecifico}
                    onChange={(e) => setPesoEspecifico(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Resultado do Cálculo */}
          {vazaoCalculada > 0 && (
            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-500" />
                Resultado do Cálculo
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Vazão Total</p>
                  <p className="text-lg font-mono font-bold text-blue-600">{vazaoCalculada.toFixed(2)} {unidade}</p>
                </div>
                {parseInt(quantidadeBicos) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Vazão por Bico</p>
                    <p className="text-lg font-mono font-bold text-blue-600">{vazaoPorBico.toFixed(3)} {unidade}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Fórmula</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    Q = ({taxaAplicacao} × {faixaUtil} × {velocidadeVoo}) / 600
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medida Real */}
      <Card className="shadow-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {metodoMedicao === "direto"
              ? tipoMedicao === "liquidos"
                ? "Medida Real (Volumétrico)"
                : "Medida Real (Ensaio de Bancada)"
              : "Leitura dos Sensores"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {metodoMedicao === "direto" ? (
            <div className="space-y-4">
              {tipoMedicao === "liquidos" ? (
                <>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    Com o drone estático no solo, ligue o sistema na pressão de trabalho e colete o líquido de cada bico em proveta graduada por {tempoColeta} segundos.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Volume Total Coletado (mL)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 500"
                        value={volumeColetado}
                        onChange={(e) => setVolumeColetado(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tempo de Coleta (s)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="60"
                        value={tempoColeta}
                        onChange={(e) => setTempoColeta(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    Posicione o drone sobre lona/bancada com a comporta aberta a {percentualComporta}% por {tempoEnsaio} segundos. Pese a massa expelida.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Massa Coletada (g)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Ex: 250"
                        value={massaColetada}
                        onChange={(e) => setMassaColetada(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tempo de Ensaio (s)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="60"
                        value={tempoEnsaio}
                        onChange={(e) => setTempoEnsaio(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {vazaoRealMedida > 0 && vazaoCalculada > 0 && (
                <div className={`p-4 rounded-lg border ${desvioPercentual <= 10 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    {desvioPercentual <= 10 ? (
                      <><CheckCircle className="h-4 w-4 text-emerald-500" /> Vazão dentro da tolerância</>
                    ) : (
                      <><AlertTriangle className="h-4 w-4 text-red-500" /> Vazão fora da tolerância</>
                    )}
                  </h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Vazão Calculada</p>
                      <p className="font-mono font-bold">{vazaoCalculada.toFixed(2)} {unidade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vazão Real Medida</p>
                      <p className="font-mono font-bold">{vazaoRealMedida.toFixed(2)} {unidade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Desvio</p>
                      <p className={`font-mono font-bold ${desvioPercentual <= 10 ? "text-emerald-600" : "text-red-600"}`}>
                        {desvioPercentual.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {desvioPercentual > 10 && (
                    <p className="mt-2 text-xs text-red-600">
                      Desvio superior a 10%. Substitua ou limpe os bicos. Meça a saída individual de cada bico.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                Verifique a leitura dos fluxômetros integrados no drone. A vazão medida deve estar próxima ao valor calculado.
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vazão Lida no Painel ({unidade})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Leitura do sensor"
                    value={vazaoRealMedida > 0 ? vazaoRealMedida.toString() : ""}
                    onChange={(e) => setVolumeColetado(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Boas Práticas */}
      <Card className="shadow-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Regras Práticas e Boas Práticas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <p><strong>Água limpa primeiro:</strong> Faça a medição inicial com água limpa. Se a calda for viscosa, refaça com a calda pronta.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <p><strong>Homogeneidade dos bicos:</strong> Meça cada bico individualmente. Desvio &gt;10% = substituir ou limpar o bico.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <p><strong>Densidade dos sólidos:</strong> Calibre sempre que mudar o lote do produto. Mesma categoria pode ter densidade diferente.</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
            <p><strong>Faixa útil (W):</strong> Não é a envergadura do drone. Faça testes de deposição em solo com copos amostradores.</p>
          </div>
        </CardContent>
      </Card>

      {/* Observações */}
      <Card className="shadow-lg">
        <CardContent className="p-6">
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Condições do dia, produto utilizado, observações adicionais..."
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/")}>
          Cancelar
        </Button>
        <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
          Salvar Medição
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function NovaMedicao() {
  const [tipoEquipamento, setTipoEquipamento] = useState<"drone" | "solo" | null>(null);

  if (!tipoEquipamento) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <TipoSelection onSelect={setTipoEquipamento} />
        </div>
      </div>
    );
  }

  if (tipoEquipamento === "drone") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTipoEquipamento(null)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <MedicaoDrone />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTipoEquipamento(null)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <MedicaoSolo />
      </div>
    </div>
  );
}
