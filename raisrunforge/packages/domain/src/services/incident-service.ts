import type { AuthContext, Incident, IncidentStatus } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import { DomainError } from "../errors";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

export interface OpenIncidentInput {
  title: string;
  severity: Incident["severity"];
  resourceType: string;
  resourceId: string;
  resourceName: string;
  projectId?: string;
  impactPercent?: number;
  likelyCause?: string;
  relatedDeploymentId?: string;
  relatedChanges?: string[];
}

/** Incident detection and lifecycle (spec §40). */
export class IncidentService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly events: EventService,
  ) {}

  async list(ctx: AuthContext, status?: IncidentStatus): Promise<Incident[]> {
    this.permissions.require(ctx, "incident:read");
    return this.store.incidents.list(ctx.organizationId, {
      where: status ? ({ status } as Partial<Incident>) : undefined,
      orderBy: "startedAt",
      direction: "desc",
    });
  }

  async get(ctx: AuthContext, id: string): Promise<Incident> {
    this.permissions.require(ctx, "incident:read");
    const incident = await this.store.incidents.get(ctx.organizationId, id);
    this.permissions.requireTenant(ctx, incident, "incident", id);
    return incident!;
  }

  async open(ctx: AuthContext, input: OpenIncidentInput): Promise<Incident> {
    this.permissions.require(ctx, "incident:write");
    const ts = nowIso();
    const incident: Incident = {
      id: newId("inc"),
      organizationId: ctx.organizationId,
      projectId: input.projectId,
      title: input.title,
      severity: input.severity,
      status: "open",
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      impactPercent: input.impactPercent,
      likelyCause: input.likelyCause,
      relatedDeploymentId: input.relatedDeploymentId,
      relatedChanges: input.relatedChanges ?? [],
      startedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.incidents.insert(incident);
    await this.events.record(ctx, {
      action: "incident.opened",
      resourceType: "incident",
      resourceId: incident.id,
      resourceName: incident.title,
      projectId: incident.projectId,
      message: incident.title,
      status: "failed",
    });
    return incident;
  }

  async updateStatus(ctx: AuthContext, id: string, status: IncidentStatus): Promise<Incident> {
    this.permissions.require(ctx, "incident:write");
    const incident = await this.get(ctx, id);
    const patch: Partial<Incident> = { status };
    if (status === "resolved") patch.resolvedAt = nowIso();
    const updated = await this.store.incidents.update(ctx.organizationId, id, patch);
    await this.events.record(ctx, {
      action: `incident.${status}`,
      resourceType: "incident",
      resourceId: id,
      resourceName: incident.title,
      projectId: incident.projectId,
      message: `Incident "${incident.title}" marked ${status}`,
    });
    return updated;
  }
}
