import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Calculator, Plus, Pencil, Trash2, Loader2, Percent,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  deleteTaxProfile,
  fetchTaxProfiles,
  saveTaxProfile,
  TAX_PROFILE_VAZIO,
  type TaxProfile,
  type TaxProfileInput,
} from "@/lib/taxProfilesStorage";

/**
 * Central de Tributação.
 *
 * Cadastra uma vez os perfis fiscais (NCM, CEST, CFOP, CST/CSOSN, origem e
 * alíquotas) e os produtos passam a referenciá-los — em vez de repetir a
 * tributação em todo produto. Na emissão de NF-e, o emissor lê o perfil do
 * produto. Cada usuário enxerga os perfis da própria empresa; só o master
 * cria, edita ou apaga (guarda no servidor via RPC).
 */
export default function Tributacao() {
  const { profile } = useAuth();

  const [linhas, setLinhas] = useState<TaxProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<TaxProfileInput>(TAX_PROFILE_VAZIO);

  const podeEditar = profile?.role === "master";

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setLinhas(await fetchTaxProfiles());
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao carregar");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setForm(TAX_PROFILE_VAZIO);
    setDialogAberto(true);
  };

  const abrirEdicao = (p: TaxProfile) => {
    setForm({
      id: p.id,
      name: p.name,
      descricao: p.descricao,
      ncm: p.ncm,
      cest: p.cest,
      cfop: p.cfop,
      cst_csosn: p.cst_csosn,
      origem: p.origem,
      aliquota_icms: p.aliquota_icms,
      aliquota_ipi: p.aliquota_ipi,
      enquadramento_ipi: p.enquadramento_ipi,
      aliquota_pis: p.aliquota_pis,
      aliquota_cofins: p.aliquota_cofins,
      aliquota_cbs: p.aliquota_cbs,
      aliquota_ibs: p.aliquota_ibs,
      cst_ibs_cbs: p.cst_ibs_cbs,
      cclasstrib: p.cclasstrib,
      ativo: p.ativo,
    });
    setDialogAberto(true);
  };

  const salvar = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do perfil");
      return;
    }
    setSalvando(true);
    try {
      await saveTaxProfile(form);
      toast.success(form.id ? "Perfil atualizado!" : "Perfil criado!");
      setDialogAberto(false);
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (p: TaxProfile) => {
    if (!confirm(`Excluir o perfil "${p.name}"? Produtos que o usem ficam sem tributação.`)) return;
    setSalvando(true);
    try {
      await deleteTaxProfile(p.id);
      toast.success("Perfil removido.");
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao remover");
    } finally {
      setSalvando(false);
    }
  };

  const num = (v: number) => (v > 0 ? `${v}%` : "—");

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
            <Calculator className="h-8 w-8 text-emerald-600" />
            Central de Tributação
          </h1>
          <p className="text-muted-foreground mt-1">
            Perfis fiscais da empresa — NCM, CEST, CFOP, CST/CSOSN e alíquotas.
            Cada produto referencia um perfil de <strong>saída</strong> (venda) e
            um de <strong>entrada</strong> (compra) na hora da nota fiscal.
          </p>
        </div>
        <Button
          onClick={abrirNovo}
          disabled={!podeEditar}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo Perfil
        </Button>
      </div>

      {!podeEditar && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          Você pode consultar os perfis, mas somente o administrador master
          cadastra ou altera a tributação.
        </p>
      )}

      <Card className="shadow-lg overflow-hidden border-none bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Perfil</TableHead>
              <TableHead className="font-bold">NCM</TableHead>
              <TableHead className="font-bold">CFOP</TableHead>
              <TableHead className="font-bold">CST/CSOSN</TableHead>
              <TableHead className="font-bold">CST IBS/CBS</TableHead>
              <TableHead className="font-bold">Origem</TableHead>
              <TableHead className="font-bold text-right">ICMS</TableHead>
              <TableHead className="font-bold text-right">CBS</TableHead>
              <TableHead className="font-bold text-right">IBS</TableHead>
              <TableHead className="font-bold text-center">Situação</TableHead>
              <TableHead className="font-bold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : linhas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  Nenhum perfil de tributação cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              linhas.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{p.name}</span>
                      {p.descricao && (
                        <span className="text-xs text-muted-foreground">{p.descricao}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{p.ncm || "—"}</TableCell>
                  <TableCell className="tabular-nums">{p.cfop || "—"}</TableCell>
                  <TableCell className="tabular-nums">{p.cst_csosn || "—"}</TableCell>
                  <TableCell className="tabular-nums">{p.cst_ibs_cbs || "—"}</TableCell>
                  <TableCell className="tabular-nums">{p.origem}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(p.aliquota_icms)}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.aliquota_cbs > 0 ? `${p.aliquota_cbs}%` : "vigente"}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.aliquota_ibs > 0 ? `${p.aliquota_ibs}%` : "vigente"}</TableCell>
                  <TableCell className="text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      p.ativo
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => abrirEdicao(p)} title="Editar" disabled={!podeEditar}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => excluir(p)} title="Excluir" disabled={!podeEditar || salvando}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600" />
              {form.id ? "Editar perfil" : "Novo perfil de tributação"}
            </DialogTitle>
            <DialogDescription>
              Este perfil é referenciado pelos produtos. Ajuste conforme o
              regime tributário da empresa (Simples: CSOSN; demais: CST).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Nome do perfil *</Label>
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Herbicida — Saída"
                />
              </div>
              <div className="space-y-2">
                <Label>CFOP padrão (saída)</Label>
                <Input
                  value={form.cfop}
                  onChange={(e) => setForm({ ...form, cfop: e.target.value })}
                  placeholder="Ex: 5102"
                  maxLength={4}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Para que serve este perfil"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>NCM</Label>
                <Input
                  value={form.ncm}
                  onChange={(e) => setForm({ ...form, ncm: e.target.value })}
                  placeholder="Ex: 3808.93.19"
                />
              </div>
              <div className="space-y-2">
                <Label>CEST</Label>
                <Input
                  value={form.cest}
                  onChange={(e) => setForm({ ...form, cest: e.target.value })}
                  placeholder="Ex: 20.045.00"
                />
              </div>
              <div className="space-y-2">
                <Label>CST / CSOSN (ICMS)</Label>
                <Input
                  value={form.cst_csosn}
                  onChange={(e) => setForm({ ...form, cst_csosn: e.target.value.toUpperCase() })}
                  placeholder="Ex: 102 (Simples)"
                  maxLength={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Origem (0–8)</Label>
                <Input
                  value={form.origem}
                  onChange={(e) => setForm({ ...form, origem: e.target.value.replace(/\D/g, "").slice(0, 1) })}
                  placeholder="0"
                  maxLength={1}
                />
              </div>
              <div className="space-y-2">
                <Label>CST IBS/CBS</Label>
                <Input
                  value={form.cst_ibs_cbs}
                  onChange={(e) => setForm({ ...form, cst_ibs_cbs: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  placeholder="000"
                  maxLength={3}
                />
                <p className="text-xs text-muted-foreground">
                  Obrigatório na NF-e desde 2026 (000 = tributação integral).
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Reforma Tributária — CBS e IBS (a partir de 01/01/2027)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Percent className="h-3 w-3" />CBS (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.aliquota_cbs || ""}
                    onChange={(e) => setForm({ ...form, aliquota_cbs: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = usar a alíquota vigente do regime. Em 2027-2028: referência do Senado (estimada ~8,8%) menos 0,1 p.p.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Percent className="h-3 w-3" />IBS (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.aliquota_ibs || ""}
                    onChange={(e) => setForm({ ...form, aliquota_ibs: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = usar a alíquota vigente do ente. Em 2027-2028: 0,1% (0,05% estadual + 0,05% municipal).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>cClassTrib</Label>
                  <Input
                    value={form.cclasstrib}
                    onChange={(e) => setForm({ ...form, cclasstrib: e.target.value })}
                    placeholder="Código dos anexos da LC 214"
                  />
                  <p className="text-xs text-muted-foreground">
                    Classificação tributária do NCM nos anexos da LC 214/2025.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Regime anterior — vigente até 31/12/2026 (PIS/COFINS extintos, IPI zerado em 2027)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Percent className="h-3 w-3" />ICMS (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.aliquota_icms || ""}
                    onChange={(e) => setForm({ ...form, aliquota_icms: parseFloat(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Continua até 2032 (ICMS migra para o IBS de 2029 a 2032).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Percent className="h-3 w-3" />IPI (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.aliquota_ipi || ""}
                    onChange={(e) => setForm({ ...form, aliquota_ipi: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Percent className="h-3 w-3" />PIS (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.aliquota_pis || ""}
                    onChange={(e) => setForm({ ...form, aliquota_pis: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Percent className="h-3 w-3" />COFINS (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={form.aliquota_cofins || ""}
                    onChange={(e) => setForm({ ...form, aliquota_cofins: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-2">
                  <Label>Enquadramento IPI</Label>
                  <Input
                    value={form.enquadramento_ipi}
                    onChange={(e) => setForm({ ...form, enquadramento_ipi: e.target.value })}
                    placeholder="Ex: 999"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.ativo}
                      onCheckedChange={(v) => setForm({ ...form, ativo: v === true })}
                    />
                    <span className="text-sm font-medium">Perfil ativo</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">NF-e</Badge>
        Ao emitir a nota, o emissor usa o perfil vinculado ao produto. A partir de
        01/01/2027 o destaque de CBS e IBS é obrigatório (inclusive para o Simples
        Nacional) e PIS/COFINS/IPI deixam de ser cobrados fora da ZFM — os campos
        do regime anterior ficam apenas para histórico.
      </p>
    </div>
  );
}
