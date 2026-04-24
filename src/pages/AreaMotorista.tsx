import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAllOS, type OrdemServico } from "@/lib/osStorage";
import { MotoristaPreview } from "@/components/os/MotoristaPreview";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer, FileDown, ArrowLeft, Search } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";

export default function AreaMotorista() {
  const [osList, setOsList] = useState<OrdemServico[]>([]);
  const [selectedOS, setSelectedOS] = useState<OrdemServico | null>(null);
  const [searchId, setSearchId] = useState("");
  const [availableTractors, setAvailableTractors] = useState<string[]>([]);
  const [selectedTractors, setSelectedTractors] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOS();
  }, []);

  const loadOS = async () => {
    const all = await getAllOS();
    // Fetch only OS that are in progress or open
    setOsList(all.filter(os => os.status !== "concluida").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  const handleSelectOS = (os: OrdemServico) => {
    setSelectedOS(os);
    
    // Extract unique tractors from pointers
    const tractors = new Set<string>();
    os.apontamentos?.forEach(ap => {
      if (ap.tratorFrota) tractors.add(ap.tratorFrota);
    });
    
    setAvailableTractors(Array.from(tractors));
    setSelectedTractors([]);
  };

  const toggleTractor = (tractor: string) => {
    setSelectedTractors(prev => 
      prev.includes(tractor) 
        ? prev.filter(t => t !== tractor)
        : [...prev, tractor]
    );
  };

  const handlePrint = () => window.print();

  const handlePDF = async () => {
    if (!printRef.current) return;
    toast.info("Gerando PDF...");
    const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
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

    pdf.save(`Fechamento-Motorista-OS-${selectedOS?.id}.pdf`);
    toast.success("PDF salvo!");
  };

  const filteredOsList = searchId.trim() === "" 
    ? osList 
    : osList.filter(os => os.id.toLowerCase().includes(searchId.toLowerCase()));

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6 no-print">
        <Link to="/">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-heading text-foreground">Área do Motorista</h1>
      </div>

      {!selectedOS ? (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Selecione a Ordem de Serviço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar OS pelo número..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="space-y-3">
              {filteredOsList.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma OS em andamento encontrada.</p>
              ) : (
                filteredOsList.map(os => (
                  <div 
                    key={os.id}
                    onClick={() => handleSelectOS(os)}
                    className="flex justify-between items-center p-4 border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-card"
                  >
                    <div>
                      <p className="font-bold">OS nº {os.id}</p>
                      <p className="text-sm text-muted-foreground">{os.propriedade}</p>
                    </div>
                    <Button variant="outline" size="sm">Selecionar</Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="no-print border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">OS nº {selectedOS.id} - {selectedOS.propriedade}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedOS(null)}>
                  Trocar OS
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {availableTractors.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum trator iniciou apontamento nesta OS ainda.</p>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Selecione o(s) seu(s) Trator(es) para gerar o fechamento:</p>
                  <div className="flex flex-wrap gap-4">
                    {availableTractors.map(tractor => (
                      <div key={tractor} className="flex items-center space-x-2 bg-secondary/50 p-3 rounded-md border">
                        <Checkbox 
                          id={`tr-${tractor}`} 
                          checked={selectedTractors.includes(tractor)}
                          onCheckedChange={() => toggleTractor(tractor)}
                        />
                        <label 
                          htmlFor={`tr-${tractor}`} 
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          Frota: {tractor}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedTractors.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 no-print">
                <Button onClick={handlePrint} variant="default" size="sm">
                  <Printer className="h-4 w-4 mr-2" /> Imprimir Relatório
                </Button>
                <Button onClick={handlePDF} variant="outline" size="sm">
                  <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
                </Button>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <MotoristaPreview 
                  ref={printRef} 
                  os={selectedOS} 
                  tratoresSelecionados={selectedTractors} 
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
