import type { AuthContext, LogEntry, LogQuery, MetricQuery, MetricSeries } from "@runforge/shared";
import type { ProviderRegistry } from "@runforge/providers";
import type { PermissionService } from "../auth/permissions";

/** Centralized logs and metrics (spec §35-§37). */
export class MonitoringService {
  constructor(
    private readonly permissions: PermissionService,
    private readonly providers: ProviderRegistry,
  ) {}

  async queryLogs(ctx: AuthContext, query: LogQuery): Promise<LogEntry[]> {
    this.permissions.require(ctx, "logs:read");
    return this.providers.logs().query(ctx.organizationId, query);
  }

  async listLogServices(ctx: AuthContext): Promise<string[]> {
    this.permissions.require(ctx, "logs:read");
    return this.providers.logs().listServices(ctx.organizationId);
  }

  async queryMetrics(ctx: AuthContext, query: MetricQuery): Promise<MetricSeries[]> {
    this.permissions.require(ctx, "metrics:read");
    return this.providers.metrics().query(ctx.organizationId, query);
  }
}
