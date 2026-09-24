import type { AuthContext, OverviewSummary } from "@runforge/shared";
import type { ProviderRegistry } from "@runforge/providers";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";

/** Powers the Overview dashboard (spec §9): "is everything okay?" */
export class OverviewService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly providers: ProviderRegistry,
  ) {}

  async summary(ctx: AuthContext): Promise<OverviewSummary> {
    this.permissions.require(ctx, "project:read");

    const [projectsCount, apps, servers, containers, databases, deployments] = await Promise.all([
      this.store.projects.count(ctx.organizationId, { status: "active" } as never),
      this.store.applications.list(ctx.organizationId),
      this.providers.compute().listServers(ctx.organizationId),
      this.providers.container().listContainers(ctx.organizationId),
      this.providers.database().listDatabases(ctx.organizationId),
      this.store.deployments.list(ctx.organizationId, { orderBy: "queuedAt", direction: "desc", limit: 500 }),
    ]);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const deploymentsToday = deployments.filter((d) => Date.parse(d.queuedAt) >= startOfDay.getTime()).length;

    const healthy = apps.filter((a) => a.status === "healthy").length;
    const degraded = apps.filter((a) => a.status === "degraded").length;
    const failed = apps.filter((a) => a.status === "failed").length;
    const total = apps.length || 1;
    const other = Math.max(0, apps.length - healthy - degraded - failed);
    const availabilityPercent = Math.min(100, Math.round(((healthy + other) / total) * 10000) / 100);

    return {
      counts: {
        projects: projectsCount,
        applications: apps.length,
        servers: servers.length,
        containers: containers.length,
        databases: databases.length,
        deploymentsToday,
        healthy,
        degraded,
        failed,
      },
      availabilityPercent,
      allHealthy: degraded === 0 && failed === 0,
    };
  }
}
