import type { AuthContext, GraphEdge, GraphNode, InfrastructureGraph } from "@runforge/shared";
import type { ProviderRegistry } from "@runforge/providers";
import { DomainError } from "../errors";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";

/**
 * Builds the infrastructure dependency graph (spec §47): domain → Cloudflare →
 * tunnel → server → reverse proxy → container → application → database.
 * Focused on one application when applicationId is given, otherwise the whole org.
 */
export class GraphService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly providers: ProviderRegistry,
  ) {}

  async build(ctx: AuthContext, applicationId?: string): Promise<InfrastructureGraph> {
    this.permissions.require(ctx, "project:read");
    const [applications, servers, containers, databases, domains, routes, tunnels] = await Promise.all([
      this.store.applications.list(ctx.organizationId),
      this.providers.compute().listServers(ctx.organizationId),
      this.providers.container().listContainers(ctx.organizationId),
      this.providers.database().listDatabases(ctx.organizationId),
      this.providers.network().listDomains(ctx.organizationId),
      this.providers.network().listRoutes(ctx.organizationId),
      this.providers.network().listTunnels(ctx.organizationId),
    ]);

    const scoped = applicationId ? applications.filter((a) => a.id === applicationId) : applications;
    if (applicationId && scoped.length === 0) throw DomainError.notFound("application", applicationId);

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const addNode = (n: GraphNode) => nodes.set(n.id, n);
    const addEdge = (from: string, to: string, label?: string) => edges.push({ from, to, label });

    for (const app of scoped) {
      const appNodeId = `application:${app.id}`;
      addNode({ id: appNodeId, type: "application", label: app.name, sublabel: app.runtimeLabel, status: app.status, href: `/applications/${app.id}` });

      const route = routes.find((r) => r.applicationId === app.id);
      const domain = domains.find((d) => d.applicationId === app.id) ?? (route ? domains.find((d) => d.name === route.domain) : undefined);
      const server = servers.find((s) => s.id === app.serverId);
      const tunnel = server ? tunnels.find((t) => t.serverId === server.id) : undefined;
      const container = containers.find((c) => c.applicationId === app.id);
      const database = databases.find((d) => d.id === app.databaseId);

      if (domain) {
        const domainNodeId = `domain:${domain.id}`;
        const cfNodeId = "cloudflare";
        addNode({ id: domainNodeId, type: "domain", label: domain.name, status: domain.status, href: `/domains/${domain.id}` });
        addNode({ id: cfNodeId, type: "cloudflare", label: "Cloudflare", sublabel: "DNS + SSL" });
        addEdge(domainNodeId, cfNodeId);
        if (route?.viaTunnel && tunnel) {
          const tunnelNodeId = `tunnel:${tunnel.id}`;
          addNode({ id: tunnelNodeId, type: "tunnel", label: "Cloudflare Tunnel", sublabel: tunnel.name, status: tunnel.status });
          addEdge(cfNodeId, tunnelNodeId);
          if (server) {
            const serverNodeId = `server:${server.id}`;
            addNode({ id: serverNodeId, type: "server", label: server.name, sublabel: server.providerLabel, status: server.status, href: `/servers/${server.id}` });
            addEdge(tunnelNodeId, serverNodeId);
            const proxyNodeId = `proxy:${server.id}`;
            addNode({ id: proxyNodeId, type: "proxy", label: route.proxy === "nginx" ? "Nginx" : route.proxy, sublabel: "Reverse Proxy" });
            addEdge(serverNodeId, proxyNodeId);
            addEdge(proxyNodeId, appNodeId, `:${app.port}`);
          }
        } else if (server) {
          const serverNodeId = `server:${server.id}`;
          addNode({ id: serverNodeId, type: "server", label: server.name, sublabel: server.providerLabel, status: server.status, href: `/servers/${server.id}` });
          addEdge(cfNodeId, serverNodeId);
          addEdge(serverNodeId, appNodeId, `:${app.port}`);
        }
      } else if (server) {
        const serverNodeId = `server:${server.id}`;
        addNode({ id: serverNodeId, type: "server", label: server.name, sublabel: server.providerLabel, status: server.status, href: `/servers/${server.id}` });
        addEdge(serverNodeId, appNodeId);
      }

      if (container) {
        const containerNodeId = `container:${container.id}`;
        addNode({ id: containerNodeId, type: "container", label: container.name, sublabel: container.image, status: container.status, href: `/containers/${container.id}` });
        addEdge(appNodeId, containerNodeId);
      }
      if (database) {
        const dbNodeId = `database:${database.id}`;
        addNode({ id: dbNodeId, type: database.engine === "redis" ? "cache" : "database", label: database.name, sublabel: database.engine, status: database.status, href: `/databases/${database.id}` });
        addEdge(appNodeId, dbNodeId);
      }
    }

    return { nodes: [...nodes.values()], edges };
  }
}
