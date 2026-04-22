import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Truck, 
  Map, 
  Droplets, 
  AlertTriangle, 
  ArrowLeft, 
  TrendingUp, 
  Calendar,
  LayoutGrid,
  Activity,
  Clock
} from "lucide-react";
import { getAllOS, OrdemServico, MOTIVO_PARADA_LABELS } from "@/lib/osStorage";
import { useNavigate } from "react-router-dom";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

interface TractorStats {
  id: string;
  hectares: number;
  totalCalda: number;
  talhoesCount: Set<string>;
  totalInterruptions: number;
  interruptionTypes: Record<string, number>;
  areas: Record<string, {
    hectares: number;
    talhoes: Set<string>;
    products: Record<string, { total: number; unit: string; packageSize: number }>;
    interruptions: { type: string; data: string; hora: string; tractor: string }[];
  }>;
  allProducts: Record<string, { total: number; unit: string; packageSize: number }>;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function Frotas() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, TractorStats>>({});
  const [loading, setLoading] = useState(true);
  const [showProductsDialog, setShowProductsDialog] = useState(false);
  const [showProductivityDialog, setShowProductivityDialog] = useState(false);
  const [showAlertsDialog, setShowAlertsDialog] = useState(false);

  useEffect(() => {
    async function loadData() {
      const allOS = await getAllOS();
      const tractorMap: Record<string, TractorStats> = {};

      allOS.forEach((os) => {
        const volumeCaldaHa = parseFloat(os.volumeCaldaHa || "0") || 0;
        const areaNome = os.propriedade || "Sem Nome";

        (os.apontamentos || []).forEach((ap) => {
          const tractorId = ap.tratorFrota || "Não Informado";
          if (!tractorMap[tractorId]) {
            tractorMap[tractorId] = {
              id: tractorId,
              hectares: 0,
              totalCalda: 0,
              talhoesCount: new Set(),
              totalInterruptions: 0,
              interruptionTypes: {},
              areas: {},
              allProducts: {}
            };
          }

          const tStats = tractorMap[tractorId];
          const areaAplicada = parseFloat(ap.areaAplicada || "0") || 0;
          const talhaoNome = os.talhoes[ap.talhaoIndex]?.nome || `T-${ap.talhaoIndex + 1}`;
          
          tStats.hectares += areaAplicada;
          tStats.totalCalda += areaAplicada * volumeCaldaHa;
          tStats.talhoesCount.add(`${os.id}-${talhaoNome}`);

          if (ap.statusRegistro === "interrompido" && ap.motivoParada) {
            tStats.totalInterruptions++;
            tStats.interruptionTypes[ap.motivoParada] = (tStats.interruptionTypes[ap.motivoParada] || 0) + 1;
          }

          // Area-specific tracking
          if (!tStats.areas[areaNome]) {
            tStats.areas[areaNome] = {
              hectares: 0,
              talhoes: new Set(),
              products: {},
              interruptions: []
            };
          }
          const aStats = tStats.areas[areaNome];
          if (ap.statusRegistro === "interrompido" && ap.motivoParada) {
            aStats.interruptions.push({
              type: ap.motivoParada,
              data: ap.dataApontamento || os.data,
              hora: ap.horaRegistro || "N/I",
              tractor: tractorId
            });
          }
          aStats.hectares += areaAplicada;
          aStats.talhoes.add(talhaoNome);

          // Product tracking
          const products = os.talhoes[ap.talhaoIndex]?.produtos || [];
          products.forEach((p) => {
            const dose = parseFloat(p.dose) || 0;
            const amount = dose * areaAplicada;
            const unit = p.unit || "L";
            const packageSize = p.packageSize || 0;

            // Global per tractor
            if (!tStats.allProducts[p.produto]) {
              tStats.allProducts[p.produto] = { total: 0, unit, packageSize };
            }
            tStats.allProducts[p.produto].total += amount;

            // Per area for tractor
            if (!aStats.products[p.produto]) {
              aStats.products[p.produto] = { total: 0, unit, packageSize };
            }
            aStats.products[p.produto].total += amount;
          });
        });
      });

      setStats(tractorMap);
      setLoading(false);
    }

    loadData();
  }, []);

  const tractorsArray = Object.values(stats).sort((a, b) => b.hectares - a.hectares);
  
  const totalHectares = tractorsArray.reduce((s, t) => s + t.hectares, 0);
  const totalCalda = tractorsArray.reduce((s, t) => s + t.totalCalda, 0);
  const totalTalhoes = tractorsArray.reduce((s, t) => s + t.talhoesCount.size, 0);
  const totalInt = tractorsArray.reduce((s, t) => s + t.totalInterruptions, 0);

  // Data for charts
  const barData = tractorsArray.map(t => ({
    name: t.id,
    ha: parseFloat(t.hectares.toFixed(2))
  })).slice(0, 10);

  const combinedIntTypes: Record<string, number> = {};
  tractorsArray.forEach(t => {
    Object.entries(t.interruptionTypes).forEach(([type, count]) => {
      const label = MOTIVO_PARADA_LABELS[type as any] || type;
      combinedIntTypes[label] = (combinedIntTypes[label] || 0) + count;
    });
  });

  const pieData = Object.entries(combinedIntTypes).map(([name, value]) => ({ name, value }));

  const globalProducts: Record<string, { total: number; unit: string; packageSize: number }> = {};
  tractorsArray.forEach(t => {
    Object.entries(t.allProducts).forEach(([prod, data]) => {
      if (!globalProducts[prod]) {
        globalProducts[prod] = { ...data };
      } else {
        globalProducts[prod].total += data.total;
      }
    });
  });

  const totalPackages = Object.values(globalProducts).reduce((s, p) => {
    return s + (p.packageSize > 0 ? p.total / p.packageSize : 0);
  }, 0);

  const totalInsumosL = Object.values(globalProducts).filter(p => p.unit === "L").reduce((s, p) => s + p.total, 0);
  const totalInsumosKG = Object.values(globalProducts).filter(p => p.unit === "KG").reduce((s, p) => s + p.total, 0);

  const globalAreas: Record<string, { hectares: number; talhoes: Set<string> }> = {};
  tractorsArray.forEach(t => {
    Object.entries(t.areas).forEach(([area, data]) => {
      if (!globalAreas[area]) {
        globalAreas[area] = { hectares: 0, talhoes: new Set() };
      }
      globalAreas[area].hectares += data.hectares;
      data.talhoes.forEach(talhao => globalAreas[area].talhoes.add(talhao));
    });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="h-8 w-8 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-heading text-foreground">Gestão de Frotas</h1>
          </div>
          <p className="text-muted-foreground text-sm">Analise detalhada do desempenho de cada equipamento no campo.</p>
        </div>
        <div className="flex items-center gap-3">
          <Card className="bg-emerald-500/10 border-emerald-500/20 px-4 py-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-bold text-emerald-600 uppercase">Período: Total Acumulado</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="bg-card/50 backdrop-blur-sm border-emerald-500/20 cursor-pointer hover:bg-emerald-500/5 transition-all group"
          onClick={() => setShowProductivityDialog(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <LayoutGrid className="h-5 w-5 text-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-500/5 px-2 py-1 rounded">Ver Detalhes</span>
            </div>
            <p className="text-3xl font-heading text-foreground">{totalHectares.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">ha</span></p>
            <p className="text-xs text-muted-foreground mt-1">Área Total Aplicada</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-blue-500/20 cursor-pointer hover:bg-blue-500/5 transition-all group"
          onClick={() => setShowProductsDialog(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Droplets className="h-5 w-5 text-blue-500" />
              </div>
              <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-500/5 px-2 py-1 rounded">Ver Detalhes</span>
            </div>
            <p className="text-3xl font-heading text-foreground">{totalPackages.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">und</span></p>
            <div className="flex gap-2 mt-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">{totalInsumosL.toFixed(0)} L</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">{totalInsumosKG.toFixed(0)} KG</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Map className="h-5 w-5 text-amber-500" />
              </div>
              <span className="text-[10px] font-bold text-amber-600 uppercase bg-amber-500/5 px-2 py-1 rounded">Cobertura</span>
            </div>
            <p className="text-3xl font-heading text-foreground">{totalTalhoes}</p>
            <p className="text-xs text-muted-foreground mt-1">Talhões Atendidos</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-card/50 backdrop-blur-sm border-red-500/20 cursor-pointer hover:bg-red-500/5 transition-all group"
          onClick={() => setShowAlertsDialog(true)}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <span className="text-[10px] font-bold text-red-600 uppercase bg-red-500/5 px-2 py-1 rounded">Ver Detalhes</span>
            </div>
            <p className="text-3xl font-heading text-foreground">{totalInt}</p>
            <p className="text-xs text-muted-foreground mt-1">Total de Interrupções</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              Ranking de Produtividade (ha)
            </CardTitle>
            <CardDescription>Top 10 equipamentos com maior área aplicada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#111", border: "none", borderRadius: "8px", color: "#fff" }}
                    itemStyle={{ color: "#10b981" }}
                  />
                  <Bar dataKey="ha" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Motivos de Interrupção
            </CardTitle>
            <CardDescription>Distribuição proporcional das paradas no campo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#111", border: "none", borderRadius: "8px", color: "#fff" }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table per Tractor */}
      <div className="space-y-6">
        <h2 className="text-xl font-heading text-foreground flex items-center gap-2">
          <Truck className="h-6 w-6 text-emerald-500" />
          Detalhamento por Equipamento
        </h2>

        {tractorsArray.map((t) => (
          <Card key={t.id} className="overflow-hidden border-emerald-500/10 hover:border-emerald-500/30 transition-all">
            <div className="bg-gradient-to-r from-emerald-500/10 to-transparent p-4 border-b border-emerald-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                  <Truck className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{t.id}</h3>
                  <div className="flex gap-4 mt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <LayoutGrid className="h-3 w-3" /> {t.talhoesCount.size} Talhões
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {Object.keys(t.areas).length} Áreas
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:flex gap-4 sm:gap-8">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Hectares</p>
                  <p className="text-xl font-heading text-emerald-600">{t.hectares.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Calda (L)</p>
                  <p className="text-xl font-heading text-blue-600">{t.totalCalda.toFixed(0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Interrupções</p>
                  <p className="text-xl font-heading text-red-600">{t.totalInterruptions}</p>
                </div>
              </div>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Areas breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <Map className="h-3.5 w-3.5" /> Áreas e Talhões Atendidos
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(t.areas).map(([areaName, aData]) => (
                      <div key={areaName} className="bg-muted/30 p-3 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-foreground">{areaName}</span>
                          <span className="text-xs font-bold text-emerald-600">{aData.hectares.toFixed(2)} ha</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(aData.talhoes).map(talhao => (
                            <span key={talhao} className="px-2 py-0.5 rounded-full bg-white text-[10px] text-muted-foreground border border-border">
                              {talhao}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5" /> Insumos Aplicados (Consolidado)
                  </h4>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-muted-foreground uppercase border-b border-border/50">
                          <th className="text-left pb-2 font-bold">Produto</th>
                          <th className="text-right pb-2 font-bold">Total (L/KG)</th>
                          <th className="text-right pb-2 font-bold">Embalagens</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {Object.entries(t.allProducts).map(([prodName, pData]) => {
                          const packages = pData.packageSize > 0 ? pData.total / pData.packageSize : 0;
                          const packageLabel = pData.unit === "KG" ? "Pac" : "Gal";
                          return (
                            <tr key={prodName} className="group hover:bg-white/40 transition-colors">
                              <td className="py-2 font-medium">{prodName}</td>
                              <td className="py-2 text-right font-bold text-primary">{pData.total.toFixed(2)} {pData.unit}</td>
                              <td className="py-2 text-right">
                                {packages > 0 ? (
                                  <span className="text-xs font-semibold text-amber-600">
                                    {packages.toFixed(2)} {packageLabel}
                                  </span>
                                ) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {t.totalInterruptions > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> Histórico de Paradas
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(t.interruptionTypes).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-2 bg-red-50 border border-red-100 px-3 py-1 rounded-full">
                            <span className="text-[10px] font-bold text-red-700">{MOTIVO_PARADA_LABELS[type as any] || type}:</span>
                            <span className="text-xs font-bold text-red-800">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {tractorsArray.length === 0 && (
          <Card className="p-12 text-center border-dashed border-2 border-border bg-muted/20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Truck className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Nenhum dado encontrado</h3>
                <p className="text-sm text-muted-foreground">Realize alguns apontamentos de OS para ver as estatísticas da frota.</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={showProductsDialog} onOpenChange={setShowProductsDialog}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              Consolidado de Insumos da Frota
            </DialogTitle>
            <DialogDescription>
              Lista completa de todos os produtos aplicados por todos os equipamentos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-[11px] text-muted-foreground uppercase">
                  <th className="text-left p-2 border-b">Produto</th>
                  <th className="text-right p-2 border-b">Total (L/KG)</th>
                  <th className="text-right p-2 border-b">Embalagens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(globalProducts).map(([name, data]) => {
                  const packs = data.packageSize > 0 ? data.total / data.packageSize : 0;
                  return (
                    <tr key={name} className="hover:bg-muted/50 transition-colors">
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right font-bold text-primary">{data.total.toFixed(2)} {data.unit}</td>
                      <td className="p-2 text-right">
                        {packs > 0 ? (
                          <span className="text-xs font-semibold text-amber-600">
                            {packs.toFixed(2)} {data.unit === "KG" ? "Pac" : "Gal"}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowProductsDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showProductivityDialog} onOpenChange={setShowProductivityDialog}>
        <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Map className="h-5 w-5 text-emerald-500" />
              Cobertura Geográfica da Frota
            </DialogTitle>
            <DialogDescription>
              Resumo de todas as áreas e talhões atendidos pela operação.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {Object.entries(globalAreas).map(([area, data]) => (
              <div key={area} className="bg-muted/30 p-4 rounded-lg border border-border">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-base font-bold text-foreground">{area}</span>
                  <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{data.hectares.toFixed(2)} ha</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(data.talhoes).sort().map(talhao => (
                    <span key={talhao} className="px-3 py-1 rounded-full bg-white text-[11px] font-medium text-muted-foreground border border-border shadow-sm">
                      Talhão {talhao}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            
            {Object.keys(globalAreas).length === 0 && (
              <p className="text-center py-8 text-muted-foreground italic">Nenhuma área registrada.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowProductivityDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAlertsDialog} onOpenChange={setShowAlertsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Linha do Tempo de Interrupções por Área
            </DialogTitle>
            <DialogDescription>
              Registros detalhados de data, hora e motivo de cada parada.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {(() => {
              const globalAreaEvents: Record<string, { type: string; data: string; hora: string; tractor: string }[]> = {};
              tractorsArray.forEach(t => {
                Object.entries(t.areas).forEach(([area, data]) => {
                  if (data.interruptions.length > 0) {
                    if (!globalAreaEvents[area]) globalAreaEvents[area] = [];
                    globalAreaEvents[area].push(...data.interruptions);
                  }
                });
              });

              const areaEntries = Object.entries(globalAreaEvents);
              if (areaEntries.length === 0) {
                return <p className="text-center py-8 text-muted-foreground italic text-sm">Nenhuma interrupção registrada.</p>;
              }

              return areaEntries.map(([area, events]) => (
                <div key={area} className="bg-muted/30 p-4 rounded-lg border border-border">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-base font-bold text-foreground">{area}</span>
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                      {events.length} Ocorrências
                    </span>
                  </div>
                  <div className="space-y-2">
                    {events.sort((a, b) => {
                      const dateA = new Date(`${a.data} ${a.hora === "N/I" ? "00:00" : a.hora}`);
                      const dateB = new Date(`${b.data} ${b.hora === "N/I" ? "00:00" : b.hora}`);
                      return dateB.getTime() - dateA.getTime();
                    }).map((ev, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded border border-border shadow-sm gap-2 group hover:border-red-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                            <Clock className="h-4 w-4 text-red-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-red-900">{MOTIVO_PARADA_LABELS[ev.type as any] || ev.type}</p>
                            <p className="text-[10px] text-muted-foreground">{ev.data} às {ev.hora} • {area}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            {ev.tractor}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowAlertsDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
