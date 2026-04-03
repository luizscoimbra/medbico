import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Plus, Minus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TalhaoData, ProdutoDose } from "@/lib/osStorage";
import { getAllAreas, AreaCadastro } from "@/lib/areaStorage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OSFormProps {
  propriedade: string;
  setPropriedade: (v: string) => void;
  codigoArea: string;
  setCodigoArea: (v: string) => void;
  dataOS: string;
  setDataOS: (v: string) => void;
  responsavelTecnico: string;
  setResponsavelTecnico: (v: string) => void;
  talhoes: TalhaoData[];
  setTalhoes: (t: TalhaoData[]) => void;
  volumeCaldaHa: string;
  setVolumeCaldaHa: (v: string) => void;
  coordenadas?: string;
  setCoordenadas?: (v: string) => void;
  onGenerate: () => void;
}

interface ProdutoDB {
  commercial_name: string;
  unit: string;
  package_size: number;
}

const emptyProduto = (): ProdutoDose => ({ produto: "", dose: "" });

const emptyTalhao = (): TalhaoData => ({
  nome: "",
  area: "",
  produtos: [emptyProduto()],
  testemunho: false,
  testemunhoArea: "",
  testeProduto: false,
  produtoTeste: "",
  produtoTesteQtd: "",
});

export function OSForm({
  propriedade, setPropriedade,
  codigoArea, setCodigoArea,
  dataOS, setDataOS,
  responsavelTecnico, setResponsavelTecnico,
  talhoes, setTalhoes,
  volumeCaldaHa, setVolumeCaldaHa,
  coordenadas, setCoordenadas,
  onGenerate,
}: OSFormProps) {
  const [produtosDB, setProdutosDB] = useState<ProdutoDB[]>([]);
  const [areasDB, setAreasDB] = useState<AreaCadastro[]>([]);

  useEffect(() => {
    supabase
      .from("registered_products")
      .select("commercial_name, unit, package_size")
      .then(({ data }) => {
        if (data) setProdutosDB(data as ProdutoDB[]);
      });

    getAllAreas().then(setAreasDB);
  }, []);

  const updateTalhao = (index: number, field: keyof TalhaoData, value: any) => {
    const updated = [...talhoes];
    updated[index] = { ...updated[index], [field]: value };
    // Se o testemunho total zera a área, mantemos os produtos caso o usuário queira.
    // Antes apagava a lista, agora vamos manter para permitir área de testemunho parcial.
    setTalhoes(updated);
  };

  const updateProduto = (talhaoIdx: number, prodIdx: number, field: keyof ProdutoDose, value: string) => {
    const updated = [...talhoes];
    const prods = [...updated[talhaoIdx].produtos];
    prods[prodIdx] = { ...prods[prodIdx], [field]: value };

    // Enrich with DB data when selecting a product
    if (field === "produto") {
      const found = produtosDB.find((p) => p.commercial_name === value);
      if (found) {
        prods[prodIdx].unit = found.unit;
        prods[prodIdx].packageSize = found.package_size;
      }
    }

    updated[talhaoIdx] = { ...updated[talhaoIdx], produtos: prods };
    setTalhoes(updated);
  };

  const addProduto = (talhaoIdx: number) => {
    const updated = [...talhoes];
    updated[talhaoIdx] = {
      ...updated[talhaoIdx],
      produtos: [...updated[talhaoIdx].produtos, emptyProduto()],
    };
    setTalhoes(updated);
  };

  const removeProduto = (talhaoIdx: number, prodIdx: number) => {
    const updated = [...talhoes];
    const prods = updated[talhaoIdx].produtos.filter((_, j) => j !== prodIdx);
    updated[talhaoIdx] = { ...updated[talhaoIdx], produtos: prods };
    setTalhoes(updated);
  };

  const addTalhao = () => setTalhoes([...talhoes, emptyTalhao()]);

  const removeTalhao = (i: number) => {
    if (talhoes.length <= 1) return;
    setTalhoes(talhoes.filter((_, idx) => idx !== i));
  };

  const replicarPrimeiro = () => {
    if (talhoes.length <= 1) return;
    const primeiro = talhoes[0];
    setTalhoes(
      talhoes.map((t, i) =>
        i === 0
          ? t
          : { ...t, produtos: primeiro.produtos.map((p) => ({ ...p })) }
      )
    );
  };

  const setQuantidadeTalhoes = (qty: number) => {
    if (qty < 1) return;
    if (qty > talhoes.length) {
      const novos = Array.from({ length: qty - talhoes.length }, () => emptyTalhao());
      setTalhoes([...talhoes, ...novos]);
    } else {
      setTalhoes(talhoes.slice(0, qty));
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados da Propriedade</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Área / Propriedade</Label>
            <Select 
              value={propriedade} 
              onValueChange={(val) => {
                setPropriedade(val);
                const area = areasDB.find(a => a.nome === val);
                if (area) {
                  setCodigoArea(area.codigo || "");
                  if (setCoordenadas && area.coordenadas) {
                    setCoordenadas(area.coordenadas);
                  }
                  const novos = area.talhoes.map(t => ({
                    ...emptyTalhao(),
                    nome: t.numero,
                    area: t.tamanhoHectares.toString()
                  }));
                  setTalhoes(novos.length > 0 ? novos : [emptyTalhao()]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a área..." />
              </SelectTrigger>
              <SelectContent>
                {areasDB.length === 0 && <SelectItem value="nenhuma" disabled>Nenhuma área cadastrada</SelectItem>}
                {areasDB.map(a => <SelectItem key={a.id} value={a.nome}>{a.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Código da Área (Opcional)</Label>
            <Input value={codigoArea} onChange={(e) => setCodigoArea(e.target.value)} placeholder="Ex: A-01" />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={dataOS} onChange={(e) => setDataOS(e.target.value)} />
          </div>
          <div>
            <Label>Responsável Técnico</Label>
            <Input value={responsavelTecnico} onChange={(e) => setResponsavelTecnico(e.target.value)} />
          </div>
          <div>
            <Label>Volume de Calda (L/ha)</Label>
            <Input
              type="number"
              step="1"
              value={volumeCaldaHa}
              onChange={(e) => setVolumeCaldaHa(e.target.value)}
              placeholder="Ex: 150"
            />
          </div>
        </CardContent>
      </Card>

      {/* Talhões */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Talhões</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">Qtd:</Label>
            <Input
              type="number"
              min={1}
              className="w-20"
              value={talhoes.length}
              onChange={(e) => setQuantidadeTalhoes(parseInt(e.target.value) || 1)}
            />
            <Button type="button" variant="outline" size="sm" onClick={addTalhao}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {talhoes.length > 1 && (
            <Button type="button" variant="secondary" size="sm" onClick={replicarPrimeiro}>
              <Copy className="h-4 w-4 mr-2" />
              Replicar produtos do Talhão 1
            </Button>
          )}

          {talhoes.map((t, i) => (
            <Card key={i} className={`border ${t.testemunho ? "border-warning/50 bg-warning/5" : "border-border"}`}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-semibold text-sm">Talhão {i + 1}</span>
                  {talhoes.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTalhao(i)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Nome/Número</Label>
                    <Input value={t.nome} onChange={(e) => updateTalhao(i, "nome", e.target.value)} placeholder="T-01" />
                  </div>
                  <div>
                    <Label className="text-xs">Área (ha)</Label>
                    <Input type="number" step="0.01" value={t.area} onChange={(e) => updateTalhao(i, "area", e.target.value)} />
                  </div>
                </div>

                {/* Produtos - Agora sempre visível para aplicar na área restante */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Produtos e Doses (Área tratada)</Label>
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => addProduto(i)}>
                      <Plus className="h-3 w-3 mr-1" /> Produto
                    </Button>
                  </div>
                  {t.produtos.map((p, j) => (
                    <div key={j} className="flex items-end gap-2">
                      <div className="flex-1">
                        {j === 0 && <Label className="text-xs">Produto</Label>}
                        <Input
                          list={`produtos-list-${i}-${j}`}
                          value={p.produto}
                          onChange={(e) => updateProduto(i, j, "produto", e.target.value)}
                          placeholder="Selecione..."
                        />
                        <datalist id={`produtos-list-${i}-${j}`}>
                          {produtosDB.map((prod) => (
                            <option key={prod.commercial_name} value={prod.commercial_name} />
                          ))}
                        </datalist>
                      </div>
                      <div className="w-28">
                        {j === 0 && <Label className="text-xs">Dose (L/ha)</Label>}
                        <Input
                          type="number"
                          step="0.01"
                          value={p.dose}
                          onChange={(e) => updateProduto(i, j, "dose", e.target.value)}
                        />
                      </div>
                      {t.produtos.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeProduto(i, j)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`testemunho-${i}`}
                      checked={t.testemunho}
                      onCheckedChange={(v) => updateTalhao(i, "testemunho", !!v)}
                    />
                    <Label htmlFor={`testemunho-${i}`} className="text-xs cursor-pointer">Testemunho (sem aplicação)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`teste-${i}`}
                      checked={t.testeProduto}
                      onCheckedChange={(v) => updateTalhao(i, "testeProduto", !!v)}
                    />
                    <Label htmlFor={`teste-${i}`} className="text-xs cursor-pointer">Teste de Produto</Label>
                  </div>
                </div>

                {t.testemunho && (
                  <div className="pl-6 border-l-2 border-warning/50 space-y-2 mt-2">
                    <Label className="text-xs text-warning-foreground">Tamanho da Área de Testemunho (m²)</Label>
                    <div className="flex gap-4 items-center">
                      <Input
                        type="number"
                        placeholder="Ex: 500"
                        value={t.testemunhoArea}
                        onChange={(e) => updateTalhao(i, "testemunhoArea", e.target.value)}
                        className="w-40"
                      />
                      <div className="text-xs text-muted-foreground">
                        Área para aplicação:{" "}
                        <span className="font-semibold text-foreground">
                          {t.area && t.testemunhoArea
                            ? Math.max(0, parseFloat(t.area) - (parseFloat(t.testemunhoArea) / 10000)).toFixed(4)
                            : t.area}
                        </span>{" "}
                        ha
                      </div>
                    </div>
                  </div>
                )}

                {t.testeProduto && (
                  <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-primary/50 mt-2">
                    <div>
                      <Label className="text-xs">Produto em Teste</Label>
                      <Input value={t.produtoTeste} onChange={(e) => updateTalhao(i, "produtoTeste", e.target.value)} placeholder="Nome do produto" />
                    </div>
                    <div>
                      <Label className="text-xs">Quantidade/Dose</Label>
                      <Input value={t.produtoTesteQtd} onChange={(e) => updateTalhao(i, "produtoTesteQtd", e.target.value)} placeholder="Ex: 2 Litros" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Button onClick={onGenerate} size="lg" className="w-full">
        Gerar Ordem de Serviço
      </Button>
    </div>
  );
}
