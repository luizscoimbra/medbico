import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building, Loader2, MapPin, Percent } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  saveCompanyFiscal,
  type CompanyFiscalInput,
} from "@/lib/companyStorage";

const REGIMES = [
  { value: "simples", label: "Simples Nacional" },
  { value: "mei", label: "MEI" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "produtor_rural", label: "Produtor Rural" },
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const VAZIO: CompanyFiscalInput = {
  document: "",
  razao_social: "",
  nome_fantasia: "",
  ie: "",
  im: "",
  regime_tributario: "",
  cnae: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  municipio: "",
  uf: "",
  cep: "",
  telefone: "",
  email: "",
};

/**
 * Cadastro fiscal da Matriz.
 *
 * A empresa nasce com apenas `document`; aqui o administrador master completa
 * razão social, inscrições, regime e endereço — dados exigidos para notas e
 * para identificar o produtor rural. A gravação é via RPC (ver
 * update_company_fiscal) porque `companies` não tem policy de UPDATE.
 */
export default function Empresa() {
  const { company, profile, loading: carregandoAuth } = useAuth();
  const [form, setForm] = useState<CompanyFiscalInput>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = profile?.role === "master";

  useEffect(() => {
    if (!company) return;
    setForm({
      document: company.document ?? "",
      razao_social: company.razao_social ?? "",
      nome_fantasia: company.nome_fantasia ?? "",
      ie: company.ie ?? "",
      im: company.im ?? "",
      regime_tributario: company.regime_tributario ?? "",
      cnae: company.cnae ?? "",
      logradouro: company.logradouro ?? "",
      numero: company.numero ?? "",
      complemento: company.complemento ?? "",
      bairro: company.bairro ?? "",
      municipio: company.municipio ?? "",
      uf: company.uf ?? "",
      cep: company.cep ?? "",
      telefone: company.telefone ?? "",
      email: company.email ?? "",
    });
  }, [company]);

  const set = (campo: keyof CompanyFiscalInput, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async () => {
    if (!form.razao_social.trim() && !form.nome_fantasia.trim()) {
      toast.error("Informe a razão social ou o nome fantasia");
      return;
    }
    setSalvando(true);
    try {
      await saveCompanyFiscal(form);
      toast.success("Cadastro da empresa salvo!");
      window.location.reload();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  if (carregandoAuth) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
            <Building className="h-8 w-8 text-emerald-600" />
            Cadastro da Empresa
          </h1>
          <p className="text-muted-foreground mt-1">
            Dados fiscais da Matriz <strong>{company?.name ?? ""}</strong> —
            usados em documentos, notas e identificação do produtor.
          </p>
        </div>
        <Button
          onClick={salvar}
          disabled={salvando || !podeEditar}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </div>

      {!podeEditar && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          Somente o administrador master da empresa pode alterar o cadastro fiscal.
        </p>
      )}

      <div className="space-y-6">
        <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-600" />
              Identificação
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Razão social</Label>
              <Input
                value={form.razao_social}
                onChange={(e) => set("razao_social", e.target.value)}
                disabled={!podeEditar}
                placeholder="Ex: Agropecuária Silva Ltda"
              />
            </div>
            <div className="space-y-2">
              <Label>Nome fantasia</Label>
              <Input
                value={form.nome_fantasia}
                onChange={(e) => set("nome_fantasia", e.target.value)}
                disabled={!podeEditar}
                placeholder="Ex: Fazenda Santa Rita"
              />
            </div>
            <div className="space-y-2">
              <Label>CNPJ / CPF</Label>
              <Input
                value={form.document}
                onChange={(e) => set("document", e.target.value)}
                disabled={!podeEditar}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>CNAE</Label>
              <Input
                value={form.cnae}
                onChange={(e) => set("cnae", e.target.value)}
                disabled={!podeEditar}
                placeholder="Ex: 0115-2/00"
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual (IE)</Label>
              <Input
                value={form.ie}
                onChange={(e) => set("ie", e.target.value)}
                disabled={!podeEditar}
                placeholder="Ex: ISENTO"
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Municipal (IM)</Label>
              <Input
                value={form.im}
                onChange={(e) => set("im", e.target.value)}
                disabled={!podeEditar}
              />
            </div>
            <div className="space-y-2">
              <Label>Regime tributário</Label>
              <Select
                value={form.regime_tributario || undefined}
                onValueChange={(v) => set("regime_tributario", v)}
                disabled={!podeEditar}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o regime" />
                </SelectTrigger>
                <SelectContent>
                  {REGIMES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                disabled={!podeEditar}
                placeholder="fiscal@empresa.com.br"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                disabled={!podeEditar}
                placeholder="(00) 00000-0000"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg border-none bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Endereço da sede
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-4 space-y-2">
              <Label>Logradouro</Label>
              <Input
                value={form.logradouro}
                onChange={(e) => set("logradouro", e.target.value)}
                disabled={!podeEditar}
                placeholder="Rua, avenida, rodovia..."
              />
            </div>
            <div className="md:col-span-1 space-y-2">
              <Label>Número</Label>
              <Input
                value={form.numero}
                onChange={(e) => set("numero", e.target.value)}
                disabled={!podeEditar}
              />
            </div>
            <div className="md:col-span-1 space-y-2">
              <Label>CEP</Label>
              <Input
                value={form.cep}
                onChange={(e) => set("cep", e.target.value)}
                disabled={!podeEditar}
                placeholder="00000-000"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Complemento</Label>
              <Input
                value={form.complemento}
                onChange={(e) => set("complemento", e.target.value)}
                disabled={!podeEditar}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Bairro</Label>
              <Input
                value={form.bairro}
                onChange={(e) => set("bairro", e.target.value)}
                disabled={!podeEditar}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Município</Label>
              <Input
                value={form.municipio}
                onChange={(e) => set("municipio", e.target.value)}
                disabled={!podeEditar}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>UF</Label>
              <Select
                value={form.uf || undefined}
                onValueChange={(v) => set("uf", v)}
                disabled={!podeEditar}
              >
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Percent className="h-3 w-3" />
          Regime tributário e inscrições aparecem nos relatórios fiscais; o
          endereço identifica a sede nas ordens de serviço.
        </p>
      </div>
    </div>
  );
}
