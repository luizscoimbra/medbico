import { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Coins,
  History,
  Loader2,
  Package,
  Pencil,
  Plus,
  Timer,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { digitosParaMoeda, formatBRL, moedaParaCentavos } from "@/lib/utils";
import { getAllEquipments, saveEquipment, type Equipment } from "@/lib/equipmentStorage";
import { getAllFornecedores, type Fornecedor } from "@/lib/fornecedorStorage";
import { criarTituloPagar, type TituloPagar } from "@/lib/contasPagarStorage";
import {
  CATEGORIAS_MANUTENCAO,
  TIPOS_ITEM_LABEL,
  calcularAgenda,
  createItem,
  createPrograma,
  createRegistro,
  deleteItem,
  deletePrograma,
  deleteRegistro,
  getAllItens,
  getAllProgramas,
  getAllRegistros,
  mapaHorasEquipamentos,
  updateItem,
  updatePrograma,
  updateRegistro,
  type ItemAgenda,
  type ItemManutencao,
  type ItemRegistro,
  type ProgramaManutencao,
  type RegistroManutencao,
  type TipoItemManutencao,
} from "@/lib/equipmentMaintenanceStorage";

const SEM_PROGRAMA = "__none";
const LIVRE = "__livre";
const SEM_EQUIPAMENTO = "__sem";

const URGENCIA_LABEL: Record<ItemAgenda["urgencia"], string> = {
  critico: "Em atraso",
  alta: "Atenção",
  media: "Quase lá",
  ok: "Em dia",
  sem_base: "Sem intervalo",
};

const URGENCIA_CLASS: Record<ItemAgenda["urgencia"], string> = {
  critico: "bg-destructive/10 text-destructive border-destructive/30",
  alta: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  media: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  ok: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  sem_base: "bg-muted text-muted-foreground border-border",
};

const HOJE = () => new Date().toISOString().slice(0, 10);

const vencimentoPadrao = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
};

const dataBR = (iso: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "";

interface FormRegistro {
  equipment_id: string;
  data: string;
  horas: string;
  schedule_id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  mao_obra: string;
  fornId: string;
  fornNome: string;
  responsavel: string;
  observacao: string;
}

interface FormPrograma {
  id?: string;
  equipment_id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  intervalo_horas: string;
  intervalo_dias: string;
  checklist: string;
}

interface FormItem {
  id?: string;
  nome: string;
  categoria: string;
  unidade: string;
  custo: string;
}

const formRegistroVazio = (equipments: Equipment[]): FormRegistro => ({
  equipment_id: equipments[0]?.id || SEM_EQUIPAMENTO,
  data: HOJE(),
  horas: equipments[0]?.horas_acumuladas != null ? String(equipments[0].horas_acumuladas) : "",
  schedule_id: SEM_PROGRAMA,
  categoria: CATEGORIAS_MANUTENCAO[0],
  titulo: "",
  descricao: "",
  mao_obra: "",
  fornId: "__none",
  fornNome: "",
  responsavel: "",
  observacao: "",
});

const formProgramaVazio = (equipments: Equipment[]): FormPrograma => ({
  equipment_id: equipments[0]?.id || SEM_EQUIPAMENTO,
  categoria: CATEGORIAS_MANUTENCAO[0],
  titulo: "",
  descricao: "",
  intervalo_horas: "",
  intervalo_dias: "",
  checklist: "",
});

const formItemVazio = (tipo: TipoItemManutencao): FormItem => ({
  nome: "",
  categoria: tipo === "servico" ? "Mecânica" : "",
  unidade: tipo === "servico" ? "serv" : "un",
  custo: "",
});

export default function ManutencaoEquipamentos() {
  const navigate = useNavigate();

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [programas, setProgramas] = useState<ProgramaManutencao[]>([]);
  const [registros, setRegistros] = useState<RegistroManutencao[]>([]);
  const [itens, setItens] = useState<ItemManutencao[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("agenda");
  const [filtroEquip, setFiltroEquip] = useState("todos");
  const [tipoCadastro, setTipoCadastro] = useState<TipoItemManutencao>("servico");

  // Dialog de registro de manutenção
  const [registroOpen, setRegistroOpen] = useState(false);
  const [formReg, setFormReg] = useState<FormRegistro>(formRegistroVazio([]));
  const [itensSel, setItensSel] = useState<ItemRegistro[]>([]);
  const [selItemId, setSelItemId] = useState("__none");
  const [selQtd, setSelQtd] = useState("1");
  const [salvandoReg, setSalvandoReg] = useState(false);

  // Dialog de programa
  const [formProg, setFormProg] = useState<FormPrograma | null>(null);

  // Dialog de item de cadastro
  const [formItem, setFormItem] = useState<FormItem | null>(null);

  // Confirmações
  const [excluindo, setExcluindo] = useState<
    | { tipo: "registro"; obj: RegistroManutencao }
    | { tipo: "programa"; obj: ProgramaManutencao }
    | { tipo: "item"; obj: ItemManutencao }
    | null
  >(null);
  const [processando, setProcessando] = useState(false);

  const load = async () => {
    try {
      const [eqs, progs, regs, its, fors] = await Promise.all([
        getAllEquipments().catch(() => [] as Equipment[]),
        getAllProgramas().catch(() => [] as ProgramaManutencao[]),
        getAllRegistros().catch(() => [] as RegistroManutencao[]),
        getAllItens().catch(() => [] as ItemManutencao[]),
        getAllFornecedores().catch(() => [] as Fornecedor[]),
      ]);
      setEquipments([...eqs].sort((a, b) => (a.fleet_number || "").localeCompare(b.fleet_number || "")));
      setProgramas(progs);
      setRegistros(regs);
      setItens(its);
      setFornecedores(fors);
    } catch {
      toast.error("Erro ao carregar os dados da manutenção");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const agenda = useMemo(
    () =>
      calcularAgenda({
        programas,
        registros,
        horasPorEquipamento: mapaHorasEquipamentos(equipments),
      }),
    [programas, registros, equipments]
  );

  const agendaFiltrada = useMemo(
    () => (filtroEquip === "todos" ? agenda : agenda.filter((i) => i.programa.equipment_id === filtroEquip)),
    [agenda, filtroEquip]
  );

  const registrosFiltrados = useMemo(
    () => (filtroEquip === "todos" ? registros : registros.filter((r) => r.equipment_id === filtroEquip)),
    [registros, filtroEquip]
  );

  const eqPorId = useMemo(() => {
    const m: Record<string, Equipment> = {};
    equipments.forEach((e) => (m[e.id] = e));
    return m;
  }, [equipments]);

  const kpis = useMemo(() => {
    const mes = HOJE().slice(0, 7);
    return {
      programas: agenda.length,
      atrasados: agenda.filter((a) => a.urgencia === "critico").length,
      atencao: agenda.filter((a) => a.urgencia === "alta").length,
      custoMes: registros
        .filter((r) => (r.data || "").slice(0, 7) === mes)
        .reduce((s, r) => s + (r.custo_total || 0), 0),
    };
  }, [agenda, registros]);

  const programasDoEquipamento = (equipmentId: string) =>
    programas.filter((p) => p.equipment_id === equipmentId);

  // ── Registrar manutenção ────────────────────────────────────────────
  const abrirRegistro = (prefill?: { equipmentId?: string; scheduleId?: string }) => {
    if (equipments.length === 0) {
      toast.error("Cadastre um equipamento antes de registrar manutenções");
      return;
    }
    const base = formRegistroVazio(equipments);
    const eqId = prefill?.equipmentId || base.equipment_id;
    const eq = eqPorId[eqId];
    const prog = prefill?.scheduleId ? programas.find((p) => p.id === prefill.scheduleId) : undefined;
    setFormReg({
      ...base,
      equipment_id: eqId,
      horas: eq?.horas_acumuladas != null ? String(eq.horas_acumuladas) : "",
      schedule_id: prog?.id || SEM_PROGRAMA,
      categoria: prog?.categoria || base.categoria,
      titulo: prog?.titulo || "",
      descricao: prog?.descricao || "",
    });
    setItensSel([]);
    setSelItemId("__none");
    setSelQtd("1");
    setRegistroOpen(true);
  };

  const trocarEquipamentoNoRegistro = (eqId: string) => {
    const eq = eqPorId[eqId];
    setFormReg((prev) => ({
      ...prev,
      equipment_id: eqId,
      horas: eq?.horas_acumuladas != null ? String(eq.horas_acumuladas) : "",
      schedule_id: SEM_PROGRAMA,
    }));
  };

  const trocarProgramaNoRegistro = (progId: string) => {
    if (progId === SEM_PROGRAMA) {
      setFormReg((prev) => ({ ...prev, schedule_id: SEM_PROGRAMA }));
      return;
    }
    const prog = programas.find((p) => p.id === progId);
    if (!prog) return;
    setFormReg((prev) => ({
      ...prev,
      schedule_id: progId,
      categoria: prog.categoria,
      titulo: prog.titulo,
      descricao: prog.descricao,
    }));
  };

  const addItemSelecionado = () => {
    if (selItemId === "__none") {
      toast.error("Selecione um item do cadastro");
      return;
    }
    const item = itens.find((i) => i.id === selItemId);
    if (!item) return;
    const qtd = parseFloat(selQtd);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      toast.error("Informe uma quantidade maior que zero");
      return;
    }
    setItensSel((prev) => [
      ...prev,
      {
        itemId: item.id,
        tipo: item.tipo,
        nome: item.nome,
        unidade: item.unidade || "un",
        quantidade: qtd,
        custoUnitario: item.custo || 0,
        subtotal: Math.round(qtd * (item.custo || 0) * 100) / 100,
      },
    ]);
    setSelItemId("__none");
    setSelQtd("1");
  };

  const removerItemSel = (index: number) =>
    setItensSel((prev) => prev.filter((_, i) => i !== index));

  const custoMaoObra = () => moedaParaCentavos(formReg.mao_obra) / 100;
  const totalRegistro = () =>
    itensSel.reduce((s, i) => s + i.subtotal, 0) + custoMaoObra();

  const gerarTituloDe = async (rec: RegistroManutencao): Promise<TituloPagar> =>
    criarTituloPagar({
      fornecedorId: rec.fornecedor_id || undefined,
      fornecedorNome: rec.fornecedor_nome || "Não informado",
      categoria: "Manutenção",
      descricao: `${rec.titulo} (Frota ${rec.fleet_number})`,
      valor: rec.custo_total,
      dataEmissao: rec.data,
      dataVencimento: vencimentoPadrao(),
      manutencaoId: rec.id,
      equipmentId: rec.equipment_id,
    });

  const salvarRegistro = async () => {
    const eq = eqPorId[formReg.equipment_id];
    if (!eq) {
      toast.error("Selecione o equipamento");
      return;
    }
    if (!formReg.titulo.trim()) {
      toast.error("Informe o título da manutenção");
      return;
    }
    const horasDigitadas = parseFloat(formReg.horas);
    const horasFinais =
      formReg.horas.trim() !== "" && Number.isFinite(horasDigitadas)
        ? horasDigitadas
        : eq.horas_acumuladas || 0;
    if (horasFinais < 0) {
      toast.error("Horímetro inválido");
      return;
    }

    setSalvandoReg(true);
    try {
      const fornId =
        formReg.fornId === LIVRE || formReg.fornId === "__none" || !formReg.fornId
          ? ""
          : formReg.fornId;
      const fornNome = fornId
        ? fornecedores.find((f) => f.id === fornId)?.nome || formReg.fornNome.trim()
        : formReg.fornNome.trim();

      const rec = await createRegistro({
        equipment_id: eq.id,
        fleet_number: eq.fleet_number,
        schedule_id: formReg.schedule_id === SEM_PROGRAMA ? null : formReg.schedule_id,
        data: formReg.data,
        horas_registradas: horasFinais,
        categoria: formReg.categoria,
        titulo: formReg.titulo.trim(),
        descricao: formReg.descricao.trim(),
        itens: itensSel,
        custo_mao_obra: custoMaoObra(),
        custo_total: totalRegistro(),
        fornecedor_id: fornId,
        fornecedor_nome: fornNome,
        responsavel: formReg.responsavel.trim(),
        observacao: formReg.observacao.trim(),
        titulo_pagar_id: "",
      });

      // Horímetro: só avança (nunca regride)
      if (horasFinais > (eq.horas_acumuladas || 0)) {
        await saveEquipment({
          ...eq,
          horas_acumuladas: horasFinais,
          data_ultima_leitura: formReg.data,
        });
      }

      if (rec.custo_total > 0) {
        const titulo = await gerarTituloDe(rec);
        await updateRegistro(rec.id, { titulo_pagar_id: titulo.id });
        toast.success(`Manutenção registrada! Conta a pagar nº ${titulo.numero} criada.`);
      } else {
        toast.success("Manutenção registrada!");
      }

      setRegistroOpen(false);
      await load();
    } catch {
      toast.error("Erro ao registrar a manutenção");
    } finally {
      setSalvandoReg(false);
    }
  };

  const gerarTituloPendente = async (rec: RegistroManutencao) => {
    try {
      const titulo = await gerarTituloDe(rec);
      await updateRegistro(rec.id, { titulo_pagar_id: titulo.id });
      toast.success(`Conta a pagar nº ${titulo.numero} criada!`);
      await load();
    } catch {
      toast.error("Erro ao gerar o título");
    }
  };

  // ── Programas ───────────────────────────────────────────────────────
  const abrirNovoPrograma = () => {
    if (equipments.length === 0) {
      toast.error("Cadastre um equipamento antes de criar programas");
      return;
    }
    setFormProg(formProgramaVazio(equipments));
  };

  const abrirEditarPrograma = (p: ProgramaManutencao) =>
    setFormProg({
      id: p.id,
      equipment_id: p.equipment_id,
      categoria: p.categoria,
      titulo: p.titulo,
      descricao: p.descricao,
      intervalo_horas: p.intervalo_horas ? String(p.intervalo_horas) : "",
      intervalo_dias: p.intervalo_dias ? String(p.intervalo_dias) : "",
      checklist: (p.checklist || []).join("\n"),
    });

  const salvarPrograma = async () => {
    if (!formProg) return;
    const eq = eqPorId[formProg.equipment_id];
    if (!eq) {
      toast.error("Selecione o equipamento");
      return;
    }
    if (!formProg.titulo.trim()) {
      toast.error("Informe o título do programa");
      return;
    }
    const horas = parseFloat(formProg.intervalo_horas) || 0;
    const dias = parseInt(formProg.intervalo_dias, 10) || 0;
    if (horas <= 0 && dias <= 0) {
      toast.error("Informe o intervalo em horas ou dias");
      return;
    }
    try {
      const payload = {
        equipment_id: eq.id,
        fleet_number: eq.fleet_number,
        equipamento_modelo: eq.equipment_model || "",
        categoria: formProg.categoria,
        titulo: formProg.titulo.trim(),
        descricao: formProg.descricao.trim(),
        intervalo_horas: horas,
        intervalo_dias: dias,
        checklist: formProg.checklist
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
        ativo: true,
      };
      if (formProg.id) {
        await updatePrograma(formProg.id, payload);
        toast.success("Programa atualizado!");
      } else {
        await createPrograma(payload);
        toast.success("Programa criado!");
      }
      setFormProg(null);
      await load();
    } catch {
      toast.error("Erro ao salvar o programa");
    }
  };

  // ── Cadastros (serviços, peças, produtos) ───────────────────────────
  const abrirNovoItem = () => setFormItem(formItemVazio(tipoCadastro));
  const abrirEditarItem = (i: ItemManutencao) =>
    setFormItem({
      id: i.id,
      nome: i.nome,
      categoria: i.categoria || "",
      unidade: i.unidade || "un",
      custo: i.custo ? digitosParaMoeda(String(Math.round(i.custo * 100))) : "",
    });

  const salvarItem = async () => {
    if (!formItem) return;
    if (!formItem.nome.trim()) {
      toast.error("Informe o nome do item");
      return;
    }
    const custo = moedaParaCentavos(formItem.custo) / 100;
    try {
      if (formItem.id) {
        await updateItem(formItem.id, {
          nome: formItem.nome.trim(),
          categoria: formItem.categoria.trim(),
          unidade: formItem.unidade.trim() || "un",
          custo,
        });
        toast.success("Item atualizado!");
      } else {
        await createItem({
          tipo: tipoCadastro,
          nome: formItem.nome.trim(),
          categoria: formItem.categoria.trim(),
          unidade: formItem.unidade.trim() || "un",
          custo,
          ativo: true,
        });
        toast.success("Item cadastrado!");
      }
      setFormItem(null);
      await load();
    } catch {
      toast.error("Erro ao salvar o item");
    }
  };

  const excluirConfirmado = async () => {
    if (!excluindo || processando) return;
    setProcessando(true);
    try {
      if (excluindo.tipo === "registro") {
        await deleteRegistro(excluindo.obj.id);
        toast.success("Registro de manutenção excluído");
      } else if (excluindo.tipo === "programa") {
        await deletePrograma(excluindo.obj.id);
        toast.success("Programa excluído");
      } else {
        await deleteItem(excluindo.obj.id);
        toast.success("Item excluído");
      }
      setExcluindo(null);
      await load();
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setProcessando(false);
    }
  };

  const itensDoCadastro = itens.filter((i) => i.tipo === tipoCadastro);

  const tituloExclusao =
    excluindo?.tipo === "registro"
      ? `o registro "${excluindo.obj.titulo}" (${excluindo.obj.fleet_number})`
      : excluindo?.tipo === "programa"
        ? `o programa "${excluindo.obj.titulo}"`
        : excluindo
          ? `o item "${excluindo.obj.nome}"`
          : "";

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading text-foreground">Manutenção de Equipamentos</h1>
            <p className="text-sm text-muted-foreground">
              Agenda por horímetro, histórico e cadastros da frota
            </p>
          </div>
        </div>
        <Button onClick={() => abrirRegistro()}>
          <Plus className="h-4 w-4 mr-2" /> Registrar Manutenção
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-t-4 border-t-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Programas ativos</p>
                <p className="text-xl font-heading font-bold">{kpis.programas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-t-4 ${kpis.atrasados > 0 ? "border-t-destructive" : "border-t-border"}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  kpis.atrasados > 0 ? "bg-destructive/10 text-destructive" : "bg-muted"
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em atraso</p>
                <p className="text-xl font-heading font-bold">{kpis.atrasados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <Timer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atenção</p>
                <p className="text-xl font-heading font-bold">{kpis.atencao}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-600">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo no mês</p>
                <p className="text-xl font-heading font-bold">{formatBRL(kpis.custoMes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro de equipamento */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={filtroEquip} onValueChange={setFiltroEquip}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os equipamentos</SelectItem>
            {equipments.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.fleet_number}  {e.equipment_model || "Equipamento"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agenda" className="gap-2">
            <CalendarClock className="h-4 w-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2">
            <History className="h-4 w-4" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="programas" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Programas
          </TabsTrigger>
          <TabsTrigger value="cadastros" className="gap-2">
            <Package className="h-4 w-4" /> Cadastros
          </TabsTrigger>
        </TabsList>

        {/* ── AGENDA ─────────────────────────────────────────────── */}
        <TabsContent value="agenda">
          {loading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-muted-foreground italic">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando agenda...
            </div>
          ) : agendaFiltrada.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground italic">
              Nenhum programa de manutenção.{" "}
              <button
                type="button"
                className="text-primary underline"
                onClick={() => {
                  setTab("programas");
                  abrirNovoPrograma();
                }}
              >
                Cadastrar o primeiro programa
              </button>
              .
            </div>
          ) : (
            <div className="space-y-3">
              {agendaFiltrada.map((item) => {
                const p = item.programa;
                const eq = eqPorId[p.equipment_id];
                return (
                  <Card key={p.id} className="shadow-sm border-border/50">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${URGENCIA_CLASS[item.urgencia]}`}>
                            {URGENCIA_LABEL[item.urgencia]}
                          </Badge>
                          <span className="font-semibold truncate">{p.titulo}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {p.categoria}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Frota {p.fleet_number}
                          {eq?.equipment_model ? ` · ${eq.equipment_model}` : ""} ·{" "}
                          {item.base === "horas"
                            ? `a cada ${p.intervalo_horas} h`
                            : item.base === "dias"
                              ? `a cada ${p.intervalo_dias} dias`
                              : "sem intervalo definido"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {item.base === "horas" ? (
                            <>
                              Horímetro atual: <strong>{item.horasAtuais} h</strong> · Última:{" "}
                              {item.ultimaManutencao
                                ? `${dataBR(item.ultimaManutencao.data)} (${item.ultimaManutencao.horas_registradas} h)`
                                : "nunca feita"}
                              {item.proximaHoras != null && (
                                <>
                                  {" "}
                                  · Próxima em <strong>{item.proximaHoras} h</strong>
                                </>
                              )}
                            </>
                          ) : item.base === "dias" ? (
                            <>
                              Última: {item.ultimaManutencao ? dataBR(item.ultimaManutencao.data) : "nunca feita"}{" "}
                              · Próxima em {item.proximaData ? dataBR(item.proximaData) : "—"}
                            </>
                          ) : (
                            "Defina um intervalo em horas ou dias no programa."
                          )}
                        </p>
                      </div>
                      <div className="text-right sm:w-40 shrink-0">
                        {item.base === "horas" && item.horasRestantes !== null && (
                          <p
                            className={`text-lg font-heading font-bold ${
                              item.horasRestantes <= 0 ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {item.horasRestantes <= 0
                              ? `${Math.abs(item.horasRestantes)} h atrasado`
                              : `faltam ${item.horasRestantes} h`}
                          </p>
                        )}
                        {item.base === "dias" && item.diasRestantes !== null && (
                          <p
                            className={`text-lg font-heading font-bold ${
                              item.diasRestantes <= 0 ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {item.diasRestantes <= 0
                              ? `${Math.abs(item.diasRestantes)} dia(s) atrasado`
                              : `faltam ${item.diasRestantes} dia(s)`}
                          </p>
                        )}
                        <Button
                          size="sm"
                          className="mt-1"
                          onClick={() =>
                            abrirRegistro({ equipmentId: p.equipment_id, scheduleId: p.id })
                          }
                        >
                          <Wrench className="h-4 w-4 mr-1" /> Registrar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── HISTÓRICO ──────────────────────────────────────────── */}
        <TabsContent value="historico">
          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Manutenções ({registrosFiltrados.length})
              </CardTitle>
              <CardDescription>
                Manutenções concluídas; com custo você pode gerar a conta a pagar.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground italic">
                  Carregando histórico...
                </div>
              ) : registrosFiltrados.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground italic">
                  Nenhuma manutenção registrada ainda.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Frota</TableHead>
                        <TableHead>Manutenção</TableHead>
                        <TableHead className="text-right">Itens</TableHead>
                        <TableHead className="text-right">Custo total</TableHead>
                        <TableHead className="text-center">Conta a pagar</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrosFiltrados.map((r) => {
                        const gerado = !!r.titulo_pagar_id;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap">{dataBR(r.data)}</TableCell>
                            <TableCell className="font-mono font-semibold">
                              {r.fleet_number}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{r.titulo}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {r.categoria}
                                {r.responsavel ? ` · ${r.responsavel}` : ""}
                                {r.horas_registradas ? ` · ${r.horas_registradas} h` : ""}
                              </p>
                            </TableCell>
                            <TableCell className="text-right">{(r.itens || []).length}</TableCell>
                            <TableCell className="text-right font-mono font-semibold whitespace-nowrap">
                              {formatBRL(r.custo_total)}
                            </TableCell>
                            <TableCell className="text-center">
                              {gerado ? (
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                  Gerada
                                </Badge>
                              ) : r.custo_total > 0 ? (
                                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                                  Pendente
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground"></span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                {r.custo_total > 0 && !gerado && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-emerald-600 hover:bg-emerald-500/10"
                                    onClick={() => gerarTituloPendente(r)}
                                  >
                                    <Plus className="h-4 w-4 mr-1" /> Título
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Excluir registro"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => setExcluindo({ tipo: "registro", obj: r })}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <tfoot className="bg-muted/50 font-semibold">
                      <TableRow>
                        <TableCell colSpan={4} className="text-right text-xs uppercase">
                          Total listado
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatBRL(registrosFiltrados.reduce((s, r) => s + (r.custo_total || 0), 0))}
                        </TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </tfoot>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PROGRAMAS ──────────────────────────────────────────── */}
        <TabsContent value="programas">
          <div className="flex justify-end mb-4">
            <Button onClick={abrirNovoPrograma}>
              <Plus className="h-4 w-4 mr-2" /> Novo Programa
            </Button>
          </div>
          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Programas de Manutenção ({programas.length})
              </CardTitle>
              <CardDescription>
                Intervalos por hora de trabalho ou por dias, vinculados a um equipamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground italic">
                  Carregando programas...
                </div>
              ) : programas.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground italic">
                  Nenhum programa cadastrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipamento</TableHead>
                        <TableHead>Programa</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Intervalo</TableHead>
                        <TableHead className="text-center">Checklist</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {programas.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <p className="font-mono font-semibold">{p.fleet_number}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {p.equipamento_modelo || eqPorId[p.equipment_id]?.equipment_model || ""}
                            </p>
                          </TableCell>
                          <TableCell className="font-medium">{p.titulo}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {p.categoria}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {p.intervalo_horas > 0 ? `${p.intervalo_horas} h` : ""}
                            {p.intervalo_horas > 0 && p.intervalo_dias > 0 ? " / " : ""}
                            {p.intervalo_dias > 0 ? `${p.intervalo_dias} dias` : ""}
                          </TableCell>
                          <TableCell className="text-center">
                            {(p.checklist || []).length || ""}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Editar programa"
                                className="h-8 w-8 text-primary"
                                onClick={() => abrirEditarPrograma(p)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Excluir programa"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setExcluindo({ tipo: "programa", obj: p })}
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
        </TabsContent>

        {/* ── CADASTROS ──────────────────────────────────────────── */}
        <TabsContent value="cadastros">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex gap-2">
              {(Object.keys(TIPOS_ITEM_LABEL) as TipoItemManutencao[]).map((t) => (
                <Button
                  key={t}
                  variant={tipoCadastro === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTipoCadastro(t)}
                >
                  {TIPOS_ITEM_LABEL[t]}s
                </Button>
              ))}
            </div>
            <Button onClick={abrirNovoItem}>
              <Plus className="h-4 w-4 mr-2" /> Novo {TIPOS_ITEM_LABEL[tipoCadastro]}
            </Button>
          </div>
          <Card className="shadow-lg border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {TIPOS_ITEM_LABEL[tipoCadastro]}s cadastrados ({itensDoCadastro.length})
              </CardTitle>
              <CardDescription>
                Serviços, peças e produtos usados no lançamento das manutenções.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground italic">
                  Carregando cadastros...
                </div>
              ) : itensDoCadastro.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground italic">
                  Nenhum item cadastrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Custo unitário</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensDoCadastro.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium">{i.nome}</TableCell>
                          <TableCell>{i.categoria || ""}</TableCell>
                          <TableCell>{i.unidade}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatBRL(i.custo)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Editar item"
                                className="h-8 w-8 text-primary"
                                onClick={() => abrirEditarItem(i)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Excluir item"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => setExcluindo({ tipo: "item", obj: i })}
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
        </TabsContent>
      </Tabs>

      {/* Dialog: registrar manutenção */}
      <Dialog open={registroOpen} onOpenChange={(open) => !open && !salvandoReg && setRegistroOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              Registrar manutenção
            </DialogTitle>
            <DialogDescription>
              Lance o serviço executado; com custo maior que zero a conta a pagar é criada
              automaticamente (vencimento +30 dias).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Equipamento *</Label>
                <Select
                  value={formReg.equipment_id}
                  onValueChange={trocarEquipamentoNoRegistro}
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
                <Label htmlFor="reg-data">Data *</Label>
                <Input
                  id="reg-data"
                  type="date"
                  value={formReg.data}
                  onChange={(e) => setFormReg({ ...formReg, data: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-horas" className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  Horímetro na execução
                </Label>
                <Input
                  id="reg-horas"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Ex: 1250"
                  value={formReg.horas}
                  onChange={(e) => setFormReg({ ...formReg, horas: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Programa (opcional)</Label>
                <Select value={formReg.schedule_id} onValueChange={trocarProgramaNoRegistro}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_PROGRAMA}>Sem programa</SelectItem>
                    {programasDoEquipamento(formReg.equipment_id).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select
                  value={formReg.categoria}
                  onValueChange={(v) => setFormReg({ ...formReg, categoria: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_MANUTENCAO.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-titulo">Título *</Label>
                <Input
                  id="reg-titulo"
                  placeholder="Ex: Troca de óleo e filtros"
                  value={formReg.titulo}
                  onChange={(e) => setFormReg({ ...formReg, titulo: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-desc">Descrição</Label>
              <Textarea
                id="reg-desc"
                rows={2}
                placeholder="Detalhes do serviço executado..."
                value={formReg.descricao}
                onChange={(e) => setFormReg({ ...formReg, descricao: e.target.value })}
              />
            </div>

            {/* Itens */}
            <div className="space-y-2 border border-border/60 rounded-lg p-3">
              <Label className="text-sm font-semibold">Itens (serviços, peças e produtos)</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={selItemId} onValueChange={setSelItemId}>
                  <SelectTrigger className="sm:flex-1">
                    <SelectValue placeholder="Selecione do cadastro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Selecione do cadastro...</SelectItem>
                    {(Object.keys(TIPOS_ITEM_LABEL) as TipoItemManutencao[]).map((tipo) => {
                      const doTipo = itens.filter((i) => i.tipo === tipo);
                      if (!doTipo.length) return null;
                      return (
                        <div key={tipo}>
                          <p className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold">
                            {TIPOS_ITEM_LABEL[tipo]}s
                          </p>
                          {doTipo.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.nome}  {formatBRL(i.custo)}/{i.unidade}
                            </SelectItem>
                          ))}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="sm:w-24"
                  value={selQtd}
                  onChange={(e) => setSelQtd(e.target.value)}
                  placeholder="Qtd"
                />
                <Button variant="outline" onClick={addItemSelecionado}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar
                </Button>
              </div>
              {itensSel.length > 0 && (
                <div className="border border-border/60 rounded-md divide-y divide-border max-h-40 overflow-y-auto">
                  {itensSel.map((i, idx) => (
                    <div key={`${i.nome}-${idx}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {TIPOS_ITEM_LABEL[i.tipo]}
                      </Badge>
                      <span className="flex-1 truncate">
                        {i.nome} · {i.quantidade} {i.unidade}
                      </span>
                      <span className="font-mono whitespace-nowrap">{formatBRL(i.subtotal)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removerItemSel(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-mao">Mão de obra</Label>
                <Input
                  id="reg-mao"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={formReg.mao_obra}
                  onChange={(e) => setFormReg({ ...formReg, mao_obra: digitosParaMoeda(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fornecedor (opcional)</Label>
                <Select
                  value={formReg.fornId || "__none"}
                  onValueChange={(v) => setFormReg({ ...formReg, fornId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Não informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Não informado</SelectItem>
                    {fornecedores.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome}
                      </SelectItem>
                    ))}
                    <SelectItem value={LIVRE}>Digitar manualmente&</SelectItem>
                  </SelectContent>
                </Select>
                {formReg.fornId === LIVRE && (
                  <Input
                    placeholder="Nome do fornecedor"
                    value={formReg.fornNome}
                    onChange={(e) => setFormReg({ ...formReg, fornNome: e.target.value })}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reg-resp">Responsável</Label>
                <Input
                  id="reg-resp"
                  placeholder="Ex: João da Silva"
                  value={formReg.responsavel}
                  onChange={(e) => setFormReg({ ...formReg, responsavel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-obs">Observação</Label>
                <Input
                  id="reg-obs"
                  placeholder="Observações internas"
                  value={formReg.observacao}
                  onChange={(e) => setFormReg({ ...formReg, observacao: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <span className="text-sm text-muted-foreground">
                {itensSel.length} item(ns) · mão de obra {formatBRL(custoMaoObra())}
              </span>
              <span className="text-lg font-heading font-bold">
                Total {formatBRL(totalRegistro())}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegistroOpen(false)} disabled={salvandoReg}>
              Cancelar
            </Button>
            <Button onClick={salvarRegistro} disabled={salvandoReg}>
              {salvandoReg ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...
                </>
              ) : (
                "Concluir manutenção"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: programa */}
      <Dialog open={!!formProg} onOpenChange={(open) => !open && setFormProg(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              {formProg?.id ? "Editar programa" : "Novo programa"}
            </DialogTitle>
            <DialogDescription>
              O intervalo pode ser em horas de trabalho (horímetro) ou em dias.
            </DialogDescription>
          </DialogHeader>
          {formProg && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>Equipamento *</Label>
                <Select
                  value={formProg.equipment_id}
                  onValueChange={(v) => setFormProg({ ...formProg, equipment_id: v })}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select
                    value={formProg.categoria}
                    onValueChange={(v) => setFormProg({ ...formProg, categoria: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_MANUTENCAO.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prog-titulo">Título *</Label>
                  <Input
                    id="prog-titulo"
                    placeholder="Ex: Troca de óleo a cada 500h"
                    value={formProg.titulo}
                    onChange={(e) => setFormProg({ ...formProg, titulo: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prog-horas">Intervalo (horas)</Label>
                  <Input
                    id="prog-horas"
                    type="number"
                    min="0"
                    placeholder="Ex: 500"
                    value={formProg.intervalo_horas}
                    onChange={(e) => setFormProg({ ...formProg, intervalo_horas: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prog-dias">Intervalo (dias)</Label>
                  <Input
                    id="prog-dias"
                    type="number"
                    min="0"
                    placeholder="Ex: 180"
                    value={formProg.intervalo_dias}
                    onChange={(e) => setFormProg({ ...formProg, intervalo_dias: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prog-desc">Descrição</Label>
                <Textarea
                  id="prog-desc"
                  rows={2}
                  placeholder="O que deve ser feito..."
                  value={formProg.descricao}
                  onChange={(e) => setFormProg({ ...formProg, descricao: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prog-check">Checklist (um item por linha)</Label>
                <Textarea
                  id="prog-check"
                  rows={4}
                  placeholder={"Verificar nível de óleo\nInspecionar correias\nTestar bicos"}
                  value={formProg.checklist}
                  onChange={(e) => setFormProg({ ...formProg, checklist: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormProg(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarPrograma}>
              {formProg?.id ? "Salvar alterações" : "Criar programa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: item de cadastro */}
      <Dialog open={!!formItem} onOpenChange={(open) => !open && setFormItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {formItem?.id
                ? `Editar ${TIPOS_ITEM_LABEL[tipoCadastro].toLowerCase()}`
                : `Novo ${TIPOS_ITEM_LABEL[tipoCadastro].toLowerCase()}`}
            </DialogTitle>
            <DialogDescription>
              Usado no lançamento das manutenções como {TIPOS_ITEM_LABEL[tipoCadastro].toLowerCase()}.
            </DialogDescription>
          </DialogHeader>
          {formItem && (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label htmlFor="item-nome">Nome *</Label>
                <Input
                  id="item-nome"
                  placeholder={
                    tipoCadastro === "servico"
                      ? "Ex: Troca de óleo"
                      : tipoCadastro === "peca"
                        ? "Ex: Filtro de óleo 1234"
                        : "Ex: Óleo SAE 15W-40 20L"
                  }
                  value={formItem.nome}
                  onChange={(e) => setFormItem({ ...formItem, nome: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-cat">Categoria</Label>
                  <Input
                    id="item-cat"
                    placeholder="Ex: Mecânica"
                    value={formItem.categoria}
                    onChange={(e) => setFormItem({ ...formItem, categoria: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-un">Unidade</Label>
                  <Input
                    id="item-un"
                    placeholder="Ex: un, L, h"
                    value={formItem.unidade}
                    onChange={(e) => setFormItem({ ...formItem, unidade: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-custo">Custo unitário</Label>
                <Input
                  id="item-custo"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={formItem.custo}
                  onChange={(e) => setFormItem({ ...formItem, custo: digitosParaMoeda(e.target.value) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormItem(null)}>
              Cancelar
            </Button>
            <Button onClick={salvarItem}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!excluindo}
        onOpenChange={(open) => !open && !processando && setExcluindo(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir
            </AlertDialogTitle>
            <AlertDialogDescription>
              Excluir {tituloExclusao}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={processando}>
              Voltar
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={excluirConfirmado}
              disabled={processando}
            >
              {processando ? "Processando..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
