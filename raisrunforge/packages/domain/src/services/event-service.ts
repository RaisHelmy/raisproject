import type { AuditLog, AuthContext, Event, EventStatus } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";

export interface RecordEventInput {
  action: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  message: string;
  projectId?: string;
  status?: EventStatus;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  simulated?: boolean;
  result?: AuditLog["result"];
}

export type EventListener = (event: Event) => void;

/**
 * EventService writes the event stream (spec §38) and the audit log (spec §39).
 * Every mutating domain operation calls `record`, regardless of transport.
 */
export class EventService {
  private listeners = new Set<EventListener>();

  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly actorNameResolver: (ctx: AuthContext) => Promise<string>,
  ) {}

  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async record(ctx: AuthContext, input: RecordEventInput): Promise<Event> {
    const event: Event = {
      id: newId("evt"),
      organizationId: ctx.organizationId,
      projectId: input.projectId,
      actorType: ctx.actorType,
      actorId: ctx.actorId,
      actorName: await this.actorNameResolver(ctx),
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      before: input.before,
      after: input.after,
      status: input.status ?? "success",
      message: input.message,
      correlationId: ctx.correlationId,
      simulated: input.simulated ?? ctx.demo,
      createdAt: nowIso(),
    };
    await this.store.events.insert(event);
    await this.store.auditLogs.insert({ ...event, id: newId("aud"), result: input.result ?? "allowed" });
    for (const l of this.listeners) l(event);
    return event;
  }

  /** Records a denied attempt in the audit log only (never in the public event stream). */
  async recordDenied(ctx: AuthContext, action: string, resourceType: string, resourceId: string, reason: string): Promise<void> {
    await this.store.auditLogs.insert({
      id: newId("aud"),
      organizationId: ctx.organizationId,
      actorType: ctx.actorType,
      actorId: ctx.actorId,
      actorName: await this.actorNameResolver(ctx),
      action,
      resourceType,
      resourceId,
      resourceName: resourceId,
      status: "failed",
      message: reason,
      correlationId: ctx.correlationId,
      simulated: ctx.demo,
      createdAt: nowIso(),
      result: "denied",
    });
  }

  async list(ctx: AuthContext, opts: { limit?: number; resourceType?: string; resourceId?: string; projectId?: string } = {}): Promise<Event[]> {
    this.permissions.require(ctx, "events:read");
    const where: Partial<Event> = {};
    if (opts.resourceType) where.resourceType = opts.resourceType;
    if (opts.resourceId) where.resourceId = opts.resourceId;
    if (opts.projectId) where.projectId = opts.projectId;
    return this.store.events.list(ctx.organizationId, { where, orderBy: "createdAt", direction: "desc", limit: opts.limit ?? 100 });
  }

  async get(ctx: AuthContext, id: string): Promise<Event> {
    this.permissions.require(ctx, "events:read");
    const event = await this.store.events.get(ctx.organizationId, id);
    this.permissions.requireTenant(ctx, event, "event", id);
    return event!;
  }

  async listAudit(ctx: AuthContext, limit = 100): Promise<AuditLog[]> {
    this.permissions.require(ctx, "audit:read");
    return this.store.auditLogs.list(ctx.organizationId, { orderBy: "createdAt", direction: "desc", limit });
  }
}
