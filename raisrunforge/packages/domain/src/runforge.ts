import { createDemoRegistry, createDemoWorld, DemoWorld } from "@runforge/providers";
import type { ProviderRegistry } from "@runforge/providers";
import type { AuthContext } from "@runforge/shared";
import { AuthService, DemoAuthProvider, PasswordAuthProvider, TokenAuthProvider } from "./auth/auth-service";
import { OrganizationService } from "./auth/organization-service";
import { PermissionService } from "./auth/permissions";
import { createMemoryDataStore } from "./store/memory";
import type { DataStore } from "./store/repository";
import { EventService } from "./services/event-service";
import { JobService } from "./services/job-service";
import { ProjectService } from "./services/project-service";
import { ApplicationService } from "./services/application-service";
import { DeploymentService } from "./services/deployment-service";
import { ServerService } from "./services/server-service";
import { ContainerService } from "./services/container-service";
import { DatabaseService } from "./services/database-service";
import { DomainService } from "./services/domain-service";
import { NetworkingService } from "./services/networking-service";
import { MonitoringService } from "./services/monitoring-service";
import { IncidentService } from "./services/incident-service";
import { OverviewService } from "./services/overview-service";
import { SearchService } from "./services/search-service";
import { GraphService } from "./services/graph-service";
import { CatalogService } from "./services/catalog-service";
import { McpService } from "./mcp/mcp-service";
import { DEMO_IDS } from "@runforge/providers";

export interface RunForgeOptions {
  mode?: "demo" | "production";
  world?: DemoWorld;
  registry?: ProviderRegistry;
  store?: DataStore;
}

/**
 * RunForge is the composition root: it wires providers, the data store and
 * every domain service together exactly once. REST handlers, the MCP server
 * and tests all construct one instance and share it — this is how the spec's
 * "do not duplicate business logic between REST and MCP" rule is enforced.
 */
export class RunForge {
  readonly mode: "demo" | "production";
  readonly world?: DemoWorld;
  readonly registry: ProviderRegistry;
  readonly store: DataStore;

  readonly permissions: PermissionService;
  readonly auth: AuthService;
  readonly organizations: OrganizationService;
  readonly events: EventService;
  readonly jobs: JobService;
  readonly projects: ProjectService;
  readonly applications: ApplicationService;
  readonly deployments: DeploymentService;
  readonly servers: ServerService;
  readonly containers: ContainerService;
  readonly databases: DatabaseService;
  readonly domains: DomainService;
  readonly networking: NetworkingService;
  readonly monitoring: MonitoringService;
  readonly incidents: IncidentService;
  readonly overview: OverviewService;
  readonly search: SearchService;
  readonly graph: GraphService;
  readonly catalog?: CatalogService;
  readonly mcp: McpService;

  constructor(options: RunForgeOptions = {}) {
    this.mode = options.mode ?? "demo";
    const world = options.world ?? (this.mode === "demo" ? createDemoWorld() : undefined);
    this.world = world;
    this.registry = options.registry ?? (world ? createDemoRegistry(world) : (() => { throw new Error("A ProviderRegistry is required outside demo mode"); })());
    this.store = options.store ?? createMemoryDataStore(world);

    this.permissions = new PermissionService();
    this.events = new EventService(this.store, this.permissions, async (ctx: AuthContext) => {
      if (ctx.actorType === "system") return "RunForge";
      if (ctx.actorType === "agent") return "RunForge Agent";
      const user = ctx.userId ? await this.store.users.get(ctx.userId) : null;
      if (user) return user.name;
      if (ctx.tokenId) {
        const token = await this.store.mcpTokens.get(ctx.organizationId, ctx.tokenId);
        return token?.name ?? "MCP Client";
      }
      return ctx.actorType === "ai" ? "AI Agent" : "Unknown";
    });
    this.auth = new AuthService(
      [
        new PasswordAuthProvider(this.store),
        new DemoAuthProvider(this.store, { userId: DEMO_IDS.user, organizationId: DEMO_IDS.org }),
        new TokenAuthProvider(this.store),
      ],
      this.store,
    );
    this.organizations = new OrganizationService(this.store, this.permissions, this.events);
    this.jobs = new JobService(this.store, this.permissions);

    this.projects = new ProjectService(this.store, this.permissions, this.events);
    this.applications = new ApplicationService(this.store, this.permissions, this.events, this.registry);
    this.deployments = new DeploymentService(this.store, this.permissions, this.events, this.jobs, this.registry, this.applications);
    this.servers = new ServerService(this.permissions, this.events, this.registry, this.store);
    this.containers = new ContainerService(this.permissions, this.events, this.registry);
    this.databases = new DatabaseService(this.permissions, this.events, this.registry);
    this.domains = new DomainService(this.permissions, this.events, this.registry);
    this.networking = new NetworkingService(this.permissions, this.events, this.registry);
    this.monitoring = new MonitoringService(this.permissions, this.registry);
    this.incidents = new IncidentService(this.store, this.permissions, this.events);
    this.overview = new OverviewService(this.store, this.permissions, this.registry);
    this.search = new SearchService(this.store, this.permissions, this.registry);
    this.graph = new GraphService(this.store, this.permissions, this.registry);
    if (world) this.catalog = new CatalogService(world);

    this.mcp = new McpService({
      projects: this.projects,
      applications: this.applications,
      deployments: this.deployments,
      servers: this.servers,
      containers: this.containers,
      databases: this.databases,
      domains: this.domains,
      events: this.events,
      incidents: this.incidents,
      monitoring: this.monitoring,
    });
  }

  /** Advances every queued/running job by one reconciliation step. Call on an interval. */
  async tick(): Promise<number> {
    return this.jobs.tick();
  }
}

export function createDemoRunForge(): RunForge {
  return new RunForge({ mode: "demo" });
}
