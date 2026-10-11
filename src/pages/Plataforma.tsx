import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Loader2, ShieldCheck, Users, MapPin, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Console do vendedor.
 *
 * Um administrador de plataforma não pertence a nenhuma empresa cliente e, por
 * isso, não enxerga nenhum dado operacional. Esta tela mostra apenas metadados
 * — nome, situação, quando a conta foi criada e quantos usuários tem — para
 * decidir a quem liberar e a quem suspender.
 *
 * Suspender não apaga nada: a RLS deixa de liberar o acesso e os dados ficam
 * intactos para quando a empresa for reativada.
 */

interface EmpresaPlataforma {
  id: string;
  nome: string;
  slug: string;
  status: string;
  plan: string;
  documento: string | null;
  criada_em: string;
  usuarios: number;
  filiais: number;
  status_em: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  trial: "Teste",
  active: "Ativa",
  suspended: "Suspensa",
};

const STATUS_CLASS: Record<string, string> = {
  trial: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  suspended: "bg-red-100 text-red-700",
};

export default function Plataforma() {
  const [empresas, setEmpresas] = useState<EmpresaPlataforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<{
    empresa: EmpresaPlataforma;
    novo: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("platform_companies");
    if (error) {
      toast.error(error.message);
    } else {
      setEmpresas((data ?? []) as EmpresaPlataforma[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const alterar = async () => {
    if (!confirmando) return;
    const { empresa, novo } = confirmando;
    setProcessando(empresa.id);
    const { error } = await supabase.rpc("platform_set_company_status", {
      p_company: empresa.id,
      p_status: novo,
    });
    setProcessando(null);
    setConfirmando(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      novo === "suspended"
        ? `Acesso de ${empresa.nome} suspenso.`
        : `${empresa.nome} está ${STATUS_LABEL[novo].toLowerCase()}.`
    );
    await carregar();
  };

  const contagens = {
    ativas: empresas.filter((e) => e.status === "active").length,
    teste: empresas.filter((e) => e.status === "trial").length,
    suspensas: empresas.filter((e) => e.status === "suspended").length,
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading text-foreground flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-emerald-600" />
          Plataforma
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestão das empresas clientes. Aqui você vê apenas metadados — os dados
          de cada empresa não são acessíveis a partir da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Empresas</p>
            <p className="text-3xl font-heading mt-1">{empresas.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ativas</p>
            <p className="text-3xl font-heading mt-1 text-emerald-600">{contagens.ativas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Em teste</p>
            <p className="text-3xl font-heading mt-1 text-amber-600">{contagens.teste}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Suspensas</p>
            <p className="text-3xl font-heading mt-1 text-destructive">{contagens.suspensas}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg overflow-hidden border-none bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-bold">Empresa</TableHead>
              <TableHead className="font-bold">Situação</TableHead>
              <TableHead className="font-bold text-right">Usuários</TableHead>
              <TableHead className="font-bold text-right">Filiais</TableHead>
              <TableHead className="font-bold">Cadastro</TableHead>
              <TableHead className="font-bold text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : empresas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  Nenhuma empresa cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              empresas.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {e.nome}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {e.slug}{e.documento ? ` · ${e.documento}` : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${STATUS_CLASS[e.status] ?? ""}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />{e.usuarios}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />{e.filiais}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(e.criada_em).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {e.status !== "active" && (
                        <Button
                          size="sm" variant="outline"
                          disabled={processando === e.id}
                          onClick={() => setConfirmando({ empresa: e, novo: "active" })}
                        >
                          Liberar
                        </Button>
                      )}
                      {e.status === "trial" && (
                        <Button
                          size="sm" variant="outline"
                          disabled={processando === e.id}
                          onClick={() => setConfirmando({ empresa: e, novo: "active" })}
                        >
                          Aprovar
                        </Button>
                      )}
                      {e.status !== "suspended" && (
                        <Button
                          size="sm" variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          disabled={processando === e.id}
                          onClick={() => setConfirmando({ empresa: e, novo: "suspended" })}
                        >
                          <Power className="h-3.5 w-3.5 mr-1" /> Suspender
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog
        open={!!confirmando}
        onOpenChange={(o) => !o && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmando?.novo === "suspended" ? "Suspender acesso" : "Liberar empresa"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando?.novo === "suspended" ? (
                <>
                  A empresa <strong>{confirmando?.empresa.nome}</strong> perderá o
                  acesso a todos os módulos. Nenhum dado é apagado — o acesso é
                  restabelecido se você suspender a decisão.
                </>
              ) : (
                <>
                  A empresa <strong>{confirmando?.empresa.nome}</strong> voltará a
                  acessar o sistema normalmente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={alterar}>
              {confirmando?.novo === "suspended" ? "Suspender" : "Liberar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}