import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OSForm } from "@/components/os/OSForm";
import { OSPreview } from "@/components/os/OSPreview";
import { OSApontamento } from "@/components/os/OSApontamento";
import { OSApontamentoPreview } from "@/components/os/OSApontamentoPreview";
import { generateOSId, saveOS, getAllOS, deleteOS, type OrdemServico as OSType, type TalhaoData } from "@/lib/osStorage";
import { Printer, FileDown, Share2, ArrowLeft, History, ClipboardCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Link } from "react-router-dom";
import { getAllEquipments, Equipment } from "@/lib/equipmentStorage";
import { getAllClientes, Cliente } from "@/lib/clienteStorage";

type View = "form" | "preview" | "history" | "apontamento" | "apontamento-preview";

export default function OrdemServico() {
  const [view, setView] = useState<View>("form");
  const [currentOS, setCurrentOS] = useState<OSType | null>(null);
  const [historico, setHistorico] = useState<OSType[]>([]);
  const printRef = useRef<HTMLDivElement>(null);
  const apontamentoRef = useRef<HTMLDivElement>(null);
  const [equipments, setEquipments] = useState<Equipment[]>([]);

  // Form state
  const [propriedade, setPropriedade] = useState("");
  const [osExterna, setOsExterna] = useState("");
  const [codigoArea, setCodigoArea] = useState("");
  const [dataOS, setDataOS] = useState(new Date().toISOString().slice(0, 10));
  const [responsavelTecnico, setResponsavelTecnico] = useState("");
  const [tipoAplicacao, setTipoAplicacao] = useState("");
  const [codigoAplicacao, setCodigoAplicacao] = useState("");
  const [volumeCaldaHa, setVolumeCaldaHa] = useState("");
  const [coordenadas, setCoordenadas] = useState("");
  const [selectedEquipments, setSelectedEquipments] = useState<string[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [selectedClienteNome, setSelectedClienteNome] = useState("");
  const [talhoes, setTalhoes] = useState<TalhaoData[]>([
    { nome: "", area: "", produtos: [{ produto: "", dose: "" }], testemunho: false, testemunhoArea: "", testeProduto: false, produtoTeste: "", produtoTesteQtd: "" },
  ]);

  useEffect(() => {
    getAllEquipments().then(setEquipments);
    getAllClientes().then(setClientes);
  }, []);

  const handleGenerate = async () => {
    if (!propriedade.trim()) {
      toast.error("Informe o nome da propriedade");
      return;
    }
    const id = await generateOSId();
    const os: OSType = {
      id,
      osExterna: osExterna || undefined,
      data: dataOS,
      propriedade,
      codigoArea,
      responsavelTecnico,
      aplicador: "",
      tipoAplicacao: tipoAplicacao || undefined,
      codigoAplicacao: codigoAplicacao || undefined,
      talhoes,
      createdAt: new Date().toISOString(),
      volumeCaldaHa: volumeCaldaHa || undefined,
      coordenadas,
      status: "aberta",
      equipamentos: selectedEquipments,
      clienteId: selectedClienteId || undefined,
      clienteNome: selectedClienteNome || undefined,
    };
    await saveOS(os);
    setCurrentOS(os);
    setView("preview");
    toast.success(`OS ${id} gerada com sucesso!`);
  };

  const handlePrint = () => window.print();

  const handlePDF = async (targetRef: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!targetRef.current) return;
    toast.info("Gerando PDF...");
    const canvas = await html2canvas(targetRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;

    // Handle multi-page if content is taller than A4
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

    pdf.save(filename);
    toast.success("PDF salvo!");
  };

  const handleShare = async (targetRef: React.RefObject<HTMLDivElement>, title: string) => {
    if (!targetRef.current) return;
    try {
      const canvas = await html2canvas(targetRef.current, { scale: 2, useCORS: true });
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const file = new File([blob], `${title}.png`, { type: "image/png" });

      if (navigator.share) {
        await navigator.share({ title, files: [file] });
      } else {
        toast.error("Compartilhamento não suportado neste navegador");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") toast.error("Erro ao compartilhar");
    }
  };

  const loadHistorico = async () => {
    const all = await getAllOS();
    setHistorico(all);
    setView("history");
  };

  const viewOS = (os: OSType) => {
    setCurrentOS(os);
    setView("preview");
  };

  const handleDeleteOS = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja excluir a OS ${id}?`)) {
      await deleteOS(id);
      const all = await getAllOS();
      setHistorico(all);
      toast.success(`OS ${id} excluída com sucesso!`);
    }
  };

  const resetForm = () => {
    setPropriedade("");
    setOsExterna("");
    setCodigoArea("");
    setDataOS(new Date().toISOString().slice(0, 10));
    setResponsavelTecnico("");
    setTipoAplicacao("");
    setCodigoAplicacao("");
    setVolumeCaldaHa("");
    setCoordenadas("");
    setTalhoes([{ nome: "", area: "", produtos: [{ produto: "", dose: "" }], testemunho: false, testemunhoArea: "", testeProduto: false, produtoTeste: "", produtoTesteQtd: "" }]);
    setSelectedEquipments([]);
    setSelectedClienteId("");
    setSelectedClienteNome("");
    setCurrentOS(null);
    setView("form");
  };

  const ExportButtons = ({ targetRef, filename }: { targetRef: React.RefObject<HTMLDivElement>; filename: string }) => (
    <div className="flex flex-wrap gap-2 mb-4 no-print">
      <Button onClick={handlePrint} variant="outline" size="sm">
        <Printer className="h-4 w-4 mr-1" /> Imprimir
      </Button>
      <Button onClick={() => handlePDF(targetRef, `${filename}.pdf`)} variant="outline" size="sm">
        <FileDown className="h-4 w-4 mr-1" /> Exportar PDF
      </Button>
      <Button onClick={() => handleShare(targetRef, filename)} variant="outline" size="sm">
        <Share2 className="h-4 w-4 mr-1" /> Compartilhar
      </Button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="text-2xl font-heading text-foreground">Ordem de Serviço</h1>
        </div>
        <div className="flex gap-2">
          {view !== "form" && (
            <Button variant="outline" size="sm" onClick={resetForm}>Nova OS</Button>
          )}
          <Button variant="secondary" size="sm" onClick={loadHistorico}>
            <History className="h-4 w-4 mr-1" /> Histórico
          </Button>
        </div>
      </div>

      {/* Form View */}
      {view === "form" && (
        <OSForm
          propriedade={propriedade} setPropriedade={setPropriedade}
          osExterna={osExterna} setOsExterna={setOsExterna}
          codigoArea={codigoArea} setCodigoArea={setCodigoArea}
          dataOS={dataOS} setDataOS={setDataOS}
          responsavelTecnico={responsavelTecnico} setResponsavelTecnico={setResponsavelTecnico}
          tipoAplicacao={tipoAplicacao} setTipoAplicacao={setTipoAplicacao}
          codigoAplicacao={codigoAplicacao} setCodigoAplicacao={setCodigoAplicacao}
          talhoes={talhoes} setTalhoes={setTalhoes}
          volumeCaldaHa={volumeCaldaHa} setVolumeCaldaHa={setVolumeCaldaHa}
          coordenadas={coordenadas} setCoordenadas={setCoordenadas}
          equipamentos={selectedEquipments} setEquipamentos={setSelectedEquipments}
          availableEquipments={equipments}
          clientes={clientes}
          selectedClienteId={selectedClienteId} setSelectedClienteId={setSelectedClienteId}
          selectedClienteNome={selectedClienteNome} setSelectedClienteNome={setSelectedClienteNome}
          onGenerate={handleGenerate}
        />
      )}

      {/* Preview View */}
      {view === "preview" && currentOS && (
        <div>
          <ExportButtons targetRef={printRef} filename={`OS-${currentOS.id}`} />
          <div className="flex gap-2 mb-4 no-print">
            <Button
              onClick={() => setView("apontamento")}
              variant="default"
              size="sm"
            >
              <ClipboardCheck className="h-4 w-4 mr-1" /> Apontamento
            </Button>
          </div>
          <OSPreview ref={printRef} os={currentOS} />
        </div>
      )}

      {/* Apontamento View */}
      {view === "apontamento" && currentOS && (
        <OSApontamento
          os={currentOS}
          onSaved={(updated) => setCurrentOS(updated)}
          onViewReport={() => setView("apontamento-preview")}
        />
      )}

      {/* Apontamento Preview View */}
      {view === "apontamento-preview" && currentOS && (
        <div>
          <ExportButtons targetRef={apontamentoRef} filename={`Apontamento-OS-${currentOS.id}`} />
          <div className="flex gap-2 mb-4 no-print">
            <Button variant="outline" size="sm" onClick={() => setView("apontamento")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao Apontamento
            </Button>
          </div>
          <OSApontamentoPreview ref={apontamentoRef} os={currentOS} equipments={equipments} />
        </div>
      )}

      {/* History View */}
      {view === "history" && (
        <div className="space-y-3">
          {historico.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma OS salva ainda.
              </CardContent>
            </Card>
          ) : (
            historico.map((os) => (
              <Card
                key={os.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => viewOS(os)}
              >
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-heading font-semibold">OS {os.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {os.propriedade} — {os.talhoes.length} talhões
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(os.data).toLocaleDateString("pt-BR")}
                      </p>
                      {os.status && os.status !== "aberta" && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          os.status === "concluida" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {os.status === "concluida" ? "Concluída" : "Em andamento"}
                        </span>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive hover:bg-destructive/10"
                      onClick={(e) => handleDeleteOS(e, os.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
