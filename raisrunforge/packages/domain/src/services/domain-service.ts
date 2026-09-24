import type { AuthContext, Domain } from "@runforge/shared";
import type { CreateDomainInput, ProviderRegistry } from "@runforge/providers";
import { DomainError } from "../errors";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

export class DomainService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventService,
    private readonly providers: ProviderRegistry,
  ) {}

  async list(ctx: AuthContext): Promise<Domain[]> {
    this.permissions.require(ctx, "domain:read");
    return this.providers.network().listDomains(ctx.organizationId);
  }

  async get(ctx: AuthContext, id: string): Promise<Domain> {
    this.permissions.require(ctx, "domain:read");
    const domains = await this.list(ctx);
    const domain = domains.find((d) => d.id === id);
    if (!domain) throw DomainError.notFound("domain", id);
    return domain;
  }

  async create(ctx: AuthContext, input: Omit<CreateDomainInput, "organizationId">): Promise<Domain> {
    this.permissions.require(ctx, "domain:write");
    const domain = await this.providers.network().createDomain({ ...input, organizationId: ctx.organizationId });
    await this.events.record(ctx, {
      action: "domain.created",
      resourceType: "domain",
      resourceId: domain.id,
      resourceName: domain.name,
      projectId: domain.projectId,
      message: `Domain ${domain.name} added`,
    });
    return domain;
  }

  async remove(ctx: AuthContext, id: string): Promise<void> {
    this.permissions.require(ctx, "domain:delete");
    const domain = await this.get(ctx, id);
    await this.providers.network().deleteDomain(ctx.organizationId, id);
    await this.events.record(ctx, {
      action: "domain.deleted",
      resourceType: "domain",
      resourceId: id,
      resourceName: domain.name,
      projectId: domain.projectId,
      message: `Domain ${domain.name} removed`,
      status: "info",
    });
  }

  async listDnsRecords(ctx: AuthContext, domainId?: string) {
    this.permissions.require(ctx, "domain:read");
    return this.providers.network().listDnsRecords(ctx.organizationId, domainId);
  }
}
