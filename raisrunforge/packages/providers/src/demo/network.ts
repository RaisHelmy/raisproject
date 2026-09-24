import type { DnsRecord, Domain, Port, ProviderKind, Route, Tunnel } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import type { CreateDomainInput, CreateRouteInput, NetworkProvider } from "../interfaces";
import type { DemoWorld } from "./world";

export class DemoNetworkProvider implements NetworkProvider {
  readonly kind: ProviderKind = "demo";
  constructor(private readonly world: DemoWorld) {}

  async listDomains(organizationId: string): Promise<Domain[]> {
    return this.world.domains.filter((d) => d.organizationId === organizationId);
  }

  async createDomain(input: CreateDomainInput): Promise<Domain> {
    const ts = nowIso();
    const domain: Domain = {
      id: newId("dom"),
      organizationId: input.organizationId,
      projectId: input.projectId,
      name: input.name.toLowerCase(),
      applicationId: input.applicationId,
      provider: input.provider ?? "cloudflare",
      ssl: "pending",
      status: "pending",
      createdAt: ts,
      updatedAt: ts,
    };
    this.world.domains.push(domain);
    this.world.dnsRecords.push({
      id: newId("dns"),
      organizationId: input.organizationId,
      domainId: domain.id,
      zone: domain.name.split(".").slice(-2).join("."),
      type: "CNAME",
      name: domain.name,
      content: "tun_production_01.cfargotunnel.com",
      ttl: 1,
      proxied: true,
      createdAt: ts,
      updatedAt: ts,
    });
    // Demo: SSL becomes active a few seconds later, based on elapsed time on read.
    setTimeout(() => {
      domain.ssl = "active";
      domain.status = "active";
      domain.sslExpiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
      domain.updatedAt = nowIso();
    }, 6000).unref?.();
    return domain;
  }

  async deleteDomain(organizationId: string, id: string): Promise<void> {
    const idx = this.world.domains.findIndex((d) => d.id === id && d.organizationId === organizationId);
    if (idx < 0) throw new Error(`Domain ${id} not found`);
    this.world.domains.splice(idx, 1);
    this.world.dnsRecords = this.world.dnsRecords.filter((r) => r.domainId !== id);
    this.world.routes = this.world.routes.filter((r) => r.domainId !== id);
  }

  async listDnsRecords(organizationId: string, domainId?: string): Promise<DnsRecord[]> {
    return this.world.dnsRecords.filter((r) => r.organizationId === organizationId && (!domainId || r.domainId === domainId));
  }

  async listRoutes(organizationId: string): Promise<Route[]> {
    return this.world.routes.filter((r) => r.organizationId === organizationId);
  }

  async createRoute(input: CreateRouteInput): Promise<Route> {
    const app = this.world.applications.find((a) => a.id === input.applicationId && a.organizationId === input.organizationId);
    if (!app) throw new Error(`Application ${input.applicationId} not found`);
    const domain = this.world.domains.find((d) => d.name === input.domain && d.organizationId === input.organizationId);
    const ts = nowIso();
    const route: Route = {
      id: newId("rt"),
      organizationId: input.organizationId,
      domainId: domain?.id,
      domain: input.domain,
      path: input.path ?? "/",
      applicationId: app.id,
      applicationName: app.name,
      serverId: app.serverId,
      internalPort: input.internalPort,
      protocol: input.protocol ?? "https",
      websocket: input.websocket ?? false,
      healthPath: input.healthPath ?? app.healthPath,
      proxy: input.proxy ?? "nginx",
      viaTunnel: input.viaTunnel ?? true,
      status: "active",
      createdAt: ts,
      updatedAt: ts,
    };
    this.world.routes.push(route);
    return route;
  }

  async deleteRoute(organizationId: string, id: string): Promise<void> {
    this.world.routes = this.world.routes.filter((r) => !(r.id === id && r.organizationId === organizationId));
  }

  async listPorts(organizationId: string, serverId?: string): Promise<Port[]> {
    return this.world.ports.filter((p) => p.organizationId === organizationId && (!serverId || p.serverId === serverId));
  }

  async setPortExposure(organizationId: string, id: string, exposure: Port["exposure"]): Promise<Port> {
    const p = this.world.ports.find((x) => x.id === id && x.organizationId === organizationId);
    if (!p) throw new Error(`Port ${id} not found`);
    p.exposure = exposure;
    p.updatedAt = nowIso();
    return p;
  }

  async listTunnels(organizationId: string): Promise<Tunnel[]> {
    return this.world.tunnels.filter((t) => t.organizationId === organizationId);
  }
}
