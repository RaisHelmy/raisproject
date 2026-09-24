import { tenantDb } from "../db/client";
import { widestScope, type AuthContext } from "../core/authz";
import type { Permission, TicketScope } from "../core/authz/permissions";
import type { RequestData } from "./env";

/**
 * Builds the AuthContext every permission check goes through (CLAUDE.md
 * §8). Contacts are not on the role model at all — they get an empty
 * permission set and no ticketScope; ticket routes filter Contact
 * visibility by Account/Team directly, not through core/authz.
 */
export async function buildAuthContext(hyperdrive: Hyperdrive, data: RequestData): Promise<AuthContext | null> {
  if (!data.session) return null;

  if (data.session.subjectType === "contact") {
    return {
      tenantId: data.tenantId,
      subjectType: "contact",
      subjectId: data.session.subjectId,
      permissions: new Set(),
    };
  }

  const db = tenantDb(hyperdrive, data.tenantId);
  const roles = await db.roles.listForAgent(data.session.subjectId);

  const permissions = new Set<Permission>();
  const scopes: TicketScope[] = [];
  for (const role of roles) {
    for (const p of JSON.parse(role.permissions) as Permission[]) permissions.add(p);
    scopes.push(role.ticketScope);
  }

  return {
    tenantId: data.tenantId,
    subjectType: "agent",
    subjectId: data.session.subjectId,
    permissions,
    ticketScope: widestScope(scopes),
  };
}
