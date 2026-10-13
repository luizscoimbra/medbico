import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSetting, setSetting, SETTINGS_KEYS } from "@/lib/settingsStorage";
import { fetchTaxProfiles, TaxProfile } from "@/lib/taxProfilesStorage";
import { ProdutoAgrofitInput } from "@/components/receituario/ProdutoAgrofitInput";
import { formulacaoSincronizada } from "@/lib/fieldVisitStorage";
import { Textarea } from "@/components/ui/textarea";

const FORMULACOES_PADRAO = [
  { value: "CORRETIVO", label: "CORRETIVO — Adjuvante Corretivo (pH, quelatizante)" },
  { value: "SG", label: "SG — Granulado Solúvel" },
  { value: "SP", label: "SP — Pó Solúvel" },
  { value: "WP", label: "WP — Pó Molhável" },
  { value: "WG", label: "WG — Granulado Dispersível" },
  { value: "CS", label: "CS — Suspensão de Encapsulado" },
  { value: "SC", label: "SC — Suspensão Concentrada" },
  { value: "OD", label: "OD — Dispersão de Óleo" },
  { value: "SE", label: "SE — Suspo-Emulsão" },
  { value: "EC", label: "EC — Concentrado Emulsionável" },
  { value: "ADJ", label: "ADJ — Adjuvante em Óleo" },
  { value: "EO", label: "EO — Emulsão de Água em Óleo" },
  { value: "EW", label: "EW — Emulsão de Óleo em Água" },
  { value: "ME", label: "ME — Microemulsão" },
  { value: "SL", label: "SL — Concentrado Solúvel" },
  { value: "SURFACTANTE", label: "SURFACTANTE — Adjuvante Surfactante (Espalhante)" },
  { value: "FOLIARE", label: "FOLIARE — Fertilizante Foliar" },
  { value: "REDUTOR", label: "REDUTOR — Adjuvante Redutor de Espuma" },
];

const formVazio = () => ({
  commercial_name: "",
  formulation: "SL",
  unit: "L",
  package_size: "",
  preco_unitario: "",
  preco_galao: "",
  tax_profile_saida_id: "",
  tax_profile_entrada_id: "",
  nr_registro_mapa: "",
  agrofit_formulacao: "",
  ingredientes_ativos: "",
});

/**
 * Popup de cadastro de produto (registered_products).
 *
 * Mesmo formulário da aba Produtos do módulo Cadastros — nome, formulação,
 * unidade, embalagem, preços e vínculo com a Central de Tributação — usado
 * pelo Estoque para cadastrar sem sair da tela.
 */
export function CadastrarProdutoDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado após gravar com sucesso (para a tela chamadora recarregar a lista). */
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(formVazio());
  const [salvando, setSalvando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([]);
  const [customFormulations, setCustomFormulations] = useState<{ value: string; label: string }[]>([]);
  const [novaFormulacao, setNovaFormulacao] = useState({ value: "", label: "" });
  const [formulaDialogAberto, setFormulaDialogAberto] = useState(false);

  const allFormulations = [...FORMULACOES_PADRAO, ...customFormulations];

  useEffect(() => {
    if (!open) return;
    setForm(formVazio());
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    fetchTaxProfiles().then(setTaxProfiles).catch(() => setTaxProfiles([]));
    getSetting<{ value: string; label: string }[]>(SETTINGS_KEYS.customFormulations, [])
      .then(setCustomFormulations)
      .catch(() => setCustomFormulations([]));
  }, [open]);

  const adicionarFormula = () => {
    const code = novaFormulacao.value.trim().toUpperCase();
    const desc = novaFormulacao.label.trim();
    if (!code || !desc) {
      toast.error("Preencha a sigla e a descrição");
      return;
    }
    if (allFormulations.some((f) => f.value === code)) {
      toast.error("Essa sigla já existe");
      return;
    }
    const updated = [...customFormulations, { value: code, label: `${code} - ${desc}` }];
    setCustomFormulations(updated);
    setSetting(SETTINGS_KEYS.customFormulations, updated).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Falha ao salvar a formulação.")
    );
    setForm((p) => ({ ...p, formulation: code }));
    setNovaFormulacao({ value: "", label: "" });
    setFormulaDialogAberto(false);
    toast.success("Formulação adicionada!");
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error("Faça login para cadastrar produtos");
      return;
    }
    const size = parseFloat(form.package_size);
    if (!form.commercial_name.trim() || isNaN(size) || size <= 0) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.from("registered_products").insert({
      commercial_name: form.commercial_name.trim(),
      formulation: form.formulation,
      unit: form.unit,
      package_size: size,
      preco_unitario: parseFloat(form.preco_unitario) || 0,
      tax_profile_saida_id: form.tax_profile_saida_id || null,
      tax_profile_entrada_id: form.tax_profile_entrada_id || null,
      nr_registro_mapa: form.nr_registro_mapa.trim(),
      agrofit_formulacao: form.agrofit_formulacao.trim(),
      ingredientes_ativos: form.ingredientes_ativos.trim(),
      user_id: userId,
    });
    setSalvando(false);

    if (error) {
      toast.error("Erro ao cadastrar produto: " + (error.message || "Erro desconhecido"));
      return;
    }
    toast.success("Produto cadastrado com sucesso!");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Cadastrar Produto
            </DialogTitle>
            <DialogDescription>
              Cadastro comercial do insumo usado no estoque, nas medições e nas
              ordens de serviço. A tributação vem da Central de Tributação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={salvar} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pop_prod_name">Nome Comercial *</Label>
                <ProdutoAgrofitInput
                  id="pop_prod_name"
                  autoFocus
                  placeholder="Ex: Roundup Original (busca na base Agrofit)"
                  value={form.commercial_name}
                  onTextoChange={(texto) => setForm((p) => ({ ...p, commercial_name: texto }))}
                  onSelecionar={(prod) =>
                    setForm((p) => ({
                      ...p,
                      commercial_name: prod.marcaComercial,
                      nr_registro_mapa: prod.nrRegistro || "",
                      agrofit_formulacao: prod.formulacao || "",
                      ingredientes_ativos: prod.ingredienteAtivo || "",
                      formulation: formulacaoSincronizada(prod.formulacao, p.formulation, allFormulations),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pop_prod_form">Formulação *</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.formulation}
                    onValueChange={(v) => setForm((p) => ({ ...p, formulation: v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allFormulations.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={formulaDialogAberto} onOpenChange={setFormulaDialogAberto}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="icon" title="Adicionar formulação">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Nova Formulação</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="pop_form_code">Sigla *</Label>
                          <Input
                            id="pop_form_code"
                            placeholder="Ex: ME"
                            maxLength={6}
                            value={novaFormulacao.value}
                            onChange={(e) => setNovaFormulacao((p) => ({ ...p, value: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pop_form_desc">Descrição *</Label>
                          <Input
                            id="pop_form_desc"
                            placeholder="Ex: Microemulsão"
                            value={novaFormulacao.label}
                            onChange={(e) => setNovaFormulacao((p) => ({ ...p, label: e.target.value }))}
                          />
                        </div>
                        <Button type="button" onClick={adicionarFormula} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pop_prod_unit">Unidade *</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => setForm((p) => ({ ...p, unit: v }))}
                >
                  <SelectTrigger id="pop_prod_unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Litros (L)</SelectItem>
                    <SelectItem value="KG">Quilogramas (KG)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pop_prod_size">Tamanho da Embalagem *</Label>
                <Input
                  id="pop_prod_size"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex: 5"
                  value={form.package_size}
                  onChange={(e) => setForm((p) => ({ ...p, package_size: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Peso (KG) ou Volume (L) da embalagem
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pop_prod_preco">Valor por Litro/KG (R$)</Label>
                <Input
                  id="pop_prod_preco"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 9.18"
                  value={form.preco_unitario}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pkg = parseFloat(form.package_size) || 0;
                    const numVal = parseFloat(val) || 0;
                    setForm((p) => ({
                      ...p,
                      preco_unitario: val,
                      preco_galao: val && pkg > 0 ? (numVal * pkg).toFixed(2) : "",
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pop_prod_galao">Valor do Galão (R$)</Label>
                <Input
                  id="pop_prod_galao"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 45.90"
                  value={form.preco_galao}
                  onChange={(e) => {
                    const val = e.target.value;
                    const pkg = parseFloat(form.package_size) || 0;
                    const numVal = parseFloat(val) || 0;
                    setForm((p) => ({
                      ...p,
                      preco_galao: val,
                      preco_unitario: val && pkg > 0 ? (numVal / pkg).toFixed(4) : "",
                    }));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Preenchimento automático baseado no tamanho da embalagem
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Dados da base oficial Agrofit/MAPA — busque pelo nome no campo
                "Nome Comercial" para preencher automaticamente.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pop_prod_reg_mapa">Registro MAPA</Label>
                  <Input
                    id="pop_prod_reg_mapa"
                    placeholder="Ex: 13408"
                    value={form.nr_registro_mapa}
                    onChange={(e) => setForm((p) => ({ ...p, nr_registro_mapa: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="pop_prod_form_agrofit">Formulação oficial (Agrofit)</Label>
                  <Input
                    id="pop_prod_form_agrofit"
                    placeholder="Ex: SL - Concentrado Solúvel"
                    value={form.agrofit_formulacao}
                    onChange={(e) => {
                      const texto = e.target.value;
                      setForm((p) => ({
                        ...p,
                        agrofit_formulacao: texto,
                        formulation: formulacaoSincronizada(texto, p.formulation, allFormulations),
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="pop_prod_ingredientes">Ingredientes ativos (descrição do produto)</Label>
                  <Textarea
                    id="pop_prod_ingredientes"
                    rows={2}
                    placeholder="Ex: 2,4-D (ácido 2,4-diclorofenoxiacético) + piclorama"
                    value={form.ingredientes_ativos}
                    onChange={(e) => setForm((p) => ({ ...p, ingredientes_ativos: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/40">
              <div className="space-y-2">
                <Label htmlFor="pop_prod_trib_saida">Tributação — Saída (venda/NF-e)</Label>
                <Select
                  value={form.tax_profile_saida_id || "sem"}
                  onValueChange={(v) => setForm((p) => ({ ...p, tax_profile_saida_id: v === "sem" ? "" : v }))}
                >
                  <SelectTrigger id="pop_prod_trib_saida">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Sem perfil de saída</SelectItem>
                    {taxProfiles.filter((t) => t.ativo).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.ncm ? ` — NCM ${t.ncm}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pop_prod_trib_entrada">Tributação — Entrada (compra)</Label>
                <Select
                  value={form.tax_profile_entrada_id || "sem"}
                  onValueChange={(v) => setForm((p) => ({ ...p, tax_profile_entrada_id: v === "sem" ? "" : v }))}
                >
                  <SelectTrigger id="pop_prod_trib_entrada">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sem">Sem perfil de entrada</SelectItem>
                    {taxProfiles.filter((t) => t.ativo).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.ncm ? ` — NCM ${t.ncm}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando} className="bg-emerald-600 hover:bg-emerald-700">
                {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cadastrar Produto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
