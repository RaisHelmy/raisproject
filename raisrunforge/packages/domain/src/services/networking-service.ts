import type { AuthContext, Port, Route, Tunnel } from "@runforge/shared";
import type { CreateRouteInput, ProviderRegistry } from "@runforge/providers";
import { DomainError } from "../errors";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

/** Reverse proxy routes, ports and tunnels (spec §23/§24/§27). */
export class NetworkingService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly events: EventService,
    private readonly providers: ProviderRegistry,
  ) {}

  async listRoutes(ctx: AuthContext): Promise<Route[]> {
    this.permissions.require(ctx, "network:read");
    return this.providers.network().listRoutes(ctx.organizationId);
  }

  async createRoute(ctx: AuthContext, input: Omit<CreateRouteInput, "organizationId">): Promise<Route> {
    this.permissions.require(ctx, "network:write");
    const route = await this.providers.network().createRoute({ ...input, organizationId: ctx.organizationId });
    await this.events.record(ctx, {
      action: "route.created",
      resourceType: "route",
      resourceId: route.id,
      resourceName: `${route.domain} → ${route.applicationName}`,
      message: `Route ${route.domain} → ${route.applicationName}:${route.internalPort} created`,
    });
    return route;
  }

  async deleteRoute(ctx: AuthContext, id: string): Promise<void> {
    this.permissions.require(ctx, "network:write");
    await this.providers.network().deleteRoute(ctx.organizationId, id);
    await this.events.record(ctx, {
      action: "route.deleted",
      resourceType: "route",
      resourceId: id,
      resourceName: id,
      message: `Route ${id} deleted`,
      status: "info",
    });
  }

  async listPorts(ctx: AuthContext, serverId?: string): Promise<Port[]> {
    this.permissions.require(ctx, "network:read");
    return this.providers.network().listPorts(ctx.organizationId, serverId);
  }

  async setPortExposure(ctx: AuthContext, id: string, exposure: Port["exposure"]): Promise<Port> {
    // Opening a port publicly is DANGEROUS (spec §24: "never expose a port without clearly showing the security impact").
    this.permissions.require(ctx, exposure === "public" ? "port:expose" : "network:write");
    const port = await this.providers.network().setPortExposure(ctx.organizationId, id, exposure);
    await this.events.record(ctx, {
      action: "port.exposure_changed",
      resourceType: "port",
      resourceId: port.id,
      resourceName: `${port.port}/${port.protocol}`,
      message: `Port ${port.port}/${port.protocol} exposure set to ${exposure}`,
      after: { exposure },
    });
    return port;
  }

  async listTunnels(ctx: AuthContext): Promise<Tunnel[]> {
    this.permissions.require(ctx, "network:read");
    return this.providers.network().listTunnels(ctx.organizationId);
  }
}
