import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteFornecedor,
  getAllFornecedores,
  saveFornecedor,
  type Fornecedor,
} from "@/lib/fornecedorStorage";

type FormState = { id?: string; nome: string; documento: string; telefone: string; email: string };

const FORM_VAZIO: FormState = { nome: "", documento: "", telefone: "", email: "" };

export function FornecedoresDialog({
  open,
  onOpenChange,
  onAlterado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAlterado?: () => void;
}) {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [excluindo, setExcluindo] = useState<Fornecedor | null>(null);
  const [processando, setProcessando] = useState(false);

  const load = async () => setLista(await getAllFornecedores());

  useEffect(() => {
    if (open) {
      load();
      setForm(FORM_VAZIO);
    }
  }, [open]);

  const salvar = async () => {
    const nome = form.nome.trim();
    if (!nome) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    try {
      await saveFornecedor({
        id: form.id,
        nome,
        documento: form.documento.trim() || undefined,
        telefone: form.telefone.trim() || undefined,
        email: form.email.trim() || undefined,
      });
      toast.success(form.id ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
      setForm(FORM_VAZIO);
      await load();
      onAlterado?.();
    } catch {
      toast.error("Erro ao salvar o fornecedor");
    }
  };

  const editar = (f: Fornecedor) =>
    setForm({
      id: f.id,
      nome: f.nome,
      documento: f.documento || "",
      telefone: f.telefone || "",
      email: f.email || "",
    });

  const excluir = async () => {
    if (!excluindo) return;
    setProcessando(true);
    try {
      await deleteFornecedor(excluindo.id);
      toast.success("Fornecedor excluído");
      setExcluindo(null);
      await load();
      onAlterado?.();
    } catch {
      toast.error("Erro ao excluir o fornecedor");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {form.id ? "Editar fornecedor" : "Fornecedores"}
            </DialogTitle>
            <DialogDescription>
              Cadastro usado para vincular títulos no módulo Contas a Pagar.
            </DialogDescription>
          </DialogHeader>

          {/* Formulário */}
          <div className="border border-border/60 rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="forn-nome">Nome / Razão social *</Label>
                <Input
                  id="forn-nome"
                  placeholder="Ex: Agro Insumos Ltda"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forn-doc">CNPJ / CPF</Label>
                <Input
                  id="forn-doc"
                  placeholder="00.000.000/0000-00"
                  value={form.documento}
                  onChange={(e) => setForm({ ...form, documento: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="forn-tel">Telefone</Label>
                <Input
                  id="forn-tel"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="forn-email">E-mail</Label>
                <Input
                  id="forn-email"
                  type="email"
                  placeholder="contato@fornecedor.com.br"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              {form.id && (
                <Button variant="ghost" size="sm" onClick={() => setForm(FORM_VAZIO)}>
                  Cancelar edição
                </Button>
              )}
              <Button size="sm" onClick={salvar}>
                <Plus className="h-4 w-4 mr-1" />
                {form.id ? "Salvar alterações" : "Adicionar"}
              </Button>
            </div>
          </div>

          {/* Lista */}
          {lista.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground italic">
              Nenhum fornecedor cadastrado.
            </div>
          ) : (
            <div className="border border-border/60 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Nome</th>
                    <th className="px-3 py-2 text-left font-semibold">CNPJ / CPF</th>
                    <th className="px-3 py-2 text-left font-semibold">Telefone</th>
                    <th className="px-3 py-2 text-center font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lista.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <p className="font-medium">{f.nome}</p>
                        {f.email && (
                          <p className="text-[11px] text-muted-foreground">{f.email}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {f.documento || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {f.telefone || "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            className="h-8 w-8"
                            onClick={() => editar(f)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setExcluindo(f)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(open) => !open && !processando && setExcluindo(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Excluir fornecedor
            </AlertDialogTitle>
            <AlertDialogDescription>
              Excluir o fornecedor "{excluindo?.nome}" do cadastro? Os títulos já criados
              mantêm o nome gravado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={processando}>
              Voltar
            </Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:opacity-90"
              onClick={excluir}
              disabled={processando}
            >
              {processando ? "Processando..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
