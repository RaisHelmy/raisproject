import type {
  Application,
  ApplicationRevision,
  Container,
  Database,
  Deployment,
  DeploymentStep,
  Domain,
  Event,
  Incident,
  LogSeverity,
  Route,
  Server,
  ServiceRecord,
} from "@runforge/shared";
import { DEPLOYMENT_STAGES } from "@runforge/shared";
import { DemoWorld } from "./world";
import { seededRandom, pick } from "../util/random";

/** Stable identifiers used across the demo dataset, tests and the UI. */
export const DEMO_IDS = {
  org: "org_demo",
  user: "usr_demo_owner",
  superAdminUser: "usr_rais_admin",
  superAdminMember: "mem_rais_admin",
  aiUser: "usr_demo_ai",
  member: "mem_demo_owner",
  project: "prj_merc999",
  projectTools: "prj_internal_tools",
  projectMarketing: "prj_marketing",
  envProduction: "env_merc999_production",
  envStaging: "env_merc999_staging",
  envToolsProd: "env_tools_production",
  envMarketingProd: "env_marketing_production",
  serverProduction: "srv_production_01",
  serverStaging: "srv_staging_01",
  serverDevelopment: "srv_development_01",
  appApi: "app_merc_api",
  appWorker: "app_merc_worker",
  appFrontend: "app_merc_frontend",
  appApiStaging: "app_merc_api_staging",
  appTools: "app_internal_tools",
  appMarketing: "app_marketing_site",
  dbPostgres: "db_merc_postgres",
  dbRedis: "db_merc_redis",
  dbPostgresStaging: "db_merc_postgres_staging",
  mcpToken: "mcp_demo_token",
  tunnelProduction: "tun_production_01",
} as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function completedSteps(startedAt: number, durationMs: number, failAt?: number): DeploymentStep[] {
  const per = durationMs / DEPLOYMENT_STAGES.length;
  return DEPLOYMENT_STAGES.map((stage, i) => {
    const s = startedAt + per * i;
    if (failAt !== undefined && i > failAt) {
      return { key: stage.status, label: stage.label, state: "skipped" as const };
    }
    if (failAt !== undefined && i === failAt) {
      return {
        key: stage.status,
        label: stage.label,
        state: "failed" as const,
        startedAt: iso(s),
        finishedAt: iso(s + per),
        message: "Health check failed: 503 from /health after 30s",
      };
    }
    return {
      key: stage.status,
      label: stage.label,
      state: "success" as const,
      startedAt: iso(s),
      finishedAt: iso(s + per),
    };
  });
}

/** Populates a DemoWorld with a deterministic, realistic dataset. */
export function seedDemoWorld(world: DemoWorld): DemoWorld {
  const now = world.now();
  const ts = iso(now);
  const org = DEMO_IDS.org;
  const rand = seededRandom("runforge-demo-seed");

  // --- Identity ------------------------------------------------------------
  world.users.push(
    {
      id: DEMO_IDS.user,
      email: "demo@runforge.dev",
      name: "Demo Owner",
      createdAt: iso(now - 90 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.aiUser,
      email: "ai@runforge.dev",
      name: "RunForge AI",
      createdAt: iso(now - 30 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.superAdminUser,
      email: "raishelmy97@gmail.com",
      name: "Rais Helmy",
      // pbkdf2$100000$<saltB64>$<hashB64> for "P@ssw0rd" (see IMPORTANT.md) —
      // the one seeded user with a real password credential, checked by
      // PasswordAuthProvider (see packages/domain/src/auth/auth-service.ts).
      passwordHash: "pbkdf2$100000$qF//tTZ42D/XXggmZOOsPw==$p1lwdt20PF0ocOLR8fMdjq9BFdzcUPBY5SXLQz/QxaQ=",
      createdAt: iso(now - 1 * DAY),
      updatedAt: ts,
    },
  );
  world.organizations.push({
    id: org,
    name: "MERC999 Labs",
    slug: "merc999-labs",
    plan: "pro",
    createdAt: iso(now - 90 * DAY),
    updatedAt: ts,
  });
  world.members.push(
    {
      id: DEMO_IDS.member,
      organizationId: org,
      userId: DEMO_IDS.user,
      role: "owner",
      status: "active",
      createdAt: iso(now - 90 * DAY),
      updatedAt: ts,
    },
    {
      id: "mem_demo_ai",
      organizationId: org,
      userId: DEMO_IDS.aiUser,
      role: "ai_agent",
      status: "active",
      createdAt: iso(now - 30 * DAY),
      updatedAt: ts,
    },
    {
      id: "mem_demo_dev",
      organizationId: org,
      userId: "usr_demo_dev",
      role: "developer",
      status: "active",
      createdAt: iso(now - 60 * DAY),
      updatedAt: ts,
    },
    {
      id: "mem_demo_viewer",
      organizationId: org,
      userId: "usr_demo_viewer",
      role: "viewer",
      status: "invited",
      createdAt: iso(now - 2 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.superAdminMember,
      organizationId: org,
      userId: DEMO_IDS.superAdminUser,
      role: "owner",
      status: "active",
      createdAt: iso(now - 1 * DAY),
      updatedAt: ts,
    },
  );
  world.users.push(
    { id: "usr_demo_dev", email: "aisyah@merc999.dev", name: "Aisyah Rahman", createdAt: iso(now - 60 * DAY), updatedAt: ts },
    { id: "usr_demo_viewer", email: "wei@merc999.dev", name: "Wei Lim", createdAt: iso(now - 2 * DAY), updatedAt: ts },
  );

  // --- Projects / environments ---------------------------------------------
  world.projects.push(
    {
      id: DEMO_IDS.project,
      organizationId: org,
      name: "MERC999",
      slug: "merc999",
      description: "Core MERC999 platform: API, worker, frontend and data services.",
      status: "active",
      createdAt: iso(now - 80 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.projectTools,
      organizationId: org,
      name: "Internal Tools",
      slug: "internal-tools",
      description: "Back-office dashboards and admin tooling.",
      status: "active",
      createdAt: iso(now - 40 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.projectMarketing,
      organizationId: org,
      name: "Marketing Site",
      slug: "marketing-site",
      description: "Public website and landing pages.",
      status: "active",
      createdAt: iso(now - 20 * DAY),
      updatedAt: ts,
    },
  );
  world.environments.push(
    { id: DEMO_IDS.envProduction, organizationId: org, projectId: DEMO_IDS.project, name: "production", slug: "production", createdAt: iso(now - 80 * DAY), updatedAt: ts },
    { id: DEMO_IDS.envStaging, organizationId: org, projectId: DEMO_IDS.project, name: "staging", slug: "staging", createdAt: iso(now - 80 * DAY), updatedAt: ts },
    { id: DEMO_IDS.envToolsProd, organizationId: org, projectId: DEMO_IDS.projectTools, name: "production", slug: "production", createdAt: iso(now - 40 * DAY), updatedAt: ts },
    { id: DEMO_IDS.envMarketingProd, organizationId: org, projectId: DEMO_IDS.projectMarketing, name: "production", slug: "production", createdAt: iso(now - 20 * DAY), updatedAt: ts },
  );

  // --- Servers ---------------------------------------------------------------
  const servers: Server[] = [
    {
      id: DEMO_IDS.serverProduction,
      organizationId: org,
      name: "production-01",
      status: "online",
      provider: "hetzner",
      providerLabel: "Hetzner",
      region: "Singapore",
      os: "Ubuntu 24.04",
      ipAddress: "10.20.0.11",
      cpuCores: 8,
      memoryMb: 32768,
      diskGb: 420,
      agentVersion: "0.1.0",
      lastHeartbeatAt: ts,
      uptimeSeconds: 41 * 24 * 3600 + 3 * 3600,
      tags: ["production", "docker", "tunnel"],
      createdAt: iso(now - 75 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.serverStaging,
      organizationId: org,
      name: "staging-01",
      status: "online",
      provider: "digitalocean",
      providerLabel: "DigitalOcean",
      region: "Singapore",
      os: "Ubuntu 24.04",
      ipAddress: "10.20.0.21",
      cpuCores: 4,
      memoryMb: 8192,
      diskGb: 160,
      agentVersion: "0.1.0",
      lastHeartbeatAt: ts,
      uptimeSeconds: 12 * 24 * 3600,
      tags: ["staging", "docker"],
      createdAt: iso(now - 60 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.serverDevelopment,
      organizationId: org,
      name: "development-01",
      status: "offline",
      provider: "self_hosted",
      providerLabel: "Self-hosted",
      region: "Kuala Lumpur (home lab)",
      os: "Ubuntu 22.04",
      ipAddress: "192.168.1.40",
      cpuCores: 4,
      memoryMb: 16384,
      diskGb: 500,
      agentVersion: "0.0.9",
      lastHeartbeatAt: iso(now - 6 * HOUR),
      uptimeSeconds: 0,
      tags: ["development", "proxmox"],
      createdAt: iso(now - 30 * DAY),
      updatedAt: ts,
    },
  ];
  world.servers.push(...servers);

  // --- Applications ----------------------------------------------------------
  const baseResources = { cpu: 1, memoryMb: 1024, instances: 1, minInstances: 1, maxInstances: 3 };
  const apps: Application[] = [
    {
      id: DEMO_IDS.appApi,
      organizationId: org,
      projectId: DEMO_IDS.project,
      environmentId: DEMO_IDS.envProduction,
      environment: "production",
      name: "MERC999 API",
      slug: "merc999-api",
      status: "healthy",
      runtime: "dotnet",
      runtimeLabel: ".NET 8",
      packaging: "docker",
      source: { type: "github", repository: "merc999/merc-api", branch: "main" },
      serverId: DEMO_IDS.serverProduction,
      provider: "demo",
      domain: "api.example.com",
      url: "https://api.example.com",
      port: 8080,
      healthPath: "/health",
      databaseId: DEMO_IDS.dbPostgres,
      storageId: "sto_merc_uploads",
      currentRevisionId: "rev_merc_api_v1_8_32",
      currentVersion: "v1.8.32",
      resources: { ...baseResources, cpu: 2, memoryMb: 2048, instances: 2, maxInstances: 4 },
      createdAt: iso(now - 75 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.appWorker,
      organizationId: org,
      projectId: DEMO_IDS.project,
      environmentId: DEMO_IDS.envProduction,
      environment: "production",
      name: "MERC999 Worker",
      slug: "merc999-worker",
      status: "healthy",
      runtime: "dotnet",
      runtimeLabel: ".NET 8",
      packaging: "docker",
      source: { type: "github", repository: "merc999/merc-worker", branch: "main" },
      serverId: DEMO_IDS.serverProduction,
      provider: "demo",
      port: 0,
      healthPath: "/health",
      databaseId: DEMO_IDS.dbPostgres,
      currentRevisionId: "rev_merc_worker_v1_4_2",
      currentVersion: "v1.4.2",
      resources: { ...baseResources, memoryMb: 512 },
      createdAt: iso(now - 70 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.appFrontend,
      organizationId: org,
      projectId: DEMO_IDS.project,
      environmentId: DEMO_IDS.envProduction,
      environment: "production",
      name: "MERC999 Frontend",
      slug: "merc999-frontend",
      status: "healthy",
      runtime: "node",
      runtimeLabel: "Next.js 15",
      packaging: "docker",
      source: { type: "github", repository: "merc999/merc-web", branch: "main" },
      serverId: DEMO_IDS.serverProduction,
      provider: "demo",
      domain: "app.example.com",
      url: "https://app.example.com",
      port: 3000,
      healthPath: "/api/health",
      currentRevisionId: "rev_merc_frontend_v2_3_0",
      currentVersion: "v2.3.0",
      resources: { ...baseResources },
      createdAt: iso(now - 68 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.appApiStaging,
      organizationId: org,
      projectId: DEMO_IDS.project,
      environmentId: DEMO_IDS.envStaging,
      environment: "staging",
      name: "MERC999 API",
      slug: "merc999-api-staging",
      status: "degraded",
      runtime: "dotnet",
      runtimeLabel: ".NET 8",
      packaging: "docker",
      source: { type: "github", repository: "merc999/merc-api", branch: "develop" },
      serverId: DEMO_IDS.serverStaging,
      provider: "demo",
      domain: "staging-api.example.com",
      url: "https://staging-api.example.com",
      port: 8080,
      healthPath: "/health",
      databaseId: DEMO_IDS.dbPostgresStaging,
      currentRevisionId: "rev_merc_api_staging_v1_9_0_rc2",
      currentVersion: "v1.9.0-rc2",
      resources: { ...baseResources },
      createdAt: iso(now - 60 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.appTools,
      organizationId: org,
      projectId: DEMO_IDS.projectTools,
      environmentId: DEMO_IDS.envToolsProd,
      environment: "production",
      name: "Ops Dashboard",
      slug: "ops-dashboard",
      status: "healthy",
      runtime: "bun",
      runtimeLabel: "Bun 1.3",
      packaging: "docker",
      source: { type: "gitlab", repository: "merc999/ops-dashboard", branch: "main" },
      serverId: DEMO_IDS.serverProduction,
      provider: "demo",
      domain: "tools.example.com",
      url: "https://tools.example.com",
      port: 3001,
      healthPath: "/healthz",
      databaseId: DEMO_IDS.dbPostgres,
      currentRevisionId: "rev_tools_v0_9_4",
      currentVersion: "v0.9.4",
      resources: { ...baseResources, memoryMb: 512 },
      createdAt: iso(now - 40 * DAY),
      updatedAt: ts,
    },
    {
      id: DEMO_IDS.appMarketing,
      organizationId: org,
      projectId: DEMO_IDS.projectMarketing,
      environmentId: DEMO_IDS.envMarketingProd,
      environment: "production",
      name: "Marketing Site",
      slug: "marketing-site",
      status: "healthy",
      runtime: "node",
      runtimeLabel: "Astro 5",
      packaging: "docker",
      source: { type: "github", repository: "merc999/www", branch: "main" },
      serverId: DEMO_IDS.serverProduction,
      provider: "demo",
      domain: "example.com",
      url: "https://example.com",
      port: 4321,
      healthPath: "/",
      currentRevisionId: "rev_marketing_v1_2_0",
      currentVersion: "v1.2.0",
      resources: { ...baseResources, memoryMb: 256 },
      createdAt: iso(now - 20 * DAY),
      updatedAt: ts,
    },
  ];
  world.applications.push(...apps);
  for (const app of apps) {
    world.appRuntime.set(app.id, {
      restarts: app.id === DEMO_IDS.appApiStaging ? 3 : 0,
      stopped: false,
      instances: app.resources.instances,
      startedAt: iso(now - 3 * DAY),
    });
    world.environmentVariables.set(app.id, [
      { key: "ASPNETCORE_ENVIRONMENT", value: app.environment === "production" ? "Production" : "Staging", secret: false },
      { key: "PORT", value: String(app.port || 8080), secret: false },
      { key: "DATABASE_URL", value: "postgres://merc:••••••@10.20.0.11:5432/merc", secret: true },
      { key: "REDIS_URL", value: "redis://10.20.0.11:6379", secret: false },
      { key: "LOG_LEVEL", value: "info", secret: false },
    ]);
  }

  // --- Revisions -------------------------------------------------------------
  const revisions: ApplicationRevision[] = [
    { id: "rev_merc_api_v1_8_32", applicationId: DEMO_IDS.appApi, version: "v1.8.32", commitSha: "abc1234", commitMessage: "Tune connection pool and add order lookup index", trafficPercent: 100, status: "healthy", createdAt: iso(now - 2 * HOUR), deploymentId: "dep_api_v1_8_32" },
    { id: "rev_merc_api_v1_8_31", applicationId: DEMO_IDS.appApi, version: "v1.8.31", commitSha: "9f3e2d1", commitMessage: "Fix timezone handling in invoice export", trafficPercent: 0, status: "healthy", createdAt: iso(now - 1 * DAY), deploymentId: "dep_api_v1_8_31" },
    { id: "rev_merc_api_v1_8_30", applicationId: DEMO_IDS.appApi, version: "v1.8.30", commitSha: "77c0b8a", commitMessage: "Upgrade Npgsql to 9.0", trafficPercent: 0, status: "healthy", createdAt: iso(now - 3 * DAY), deploymentId: "dep_api_v1_8_30" },
    { id: "rev_merc_worker_v1_4_2", applicationId: DEMO_IDS.appWorker, version: "v1.4.2", commitSha: "5d21e0f", commitMessage: "Retry failed webhook deliveries", trafficPercent: 100, status: "healthy", createdAt: iso(now - 5 * HOUR), deploymentId: "dep_worker_v1_4_2" },
    { id: "rev_merc_worker_v1_4_1", applicationId: DEMO_IDS.appWorker, version: "v1.4.1", commitSha: "0a9b7c6", commitMessage: "Batch email sending", trafficPercent: 0, status: "healthy", createdAt: iso(now - 4 * DAY), deploymentId: "dep_worker_v1_4_1" },
    { id: "rev_merc_frontend_v2_3_0", applicationId: DEMO_IDS.appFrontend, version: "v2.3.0", commitSha: "e4f5a6b", commitMessage: "New dashboard layout", trafficPercent: 100, status: "healthy", createdAt: iso(now - 8 * HOUR), deploymentId: "dep_frontend_v2_3_0" },
    { id: "rev_merc_frontend_v2_2_9", applicationId: DEMO_IDS.appFrontend, version: "v2.2.9", commitSha: "c1d2e3f", commitMessage: "Fix mobile nav", trafficPercent: 0, status: "healthy", createdAt: iso(now - 2 * DAY), deploymentId: "dep_frontend_v2_2_9" },
    { id: "rev_merc_api_staging_v1_9_0_rc2", applicationId: DEMO_IDS.appApiStaging, version: "v1.9.0-rc2", commitSha: "b2c3d4e", commitMessage: "Experimental caching layer", trafficPercent: 100, status: "degraded", createdAt: iso(now - 40 * MINUTE), deploymentId: "dep_api_staging_v1_9_0_rc2" },
    { id: "rev_merc_api_staging_v1_9_0_rc1", applicationId: DEMO_IDS.appApiStaging, version: "v1.9.0-rc1", commitSha: "a1b2c3d", commitMessage: "Caching layer scaffold", trafficPercent: 0, status: "failed", createdAt: iso(now - 90 * MINUTE), deploymentId: "dep_api_staging_v1_9_0_rc1" },
    { id: "rev_tools_v0_9_4", applicationId: DEMO_IDS.appTools, version: "v0.9.4", commitSha: "f6e5d4c", commitMessage: "Add server cost widget", trafficPercent: 100, status: "healthy", createdAt: iso(now - 1 * DAY), deploymentId: "dep_tools_v0_9_4" },
    { id: "rev_marketing_v1_2_0", applicationId: DEMO_IDS.appMarketing, version: "v1.2.0", commitSha: "1122abc", commitMessage: "Launch pricing page", trafficPercent: 100, status: "healthy", createdAt: iso(now - 2 * DAY), deploymentId: "dep_marketing_v1_2_0" },
  ].map((r) => ({ ...r, organizationId: org }) as ApplicationRevision);
  world.revisions.push(...revisions);

  // --- Deployments -----------------------------------------------------------
  const appById = new Map(apps.map((a) => [a.id, a]));
  const serverById = new Map(servers.map((s) => [s.id, s]));
  const deploymentSpecs: Array<{
    id: string;
    appId: string;
    version: string;
    sha: string;
    message: string;
    ago: number;
    durationMs: number;
    failed?: boolean;
    trigger?: Deployment["trigger"];
    by?: string;
  }> = [
    { id: "dep_api_v1_8_32", appId: DEMO_IDS.appApi, version: "v1.8.32", sha: "abc1234", message: "Tune connection pool and add order lookup index", ago: 2 * HOUR, durationMs: 222_000, trigger: "webhook", by: "GitHub push" },
    { id: "dep_worker_v1_4_2", appId: DEMO_IDS.appWorker, version: "v1.4.2", sha: "5d21e0f", message: "Retry failed webhook deliveries", ago: 5 * HOUR, durationMs: 148_000, trigger: "webhook", by: "GitHub push" },
    { id: "dep_frontend_v2_3_0", appId: DEMO_IDS.appFrontend, version: "v2.3.0", sha: "e4f5a6b", message: "New dashboard layout", ago: 8 * HOUR, durationMs: 305_000, trigger: "manual", by: "Aisyah Rahman" },
    { id: "dep_api_staging_v1_9_0_rc2", appId: DEMO_IDS.appApiStaging, version: "v1.9.0-rc2", sha: "b2c3d4e", message: "Experimental caching layer", ago: 40 * MINUTE, durationMs: 201_000, trigger: "manual", by: "Aisyah Rahman" },
    { id: "dep_api_staging_v1_9_0_rc1", appId: DEMO_IDS.appApiStaging, version: "v1.9.0-rc1", sha: "a1b2c3d", message: "Caching layer scaffold", ago: 90 * MINUTE, durationMs: 96_000, failed: true, trigger: "manual", by: "Aisyah Rahman" },
    { id: "dep_api_v1_8_31", appId: DEMO_IDS.appApi, version: "v1.8.31", sha: "9f3e2d1", message: "Fix timezone handling in invoice export", ago: 1 * DAY, durationMs: 214_000, trigger: "webhook", by: "GitHub push" },
    { id: "dep_tools_v0_9_4", appId: DEMO_IDS.appTools, version: "v0.9.4", sha: "f6e5d4c", message: "Add server cost widget", ago: 1 * DAY + 3 * HOUR, durationMs: 88_000, trigger: "webhook", by: "GitLab push" },
    { id: "dep_frontend_v2_2_9", appId: DEMO_IDS.appFrontend, version: "v2.2.9", sha: "c1d2e3f", message: "Fix mobile nav", ago: 2 * DAY, durationMs: 290_000, trigger: "webhook", by: "GitHub push" },
    { id: "dep_marketing_v1_2_0", appId: DEMO_IDS.appMarketing, version: "v1.2.0", sha: "1122abc", message: "Launch pricing page", ago: 2 * DAY + 5 * HOUR, durationMs: 74_000, trigger: "manual", by: "Demo Owner" },
    { id: "dep_api_v1_8_30", appId: DEMO_IDS.appApi, version: "v1.8.30", sha: "77c0b8a", message: "Upgrade Npgsql to 9.0", ago: 3 * DAY, durationMs: 230_000, trigger: "mcp", by: "Claude (MCP)" },
    { id: "dep_worker_v1_4_1", appId: DEMO_IDS.appWorker, version: "v1.4.1", sha: "0a9b7c6", message: "Batch email sending", ago: 4 * DAY, durationMs: 151_000, trigger: "webhook", by: "GitHub push" },
  ];
  for (const spec of deploymentSpecs) {
    const app = appById.get(spec.appId)!;
    const server = app.serverId ? serverById.get(app.serverId) : undefined;
    const startedAt = now - spec.ago;
    const finishedAt = startedAt + spec.durationMs;
    world.deployments.push({
      id: spec.id,
      organizationId: org,
      projectId: app.projectId,
      applicationId: app.id,
      applicationName: app.name,
      environment: app.environment,
      serverId: server?.id,
      serverName: server?.name,
      revisionId: revisions.find((r) => r.deploymentId === spec.id)?.id,
      version: spec.version,
      commitSha: spec.sha,
      commitMessage: spec.message,
      branch: app.source.branch ?? "main",
      trigger: spec.trigger ?? "manual",
      triggeredBy: spec.by ?? "Demo Owner",
      status: spec.failed ? "failed" : "completed",
      steps: completedSteps(startedAt, spec.durationMs, spec.failed ? 5 : undefined),
      simulated: true,
      durationMs: spec.durationMs,
      errorMessage: spec.failed ? "Health check failed: 503 from /health after 30s" : undefined,
      queuedAt: iso(startedAt - 4000),
      startedAt: iso(startedAt),
      finishedAt: iso(finishedAt),
      createdAt: iso(startedAt - 4000),
      updatedAt: iso(finishedAt),
    });
  }

  // --- Containers ------------------------------------------------------------
  const containerSpecs: Array<Partial<Container> & { name: string; image: string; serverId: string }> = [
    { name: "merc-api", image: "ghcr.io/merc999/merc-api:v1.8.32", serverId: DEMO_IDS.serverProduction, applicationId: DEMO_IDS.appApi, cpuPercent: 18, memoryMb: 421, memoryLimitMb: 2048, ports: [{ container: 8080, protocol: "tcp" }] },
    { name: "merc-api-2", image: "ghcr.io/merc999/merc-api:v1.8.32", serverId: DEMO_IDS.serverProduction, applicationId: DEMO_IDS.appApi, cpuPercent: 14, memoryMb: 398, memoryLimitMb: 2048, ports: [{ container: 8080, protocol: "tcp" }] },
    { name: "merc-worker", image: "ghcr.io/merc999/merc-worker:v1.4.2", serverId: DEMO_IDS.serverProduction, applicationId: DEMO_IDS.appWorker, cpuPercent: 6, memoryMb: 210, memoryLimitMb: 512, ports: [] },
    { name: "merc-frontend", image: "ghcr.io/merc999/merc-web:v2.3.0", serverId: DEMO_IDS.serverProduction, applicationId: DEMO_IDS.appFrontend, cpuPercent: 4, memoryMb: 188, memoryLimitMb: 1024, ports: [{ container: 3000, protocol: "tcp" }] },
    { name: "postgres", image: "postgres:17-alpine", serverId: DEMO_IDS.serverProduction, cpuPercent: 9, memoryMb: 1840, memoryLimitMb: 4096, ports: [{ container: 5432, host: 5432, protocol: "tcp" }] },
    { name: "redis", image: "redis:7-alpine", serverId: DEMO_IDS.serverProduction, cpuPercent: 1, memoryMb: 64, memoryLimitMb: 256, ports: [{ container: 6379, host: 6379, protocol: "tcp" }] },
    { name: "nginx", image: "nginx:1.27-alpine", serverId: DEMO_IDS.serverProduction, cpuPercent: 2, memoryMb: 32, memoryLimitMb: 128, ports: [{ container: 80, host: 80, protocol: "tcp" }, { container: 443, host: 443, protocol: "tcp" }] },
    { name: "cloudflared", image: "cloudflare/cloudflared:latest", serverId: DEMO_IDS.serverProduction, cpuPercent: 1, memoryMb: 28, memoryLimitMb: 128, ports: [] },
    { name: "ops-dashboard", image: "registry.gitlab.com/merc999/ops-dashboard:v0.9.4", serverId: DEMO_IDS.serverProduction, applicationId: DEMO_IDS.appTools, cpuPercent: 2, memoryMb: 96, memoryLimitMb: 512, ports: [{ container: 3001, protocol: "tcp" }] },
    { name: "marketing-site", image: "ghcr.io/merc999/www:v1.2.0", serverId: DEMO_IDS.serverProduction, applicationId: DEMO_IDS.appMarketing, cpuPercent: 1, memoryMb: 54, memoryLimitMb: 256, ports: [{ container: 4321, protocol: "tcp" }] },
    { name: "merc-api-staging", image: "ghcr.io/merc999/merc-api:v1.9.0-rc2", serverId: DEMO_IDS.serverStaging, applicationId: DEMO_IDS.appApiStaging, cpuPercent: 71, memoryMb: 930, memoryLimitMb: 1024, ports: [{ container: 8080, protocol: "tcp" }], restarts: 3, status: "running" },
    { name: "postgres-staging", image: "postgres:17-alpine", serverId: DEMO_IDS.serverStaging, cpuPercent: 12, memoryMb: 512, memoryLimitMb: 2048, ports: [{ container: 5432, host: 5432, protocol: "tcp" }] },
    { name: "redis-staging", image: "redis:7-alpine", serverId: DEMO_IDS.serverStaging, cpuPercent: 0.5, memoryMb: 22, memoryLimitMb: 128, ports: [{ container: 6379, protocol: "tcp" }] },
    { name: "nginx-staging", image: "nginx:1.27-alpine", serverId: DEMO_IDS.serverStaging, cpuPercent: 1, memoryMb: 20, memoryLimitMb: 128, ports: [{ container: 80, host: 80, protocol: "tcp" }] },
  ];
  for (const c of containerSpecs) {
    world.containers.push({
      id: `ctr_${c.name.replace(/-/g, "_")}`,
      organizationId: org,
      serverId: c.serverId,
      applicationId: c.applicationId,
      name: c.name,
      image: c.image,
      status: c.status ?? "running",
      cpuPercent: c.cpuPercent ?? 1,
      memoryMb: c.memoryMb ?? 64,
      memoryLimitMb: c.memoryLimitMb ?? 512,
      ports: c.ports ?? [],
      network: c.serverId === DEMO_IDS.serverProduction ? "runforge_prod" : "runforge_staging",
      restarts: c.restarts ?? 0,
      startedAt: iso(now - Math.floor(rand() * 5 * DAY)),
      createdAt: iso(now - 30 * DAY),
      updatedAt: ts,
    });
  }

  // --- System services -------------------------------------------------------
  const serviceSpecs: Array<[string, string, string, number, number]> = [
    ["docker", "docker.service", "Docker", 1_204, 88],
    ["nginx", "nginx.service", "Nginx", 2_210, 12],
    ["postgresql", "postgresql.service", "PostgreSQL", 3_401, 1840],
    ["redis", "redis-server.service", "Redis", 3_512, 64],
    ["cron", "cron.service", "Cron", 812, 3],
    ["cloudflared", "cloudflared.service", "Cloudflare Tunnel", 4_100, 28],
    ["runforge-agent", "runforge-agent.service", "RunForge Agent", 990, 41],
  ];
  for (const server of servers.filter((s) => s.status === "online")) {
    for (const [name, unit, , pid, mem] of serviceSpecs) {
      if (server.id === DEMO_IDS.serverStaging && name === "cloudflared") continue;
      const svc: ServiceRecord = {
        id: `svc_${server.name.replace(/-/g, "_")}_${name.replace(/-/g, "_")}`,
        organizationId: org,
        serverId: server.id,
        name,
        unit,
        status: "active",
        enabled: true,
        pid,
        cpuPercent: Math.round(rand() * 40) / 10,
        memoryMb: mem,
        uptimeSeconds: server.uptimeSeconds - Math.floor(rand() * 3600),
        createdAt: server.createdAt,
        updatedAt: ts,
      };
      world.services.push(svc);
    }
  }

  // --- Databases -------------------------------------------------------------
  const databases: Database[] = [
    { id: DEMO_IDS.dbPostgres, organizationId: org, projectId: DEMO_IDS.project, serverId: DEMO_IDS.serverProduction, name: "merc-postgres", engine: "postgresql", version: "17.2", status: "healthy", sizeBytes: 8.2 * 1024 ** 3, connections: 34, maxConnections: 100, queriesPerSecond: 312, host: "10.20.0.11", port: 5432, createdAt: iso(now - 75 * DAY), updatedAt: ts },
    { id: DEMO_IDS.dbRedis, organizationId: org, projectId: DEMO_IDS.project, serverId: DEMO_IDS.serverProduction, name: "merc-redis", engine: "redis", version: "7.4", status: "healthy", sizeBytes: 64 * 1024 ** 2, connections: 12, maxConnections: 10000, queriesPerSecond: 1450, host: "10.20.0.11", port: 6379, createdAt: iso(now - 75 * DAY), updatedAt: ts },
    { id: DEMO_IDS.dbPostgresStaging, organizationId: org, projectId: DEMO_IDS.project, serverId: DEMO_IDS.serverStaging, name: "merc-postgres-staging", engine: "postgresql", version: "17.2", status: "degraded", sizeBytes: 1.1 * 1024 ** 3, connections: 97, maxConnections: 100, queriesPerSecond: 88, host: "10.20.0.21", port: 5432, createdAt: iso(now - 60 * DAY), updatedAt: ts },
  ];
  world.databases.push(...databases);

  // --- Storage / backups -----------------------------------------------------
  world.storage.push(
    { id: "sto_merc_uploads", organizationId: org, projectId: DEMO_IDS.project, name: "merc-uploads", provider: "r2", region: "APAC", sizeBytes: 142 * 1024 ** 3, objects: 48_210, status: "healthy", createdAt: iso(now - 70 * DAY), updatedAt: ts },
    { id: "sto_merc_backups", organizationId: org, projectId: DEMO_IDS.project, name: "merc-backups", provider: "r2", region: "APAC", sizeBytes: 61 * 1024 ** 3, objects: 412, status: "healthy", createdAt: iso(now - 70 * DAY), updatedAt: ts },
  );
  for (let i = 0; i < 6; i++) {
    const at = now - i * DAY - 2 * HOUR;
    world.backups.push({
      id: `bak_pg_${i}`,
      organizationId: org,
      resourceType: "database",
      resourceId: DEMO_IDS.dbPostgres,
      resourceName: "merc-postgres",
      destination: "r2",
      sizeBytes: (4.8 - i * 0.05) * 1024 ** 3,
      status: i === 0 ? "verified" : "completed",
      createdAt: iso(at),
      updatedAt: iso(at + 6 * MINUTE),
    });
  }

  // --- Domains / DNS / routes / ports / tunnels ------------------------------
  const domainSpecs: Array<[string, string, string | undefined]> = [
    ["dom_api_example", "api.example.com", DEMO_IDS.appApi],
    ["dom_app_example", "app.example.com", DEMO_IDS.appFrontend],
    ["dom_example", "example.com", DEMO_IDS.appMarketing],
    ["dom_staging_api_example", "staging-api.example.com", DEMO_IDS.appApiStaging],
    ["dom_tools_example", "tools.example.com", DEMO_IDS.appTools],
  ];
  const domains: Domain[] = domainSpecs.map(([id, name, appId]) => ({
    id,
    organizationId: org,
    projectId: appById.get(appId!)?.projectId,
    name,
    applicationId: appId,
    provider: "cloudflare",
    ssl: "active",
    sslExpiresAt: iso(now + 71 * DAY),
    status: "active",
    createdAt: iso(now - 60 * DAY),
    updatedAt: ts,
  }));
  world.domains.push(...domains);
  for (const d of domains) {
    world.dnsRecords.push({
      id: `dns_${d.id}`,
      organizationId: org,
      domainId: d.id,
      zone: "example.com",
      type: "CNAME",
      name: d.name,
      content: `${DEMO_IDS.tunnelProduction}.cfargotunnel.com`,
      ttl: 1,
      proxied: true,
      createdAt: d.createdAt,
      updatedAt: ts,
    });
  }
  world.dnsRecords.push({
    id: "dns_txt_verify",
    organizationId: org,
    domainId: "dom_example",
    zone: "example.com",
    type: "TXT",
    name: "example.com",
    content: "v=spf1 include:_spf.google.com ~all",
    ttl: 300,
    proxied: false,
    createdAt: iso(now - 60 * DAY),
    updatedAt: ts,
  });
  const routes: Route[] = domains.map((d) => {
    const app = appById.get(d.applicationId!)!;
    return {
      id: `rt_${d.id}`,
      organizationId: org,
      domainId: d.id,
      domain: d.name,
      path: "/",
      applicationId: app.id,
      applicationName: app.name,
      serverId: app.serverId,
      internalPort: app.port,
      protocol: "https",
      websocket: app.id === DEMO_IDS.appApi,
      healthPath: app.healthPath,
      proxy: "nginx",
      viaTunnel: app.serverId === DEMO_IDS.serverProduction,
      status: "active",
      createdAt: d.createdAt,
      updatedAt: ts,
    } satisfies Route;
  });
  world.routes.push(...routes);
  const portSpecs: Array<[number, string, string | undefined, "internal" | "public" | "restricted"]> = [
    [22, "SSH", undefined, "restricted"],
    [80, "Nginx", "ctr_nginx", "public"],
    [443, "Nginx", "ctr_nginx", "public"],
    [8080, "MERC999 API", "ctr_merc_api", "internal"],
    [3000, "MERC999 Frontend", "ctr_merc_frontend", "internal"],
    [3001, "Ops Dashboard", "ctr_ops_dashboard", "internal"],
    [4321, "Marketing Site", "ctr_marketing_site", "internal"],
    [5432, "PostgreSQL", "ctr_postgres", "internal"],
    [6379, "Redis", "ctr_redis", "internal"],
  ];
  for (const [port, service, containerId, exposure] of portSpecs) {
    world.ports.push({
      id: `prt_prod_${port}`,
      organizationId: org,
      serverId: DEMO_IDS.serverProduction,
      port,
      protocol: "tcp",
      service,
      containerId,
      exposure,
      status: "active",
      createdAt: iso(now - 60 * DAY),
      updatedAt: ts,
    });
  }
  world.ports.push(
    { id: "prt_staging_22", organizationId: org, serverId: DEMO_IDS.serverStaging, port: 22, protocol: "tcp", service: "SSH", exposure: "restricted", status: "active", createdAt: iso(now - 60 * DAY), updatedAt: ts },
    { id: "prt_staging_80", organizationId: org, serverId: DEMO_IDS.serverStaging, port: 80, protocol: "tcp", service: "Nginx", containerId: "ctr_nginx_staging", exposure: "public", status: "active", createdAt: iso(now - 60 * DAY), updatedAt: ts },
    { id: "prt_staging_8080", organizationId: org, serverId: DEMO_IDS.serverStaging, port: 8080, protocol: "tcp", service: "MERC999 API (staging)", containerId: "ctr_merc_api_staging", exposure: "internal", status: "active", createdAt: iso(now - 60 * DAY), updatedAt: ts },
  );
  world.tunnels.push({
    id: DEMO_IDS.tunnelProduction,
    organizationId: org,
    serverId: DEMO_IDS.serverProduction,
    name: "production-01",
    status: "healthy",
    connectors: 2,
    ingress: routes
      .filter((r) => r.viaTunnel)
      .map((r) => ({ hostname: r.domain, service: `http://nginx:80` })),
    createdAt: iso(now - 60 * DAY),
    updatedAt: ts,
  });

  // --- Git / integrations / tokens / templates -------------------------------
  world.gitConnections.push(
    { id: "git_github_merc999", organizationId: org, provider: "github", account: "merc999", status: "connected", repositories: 14, createdAt: iso(now - 75 * DAY), updatedAt: ts },
    { id: "git_gitlab_merc999", organizationId: org, provider: "gitlab", account: "merc999", status: "connected", repositories: 3, createdAt: iso(now - 40 * DAY), updatedAt: ts },
  );
  world.integrations.push(
    { id: "int_cloudflare", organizationId: org, kind: "cloudflare", name: "Cloudflare (merc999.dev account)", status: "connected", createdAt: iso(now - 70 * DAY), updatedAt: ts },
    { id: "int_github", organizationId: org, kind: "github", name: "GitHub App", status: "connected", createdAt: iso(now - 75 * DAY), updatedAt: ts },
    { id: "int_gitlab", organizationId: org, kind: "gitlab", name: "GitLab OAuth", status: "connected", createdAt: iso(now - 40 * DAY), updatedAt: ts },
    { id: "int_hetzner", organizationId: org, kind: "hetzner", name: "Hetzner Cloud", status: "connected", createdAt: iso(now - 75 * DAY), updatedAt: ts },
    { id: "int_slack", organizationId: org, kind: "slack", name: "Slack #ops-alerts", status: "disconnected", createdAt: iso(now - 10 * DAY), updatedAt: ts },
  );
  world.mcpTokens.push(
    {
      id: DEMO_IDS.mcpToken,
      organizationId: org,
      name: "Claude Desktop",
      tokenHash: "demo",
      tokenPrefix: "rf_mcp_demo",
      level: "WRITE",
      role: "ai_agent",
      lastUsedAt: iso(now - 3 * DAY),
      status: "active",
      createdAt: iso(now - 30 * DAY),
      updatedAt: ts,
    },
    {
      id: "mcp_demo_readonly",
      organizationId: org,
      name: "ChatGPT (read only)",
      tokenHash: "demo-ro",
      tokenPrefix: "rf_mcp_ro",
      level: "READ",
      role: "viewer",
      status: "active",
      createdAt: iso(now - 12 * DAY),
      updatedAt: ts,
    },
  );
  world.templates.push(
    { id: "tpl_dotnet_api", kind: "application", name: ".NET 8 API", description: "ASP.NET Core minimal API with Dockerfile, health endpoint and PostgreSQL.", runtime: "dotnet", tags: ["api", "dotnet", "postgresql"] },
    { id: "tpl_dotnet_mvc", kind: "application", name: ".NET MVC", description: "ASP.NET Core MVC web application.", runtime: "dotnet", tags: ["web", "dotnet"] },
    { id: "tpl_node_api", kind: "application", name: "Node.js API", description: "Express/Fastify API with Docker multi-stage build.", runtime: "node", tags: ["api", "node"] },
    { id: "tpl_bun_api", kind: "application", name: "Bun API", description: "Bun + Hono API with hot reload and health checks.", runtime: "bun", tags: ["api", "bun"] },
    { id: "tpl_react", kind: "application", name: "React", description: "Vite React SPA served by Nginx.", runtime: "node", tags: ["frontend", "react"] },
    { id: "tpl_nextjs", kind: "application", name: "Next.js", description: "Next.js standalone output in Docker.", runtime: "node", tags: ["frontend", "nextjs"] },
    { id: "tpl_fastapi", kind: "application", name: "Python FastAPI", description: "FastAPI with uvicorn and PostgreSQL.", runtime: "python", tags: ["api", "python"] },
    { id: "tpl_django", kind: "application", name: "Django", description: "Django with gunicorn and PostgreSQL.", runtime: "python", tags: ["web", "python"] },
    { id: "tpl_go", kind: "application", name: "Go", description: "Go HTTP service with scratch image.", runtime: "go", tags: ["api", "go"] },
    { id: "tpl_rust", kind: "application", name: "Rust", description: "Axum service with distroless image.", runtime: "rust", tags: ["api", "rust"] },
    { id: "tpl_spring", kind: "application", name: "Java Spring", description: "Spring Boot with layered JAR.", runtime: "java", tags: ["api", "java"] },
    { id: "tpl_laravel", kind: "application", name: "PHP Laravel", description: "Laravel with PHP-FPM and Nginx.", runtime: "php", tags: ["web", "php"] },
    { id: "tpl_docker", kind: "application", name: "Docker", description: "Any Dockerfile-based application.", runtime: "docker", tags: ["docker"] },
    { id: "tpl_infra_single_vps", kind: "infrastructure", name: "Single VPS", description: "One server with Docker, Nginx, Cloudflare Tunnel and backups.", tags: ["vps", "docker"] },
    { id: "tpl_infra_dotnet_pg", kind: "infrastructure", name: ".NET + PostgreSQL", description: "API, PostgreSQL, Redis and R2 storage on one server.", tags: ["dotnet", "postgresql"] },
    { id: "tpl_infra_react_api_pg", kind: "infrastructure", name: "React + API + PostgreSQL", description: "Frontend, API and database with reverse proxy routes.", tags: ["react", "api", "postgresql"] },
    { id: "tpl_infra_staging", kind: "infrastructure", name: "Staging Environment", description: "Clone production into an isolated staging environment.", tags: ["staging"] },
    { id: "tpl_db_saas", kind: "database", name: "SaaS Starter", description: "users, organizations, members, subscriptions, audit_logs.", tags: ["saas"] },
    { id: "tpl_db_multitenant", kind: "database", name: "Multi-tenant SaaS", description: "Tenant-scoped schema with row-level ownership.", tags: ["saas", "multi-tenant"] },
    { id: "tpl_db_auth", kind: "database", name: "Authentication", description: "users, sessions, api_keys, password_resets.", tags: ["auth"] },
  );

  // --- Incidents -------------------------------------------------------------
  const incidents: Incident[] = [
    {
      id: "inc_staging_api_degraded",
      organizationId: org,
      projectId: DEMO_IDS.project,
      title: "MERC999 API (staging) degraded",
      severity: "high",
      status: "investigating",
      resourceType: "application",
      resourceId: DEMO_IDS.appApiStaging,
      resourceName: "MERC999 API (staging)",
      impactPercent: 8.3,
      likelyCause: "Database connection exhaustion",
      relatedDeploymentId: "dep_api_staging_v1_9_0_rc2",
      relatedChanges: ["Deployment v1.9.0-rc2", "Environment variable DB_POOL_SIZE modified"],
      startedAt: iso(now - 35 * MINUTE),
      createdAt: iso(now - 35 * MINUTE),
      updatedAt: ts,
    },
    {
      id: "inc_dev_offline",
      organizationId: org,
      title: "development-01 offline",
      severity: "medium",
      status: "open",
      resourceType: "server",
      resourceId: DEMO_IDS.serverDevelopment,
      resourceName: "development-01",
      relatedChanges: [],
      startedAt: iso(now - 6 * HOUR),
      createdAt: iso(now - 6 * HOUR),
      updatedAt: ts,
    },
    {
      id: "inc_ssl_renewed",
      organizationId: org,
      projectId: DEMO_IDS.projectMarketing,
      title: "SSL certificate for example.com near expiry",
      severity: "low",
      status: "resolved",
      resourceType: "domain",
      resourceId: "dom_example",
      resourceName: "example.com",
      relatedChanges: ["SSL renewed automatically"],
      startedAt: iso(now - 9 * DAY),
      resolvedAt: iso(now - 9 * DAY + 2 * HOUR),
      createdAt: iso(now - 9 * DAY),
      updatedAt: iso(now - 9 * DAY + 2 * HOUR),
    },
  ];
  world.incidents.push(...incidents);

  // --- Events ----------------------------------------------------------------
  const ev = (
    id: string,
    ago: number,
    action: string,
    resourceType: string,
    resourceId: string,
    resourceName: string,
    message: string,
    status: Event["status"] = "success",
    actorType: Event["actorType"] = "system",
    actorName = "RunForge",
    extra: Partial<Event> = {},
  ): Event => ({
    id,
    organizationId: org,
    actorType,
    actorId: actorType === "user" ? DEMO_IDS.user : actorType === "ai" ? DEMO_IDS.aiUser : "system",
    actorName,
    action,
    resourceType,
    resourceId,
    resourceName,
    status,
    message,
    correlationId: `corr_seed_${id}`,
    simulated: true,
    createdAt: iso(now - ago),
    ...extra,
  });
  world.events.push(
    ev("evt_s01", 10 * MINUTE, "backup.completed", "database", DEMO_IDS.dbPostgres, "merc-postgres", "Database backup completed (4.8 GB, verified)"),
    ev("evt_s02", 25 * MINUTE, "container.restarted", "container", "ctr_merc_api_staging", "merc-api-staging", "Container restarted after OOM kill", "info"),
    ev("evt_s03", 35 * MINUTE, "incident.opened", "incident", "inc_staging_api_degraded", "MERC999 API (staging) degraded", "Error rate exceeded 5% for 5 minutes", "failed"),
    ev("evt_s04", 40 * MINUTE, "deployment.completed", "deployment", "dep_api_staging_v1_9_0_rc2", "MERC999 API v1.9.0-rc2", "Deployment v1.9.0-rc2 completed on staging-01", "success", "user", "Aisyah Rahman", { projectId: DEMO_IDS.project }),
    ev("evt_s05", 55 * MINUTE, "environment.updated", "application", DEMO_IDS.appApiStaging, "MERC999 API (staging)", "Environment variable DB_POOL_SIZE changed", "success", "user", "Aisyah Rahman", { before: { DB_POOL_SIZE: "20" }, after: { DB_POOL_SIZE: "200" } }),
    ev("evt_s06", 90 * MINUTE, "deployment.failed", "deployment", "dep_api_staging_v1_9_0_rc1", "MERC999 API v1.9.0-rc1", "Health check failed: 503 from /health after 30s", "failed", "user", "Aisyah Rahman"),
    ev("evt_s07", 2 * HOUR, "deployment.completed", "deployment", "dep_api_v1_8_32", "MERC999 API v1.8.32", "Deployment v1.8.32 completed on production-01", "success", "system", "GitHub webhook", { projectId: DEMO_IDS.project }),
    ev("evt_s08", 3 * HOUR, "ssl.renewed", "domain", "dom_api_example", "api.example.com", "SSL certificate renewed via Cloudflare"),
    ev("evt_s09", 5 * HOUR, "deployment.completed", "deployment", "dep_worker_v1_4_2", "MERC999 Worker v1.4.2", "Deployment v1.4.2 completed on production-01", "success", "system", "GitHub webhook"),
    ev("evt_s10", 6 * HOUR, "server.offline", "server", DEMO_IDS.serverDevelopment, "development-01", "Agent heartbeat missed for 5 minutes", "failed"),
    ev("evt_s11", 8 * HOUR, "deployment.completed", "deployment", "dep_frontend_v2_3_0", "MERC999 Frontend v2.3.0", "Deployment v2.3.0 completed on production-01", "success", "user", "Aisyah Rahman"),
    ev("evt_s12", 12 * HOUR, "domain.created", "domain", "dom_tools_example", "tools.example.com", "Domain added and routed to Ops Dashboard", "success", "user", "Demo Owner"),
    ev("evt_s13", 1 * DAY, "deployment.completed", "deployment", "dep_api_v1_8_31", "MERC999 API v1.8.31", "Deployment v1.8.31 completed on production-01", "success", "system", "GitHub webhook"),
    ev("evt_s14", 1 * DAY + 1 * HOUR, "application.restarted", "application", DEMO_IDS.appApi, "MERC999 API", "Application restarted via MCP (restart_application)", "success", "ai", "Claude (MCP)"),
    ev("evt_s15", 2 * DAY, "server.connected", "server", DEMO_IDS.serverStaging, "staging-01", "Agent 0.1.0 registered and connected"),
    ev("evt_s16", 3 * DAY, "deployment.completed", "deployment", "dep_api_v1_8_30", "MERC999 API v1.8.30", "Deployment v1.8.30 completed via MCP (deploy_application)", "success", "ai", "Claude (MCP)"),
    ev("evt_s17", 4 * DAY, "port.opened", "port", "prt_prod_443", "443/tcp on production-01", "Port 443 exposed publicly", "success", "user", "Demo Owner"),
    ev("evt_s18", 9 * DAY, "incident.resolved", "incident", "inc_ssl_renewed", "example.com SSL", "SSL renewed automatically; incident resolved"),
  );
  world.auditLogs.push(
    ...world.events
      .filter((e) => e.actorType !== "system")
      .map((e) => ({ ...e, id: `aud_${e.id}`, result: "allowed" as const, ip: "203.0.113.10" })),
  );

  // --- Logs ------------------------------------------------------------------
  seedLogs(world, now);

  return world;
}

const LOG_TEMPLATES: Array<{ service: string; source: "application" | "container" | "database" | "nginx" | "agent" | "server" | "cloudflare"; lines: Array<[LogSeverity, string]> }> = [
  {
    service: "merc-api",
    source: "application",
    lines: [
      ["info", "GET /api/orders/{id} 200 in 38ms"],
      ["info", "POST /api/orders 201 in 71ms"],
      ["info", "GET /api/customers 200 in 22ms"],
      ["debug", "Cache hit for products:featured"],
      ["info", "PostgreSQL connection pool: 34/100 in use"],
      ["warn", "Request latency increased: p95 412ms over last 60s"],
      ["info", "Webhook delivered to https://hooks.example.com (204)"],
      ["error", "Database timeout after 5000ms on query orders_by_customer"],
    ],
  },
  {
    service: "merc-worker",
    source: "application",
    lines: [
      ["info", "Processed job email.send (id=job_4412) in 120ms"],
      ["info", "Processed job invoice.generate (id=job_4413) in 940ms"],
      ["debug", "Polling queue orders.events (depth=3)"],
      ["warn", "Retrying webhook delivery (attempt 2/5)"],
    ],
  },
  {
    service: "merc-frontend",
    source: "application",
    lines: [
      ["info", "GET / 200 in 12ms"],
      ["info", "GET /dashboard 200 in 48ms"],
      ["info", "Prefetching /api/session"],
    ],
  },
  {
    service: "merc-api-staging",
    source: "application",
    lines: [
      ["warn", "Connection pool exhausted: waiting for free connection (97/100)"],
      ["error", "Npgsql.NpgsqlException: The connection pool has been exhausted"],
      ["error", "GET /api/orders 503 in 30012ms"],
      ["warn", "Health check /health returned 503"],
      ["info", "GET /api/customers 200 in 91ms"],
    ],
  },
  {
    service: "postgres",
    source: "database",
    lines: [
      ["info", "checkpoint complete: wrote 812 buffers (4.9%)"],
      ["info", "automatic vacuum of table \"merc.orders\": index scans: 1"],
      ["warn", "duration: 1432.118 ms  statement: SELECT * FROM orders WHERE customer_id = $1"],
    ],
  },
  {
    service: "nginx",
    source: "nginx",
    lines: [
      ["info", "10.20.0.1 - \"GET /api/orders HTTP/2.0\" 200 1284 0.041"],
      ["info", "10.20.0.1 - \"POST /api/orders HTTP/2.0\" 201 312 0.072"],
      ["info", "10.20.0.1 - \"GET / HTTP/2.0\" 200 5210 0.012"],
      ["warn", "upstream response time exceeded 1s for /api/reports"],
    ],
  },
  {
    service: "runforge-agent",
    source: "agent",
    lines: [
      ["info", "Heartbeat sent (cpu=17% mem=41% disk=62%)"],
      ["debug", "Collected metrics for 10 containers"],
      ["info", "Reverse proxy config unchanged (checksum 9f2a)"],
    ],
  },
  {
    service: "cloudflared",
    source: "cloudflare",
    lines: [
      ["info", "Connection registered connIndex=0 location=sin06"],
      ["info", "Connection registered connIndex=1 location=sin07"],
      ["debug", "Proxying request api.example.com -> http://nginx:80"],
    ],
  },
];

const LOG_APP_BY_SERVICE: Record<string, { applicationId?: string; serverId: string; environment: string }> = {
  "merc-api": { applicationId: DEMO_IDS.appApi, serverId: DEMO_IDS.serverProduction, environment: "production" },
  "merc-worker": { applicationId: DEMO_IDS.appWorker, serverId: DEMO_IDS.serverProduction, environment: "production" },
  "merc-frontend": { applicationId: DEMO_IDS.appFrontend, serverId: DEMO_IDS.serverProduction, environment: "production" },
  "merc-api-staging": { applicationId: DEMO_IDS.appApiStaging, serverId: DEMO_IDS.serverStaging, environment: "staging" },
  postgres: { serverId: DEMO_IDS.serverProduction, environment: "production" },
  nginx: { serverId: DEMO_IDS.serverProduction, environment: "production" },
  "runforge-agent": { serverId: DEMO_IDS.serverProduction, environment: "production" },
  cloudflared: { serverId: DEMO_IDS.serverProduction, environment: "production" },
};

export { LOG_TEMPLATES, LOG_APP_BY_SERVICE };

/** Generates ~400 deterministic historical log lines over the last 6 hours. */
function seedLogs(world: DemoWorld, now: number): void {
  const rand = seededRandom("runforge-demo-logs");
  const span = 6 * HOUR;
  let seq = 0;
  for (let t = now - span; t < now - 5000; t += 40_000 + rand() * 30_000) {
    const tpl = pick(rand, LOG_TEMPLATES);
    const [severity, message] = pick(rand, tpl.lines);
    const ctx = LOG_APP_BY_SERVICE[tpl.service];
    world.logs.push({
      id: `log_seed_${String(seq++).padStart(5, "0")}`,
      organizationId: DEMO_IDS.org,
      timestamp: iso(t),
      severity,
      source: tpl.source,
      service: tpl.service,
      serverId: ctx?.serverId,
      applicationId: ctx?.applicationId,
      environment: ctx?.environment,
      requestId: severity === "debug" ? undefined : `req_${Math.floor(rand() * 1e8).toString(16)}`,
      message,
    });
  }
  // Startup sequence for the latest API deployment, tied to the deployment id.
  const start = now - 2 * HOUR + 200_000;
  const startup: Array<["info" | "warn" | "error", string]> = [
    ["info", "API started"],
    ["info", "PostgreSQL connected"],
    ["info", "Listening on http://0.0.0.0:8080"],
    ["info", "Health check /health 200"],
  ];
  startup.forEach(([severity, message], i) => {
    world.logs.push({
      id: `log_seed_dep_${i}`,
      organizationId: DEMO_IDS.org,
      timestamp: iso(start + i * 1500),
      severity,
      source: "application",
      service: "merc-api",
      serverId: DEMO_IDS.serverProduction,
      applicationId: DEMO_IDS.appApi,
      deploymentId: "dep_api_v1_8_32",
      environment: "production",
      message,
    });
  });
  world.logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Convenience: a freshly seeded world. */
export function createDemoWorld(now?: () => number): DemoWorld {
  const world = new DemoWorld(now ? now() : Date.now());
  if (now) world.now = now;
  return seedDemoWorld(world);
}
