import type { AuthContext, Job, JobStatus, JobType } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import type { DataStore } from "../store/repository";
import type { PermissionService } from "../auth/permissions";

/**
 * Jobs track long-running operations (spec §53). Enqueueing is synchronous;
 * execution is driven by a worker (Cloudflare Queue consumer, cron, or the
 * dev ticker) calling `tick`. Reconcilers registered per job type advance
 * jobs by asking providers for progress — nothing blocks an HTTP request.
 */
export type JobReconciler = (job: Job) => Promise<void>;

export class JobService {
  private reconcilers = new Map<JobType, JobReconciler>();

  constructor(
    private readonly store: DataStore,
    private readonly permissions: PermissionService,
  ) {}

  registerReconciler(type: JobType, reconciler: JobReconciler): void {
    this.reconcilers.set(type, reconciler);
  }

  async enqueue(ctx: AuthContext, input: { type: JobType; resourceType: string; resourceId: string; payload?: Record<string, unknown>; simulated?: boolean }): Promise<Job> {
    const ts = nowIso();
    const job: Job = {
      id: newId("job"),
      organizationId: ctx.organizationId,
      type: input.type,
      status: "QUEUED",
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      progress: 0,
      payload: input.payload ?? {},
      correlationId: ctx.correlationId,
      simulated: input.simulated ?? ctx.demo,
      queuedAt: ts,
      createdAt: ts,
      updatedAt: ts,
    };
    await this.store.jobs.insert(job);
    return job;
  }

  async transition(job: Job, status: JobStatus, patch: Partial<Job> = {}): Promise<Job> {
    const ts = nowIso();
    const update: Partial<Job> = { status, ...patch };
    if (status === "RUNNING" && !job.startedAt) update.startedAt = ts;
    if (status === "SUCCESS" || status === "FAILED" || status === "CANCELLED") update.finishedAt = ts;
    if (status === "SUCCESS") update.progress = 100;
    return this.store.jobs.update(job.organizationId, job.id, update);
  }

  async list(ctx: AuthContext, limit = 50): Promise<Job[]> {
    this.permissions.require(ctx, "deployment:read");
    return this.store.jobs.list(ctx.organizationId, { orderBy: "createdAt", direction: "desc", limit });
  }

  async get(ctx: AuthContext, id: string): Promise<Job | null> {
    this.permissions.require(ctx, "deployment:read");
    return this.store.jobs.get(ctx.organizationId, id);
  }

  /** Advance every non-terminal job for an organization (or all organizations). */
  async tick(organizationId?: string): Promise<number> {
    const orgs = organizationId ? [organizationId] : (await this.store.organizations.list()).map((o) => o.id);
    let advanced = 0;
    for (const org of orgs) {
      const active = [
        ...(await this.store.jobs.list(org, { where: { status: "QUEUED" } })),
        ...(await this.store.jobs.list(org, { where: { status: "RUNNING" } })),
      ];
      for (const job of active) {
        const reconciler = this.reconcilers.get(job.type);
        if (!reconciler) continue;
        await reconciler(job);
        advanced++;
      }
    }
    return advanced;
  }
}
