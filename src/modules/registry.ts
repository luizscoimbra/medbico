export type ModuleId =
  | "principal"
  | "operacoes"
  | "motorista"
  | "consultas"
  | "cadastros"
  | "estoque"
  | "drones"
  | "financeiro"
  | "acessos"
  | "plataforma";

export interface ModuleDef {
  id: ModuleId;
  label: string;
  routes: string[];
}

export const MODULES: ModuleDef[] = [
  { id: "principal", label: "Painel", routes: ["/", "/visao-geral"] },
  {
    id: "operacoes",
    label: "Operações",
    routes: [
      "/nova-medicao",
      "/entrada-dados",
      "/resultados",
      "/calculadora-calda",
      "/aferir-vazao",
      "/ordem-servico",
      "/visitas",
      "/receituario",
    ],
  },
  { id: "motorista", label: "Área do Motorista", routes: ["/area-motorista"] },
  { id: "consultas", label: "Consultas", routes: ["/historico", "/agrofit-historico", "/tabela-referencia"] },
  { id: "cadastros", label: "Cadastros", routes: ["/cadastros", "/cadastro-produtos"] },
  { id: "estoque", label: "Estoque", routes: ["/estoque"] },
  {
    id: "drones",
    label: "Drones e Frotas",
    routes: ["/frotas", "/equipamentos", "/manutencao-equipamentos", "/gestao-abastecimento", "/drones", "/battery-management", "/flight-log", "/maintenance"],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    routes: ["/financeiro", "/plano-de-contas", "/conciliacao", "/boletos"],
  },
  { id: "acessos", label: "Gestão de Acessos", routes: ["/acessos", "/filiais"] },
  { id: "plataforma", label: "Plataforma", routes: ["/plataforma"] },
];

/**
 * Módulos fora do alcance do administrador de uma empresa cliente.
 *
 * `plataforma` é o console do vendedor. Ele não entra no padrão de nenhum
 * papel — a concessão é feita em platform_admins, no banco —, então não aparece
 * na matriz de permissões por papel.
 */
export const MODULOS_EXTERNOS: ModuleId[] = ["plataforma"];

export const MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id);

export const MODULE_LABELS = MODULES.reduce((acc, m) => {
  acc[m.id] = m.label;
  return acc;
}, {} as Record<ModuleId, string>);

export const PUBLIC_ROUTES = ["/auth", "/email-confirmada"];

export function moduleForRoute(path: string): ModuleId | null {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  const found = MODULES.find((m) => m.routes.includes(clean));
  return found ? found.id : null;
}
