import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MeasurementProvider } from "@/context/MeasurementContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { Sidebar } from "@/components/Sidebar";
import Index from "./pages/Index";
import NovaMedicao from "./pages/NovaMedicao";
import EntradaDados from "./pages/EntradaDados";
import Resultados from "./pages/Resultados";
import Historico from "./pages/Historico";
import TabelaReferencia from "./pages/TabelaReferencia";
import CadastroProdutos from "./pages/CadastroProdutos";
import Cadastros from "./pages/Cadastros";
import CalculadoraCalda from "./pages/CalculadoraCalda";
import AferirVazao from "./pages/AferirVazao";
import OrdemServico from "./pages/OrdemServico";
import Frotas from "./pages/Frotas";
import Acessos from "./pages/Acessos";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AreaMotorista from "./pages/AreaMotorista";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

function AppLayout() {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Main content area */}
      <div
        className="main-content-area min-h-screen pt-14 md:pt-0 transition-[margin] duration-300 ease-out"
        style={{
          marginLeft: `var(--sidebar-offset, 0px)`,
        }}
      >
        {/* CSS custom property set via media query + collapsed state */}
        <style>{`
          @media (min-width: 768px) {
            .main-content-area {
              --sidebar-offset: ${collapsed ? "72px" : "256px"};
            }
          }
        `}</style>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/nova-medicao" element={<ProtectedRoute><NovaMedicao /></ProtectedRoute>} />
            <Route path="/entrada-dados" element={<ProtectedRoute><EntradaDados /></ProtectedRoute>} />
            <Route path="/resultados" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute><Historico /></ProtectedRoute>} />
            <Route path="/tabela-referencia" element={<ProtectedRoute><TabelaReferencia /></ProtectedRoute>} />
            <Route path="/cadastro-produtos" element={<ProtectedRoute><CadastroProdutos /></ProtectedRoute>} />
            <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
            <Route path="/calculadora-calda" element={<ProtectedRoute><CalculadoraCalda /></ProtectedRoute>} />
            <Route path="/aferir-vazao" element={<ProtectedRoute><AferirVazao /></ProtectedRoute>} />
            <Route path="/ordem-servico" element={<ProtectedRoute><OrdemServico /></ProtectedRoute>} />
            <Route path="/area-motorista" element={<ProtectedRoute><AreaMotorista /></ProtectedRoute>} />
            <Route path="/frotas" element={<ProtectedRoute><Frotas /></ProtectedRoute>} />
            <Route path="/acessos" element={<ProtectedRoute><Acessos /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MeasurementProvider>
        <Toaster />
        <Sonner position="top-right" />
        <BrowserRouter>
          <SidebarProvider>
            <AppLayout />
          </SidebarProvider>
        </BrowserRouter>
      </MeasurementProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
