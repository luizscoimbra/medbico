import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { MeasurementProvider } from "@/context/MeasurementContext";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/Sidebar";
import { runLegacyMigrationWithFeedback } from "@/lib/legacyMigration";
import Index from "./pages/Index";
import NovaMedicao from "./pages/NovaMedicao";
import EntradaDados from "./pages/EntradaDados";
import Resultados from "./pages/Resultados";
import Historico from "./pages/Historico";
import TabelaReferencia from "./pages/TabelaReferencia";
import CadastroProdutos from "./pages/CadastroProdutos";
import Cadastros from "./pages/Cadastros";
import Estoque from "./pages/Estoque";
import CalculadoraCalda from "./pages/CalculadoraCalda";
import AferirVazao from "./pages/AferirVazao";
import OrdemServico from "./pages/OrdemServico";
import Visitas from "./pages/Visitas";
import Receituario from "./pages/Receituario";
import Drones from "./pages/Drones";
import Frotas from "./pages/Frotas";
import Equipamentos from "./pages/Equipamentos";
import ManutencaoEquipamentos from "./pages/ManutencaoEquipamentos";
import GestaoAbastecimento from "./pages/GestaoAbastecimento";
import Acessos from "./pages/Acessos";
import Filiais from "./pages/Filiais";
import Empresa from "./pages/Empresa";
import Tributacao from "./pages/Tributacao";
import Plataforma from "./pages/Plataforma";
import Auth from "./pages/Auth";
import EmailConfirmada from "./pages/EmailConfirmada";
import NotFound from "./pages/NotFound";
import AreaMotorista from "./pages/AreaMotorista";
import BatteryManagement from "./pages/BatteryManagement";
import FlightLog from "./pages/FlightLog";
import MaintenanceDashboard from "./pages/MaintenanceDashboard";
import VisaoGeral from "./pages/VisaoGeral";
import Financeiro from "./pages/Financeiro";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

/**
 * Esvazia para a nuvem o que ainda estava guardado apenas no navegador.
 *
 * Roda uma única vez por navegador, logo após o login. Sem isso, as ordens de
 * serviço e títulos financeiros criados antes da migração existiriam somente
 * na máquina onde foram digitados — exatamente o risco Crítico apontado na
 * auditoria.
 */
function LegacyDataMigrator() {
  const { user, loading } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (loading || !userId) return;
    void runLegacyMigrationWithFeedback();
  }, [userId, loading]);

  return null;
}

function AppLayout() {
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen">
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
            <Route path="/email-confirmada" element={<EmailConfirmada />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/visao-geral" element={<ProtectedRoute><VisaoGeral /></ProtectedRoute>} />
            <Route path="/nova-medicao" element={<ProtectedRoute><NovaMedicao /></ProtectedRoute>} />
            <Route path="/entrada-dados" element={<ProtectedRoute><EntradaDados /></ProtectedRoute>} />
            <Route path="/resultados" element={<ProtectedRoute><Resultados /></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute><Historico /></ProtectedRoute>} />
            <Route path="/tabela-referencia" element={<ProtectedRoute><TabelaReferencia /></ProtectedRoute>} />
            <Route path="/cadastro-produtos" element={<ProtectedRoute><CadastroProdutos /></ProtectedRoute>} />
            <Route path="/cadastros" element={<ProtectedRoute><Cadastros /></ProtectedRoute>} />
            <Route path="/estoque" element={<ProtectedRoute><Estoque /></ProtectedRoute>} />
            <Route path="/calculadora-calda" element={<ProtectedRoute><CalculadoraCalda /></ProtectedRoute>} />
            <Route path="/aferir-vazao" element={<ProtectedRoute><AferirVazao /></ProtectedRoute>} />
            <Route path="/ordem-servico" element={<ProtectedRoute><OrdemServico /></ProtectedRoute>} />
            <Route path="/visitas" element={<ProtectedRoute><Visitas /></ProtectedRoute>} />
            <Route path="/receituario" element={<ProtectedRoute><Receituario /></ProtectedRoute>} />
            <Route path="/area-motorista" element={<ProtectedRoute><AreaMotorista /></ProtectedRoute>} />
            <Route path="/frotas" element={<ProtectedRoute><Frotas /></ProtectedRoute>} />
            <Route path="/equipamentos" element={<ProtectedRoute><Equipamentos /></ProtectedRoute>} />
            <Route path="/manutencao-equipamentos" element={<ProtectedRoute><ManutencaoEquipamentos /></ProtectedRoute>} />
            <Route path="/gestao-abastecimento" element={<ProtectedRoute><GestaoAbastecimento /></ProtectedRoute>} />
            <Route path="/drones" element={<ProtectedRoute><Drones /></ProtectedRoute>} />
            <Route path="/battery-management" element={<ProtectedRoute><BatteryManagement /></ProtectedRoute>} />
            <Route path="/flight-log" element={<ProtectedRoute><FlightLog /></ProtectedRoute>} />
            <Route path="/maintenance" element={<ProtectedRoute><MaintenanceDashboard /></ProtectedRoute>} />
            <Route path="/acessos" element={<ProtectedRoute><Acessos /></ProtectedRoute>} />
            <Route path="/filiais" element={<ProtectedRoute><Filiais /></ProtectedRoute>} />
            <Route path="/empresa" element={<ProtectedRoute><Empresa /></ProtectedRoute>} />
            <Route path="/tributacao" element={<ProtectedRoute><Tributacao /></ProtectedRoute>} />
            <Route path="/plataforma" element={<ProtectedRoute><Plataforma /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
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
        <AuthProvider>
          <LegacyDataMigrator />
          <BrowserRouter>
            <SidebarProvider>
              <AppLayout />
            </SidebarProvider>
          </BrowserRouter>
        </AuthProvider>
      </MeasurementProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
