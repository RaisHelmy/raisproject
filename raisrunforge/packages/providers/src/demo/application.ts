import type {
  ApplicationRevision,
  DeploymentStatus,
  DeploymentStep,
  EnvironmentVariable,
  ProviderKind,
} from "@runforge/shared";
import { DEPLOYMENT_STAGES, nowIso } from "@runforge/shared";
import type { ApplicationHealth, ApplicationProvider, DeployInput, DeploymentProgress } from "../interfaces";
import type { DemoWorld } from "./world";
import { wobble } from "./compute";

/**
 * Demo deployments progress based purely on elapsed wall-clock time, so the
 * simulation is stateless across requests and survives Worker isolate restarts
 * as long as the in-memory world survives. Each stage takes STAGE_MS.
 */
export const DEMO_STAGE_MS = 2_500;

export class DemoApplicationProvider implements ApplicationProvider {
  readonly kind: ProviderKind = "demo";
  constructor(private readonly world: DemoWorld) {}

  async deploy(input: DeployInput): Promise<DeploymentProgress> {
    this.world.deploymentSims.set(input.deploymentId, {
      startedAt: this.world.now(),
      failAtStep: input.simulateFailure ? 5 : undefined,
      cancelled: false,
      applicationId: input.application.id,
      version: input.version,
    });
    return this.computeProgress(input.deploymentId)!;
  }

  async getDeploymentProgress(_organizationId: string, deploymentId: string): Promise<DeploymentProgress | null> {
    return this.computeProgress(deploymentId);
  }

  async cancelDeployment(_organizationId: string, deploymentId: string): Promise<void> {
    const sim = this.world.deploymentSims.get(deploymentId);
    if (sim) sim.cancelled = true;
  }

  async restart(_organizationId: string, applicationId: string): Promise<void> {
    const rt = this.runtime(applicationId);
    rt.restarts += 1;
    rt.lastRestartAt = nowIso();
    rt.startedAt = rt.lastRestartAt;
    rt.stopped = false;
    for (const c of this.world.containers.filter((c) => c.applicationId === applicationId)) {
      c.restarts += 1;
      c.status = "running";
      c.startedAt = rt.startedAt;
      c.updatedAt = rt.startedAt;
    }
  }

  async stop(_organizationId: string, applicationId: string): Promise<void> {
    const rt = this.runtime(applicationId);
    rt.stopped = true;
    for (const c of this.world.containers.filter((c) => c.applicationId === applicationId)) {
      c.status = "stopped";
      c.cpuPercent = 0;
      c.updatedAt = nowIso();
    }
  }

  async start(_organizationId: string, applicationId: string): Promise<void> {
    const rt = this.runtime(applicationId);
    rt.stopped = false;
    rt.startedAt = nowIso();
    for (const c of this.world.containers.filter((c) => c.applicationId === applicationId)) {
      c.status = "running";
      c.startedAt = rt.startedAt;
      c.updatedAt = rt.startedAt;
    }
  }

  async rollback(_organizationId: string, applicationId: string, revision: ApplicationRevision): Promise<void> {
    for (const c of this.world.containers.filter((c) => c.applicationId === applicationId)) {
      c.image = c.image.replace(/:[^:]+$/, `:${revision.version}`);
      c.restarts += 1;
      c.startedAt = nowIso();
      c.updatedAt = c.startedAt;
    }
    const rt = this.runtime(applicationId);
    rt.startedAt = nowIso();
  }

  async scale(_organizationId: string, applicationId: string, instances: number): Promise<void> {
    this.runtime(applicationId).instances = instances;
  }

  async getEnvironment(_organizationId: string, applicationId: string): Promise<EnvironmentVariable[]> {
    return this.world.environmentVariables.get(applicationId) ?? [];
  }

  async setEnvironment(_organizationId: string, applicationId: string, vars: EnvironmentVariable[]): Promise<void> {
    this.world.environmentVariables.set(applicationId, vars);
  }

  async getHealth(_organizationId: string, applicationId: string): Promise<ApplicationHealth> {
    const app = this.world.applications.find((a) => a.id === applicationId);
    const rt = this.runtime(applicationId);
    const now = this.world.now();
    const degraded = app?.status === "degraded";
    const stopped = rt.stopped || app?.status === "stopped";
    const isApi = app?.name.includes("API");
    const baseReq = stopped ? 0 : isApi ? (degraded ? 90 : 237) : 40;
    const latency = stopped ? 0 : wobble(`${applicationId}:lat`, degraded ? 1240 : 42, degraded ? 300 : 8, now);
    const errorRate = stopped ? 0 : degraded ? wobble(`${applicationId}:err`, 8.3, 2, now) : wobble(`${applicationId}:err`, 0.03, 0.02, now, 30 * 60_000);
    return {
      status: stopped ? "stopped" : (app?.status ?? "unknown"),
      cpuPercent: stopped ? 0 : wobble(`${applicationId}:cpu`, degraded ? 71 : 18, 5, now),
      memoryMb: stopped ? 0 : Math.round(wobble(`${applicationId}:mem`, degraded ? 930 : 421, 20, now, 60 * 60_000)),
      requestsPerMinute: Math.round(wobble(`${applicationId}:rpm`, baseReq, baseReq * 0.2, now)),
      requestsLastHour: Math.round(baseReq * 60),
      latencyMs: Math.round(latency),
      errorRatePercent: Math.round(errorRate * 100) / 100,
      instances: stopped ? 0 : rt.instances,
      uptimeSeconds: stopped ? 0 : Math.max(0, Math.floor((now - Date.parse(rt.startedAt)) / 1000)),
      lastCheckAt: new Date(now).toISOString(),
      checks: [
        { name: `HTTP ${app?.healthPath ?? "/health"}`, ok: !stopped && !degraded, detail: stopped ? "no instances" : degraded ? "503 Service Unavailable" : "200 OK in 4ms" },
        { name: "Database", ok: !degraded, detail: degraded ? "connection pool exhausted (97/100)" : "connected" },
        { name: "Memory", ok: !degraded, detail: degraded ? "930 MB / 1024 MB" : "421 MB / 2048 MB" },
      ],
    };
  }

  private runtime(applicationId: string) {
    let rt = this.world.appRuntime.get(applicationId);
    if (!rt) {
      rt = { restarts: 0, stopped: false, instances: 1, startedAt: nowIso() };
      this.world.appRuntime.set(applicationId, rt);
    }
    return rt;
  }

  private computeProgress(deploymentId: string): DeploymentProgress | null {
    const sim = this.world.deploymentSims.get(deploymentId);
    if (!sim) return null;
    const elapsed = this.world.now() - sim.startedAt;
    const total = DEPLOYMENT_STAGES.length;
    const currentIndex = Math.min(total, Math.floor(elapsed / DEMO_STAGE_MS));
    const steps: DeploymentStep[] = [];
    let status: DeploymentStatus = "queued";
    let finishedAt: string | undefined;
    let errorMessage: string | undefined;

    for (let i = 0; i < total; i++) {
      const stage = DEPLOYMENT_STAGES[i];
      const stageStart = new Date(sim.startedAt + i * DEMO_STAGE_MS).toISOString();
      const stageEnd = new Date(sim.startedAt + (i + 1) * DEMO_STAGE_MS).toISOString();
      if (sim.cancelled && i >= currentIndex) {
        steps.push({ key: stage.status, label: stage.label, state: "skipped" });
        continue;
      }
      if (sim.failAtStep !== undefined && i === sim.failAtStep && currentIndex > i) {
        steps.push({ key: stage.status, label: stage.label, state: "failed", startedAt: stageStart, finishedAt: stageEnd, message: "Health check failed: 503 from /health after 30s (simulated)" });
        errorMessage = "Health check failed: 503 from /health after 30s (simulated)";
        finishedAt = stageEnd;
        status = "failed";
        for (let j = i + 1; j < total; j++) steps.push({ key: DEPLOYMENT_STAGES[j].status, label: DEPLOYMENT_STAGES[j].label, state: "skipped" });
        break;
      }
      if (i < currentIndex) {
        steps.push({ key: stage.status, label: stage.label, state: "success", startedAt: stageStart, finishedAt: stageEnd });
      } else if (i === currentIndex) {
        steps.push({ key: stage.status, label: stage.label, state: "running", startedAt: stageStart });
        status = stage.status;
      } else {
        steps.push({ key: stage.status, label: stage.label, state: "pending" });
      }
    }
    if (sim.cancelled && status !== "failed") {
      status = "cancelled";
      finishedAt = new Date(this.world.now()).toISOString();
    } else if (status !== "failed" && currentIndex >= total) {
      status = "completed";
      finishedAt = new Date(sim.startedAt + total * DEMO_STAGE_MS).toISOString();
    } else if (status === "queued" && currentIndex === 0) {
      status = "cloning";
    }
    const progress = status === "completed" ? 100 : status === "failed" || status === "cancelled" ? Math.round((Math.min(currentIndex, total) / total) * 100) : Math.round((currentIndex / total) * 100);
    return {
      status,
      steps,
      progress,
      startedAt: new Date(sim.startedAt).toISOString(),
      finishedAt,
      errorMessage,
    };
  }
}
