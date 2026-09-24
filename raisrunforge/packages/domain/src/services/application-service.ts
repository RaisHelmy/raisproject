import type {
  Application,
  ApplicationRevision,
  AuthContext,
  Environment,
  EnvironmentVariable,
  ProviderKind,
  Runtime,
  SourceType,
} from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import type { ApplicationProvider } from "@runforge/providers";
import type { ProviderRegistry } from "@runforge/providers";
import { DomainError, assertString, slugify } from "../errors";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";

export interface CreateApplicationInput {
  projectId: string;
  environmentId: string;
  environment: Environment;
  name: string;
  runtime: Runtime;
  runtimeLabel: string;
  sourceType: SourceType;
  repository?: string;
  branch?: string;
  image?: string;
  serverId?: string;
  provider?: ProviderKind;
  port?: number;
  healthPath?: string;
  cpu?: number;
  memoryMb?: number;
  instances?: number;
}

/**
 * ApplicationService is the primary deployment abstraction (spec §14). It owns
 * application records and revisions; actual lifecycle operations are executed
 * through an ApplicationProvider resolved by the resource's provider kind.
 */
export class ApplicationService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly events: EventService,
    private readonly providers: ProviderRegistry,
  ) {}

  async list(ctx: AuthContext, filter: { projectId?: string; environment?: Environment } = {}): Promise<Application[]> {
    this.permissions.require(ctx, "application:read");
    const where: Partial<Application> = {};
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.environment) where.environment = filter.environment;
    return this.store.applications.list(ctx.organizationId, { where, orderBy: "name" });
  }

  async get(ctx: AuthContext, id: string): Promise<Application> {
    this.permissions.require(ctx, "application:read");
    const app = await this.store.applications.get(ctx.organizationId, id);
    this.permissions.requireTenant(ctx, app, "application", id);
    return app!;
  }

  async create(ctx: AuthContext, input: CreateApplicationInput): Promise<Application> {
    this.permissions.require(ctx, "application:write");
    const ts = nowIso();
    const app: Application = {
      id: newId("app"),
      organizationId: ctx.organizationId,
      projectId: input.projectId,
      environmentId: input.environmentId,
      environment: input.environment,
      name: assertString(input.name, "name", { min: 2, max: 64 }),
      slug: slugify(input.name),
      status: "starting",
      runtime: input.runtime,
      runtimeLabel: input.runtimeLabel,
      packaging: input.sourceType === "docker_image" || input.sourceType === "dockerfile" ? "docker" : "docker",
      source: { type: input.sourceType, repository: input.repository, branch: input.branch ?? "main", image: input.image },
      serverId: input.serverId,
      provider: input.provider ?? "demo",
      port: input.port ?? 8080,
      healthPath: input.healthPath ?? "/health",
      resources: {
        cpu: input.cpu ?? 1,
        memoryMb: input.memoryMb ?? 512,
        instances: input.instances ?? 1,
        minInstances: 1,
        maxInstances: Math.max(1, input.instances ?? 1) + 2,
      },
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.applications.insert(app);
    await this.events.record(ctx, {
      action: "application.created",
      resourceType: "application",
      resourceId: app.id,
      resourceName: app.name,
      projectId: app.projectId,
      message: `Application ${app.name} created`,
      after: { runtime: app.runtime, environment: app.environment },
    });
    return app;
  }

  async restart(ctx: AuthContext, id: string): Promise<Application> {
    this.permissions.require(ctx, "application:restart");
    const app = await this.get(ctx, id);
    const provider = this.applicationProvider(app);
    await provider.restart(ctx.organizationId, app.id);
    const updated = await this.store.applications.update(ctx.organizationId, app.id, { status: "healthy" });
    await this.events.record(ctx, {
      action: "application.restarted",
      resourceType: "application",
      resourceId: app.id,
      resourceName: app.name,
      projectId: app.projectId,
      message: `Application ${app.name} restarted`,
      simulated: app.provider === "demo",
    });
    return updated;
  }

  async stop(ctx: AuthContext, id: string): Promise<Application> {
    this.permissions.require(ctx, "application:write");
    const app = await this.get(ctx, id);
    await this.applicationProvider(app).stop(ctx.organizationId, app.id);
    const updated = await this.store.applications.update(ctx.organizationId, app.id, { status: "stopped" });
    await this.events.record(ctx, {
      action: "application.stopped",
      resourceType: "application",
      resourceId: app.id,
      resourceName: app.name,
      projectId: app.projectId,
      message: `Application ${app.name} stopped`,
      simulated: app.provider === "demo",
    });
    return updated;
  }

  async start(ctx: AuthContext, id: string): Promise<Application> {
    this.permissions.require(ctx, "application:write");
    const app = await this.get(ctx, id);
    await this.applicationProvider(app).start(ctx.organizationId, app.id);
    const updated = await this.store.applications.update(ctx.organizationId, app.id, { status: "healthy" });
    await this.events.record(ctx, {
      action: "application.started",
      resourceType: "application",
      resourceId: app.id,
      resourceName: app.name,
      projectId: app.projectId,
      message: `Application ${app.name} started`,
      simulated: app.provider === "demo",
    });
    return updated;
  }

  async listRevisions(ctx: AuthContext, applicationId: string): Promise<ApplicationRevision[]> {
    this.permissions.require(ctx, "application:read");
    await this.get(ctx, applicationId);
    return this.store.revisions.list(ctx.organizationId, { where: { applicationId } as Partial<ApplicationRevision>, orderBy: "createdAt", direction: "desc" });
  }

  async rollback(ctx: AuthContext, applicationId: string, revisionId: string): Promise<Application> {
    const app = await this.get(ctx, applicationId);
    // Rollback is DANGEROUS on production (spec §44).
    this.permissions.require(ctx, app.environment === "production" ? "application:rollback" : "application:write");
    const revision = await this.store.revisions.get(ctx.organizationId, revisionId);
    this.permissions.requireTenant(ctx, revision, "revision", revisionId);
    if (revision!.applicationId !== applicationId) throw DomainError.validation("Revision does not belong to this application");

    await this.applicationProvider(app).rollback(ctx.organizationId, app.id, revision!);
    for (const rev of await this.listRevisions(ctx, applicationId)) {
      await this.store.revisions.update(ctx.organizationId, rev.id, { trafficPercent: rev.id === revisionId ? 100 : 0 });
    }
    const updated = await this.store.applications.update(ctx.organizationId, app.id, {
      currentRevisionId: revision!.id,
      currentVersion: revision!.version,
      status: "healthy",
    });
    await this.events.record(ctx, {
      action: "application.rolled_back",
      resourceType: "application",
      resourceId: app.id,
      resourceName: app.name,
      projectId: app.projectId,
      message: `Rolled back ${app.name} to ${revision!.version}`,
      before: { version: app.currentVersion },
      after: { version: revision!.version },
      simulated: app.provider === "demo",
    });
    return updated;
  }

  async scale(ctx: AuthContext, id: string, instances: number): Promise<Application> {
    this.permissions.require(ctx, "application:write");
    const app = await this.get(ctx, id);
    if (instances < 0 || instances > 50) throw DomainError.validation("instances must be between 0 and 50");
    await this.applicationProvider(app).scale(ctx.organizationId, app.id, instances);
    const updated = await this.store.applications.update(ctx.organizationId, app.id, {
      resources: { ...app.resources, instances },
    });
    await this.events.record(ctx, {
      action: "application.scaled",
      resourceType: "application",
      resourceId: app.id,
      resourceName: app.name,
      projectId: app.projectId,
      message: `Scaled ${app.name} to ${instances} instance(s)`,
      before: { instances: app.resources.instances },
      after: { instances },
    });
    return updated;
  }

  async getEnvironment(ctx: AuthContext, id: string): Promise<EnvironmentVariable[]> {
    this.permissions.require(ctx, "application:read");
    const app = await this.get(ctx, id);
    return this.applicationProvider(app).getEnvironment(ctx.organizationId, app.id);
  }

  async setEnvironment(ctx: AuthContext, id: string, vars: EnvironmentVariable[]): Promise<EnvironmentVariable[]> {
    this.permissions.require(ctx, "application:write");
    const app = await this.get(ctx, id);
    const before = await this.applicationProvider(app).getEnvironment(ctx.organizationId, app.id);
    await this.applicationProvider(app).setEnvironment(ctx.organizationId, app.id, vars);
    await this.events.record(ctx, {
      action: "environment.updated",
      resourceType: "application",
      resourceId: app.id,
      resourceName: app.name,
      projectId: app.projectId,
      message: `Environment variables updated for ${app.name}`,
      before: { count: before.length },
      after: { count: vars.length },
    });
    return vars;
  }

  async getHealth(ctx: AuthContext, id: string) {
    this.permissions.require(ctx, "application:read");
    const app = await this.get(ctx, id);
    return this.applicationProvider(app).getHealth(ctx.organizationId, app.id);
  }

  applicationProvider(app: Application): ApplicationProvider {
    return this.providers.application(app.provider);
  }
}
