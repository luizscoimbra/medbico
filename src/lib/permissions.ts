import type { UserRole } from "@/lib/auth-roles";
import { MODULES, MODULE_IDS, type ModuleId } from "@/modules/registry";

export type ModuleOverrides = Record<string, boolean>;

const DEFAULT_MODULES_WITHOUT_ACESSOS: ModuleId[] = MODULE_IDS.filter(
  (id) => id !== "acessos"
);

export const DEFAULT_ROLE_MODULES: Record<UserRole, ModuleId[]> = {
  master: [...MODULE_IDS],
  gestor: [...MODULE_IDS],
  operador: [...DEFAULT_MODULES_WITHOUT_ACESSOS],
  motorista: [...DEFAULT_MODULES_WITHOUT_ACESSOS],
};

export function resolveModules(
  role: UserRole,
  overrides?: ModuleOverrides | null
): Set<ModuleId> {
  if (role === "master") {
    return new Set(MODULE_IDS);
  }

  const base = DEFAULT_ROLE_MODULES[role] ?? DEFAULT_ROLE_MODULES.operador;
  const modules = new Set<ModuleId>(base);

  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    for (const [moduleId, allowed] of Object.entries(overrides)) {
      if (!MODULE_IDS.includes(moduleId as ModuleId)) continue;
      if (allowed === true) {
        modules.add(moduleId as ModuleId);
      } else if (allowed === false) {
        modules.delete(moduleId as ModuleId);
      }
    }
  }

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
