import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MeasurementProvider } from "@/context/MeasurementContext";
import { Header } from "@/components/Header";
import Index from "./pages/Index";
import NovaMedicao from "./pages/NovaMedicao";
import EntradaDados from "./pages/EntradaDados";
import Resultados from "./pages/Resultados";
import Historico from "./pages/Historico";
import TabelaReferencia from "./pages/TabelaReferencia";
import CadastroProdutos from "./pages/CadastroProdutos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MeasurementProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <Header />
            <main>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/nova-medicao" element={<NovaMedicao />} />
                <Route path="/entrada-dados" element={<EntradaDados />} />
                <Route path="/resultados" element={<Resultados />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="/tabela-referencia" element={<TabelaReferencia />} />
                <Route path="/cadastro-produtos" element={<CadastroProdutos />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </MeasurementProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
