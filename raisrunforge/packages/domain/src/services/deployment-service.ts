import type { Application, AuthContext, Deployment, DeploymentStep, Job } from "@runforge/shared";
import { isTerminalDeploymentStatus, newId, nowIso } from "@runforge/shared";
import type { ProviderRegistry } from "@runforge/providers";
import { DomainError } from "../errors";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";
import type { EventService } from "./event-service";
import type { JobService } from "./job-service";
import type { ApplicationService } from "./application-service";

export interface DeployOptions {
  /** Explicit version/commit (e.g. from a Git provider). Demo defaults to a bumped patch version. */
  version?: string;
  commitSha?: string;
  commitMessage?: string;
  branch?: string;
  trigger?: Deployment["trigger"];
  triggeredBy?: string;
  /** Demo Provider only: force the deployment to fail its health check. */
  simulateFailure?: boolean;
}

function bumpPatch(version?: string): string {
  const m = /^v(\d+)\.(\d+)\.(\d+)/.exec(version ?? "v1.0.0");
  if (!m) return "v1.0.1";
  return `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/**
 * DeploymentService orchestrates the deploy pipeline (spec §18/§20): it never
 * blocks on the underlying provider — deploy() enqueues a job and returns
 * immediately, and job reconciliation polls provider progress until the
 * deployment reaches a terminal state.
 */
export class DeploymentService {
  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
    private readonly events: EventService,
    private readonly jobs: JobService,
    private readonly providers: ProviderRegistry,
    private readonly applications: ApplicationService,
  ) {
    this.jobs.registerReconciler("deployment", (job) => this.reconcile(job));
  }

  async list(ctx: AuthContext, filter: { applicationId?: string; projectId?: string; limit?: number } = {}): Promise<Deployment[]> {
    this.permissions.require(ctx, "deployment:read");
    const where: Partial<Deployment> = {};
    if (filter.applicationId) where.applicationId = filter.applicationId;
    if (filter.projectId) where.projectId = filter.projectId;
    return this.store.deployments.list(ctx.organizationId, { where, orderBy: "queuedAt", direction: "desc", limit: filter.limit ?? 100 });
  }

  async get(ctx: AuthContext, id: string): Promise<Deployment> {
    this.permissions.require(ctx, "deployment:read");
    const deployment = await this.store.deployments.get(ctx.organizationId, id);
    this.permissions.requireTenant(ctx, deployment, "deployment", id);
    return deployment!;
  }

  async deploy(ctx: AuthContext, applicationId: string, options: DeployOptions = {}): Promise<Deployment> {
    const app = await this.applications.get(ctx, applicationId);
    // Production deploys are DANGEROUS; everything else is WRITE (spec §44).
    this.permissions.require(ctx, app.environment === "production" ? "application:deploy:production" : "application:deploy");

    const version = options.version ?? bumpPatch(app.currentVersion);
    const commitSha = options.commitSha ?? Math.random().toString(16).slice(2, 9);
    const ts = nowIso();
    const deployment: Deployment = {
      id: newId("dep"),
      organizationId: ctx.organizationId,
      projectId: app.projectId,
      applicationId: app.id,
      applicationName: app.name,
      environment: app.environment,
      serverId: app.serverId,
      version,
      commitSha,
      commitMessage: options.commitMessage ?? "Manual deployment",
      branch: options.branch ?? app.source.branch ?? "main",
      trigger: options.trigger ?? "manual",
      triggeredBy: options.triggeredBy ?? ctx.actorId,
      status: "queued",
      steps: [],
      simulated: app.provider === "demo",
      queuedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.deployments.insert(deployment);
    await this.store.applications.update(ctx.organizationId, app.id, { status: "deploying" });

    const job = await this.jobs.enqueue(ctx, {
      type: "deployment",
      resourceType: "deployment",
      resourceId: deployment.id,
      payload: { applicationId: app.id, deploymentId: deployment.id, simulateFailure: options.simulateFailure ?? false },
      simulated: app.provider === "demo",
    });
    await this.store.deployments.update(ctx.organizationId, deployment.id, { jobId: job.id });

    await this.events.record(ctx, {
      action: "deployment.queued",
      resourceType: "deployment",
      resourceId: deployment.id,
      resourceName: `${app.name} ${version}`,
      projectId: app.projectId,
      message: `Deployment ${version} queued for ${app.name} (${app.environment})`,
      status: "pending",
      simulated: deployment.simulated,
    });

    // Kick the provider immediately so progress is visible without waiting for the next tick.
    const provider = this.providers.application(app.provider);
    await provider.deploy({
      organizationId: ctx.organizationId,
      application: app,
      deploymentId: deployment.id,
      version,
      commitSha,
      branch: deployment.branch,
      simulateFailure: options.simulateFailure,
    });
    await this.jobs.transition(job, "RUNNING", { phase: "Cloning" });

    return { ...deployment, jobId: job.id };
  }

  async cancel(ctx: AuthContext, deploymentId: string): Promise<Deployment> {
    this.permissions.require(ctx, "application:write");
    const deployment = await this.get(ctx, deploymentId);
    const app = await this.applications.get(ctx, deployment.applicationId);
    if (isTerminalDeploymentStatus(deployment.status)) return deployment;
    await this.providers.application(app.provider).cancelDeployment(ctx.organizationId, deploymentId);
    const updated = await this.store.deployments.update(ctx.organizationId, deploymentId, { status: "cancelled", finishedAt: nowIso() });
    await this.events.record(ctx, {
      action: "deployment.cancelled",
      resourceType: "deployment",
      resourceId: deployment.id,
      resourceName: `${deployment.applicationName} ${deployment.version}`,
      projectId: deployment.projectId,
      message: `Deployment ${deployment.version} cancelled`,
      status: "info",
      simulated: deployment.simulated,
    });
    return updated;
  }

  /** Called by JobService.tick(): pulls provider progress and advances the deployment + job together. */
  private async reconcile(job: Job): Promise<void> {
    const deploymentId = job.resourceId;
    const deployment = await this.store.deployments.get(job.organizationId, deploymentId);
    if (!deployment || isTerminalDeploymentStatus(deployment.status)) {
      if (job.status !== "SUCCESS" && job.status !== "FAILED" && job.status !== "CANCELLED") {
        await this.jobs.transition(job, deployment?.status === "failed" ? "FAILED" : deployment?.status === "cancelled" ? "CANCELLED" : "SUCCESS");
      }
      return;
    }
    const app = await this.store.applications.get(job.organizationId, deployment.applicationId);
    if (!app) return;
    const provider = this.providers.application(app.provider);
    const progress = await provider.getDeploymentProgress(job.organizationId, deploymentId);
    if (!progress) return;

    const patch: Partial<Deployment> = {
      status: progress.status,
      steps: progress.steps as DeploymentStep[],
      finishedAt: progress.finishedAt,
      errorMessage: progress.errorMessage,
    };
    if (progress.finishedAt && deployment.startedAt) {
      patch.durationMs = Date.parse(progress.finishedAt) - Date.parse(deployment.startedAt ?? deployment.queuedAt);
    }
    if (!deployment.startedAt) patch.startedAt = progress.startedAt ?? nowIso();
    await this.store.deployments.update(job.organizationId, deploymentId, patch);
    await this.jobs.transition(job, "RUNNING", { phase: progress.status, progress: progress.progress });

    if (isTerminalDeploymentStatus(progress.status)) {
      await this.finalize(job.organizationId, { ...deployment, ...patch } as Deployment, app);
      await this.jobs.transition(job, progress.status === "completed" ? "SUCCESS" : progress.status === "failed" ? "FAILED" : "CANCELLED", {
        result: { status: progress.status },
        error: progress.errorMessage,
      });
    }
  }

  private async finalize(organizationId: string, deployment: Deployment, app: Application): Promise<void> {
    const actorCtx: AuthContext = {
      actorType: "system",
      actorId: "system",
      organizationId,
      role: "operator",
      maxLevel: "DANGEROUS",
      correlationId: deployment.id,
      demo: deployment.simulated,
    };
    if (deployment.status === "completed") {
      const ts = nowIso();
      const revision = {
        id: newId("rev"),
        organizationId,
        applicationId: app.id,
        version: deployment.version,
        commitSha: deployment.commitSha,
        commitMessage: deployment.commitMessage,
        trafficPercent: 100,
        status: "healthy" as const,
        deploymentId: deployment.id,
        createdAt: ts,
      };
      await this.store.revisions.insert(revision);
      for (const rev of await this.store.revisions.list(organizationId, { where: { applicationId: app.id } })) {
        if (rev.id !== revision.id && rev.trafficPercent > 0) {
          await this.store.revisions.update(organizationId, rev.id, { trafficPercent: 0 });
        }
      }
      await this.store.applications.update(organizationId, app.id, {
        status: "healthy",
        currentRevisionId: revision.id,
        currentVersion: revision.version,
      });
      await this.events.record(actorCtx, {
        action: "deployment.completed",
        resourceType: "deployment",
        resourceId: deployment.id,
        resourceName: `${app.name} ${deployment.version}`,
        projectId: app.projectId,
        message: `Deployment ${deployment.version} completed on ${deployment.serverId ? "assigned server" : "provider"}`,
        simulated: deployment.simulated,
      });
    } else if (deployment.status === "failed") {
      await this.store.applications.update(organizationId, app.id, { status: "degraded" });
      await this.events.record(actorCtx, {
        action: "deployment.failed",
        resourceType: "deployment",
        resourceId: deployment.id,
        resourceName: `${app.name} ${deployment.version}`,
        projectId: app.projectId,
        message: deployment.errorMessage ?? `Deployment ${deployment.version} failed`,
        status: "failed",
        simulated: deployment.simulated,
      });
    }
  }
}
