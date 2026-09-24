import type { AuthContext, SearchResult } from "@runforge/shared";
import type { ProviderRegistry } from "@runforge/providers";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";

/** Global search across every resource type (spec §50). */
export class SearchService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly providers: ProviderRegistry,
  ) {}

  async search(ctx: AuthContext, query: string, limit = 20): Promise<SearchResult[]> {
    this.permissions.require(ctx, "project:read");
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];

    const push = (r: SearchResult) => {
      if (results.length < 500) results.push(r);
    };

    const [projects, applications, servers, containers, databases, domains, deployments, events, incidents] = await Promise.all([
      this.store.projects.list(ctx.organizationId),
      this.store.applications.list(ctx.organizationId),
      this.providers.compute().listServers(ctx.organizationId),
      this.providers.container().listContainers(ctx.organizationId),
      this.providers.database().listDatabases(ctx.organizationId),
      this.providers.network().listDomains(ctx.organizationId),
      this.store.deployments.list(ctx.organizationId, { limit: 200 }),
      this.store.events.list(ctx.organizationId, { limit: 200 }),
      this.store.incidents.list(ctx.organizationId),
    ]);

    for (const p of projects) if (p.name.toLowerCase().includes(q) || p.slug.includes(q)) push({ type: "project", id: p.id, title: p.name, subtitle: "Project", status: p.status, href: `/projects/${p.id}` });
    for (const a of applications) if (a.name.toLowerCase().includes(q) || a.domain?.toLowerCase().includes(q)) push({ type: "application", id: a.id, title: a.name, subtitle: a.domain ?? a.environment, status: a.status, href: `/applications/${a.id}` });
    for (const s of servers) if (s.name.toLowerCase().includes(q) || s.ipAddress.includes(q)) push({ type: "server", id: s.id, title: s.name, subtitle: `${s.providerLabel} · ${s.region}`, status: s.status, href: `/servers/${s.id}` });
    for (const c of containers) if (c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q)) push({ type: "container", id: c.id, title: c.name, subtitle: c.image, status: c.status, href: `/containers/${c.id}` });
    for (const d of databases) if (d.name.toLowerCase().includes(q)) push({ type: "database", id: d.id, title: d.name, subtitle: `${d.engine} ${d.version}`, status: d.status, href: `/databases/${d.id}` });
    for (const d of domains) if (d.name.toLowerCase().includes(q)) push({ type: "domain", id: d.id, title: d.name, subtitle: "Domain", status: d.status, href: `/domains/${d.id}` });
    for (const d of deployments) if (d.version.toLowerCase().includes(q) || d.commitSha.includes(q) || d.applicationName.toLowerCase().includes(q)) push({ type: "deployment", id: d.id, title: `${d.applicationName} ${d.version}`, subtitle: d.commitSha, status: d.status, href: `/deployments/${d.id}` });
    for (const e of events) if (e.message.toLowerCase().includes(q) || e.resourceName.toLowerCase().includes(q)) push({ type: "event", id: e.id, title: e.message, subtitle: e.resourceName, status: e.status, href: `/events/${e.id}` });
    for (const i of incidents) if (i.title.toLowerCase().includes(q)) push({ type: "incident", id: i.id, title: i.title, subtitle: i.resourceName, status: i.status, href: `/incidents/${i.id}` });

    return results.slice(0, limit);
  }
}
