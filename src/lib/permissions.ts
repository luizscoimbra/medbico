import type { UserRole } from "@/lib/auth-roles";
import { MODULES, MODULE_IDS, MODULOS_EXTERNOS, type ModuleId } from "@/modules/registry";

export type ModuleOverrides = Record<string, boolean>;

/**
 * Módulos que o papel pode ter. `plataforma` fica de fora de propósito: é o
 * console do vendedor, concedido por platform_admins no banco, e não por um
 * papel dentro da empresa cliente. Um master de empresa que ganhasse esse módulo
 * por override passaria a enxergar todos os clientes.
 */
const MODULOS_POR_PAPEL: ModuleId[] = MODULE_IDS.filter(
  (id) => !MODULOS_EXTERNOS.includes(id)
);

/** Módulos que um papel dentro da empresa cliente pode receber. */
export const MODULOS_DA_EMPRESA: ModuleId[] = MODULOS_POR_PAPEL;

const DEFAULT_MODULES_WITHOUT_ACESSOS: ModuleId[] = MODULOS_POR_PAPEL.filter(
  (id) => id !== "acessos"
);

export const DEFAULT_ROLE_MODULES: Record<UserRole, ModuleId[]> = {
  master: [...MODULOS_POR_PAPEL],
  gestor: [...MODULOS_POR_PAPEL],
  operador: [...DEFAULT_MODULES_WITHOUT_ACESSOS],
  motorista: [...DEFAULT_MODULES_WITHOUT_ACESSOS],
};

export function resolveModules(
  role: UserRole,
  overrides?: ModuleOverrides | null
): Set<ModuleId> {
  if (role === "master") {
    return new Set(MODULOS_POR_PAPEL);
  }

  const base = DEFAULT_ROLE_MODULES[role] ?? DEFAULT_ROLE_MODULES.operador;
  const modules = new Set<ModuleId>(base);

  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [moduleId, allowed] of Object.entries(overrides)) {
      // Módulos externos à empresa nunca entram por override.
      if (!MODULOS_POR_PAPEL.includes(moduleId as ModuleId)) continue;
      if (allowed === true) {
        modules.add(moduleId as ModuleId);
      } else if (allowed === false) {
        modules.delete(moduleId as ModuleId);
      }
    }
  }

  return modules;
}

/**
 * Módulos que este usuário acessa, somando o console da plataforma quando ele é
 * administrador dela. O módulo da plataforma não faz parte de nenhum papel.
 */
export function resolveModulesWithPlatform(
  role: UserRole,
  overrides: ModuleOverrides | null | undefined,
  isPlatformAdmin: boolean
): Set<ModuleId> {
  const modules = resolveModules(role, overrides);
  if (isPlatformAdmin) modules.add("plataforma");
  return modules;
}

export function canAccess(modules: Set<ModuleId>, moduleId: ModuleId): boolean {
  return modules.has(moduleId);
}

export function homePathFor(modules: Set<ModuleId>): string {
  for (const def of MODULES) {
    if (modules.has(def.id) && def.routes.length > 0) {
      return def.routes[0];
    }
  }
  return "/auth";
}
