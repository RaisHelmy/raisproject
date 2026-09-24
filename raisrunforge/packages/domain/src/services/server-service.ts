import type { AuthContext, Server, ServerMetricsSnapshot, ServiceRecord } from "@runforge/shared";
import { newId } from "@runforge/shared";
import type { ComputeProvider, CreateServerInput, ProviderRegistry } from "@runforge/providers";
import { DomainError } from "../errors";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

/** ServerService manages connected infrastructure (spec §10-§13). */
export class ServerService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventService,
    private readonly providers: ProviderRegistry,
    private readonly store: DataStore,
  ) {}

  async list(ctx: AuthContext): Promise<Server[]> {
    this.permissions.require(ctx, "server:read");
    return this.providers.compute().listServers(ctx.organizationId);
  }

  async get(ctx: AuthContext, id: string): Promise<Server> {
    this.permissions.require(ctx, "server:read");
    const server = await this.providers.compute().getServer(ctx.organizationId, id);
    if (!server) throw DomainError.notFound("server", id);
    return server;
  }

  async connect(ctx: AuthContext, input: Omit<CreateServerInput, "organizationId">): Promise<Server> {
    this.permissions.require(ctx, "server:write");
    const server = await this.providers.compute().createServer({ ...input, organizationId: ctx.organizationId });
    await this.events.record(ctx, {
      action: "server.connected",
      resourceType: "server",
      resourceId: server.id,
      resourceName: server.name,
      message: `Server ${server.name} connected`,
      after: { region: server.region, cpuCores: server.cpuCores },
    });
    return server;
  }

  async remove(ctx: AuthContext, id: string): Promise<void> {
    this.permissions.require(ctx, "server:delete");
    const server = await this.get(ctx, id);
    await this.providers.compute().deleteServer(ctx.organizationId, id);
    await this.events.record(ctx, {
      action: "server.removed",
      resourceType: "server",
      resourceId: id,
      resourceName: server.name,
      message: `Server ${server.name} removed`,
    });
  }

  async getMetrics(ctx: AuthContext, id: string): Promise<ServerMetricsSnapshot> {
    this.permissions.require(ctx, "server:read");
    const metrics = await this.providers.compute().getMetrics(ctx.organizationId, id);
    if (!metrics) throw DomainError.notFound("server metrics", id);
    return metrics;
  }

  async listServices(ctx: AuthContext, serverId: string): Promise<ServiceRecord[]> {
    this.permissions.require(ctx, "server:read");
    return this.providers.compute().listServices(ctx.organizationId, serverId);
  }

  async controlService(ctx: AuthContext, serviceId: string, action: "start" | "stop" | "restart" | "enable" | "disable"): Promise<ServiceRecord> {
    this.permissions.require(ctx, "service:control");
    const svc = await this.providers.compute().controlService(ctx.organizationId, serviceId, action);
    await this.events.record(ctx, {
      action: `service.${action}`,
      resourceType: "service",
      resourceId: svc.id,
      resourceName: svc.name,
      message: `Service ${svc.name} ${action}ed`,
    });
    return svc;
  }

  async restartAgent(ctx: AuthContext, serverId: string): Promise<void> {
    this.permissions.require(ctx, "server:write");
    const server = await this.get(ctx, serverId);
    await this.providers.compute().restartAgent(ctx.organizationId, serverId);
    await this.events.record(ctx, {
      action: "agent.restarted",
      resourceType: "server",
      resourceId: serverId,
      resourceName: server.name,
      message: `RunForge Agent restarted on ${server.name}`,
    });
  }

  computeProvider(): ComputeProvider {
    return this.providers.compute();
  }
}
