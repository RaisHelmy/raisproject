import type { Role } from "../../shared/types";
import type { AuthContext } from "../types";

const GROUP_ROLES: Role[] = ["owner", "group_admin"];

/** True if the user has group-wide access (owner/group_admin on any outlet). */
export function isGroupAdmin(auth: AuthContext): boolean {
  return Object.values(auth.roles).some((r) => GROUP_ROLES.includes(r));
}

export function roleForOutlet(auth: AuthContext, outletId: string): Role | null {
  if (isGroupAdmin(auth)) {
    const groupRole = Object.values(auth.roles).find((r) => GROUP_ROLES.includes(r));
    if (groupRole) return groupRole;
  }
  return auth.roles[outletId] ?? null;
}

export function hasOutletAccess(auth: AuthContext, outletId: string, allowed: Role[]): boolean {
  const role = roleForOutlet(auth, outletId);
  return role !== null && allowed.includes(role);
}
