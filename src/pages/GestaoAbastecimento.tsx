import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { RelatorioAbastecimento } from "@/components/abastecimento/RelatorioAbastecimento";
import {
  AlertTriangle,
  ArrowLeft,
  Droplet,
  FileDown,
  FileText,
  Fuel,
  History,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { digitosParaMoeda, formatBRL, moedaParaCentavos } from "@/lib/utils";
import { getAllEquipments, saveEquipment, type Equipment } from "@/lib/equipmentStorage";
import { getAllOS, type OrdemServico } from "@/lib/osStorage";
import {
  TIPOS_COMBUSTIVEL,
  calcularConsumoPeriodo,
  calcularHistorico,
  createAbastecimento,
  deleteAbastecimento,
  getAllAbastecimentos,
  previewLancamento,
  updateAbastecimento,
  ultimoAbastecimento,
  type Abastecimento,
} from "@/lib/equipmentFuelStorage";

const SEM_EQUIPAMENTO = "__sem";
const TODOS = "__todos";
const SEM_OS = "__none";

const HOJE = () => new Date().toISOString().slice(0, 10);

const inicioPadrao = () => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

const dataBR = (iso: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "";

interface FormAbast {
  id?: string;
  equipment_id: string;
  data: string;
  horimetro: string;
  litros: string;
  tipo: string;
  valor: string;
  posto: string;
  observacao: string;
  os_id: string;
}

const formVazio = (equipments: Equipment[]): FormAbast => ({
  equipment_id: equipments[0]?.id || SEM_EQUIPAMENTO,
  data: HOJE(),
  horimetro:
    equipments[0]?.horas_acumuladas != null ? String(equipments[0].horas_acumuladas) : "",
  litros: "",
  tipo: TIPOS_COMBUSTIVEL[0],
  valor: "",
  posto: "",
  observacao: "",
  os_id: SEM_OS,
});

export default function GestaoAbastecimento() {
  const navigate = useNavigate();

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [ordensServico, setOrdensServico] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);

  const [inicio, setInicio] = useState(inicioPadrao());
  const [fim, setFim] = useState(HOJE());
  const [filtroEquip, setFiltroEquip] = useState(TODOS);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormAbast>(formVazio([]));
  const [salvando, setSalvando] = useState(false);

  const [excluindo, setExcluindo] = useState<Abastecimento | null>(null);
  const [processando, setProcessando] = useState(false);

  // Relatório de abastecimento (impressão / PDF)
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [relDe, setRelDe] = useState(inicioPadrao());
  const [relAte, setRelAte] = useState(HOJE());
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const relatorioRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const [eqs, abas, oss] = await Promise.all([
        getAllEquipments().catch(() => [] as Equipment[]),
        getAllAbastecimentos().catch(() => [] as Abastecimento[]),
        getAllOS().catch(() => [] as OrdemServico[]),
      ]);
      setEquipments(
        [...eqs].sort((a, b) => (a.fleet_number || "").localeCompare(b.fleet_number || ""))
      );
      setAbastecimentos(abas);
      setOrdensServico(oss);
    } catch {
      toast.error("Erro ao carregar os dados de abastecimento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const eqPorId = useMemo(
    () => new Map(equipments.map((e) => [e.id, e])),
    [equipments]
  );

  const abastFiltrados = useMemo(
    () =>
      filtroEquip === TODOS ? abastecimentos : abastecimentos.filter((a) => a.equipment_id === filtroEquip),
    [abastecimentos, filtroEquip]
  );

  // Histórico completo calculado (baseline vem de fora do período também)
  const historico = useMemo(() => calcularHistorico(abastFiltrados), [abastFiltrados]);

  const historicoPeriodo = useMemo(
    () => historico.filter((h) => h.data >= inicio && h.data <= fim),
    [historico, inicio, fim]
  );

  const consumo = useMemo(
    () => calcularConsumoPeriodo(abastFiltrados, inicio, fim, equipments),
    [abastFiltrados, inicio, fim, equipments]
  );

  const ultimo = useMemo(() => ultimoAbastecimento(abastFiltrados), [abastFiltrados]);

  // Relatório: base completa (independente do filtro da tela)
  const historicoCompleto = useMemo(() => calcularHistorico(abastecimentos), [abastecimentos]);

  const historicoRelatorio = useMemo(
    () =>
      historicoCompleto.filter(
        (h) =>
          selecionados.includes(h.equipment_id) && h.data >= relDe && h.data <= relAte
      ),
    [historicoCompleto, selecionados, relDe, relAte]
  );

  // Prévia instantânea do lançamento
  const preview = useMemo(() => {
    const horimetro = parseFloat(form.horimetro);
    const litros = parseFloat(form.litros);
    if (!form.equipment_id || form.equipment_id === SEM_EQUIPAMENTO || !Number.isFinite(horimetro)) {
      return { baseline: null, horasDesdeUltimo: null as number | null, consumoLph: null as number | null, erroHorimetro: false };
    }
    return previewLancamento({
      abastecimentos,
      equipmentId: form.equipment_id,
      data: form.data,
      horimetro,
      litros: Number.isFinite(litros) ? litros : 0,
      excluirId: form.id,
    });
  }, [abastecimentos, form]);

  // OS ordenadas: as que incluem a frota do equipamento vêm primeiro
  const ossOrdenadas = useMemo(() => {
    const frota = eqPorId.get(form.equipment_id)?.fleet_number;
    return [...ordensServico].sort((a, b) => {
      const am = frota && !(a.equipamentos || []).includes(frota) ? 1 : 0;
      const bm = frota && !(b.equipamentos || []).includes(frota) ? 1 : 0;
      if (am !== bm) return am - bm;
      return b.id.localeCompare(a.id);
    });
  }, [ordensServico, form.equipment_id, eqPorId]);

  const abrirNovo = () => {
    if (equipments.length === 0) {
      toast.error("Cadastre um equipamento antes de registrar abastecimentos");
      return;
    }
    setForm(formVazio(equipments));
    setDialogOpen(true);
  };

  const abrirEditar = (a: Abastecimento) => {
    setForm({
      id: a.id,
      equipment_id: a.equipment_id,
      data: a.data,
      horimetro: String(a.horimetro),
      litros: String(a.litros),
      tipo: a.tipo_combustivel || TIPOS_COMBUSTIVEL[0],
      valor: a.valor_total ? digitosParaMoeda(String(Math.round(a.valor_total * 100))) : "",
      posto: a.posto_fornecedor || "",
      observacao: a.observacao || "",
      os_id: a.os_id || SEM_OS,
    });
    setDialogOpen(true);
  };

  const salvar = async () => {
    const eq = eqPorId.get(form.equipment_id);
    if (!eq) {
      toast.error("Selecione o equipamento");
      return;
    }
    const horimetro = parseFloat(form.horimetro);
    if (!Number.isFinite(horimetro) || horimetro < 0) {
      toast.error("Informe o horímetro atual");
      return;
    }
    const litros = parseFloat(form.litros);
    if (!Number.isFinite(litros) || litros <= 0) {
      toast.error("Informe os litros abastecidos (maior que zero)");
      return;
    }
    if (preview.erroHorimetro) {
      toast.error("O horímetro informado não é maior que o do último abastecimento");
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        equipment_id: eq.id,
        fleet_number: eq.fleet_number,
        data: form.data,
        horimetro,
        litros,
        tipo_combustivel: form.tipo,
        valor_total: moedaParaCentavos(form.valor) / 100,
        posto_fornecedor: form.posto.trim(),
        observacao: form.observacao.trim(),
        os_id: form.os_id === SEM_OS ? null : form.os_id,
      };

      if (form.id) {
        await updateAbastecimento(form.id, payload);
        toast.success("Abastecimento atualizado!");
      } else {
        await createAbastecimento(payload);
        toast.success("Abastecimento registrado!");
      }

      // Horímetro: só avança (nunca regride)
      if (horimetro > (eq.horas_acumuladas || 0)) {
        await saveEquipment({
          ...eq,
          horas_acumuladas: horimetro,
          data_ultima_leitura: form.data,
        });
      }

      setDialogOpen(false);
      await load();
    } catch {
      toast.error("Erro ao salvar o abastecimento");
    } finally {
      setSalvando(false);
    }
  };

  const excluirConfirmado = async () => {
    if (!excluindo || processando) return;
    setProcessando(true);
    try {
      await deleteAbastecimento(excluindo.id);
      toast.success("Abastecimento excluído");
      setExcluindo(null);
      await load();
    } catch {
      toast.error("Erro ao excluir o abastecimento");
    } finally {
      setProcessando(false);
    }
  };

  // ── Relatório ─────────────────────────────────────────────────────
  const abrirRelatorio = () => {
    setRelDe(inicio);
    setRelAte(fim);
    setSelecionados(
      filtroEquip === TODOS ? equipments.map((e) => e.id) : [filtroEquip]
    );
    setRelatorioAberto(true);
  };

  const toggleSelecionado = (id: string) =>
    setSelecionados((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const selecionarTodos = () => setSelecionados(equipments.map((e) => e.id));
  const limparSelecao = () => setSelecionados([]);

  const handlePrintRelatorio = () => window.print();

  const handlePDFRelatorio = async () => {
    const target = relatorioRef.current;
    if (!target) return;
    try {
      toast.info("Gerando PDF do relatório...");
      const canvas = await html2canvas(target, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      const pageH = pdf.internal.pageSize.getHeight();

      if (pdfH <= pageH) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      } else {
        let position = 0;
        let remaining = pdfH;
        while (remaining > 0) {
          if (position > 0) pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, -position, pdfW, pdfH);
          position += pageH;
          remaining -= pageH;
        }
      }

      pdf.save(`Relatorio-Abastecimento-${relDe}_a_${relAte}.pdf`);
      toast.success("PDF salvo!");
    } catch {
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-foreground">Gestão de Abastecimento</h1>
            <p className="text-sm text-muted-foreground">
              Abastecimentos por equipamento, horímetro e consumo de combustível
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={abrirRelatorio}>
            <FileText className="h-4 w-4 mr-2" /> Relatório
          </Button>
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4 mr-2" /> Novo abastecimento
          </Button>
        </div>
      </div>

      {/* Filtro de período + equipamento */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="periodo-inicio" className="text-xs text-muted-foreground whitespace-nowrap">
            De
          </Label>
          <Input
            id="periodo-inicio"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="w-40"
          />
          <Label htmlFor="periodo-fim" className="text-xs text-muted-foreground whitespace-nowrap">
            Até
          </Label>
          <Input
            id="periodo-fim"
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="w-40"
          />
        </div>
        <Select value={filtroEquip} onValueChange={setFiltroEquip}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os equipamentos</SelectItem>
            {equipments.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.fleet_number}  {e.equipment_model || "Equipamento"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs do período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-t-4 border-t-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Droplet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Litros no período</p>
                <p className="text-xl font-heading font-bold">
                  {consumo.totais.litros.toLocaleString("pt-BR")} L
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Timer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Horas trabalhadas no período</p>
                <p className="text-xl font-heading font-bold">{consumo.totais.horas} h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Média de gasto no período</p>
                <p className="text-xl font-heading font-bold">
                  {consumo.totais.mediaLph != null ? `${consumo.totais.mediaLph} L/h` : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                <History className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último abastecimento</p>
                <p className="text-xl font-heading font-bold">
                  {ultimo ? dataBR(ultimo.data) : ""}
                </p>
                {ultimo && (
                  <p className="text-[11px] text-muted-foreground">
                    {ultimo.fleet_number} · {ultimo.litros} L
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consumo por equipamento no período */}
      <Card className="shadow-sm border-border/50 mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Fuel className="h-4 w-4 text-primary" /> Consumo por equipamento
          </CardTitle>
          <CardDescription>
            Litros gastos e média por hora de cada equipamento no período informado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground italic">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando consumo...
            </div>
          ) : consumo.equipamentos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground italic">
              Nenhum abastecimento no período informado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Frota</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead className="text-center">Registros</TableHead>
                    <TableHead className="text-right">Litros gastos</TableHead>
                    <TableHead className="text-right">Horas trabalhadas</TableHead>
                    <TableHead className="text-right">Média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumo.equipamentos.map((c) => (
                    <TableRow key={c.equipment_id}>
                      <TableCell className="font-medium">{c.fleet_number}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.modelo}</TableCell>
                      <TableCell className="text-center">{c.qtd}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {c.litros.toLocaleString("pt-BR")} L
                      </TableCell>
                      <TableCell className="text-right">{c.horas} h</TableCell>
                      <TableCell className="text-right">
                        {c.mediaLph != null ? (
                          <Badge variant="secondary" className="text-[11px]">
                            {c.mediaLph} L/h
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground"></span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-semibold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">
                      {consumo.totais.litros.toLocaleString("pt-BR")} L
                    </TableCell>
                    <TableCell className="text-right">{consumo.totais.horas} h</TableCell>
                    <TableCell className="text-right">
                      {consumo.totais.mediaLph != null ? `${consumo.totais.mediaLph} L/h` : ""}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de abastecimentos */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico de abastecimentos
          </CardTitle>
          <CardDescription>
            {dataBR(inicio)} a {dataBR(fim)} · horas e consumo calculados desde o abastecimento
            anterior de cada equipamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground italic">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando histórico...
            </div>
          ) : historicoPeriodo.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground italic">
              Nenhum abastecimento no período informado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Frota</TableHead>
                    <TableHead className="text-right">Horímetro</TableHead>
                    <TableHead className="text-right">Litros</TableHead>
                    <TableHead className="text-right">Horas desde o último</TableHead>
                    <TableHead className="text-right">Gasto por hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Posto</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicoPeriodo.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap">{dataBR(h.data)}</TableCell>
                      <TableCell className="font-medium">{h.fleet_number}</TableCell>
                      <TableCell className="text-right">{h.horimetro} h</TableCell>
                      <TableCell className="text-right font-semibold">
                        {h.litros.toLocaleString("pt-BR")} L
                      </TableCell>
                      <TableCell className="text-right">
                        {h.horasDesdeUltimo != null ? `${h.horasDesdeUltimo} h` : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {h.consumoLph != null ? (
                          <Badge variant="secondary" className="text-[11px]">
                            {h.consumoLph} L/h
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">primeiro registro</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{h.tipo_combustivel || ""}</TableCell>
                      <TableCell className="text-right text-sm">
                        {h.valor_total > 0 ? formatBRL(h.valor_total) : ""}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {h.posto_fornecedor || ""}
                      </TableCell>
                      <TableCell>
                        {h.os_id ? (
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {h.os_id}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground"></span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => abrirEditar(h)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setExcluindo(h)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo/Editar abastecimento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar abastecimento" : "Novo abastecimento"}</DialogTitle>
            <DialogDescription>
              Informe o horímetro atual e os litros — o consumo por hora é calculado na hora.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Equipamento</Label>
              <Select
                value={form.equipment_id}
                onValueChange={(v) => {
                  const eq = eqPorId.get(v);
                  setForm((p) => ({
                    ...p,
                    equipment_id: v,
                    horimetro:
                      p.id || eq?.horas_acumuladas == null
                        ? p.horimetro
                        : String(eq.horas_acumuladas),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o equipamento" />
                </SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fleet_number}  {e.equipment_model || "Equipamento"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ordem de Serviço — opcional</Label>
              <Select
                value={form.os_id}
                onValueChange={(v) => setForm((p) => ({ ...p, os_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem OS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_OS}>Sem OS</SelectItem>
                  {ossOrdenadas.map((os) => (
                    <SelectItem key={os.id} value={os.id}>
                      OS {os.id}  {os.propriedade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.os_id !== SEM_OS && (
                <p className="text-[11px] text-muted-foreground">
                  O valor total deste abastecimento será somado ao custo da OS{" "}
                  {form.os_id}.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="aba-data">Data</Label>
                <Input
                  id="aba-data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aba-horimetro">Horímetro atual (h)</Label>
                <Input
                  id="aba-horimetro"
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="Ex.: 1250,5"
                  value={form.horimetro}
                  onChange={(e) => setForm((p) => ({ ...p, horimetro: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="aba-litros">Litros abastecidos</Label>
                <Input
                  id="aba-litros"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ex.: 120"
                  value={form.litros}
                  onChange={(e) => setForm((p) => ({ ...p, litros: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aba-tipo">Tipo de combustível</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) => setForm((p) => ({ ...p, tipo: v }))}
                >
                  <SelectTrigger id="aba-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_COMBUSTIVEL.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="aba-valor">Valor total (R$)  opcional</Label>
                <Input
                  id="aba-valor"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={form.valor}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, valor: digitosParaMoeda(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aba-posto">Posto / fornecedor  opcional</Label>
                <Input
                  id="aba-posto"
                  placeholder="Ex.: Posto Central"
                  value={form.posto}
                  onChange={(e) => setForm((p) => ({ ...p, posto: e.target.value }))}
                />
              </div>
            </div>

            {/* Prévia instantânea */}
            <div
              className={`rounded-xl border p-3 text-sm ${
                preview.erroHorimetro
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-primary/30 bg-primary/5"
              }`}
            >
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Relatório do abastecimento
              </p>
              {preview.erroHorimetro ? (
                <p className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Horímetro menor ou igual ao do
                  último abastecimento ({preview.baseline?.horimetro} h em{" "}
                  {preview.baseline ? dataBR(preview.baseline.data) : ""}).
                </p>
              ) : preview.horasDesdeUltimo != null ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Horas trabalhadas</p>
                    <p className="font-semibold">{preview.horasDesdeUltimo} h</p>
                    <p className="text-[10px] text-muted-foreground">
                      desde {preview.baseline ? dataBR(preview.baseline.data) : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Litros</p>
                    <p className="font-semibold">
                      {Number.isFinite(parseFloat(form.litros))
                        ? `${parseFloat(form.litros)} L`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Gasto por hora</p>
                    <p className="font-semibold text-primary">
                      {preview.consumoLph != null ? `${preview.consumoLph} L/h` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Primeiro registro do equipamento — informe o horímetro e os litros para ver o
                  consumo por hora nos próximos lançamentos.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="aba-obs">Observação — opcional</Label>
              <Textarea
                id="aba-obs"
                rows={2}
                placeholder="Ex.: abastecimento no posto da unidade..."
                value={form.observacao}
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {form.id ? "Salvar alterações" : "Registrar abastecimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Relatório de abastecimento (impressão / PDF) */}
      <Dialog
        open={relatorioAberto}
        onOpenChange={(open) => {
          if (!open) setRelatorioAberto(false);
        }}
      >
        <DialogContent className="relatorio-dialog sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Relatório de Abastecimento
            </DialogTitle>
            <DialogDescription>
              Selecione os equipamentos e o período para gerar o relatório de consumo.
            </DialogDescription>
          </DialogHeader>

          <div className="no-print space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rel-de">De</Label>
                <Input
                  id="rel-de"
                  type="date"
                  value={relDe}
                  onChange={(e) => setRelDe(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rel-ate">Até</Label>
                <Input
                  id="rel-ate"
                  type="date"
                  value={relAte}
                  onChange={(e) => setRelAte(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">
                Equipamentos ({selecionados.length}/{equipments.length})
              </Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selecionarTodos}>
                  Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={limparSelecao}>
                  Limpar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-border/60 p-2">
              {equipments.map((e) => (
                <div
                  key={e.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSelecionado(e.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") toggleSelecionado(e.id);
                  }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                >
                  <Checkbox checked={selecionados.includes(e.id)} className="pointer-events-none" />
                  <span className="truncate">
                    {e.fleet_number}  {e.equipment_model || "Equipamento"}
                  </span>
                </div>
              ))}
              {equipments.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-2 py-1">
                  Nenhum equipamento cadastrado.
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {historicoRelatorio.length} abastecimento(s) no relatório · {relDe ? new Date(`${relDe}T00:00:00`).toLocaleDateString("pt-BR") : "—"} a{" "}
              {relAte ? new Date(`${relAte}T00:00:00`).toLocaleDateString("pt-BR") : ""}
            </p>
          </div>

          <div className="relatorio-preview rounded-lg border border-border/60 bg-card p-2 overflow-x-auto">
            <RelatorioAbastecimento
              ref={relatorioRef}
              abastecimentos={historicoRelatorio}
              equipamentos={equipments}
              selecionados={selecionados}
              filtros={{ de: relDe, ate: relAte }}
            />
          </div>

          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setRelatorioAberto(false)}>
              Fechar
            </Button>
            <Button
              variant="outline"
              onClick={handlePDFRelatorio}
              disabled={selecionados.length === 0}
            >
              <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
            </Button>
            <Button onClick={handlePrintRelatorio} disabled={selecionados.length === 0}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir abastecimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O registro de {excluindo ? dataBR(excluindo.data) : ""} da frota{" "}
              {excluindo?.fleet_number} ({excluindo?.litros} L) será removido. As horas e médias
              serão recalculadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={processando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluirConfirmado} disabled={processando}>
              {processando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
