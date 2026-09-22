import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Plus, Minus, X, History as HistoryIcon, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TalhaoData, ProdutoDose, OrdemServico, ServicoOS } from "@/lib/osStorage";
import type { Cliente } from "@/lib/clienteStorage";
import { getAllOS, MOTIVO_PARADA_LABELS } from "@/lib/osStorage";
import { getAllAreas, AreaCadastro } from "@/lib/areaStorage";
import { getAllTiposAplicacao, TipoAplicacao } from "@/lib/applicationTypeStorage";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface OSFormProps {
  propriedade: string;
  setPropriedade: (v: string) => void;
  codigoArea: string;
  setCodigoArea: (v: string) => void;
  osExterna: string;
  setOsExterna: (v: string) => void;
  dataOS: string;
  setDataOS: (v: string) => void;
  responsavelTecnico: string;
  setResponsavelTecnico: (v: string) => void;
  tipoAplicacao: string;
  setTipoAplicacao: (v: string) => void;
  codigoAplicacao: string;
  setCodigoAplicacao: (v: string) => void;
  talhoes: TalhaoData[];
  setTalhoes: (t: TalhaoData[]) => void;
  volumeCaldaHa: string;
  setVolumeCaldaHa: (v: string) => void;
  coordenadas?: string;
  setCoordenadas?: (v: string) => void;
  equipamentos?: string[];
  setEquipamentos: (v: string[]) => void;
  availableEquipments: any[];
  clientes: Cliente[];
  selectedClienteId: string;
  setSelectedClienteId: (v: string) => void;
  selectedClienteNome: string;
  setSelectedClienteNome: (v: string) => void;
  servicosDisponiveis: any[];
  servicosOS: ServicoOS[];
  setServicosOS: (v: ServicoOS[]) => void;
  onGenerate: () => void;
}

interface ProdutoDB {
  commercial_name: string;
  unit: string;
  package_size: number;
  preco_unitario?: number;
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
  osExterna, setOsExterna,
  codigoArea, setCodigoArea,
  dataOS, setDataOS,
  responsavelTecnico, setResponsavelTecnico,
  tipoAplicacao, setTipoAplicacao,
  codigoAplicacao, setCodigoAplicacao,
  talhoes, setTalhoes,
  volumeCaldaHa, setVolumeCaldaHa,
  coordenadas, setCoordenadas,
  equipamentos = [], setEquipamentos,
  availableEquipments,
  clientes,
  selectedClienteId, setSelectedClienteId,
  selectedClienteNome, setSelectedClienteNome,
  servicosDisponiveis,
  servicosOS, setServicosOS,
  onGenerate,
}: OSFormProps) {
  const [produtosDB, setProdutosDB] = useState<ProdutoDB[]>([]);
  const [areasDB, setAreasDB] = useState<AreaCadastro[]>([]);
  const [tiposAplicacaoDB, setTiposAplicacaoDB] = useState<TipoAplicacao[]>([]);
  const [allPastOS, setAllPastOS] = useState<OrdemServico[]>([]);
  const [historyTalhaoIndex, setHistoryTalhaoIndex] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("registered_products")
      .select("*")
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao buscar produtos:", error.message);
          return;
        }
        if (data) setProdutosDB(data as ProdutoDB[]);
      });

    getAllAreas().then(setAreasDB);
    getAllTiposAplicacao().then(setTiposAplicacaoDB);
    getAllOS().then(setAllPastOS);
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
          <div className="sm:col-span-2">
            <Label>Cliente (Opcional)</Label>
            <Select
              value={selectedClienteId}
              onValueChange={(val) => {
                setSelectedClienteId(val);
                const cliente = clientes.find(c => c.id === val);
                setSelectedClienteNome(cliente ? (cliente.tipo === "pessoa_fisica" ? cliente.nomeCompleto || "" : cliente.nomeFantasia || cliente.razaoSocial || "") : "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clientes.length === 0 && <SelectItem value="nenhum" disabled>Nenhum cliente cadastrado</SelectItem>}
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tipo === "pessoa_fisica" ? c.nomeCompleto : (c.nomeFantasia || c.razaoSocial)}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({c.tipo === "pessoa_fisica" ? "PF" : "PJ"})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
            <Label>Número OS externa (Opcional)</Label>
            <Input value={osExterna} onChange={(e) => setOsExterna(e.target.value)} placeholder="Ex: 12345" />
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
            <Label>Tipo de Aplicação</Label>
            <Select
              value={tipoAplicacao}
              onValueChange={(val) => {
                setTipoAplicacao(val);
                const tipo = tiposAplicacaoDB.find(t => t.nome === val);
                if (tipo) setCodigoAplicacao(tipo.codigo);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {tiposAplicacaoDB.length === 0 && <SelectItem value="nenhum" disabled>Nenhum tipo cadastrado</SelectItem>}
                {tiposAplicacaoDB.map(t => (
                  <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Código da Aplicação</Label>
            <Input value={codigoAplicacao} onChange={(e) => setCodigoAplicacao(e.target.value)} placeholder="Preenchido automaticamente" />
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

          <div className="sm:col-span-2 space-y-2 border-t pt-4">
            <Label className="text-sm font-semibold flex items-center gap-2">
              Equipamentos Vinculados
              <span className="text-[10px] font-normal text-muted-foreground">(Selecione um ou mais)</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-lg border border-dashed border-border">
              {availableEquipments.map((eq) => (
                <div key={eq.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`eq-${eq.id}`} 
                    checked={equipamentos.includes(eq.fleet_number)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setEquipamentos([...equipamentos, eq.fleet_number]);
                      } else {
                        setEquipamentos(equipamentos.filter(id => id !== eq.fleet_number));
                      }
                    }}
                  />
                  <label 
                    htmlFor={`eq-${eq.id}`} 
                    className="text-xs font-medium leading-none cursor-pointer"
                  >
                    {eq.fleet_number}
                    <span className="block text-[9px] text-muted-foreground font-normal">
                      {eq.equipment_model}
                    </span>
                  </label>
                </div>
              ))}
              {availableEquipments.length === 0 && (
                <p className="col-span-full text-xs text-muted-foreground italic py-2">
                  Nenhum equipamento cadastrado.
                </p>
              )}
            </div>
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
                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setHistoryTalhaoIndex(i)}
                      className="h-8 text-xs text-muted-foreground hover:text-primary"
                    >
                      <HistoryIcon className="h-3.5 w-3.5 mr-1" /> Histórico
                    </Button>
                    {talhoes.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTalhao(i)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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

      {/* Serviços da OS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Serviços</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => {
            setServicosOS([...servicosOS, { servicoId: "", codigo: "", descricao: "", quantidade: 1, valorUnitario: 0, valorTotal: 0 }]);
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Serviço
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {servicosOS.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nenhum serviço adicionado. Clique em "Adicionar Serviço" para incluir.</p>
          )}
          {servicosOS.map((s, idx) => (
            <div key={idx} className="flex items-end gap-2 border rounded-lg p-3 bg-muted/10">
              <div className="flex-1 min-w-0">
                <Label className="text-xs">Serviço</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={s.servicoId}
                  onChange={(e) => {
                    const selected = servicosDisponiveis.find(srv => srv.id === e.target.value);
                    const updated = [...servicosOS];
                    if (selected) {
                      updated[idx] = {
                        servicoId: selected.id,
                        codigo: selected.codigo,
                        descricao: selected.descricao,
                        quantidade: updated[idx].quantidade || 1,
                        valorUnitario: selected.preco_unitario || 0,
                        valorTotal: (updated[idx].quantidade || 1) * (selected.preco_unitario || 0),
                      };
                    } else {
                      updated[idx] = { servicoId: "", codigo: "", descricao: "", quantidade: 1, valorUnitario: 0, valorTotal: 0 };
                    }
                    setServicosOS(updated);
                  }}
                >
                  <option value="">Selecione um serviço...</option>
                  {servicosDisponiveis.map(srv => (
                    <option key={srv.id} value={srv.id}>{srv.codigo} - {srv.descricao}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <Label className="text-xs">Qtd.</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={s.quantidade || ""}
                  onChange={(e) => {
                    const qty = parseFloat(e.target.value) || 0;
                    const updated = [...servicosOS];
                    updated[idx] = { ...updated[idx], quantidade: qty, valorTotal: qty * updated[idx].valorUnitario };
                    setServicosOS(updated);
                  }}
                />
              </div>
              <div className="w-28">
                <Label className="text-xs">Valor Unit.</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={s.valorUnitario || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const updated = [...servicosOS];
                    updated[idx] = { ...updated[idx], valorUnitario: val, valorTotal: updated[idx].quantidade * val };
                    setServicosOS(updated);
                  }}
                />
              </div>
              <div className="w-28">
                <Label className="text-xs">Subtotal</Label>
                <div className="h-9 flex items-center text-sm font-semibold">
                  R$ {(s.valorTotal || 0).toFixed(2)}
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => {
                setServicosOS(servicosOS.filter((_, j) => j !== idx));
              }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {servicosOS.length > 0 && (
            <div className="flex justify-end pt-2 border-t">
              <div className="text-sm">
                Total Serviços: <span className="font-bold">R$ {servicosOS.reduce((sum, s) => sum + (s.valorTotal || 0), 0).toFixed(2)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={onGenerate} size="lg" className="w-full">
        Gerar Ordem de Serviço
      </Button>

      <Dialog open={historyTalhaoIndex !== null} onOpenChange={(open) => !open && setHistoryTalhaoIndex(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="h-5 w-5" />
              Histórico de Aplicação: {historyTalhaoIndex !== null && (talhoes[historyTalhaoIndex]?.nome || `Talhão ${historyTalhaoIndex + 1}`)}
            </DialogTitle>
            <DialogDescription>
              Resumo histórico de aplicações anteriores para este talhão.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {historyTalhaoIndex !== null && (() => {
              const currentTalhaoName = talhoes[historyTalhaoIndex]?.nome;
              if (!currentTalhaoName) return <p className="text-center text-sm text-muted-foreground">Nome do talhão não definido.</p>;

              // Filtrar todos os apontamentos de todas as OS passadas que batem com esse nome de talhão
              const historyRecords = allPastOS.flatMap(oldOS => {
                const oldTalhoes = oldOS.talhoes || [];
                const oldAps = oldOS.apontamentos || [];
                
                return oldAps
                  .filter(ap => {
                    const t = oldTalhoes[ap.talhaoIndex];
                    return t && t.nome === currentTalhaoName;
                  })
                  .map(ap => ({ ...ap, osId: oldOS.id, osData: oldOS.data, talhaoConfig: oldTalhoes[ap.talhaoIndex] }));
              });

              if (historyRecords.length === 0) {
                return <div className="text-center py-8 text-muted-foreground italic text-sm">Nenhum histórico encontrado para o talhão "{currentTalhaoName}".</div>;
              }

              return historyRecords.sort((a, b) => b.osData.localeCompare(a.osData)).map((rec, idx) => (
                <div key={idx} className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex justify-between items-start border-b border-border pb-2">
                    <div>
                      <p className="text-sm font-bold text-primary">OS #{rec.osId}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {rec.osData} às {rec.horaRegistro || "N/I"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{rec.tratorFrota || "Trator N/I"}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{rec.aplicador || "Operador N/I"}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="bg-white p-2 rounded border border-border">
                      <p className="text-[10px] text-muted-foreground uppercase">Área</p>
                      <p className="font-bold">{rec.areaAplicada || "0.00"} ha</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-border">
                      <p className="text-[10px] text-muted-foreground uppercase">Sobra Utilizada</p>
                      <p className="font-bold text-green-600">{rec.sobraUtilizada || "0"} L</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-border">
                      <p className="text-[10px] text-muted-foreground uppercase">Sobra Gerada</p>
                      <p className="font-bold text-amber-600">{rec.caldaRestante || "0"} L</p>
                    </div>
                    <div className="bg-white p-2 rounded border border-border text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Status</p>
                      <p className={`font-bold text-[10px] ${rec.statusRegistro === "interrompido" ? "text-red-600" : "text-blue-600"}`}>
                        {rec.statusRegistro === "interrompido" ? "INTERROMPIDO" : "CONCLUÍDO"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Produtos Aplicados:</p>
                    <div className="flex flex-wrap gap-2">
                      {rec.talhaoConfig.produtos.map((p, pIdx) => (
                        <span key={pIdx} className="bg-blue-50 text-blue-800 text-[10px] px-2 py-0.5 rounded border border-blue-100">
                          {p.produto}: <strong>{p.dose}{p.unit}/ha</strong>
                        </span>
                      ))}
                    </div>
                  </div>

                  {rec.observacoes && (
                    <div className="text-[11px] text-gray-600 bg-gray-100 p-2 rounded italic">
                      <strong>Notas:</strong> {rec.observacoes}
                    </div>
                  )}

                  {rec.statusRegistro === "interrompido" && (
                    <div className="text-[11px] bg-red-50 text-red-700 p-2 rounded border border-red-100 font-medium">
                      ⚠ Interrupção: {rec.motivoParada && MOTIVO_PARADA_LABELS[rec.motivoParada]}
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
          <DialogFooter>
            <Button onClick={() => setHistoryTalhaoIndex(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
