import type { Actor, AuditLog, ExecutionMode, Notification, NotificationEvent, Permission, RequestContext, RiskLevel } from "../types";
import type { DataStore } from "../repository/store";
import { permissionsForRoles, requirePermission } from "../permissions";
import { DomainError } from "../types";
import { newId, nowIso } from "../ids";
import { redact } from "../engines/privacy";

/** Resolve an Actor from a user + organization — always server-side; never trust the client. */
export async function resolveActor(store: DataStore, userId: string, organizationId: string): Promise<Actor> {
  const user = await store.users.get(userId);
  if (!user) throw new DomainError("NOT_FOUND", "User not found");
  const membership = (await store.memberships.list({ userId, organizationId }))[0];
  if (!membership || membership.status !== "ACTIVE") throw new DomainError("FORBIDDEN", "You are not an active member of this organization");
  const roles = await store.roles.list((r) => r.organizationId === null || r.organizationId === organizationId);
  const roleKeys = membership.roleIds.map((id) => roles.find((r) => r.id === id)?.key ?? id);
  const permissions = permissionsForRoles(membership.roleIds, roles);
  return { userId, userName: user.name, organizationId, membershipId: membership.id, roleKeys, permissions, isOwner: roleKeys.includes("org_owner") };
}

export function makeContext(actor: Actor, executionMode: ExecutionMode = "HUMAN", correlationId = newId("cor")): RequestContext {
  return { actor, correlationId, executionMode, now: nowIso };
}

export class ServiceBase {
  constructor(protected store: DataStore) {}

  protected require(ctx: RequestContext, permission: Permission) { requirePermission(ctx.actor, permission); }

  /** Tenant guard: every entity loaded must belong to the actor's organization. */
  protected assertTenant<E extends { organizationId: string | null }>(ctx: RequestContext, entity: E | undefined, label = "Resource"): E {
    if (!entity) throw new DomainError("NOT_FOUND", `${label} not found`);
    if (entity.organizationId !== null && entity.organizationId !== ctx.actor.organizationId) throw new DomainError("NOT_FOUND", `${label} not found`);
    return entity;
  }

  /** Organization guard: the actor may only load their own organization. */
  protected assertOrg(ctx: RequestContext, org: import("../types").Organization | undefined): import("../types").Organization {
    if (!org || org.id !== ctx.actor.organizationId) throw new DomainError("NOT_FOUND", "Organization not found");
    return org;
  }

  protected async audit(ctx: RequestContext, action: string, resourceType: string, resourceId: string, resourceLabel?: string, opts: { risk?: RiskLevel; result?: AuditLog["result"]; detail?: string } = {}): Promise<void> {
    await this.store.auditLogs.put({
      id: newId("aud"), organizationId: ctx.actor.organizationId, actorId: ctx.actor.userId, actorName: ctx.actor.userName, action, resourceType, resourceId, resourceLabel,
      timestamp: ctx.now(), result: opts.result ?? "SUCCESS", risk: opts.risk ?? "LOW", correlationId: ctx.correlationId, executionMode: ctx.executionMode, detail: opts.detail ? redact(opts.detail).text : undefined,
    });
  }

  protected async notify(ctx: RequestContext, userIds: string[], event: NotificationEvent, title: string, body: string, href?: string): Promise<void> {
    const at = ctx.now();
    const items: Notification[] = [...new Set(userIds)].map((userId) => ({ id: newId("ntf"), organizationId: ctx.actor.organizationId, userId, event, title, body: redact(body).text, href, read: false, channel: "IN_APP", createdAt: at }));
    await this.store.notifications.putMany(items);
  }

  /** Users in the org holding any of the given role keys (used for approval notifications). */
  protected async usersWithRoles(organizationId: string, roleKeys: string[]): Promise<string[]> {
    const memberships = await this.store.memberships.list({ organizationId, status: "ACTIVE" });
    const roles = await this.store.roles.list((r) => r.organizationId === null || r.organizationId === organizationId);
    return memberships.filter((m) => m.roleIds.some((id) => roleKeys.includes(roles.find((r) => r.id === id)?.key ?? ""))).map((m) => m.userId);
  }
}
