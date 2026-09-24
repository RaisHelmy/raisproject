import type * as T from "../types";
import { ServiceBase } from "./context";
import { DEMO } from "../seed/demo";
import type { TaskService, ExecutionHooks } from "./taskService";
import type { ApprovalService } from "./approvalService";
import type { ChangeService } from "./changeService";
import type { TelemetryService } from "./telemetryService";
import { DomainError } from "../types";

export interface DemoScenarioStep { key: string; label: string; state: "PENDING" | "RUNNING" | "DONE" | "FAILED"; detail?: string; href?: string }

/**
 * Section 110/121 — Demo Lab. Runs the showcase end-to-end against Mock* adapters only.
 * Never touches real infrastructure: every organization flagged `demo` uses the in-memory MockAgent.
 */
export class DemoLab extends ServiceBase {
  constructor(store: ConstructorParameters<typeof ServiceBase>[0], private tasks: TaskService, private approvals: ApprovalService, private changes: ChangeService, private telemetry: TelemetryService) { super(store); }

  scenarios() {
    return [
      { id: "showcase", title: "Deploy Claims Portal v2.8 to Production", description: "Approval → deployment → health-check failure → self-healing → success → AI optimization summary.", scenario: "HEALTH_CHECK_FAIL_THEN_RECOVER" as T.DemoFailureScenario },
      { id: "rollback", title: "Failed deployment with rollback", description: "Health check keeps failing → rollback → incident → Jira → owner notified.", scenario: "HEALTH_CHECK_FAIL_ROLLBACK" as T.DemoFailureScenario },
      { id: "dotnet", title: ".NET Project Factory with SDK mismatch", description: "Task Engine detects .NET 8, installs .NET 10 via known recovery, builds and tests.", scenario: "SDK_MISMATCH" as T.DemoFailureScenario },
      { id: "docker", title: "Docker build failure → AI diagnosis", description: "Deterministic retries exhausted → AI recovery plan → success → recommendation to make it deterministic.", scenario: "DOCKER_BUILD_FAIL" as T.DemoFailureScenario },
    ];
  }

  /** Prepare a scenario: returns the change/task/approval the user should act on. */
  async prepare(ctx: T.RequestContext, scenarioId: string): Promise<{ changeId?: string; taskId?: string; approvalRequestId?: string; steps: DemoScenarioStep[] }> {
    const org = await this.store.organizations.get(ctx.actor.organizationId);
    if (!org?.demo) throw new DomainError("VALIDATION", "Demo Lab runs only inside a demo organization. Switch to ABC Sdn Bhd (Demo).");
    const s = this.scenarios().find((x) => x.id === scenarioId);
    if (!s) throw new DomainError("NOT_FOUND", "Scenario not found");
    const aiCtx: T.RequestContext = { ...ctx, executionMode: "AI" };
    const run = await this.telemetry.startRun(ctx, { purpose: s.id === "dotnet" ? "PLAN_TASK" : "DEPLOYMENT", client: "Claude", provider: "DEMO", model: "demo-planner-1", summary: `Demo Lab: ${s.title}`, contextItemCount: 12, relevantItemCount: 12 });
    await this.telemetry.recordCall(ctx, run.id, { toolName: "super.change.get", durationMs: 140, status: "SUCCESS" });
    await this.telemetry.recordCall(ctx, run.id, { toolName: "super.deployment.status", durationMs: 90, status: "SUCCESS" });

    if (s.id === "dotnet") {
      const env = (await this.store.environments.list({ organizationId: org.id })).find((e) => e.kind === "DEVELOPMENT");
      const { task } = await this.tasks.create(aiCtx, { definitionId: "create-dotnet-project", inputs: { name: "notification-service", architecture: "Clean Architecture", dotnetVersion: "10.0", database: "SQLite" }, environmentId: env?.id, aiRunId: run.id, scenario: "SDK_MISMATCH", executionMode: "AI" });
      return { taskId: task.id, steps: this.steps(s.id, { taskId: task.id }) };
    }
    if (s.id === "docker") {
      const change = await this.store.changes.get(DEMO.changes.payments);
      const env = (await this.store.environments.list({ organizationId: org.id })).find((e) => e.kind === "DEVELOPMENT");
      const { task } = await this.tasks.create(aiCtx, { definitionId: "deploy-application", inputs: { applicationId: DEMO.apps.payments, environmentId: env!.id, version: "v2.4.1-dev.13" }, changeId: change?.id, environmentId: env!.id, applicationId: DEMO.apps.payments, aiRunId: run.id, scenario: "DOCKER_BUILD_FAIL", executionMode: "AI", name: "Deploy payments-api v2.4.1-dev.13 to Development" });
      return { taskId: task.id, changeId: change?.id, steps: this.steps(s.id, { taskId: task.id }) };
    }
    // showcase / rollback: use the Claims v2.8 change. Ensure it is at Deployment Preparation / Approval with a pending approval.
    let change = await this.store.changes.get(DEMO.changes.claimsRelease);
    if (!change) throw new DomainError("NOT_FOUND", "Demo change missing — reset demo data");
    change = { ...change, demoScenario: s.scenario };
    const pending = (await this.store.approvals.list({ changeId: change.id })).find((a) => a.status === "PENDING");
    let approvalRequestId = pending?.id;
    let approvalRequestId2: string | undefined;
    let taskId = pending?.taskId;
    if (pending && !pending.taskId) {
      // The seeded approval is a fixture. Replace it with one the Policy Engine actually produces,
      // so the demo shows a real decision rather than a hard-coded one.
      const env = (await this.store.environments.get(change.targetEnvironmentId!))!;
      const requester: T.RequestContext = { ...aiCtx, actor: { ...ctx.actor, userId: pending.requestedById, userName: pending.requestedByName } };
      const { task, approvalRequestId } = await this.tasks.create(requester, { definitionId: "deploy-application", inputs: { applicationId: change.applicationId!, environmentId: env.id, version: change.version!, includesMigration: false }, changeId: change.id, environmentId: env.id, applicationId: change.applicationId, aiRunId: run.id, scenario: s.scenario, executionMode: "AI", name: `Deploy claims-portal ${change.version} to Production` });
      await this.store.approvals.put({ ...pending, status: "CANCELLED", decidedAt: ctx.now() });
      approvalRequestId2 = approvalRequestId;
      taskId = task.id;
      const req = approvalRequestId ? await this.store.approvals.get(approvalRequestId) : undefined;
      const fresh = (await this.store.changes.get(change.id))!;
      change = { ...fresh, demoScenario: s.scenario, status: "AWAITING_APPROVAL", currentStageKey: "APPROVAL",
        stages: fresh.stages.map((st) => st.key === "DEPLOYMENT_PREPARATION" ? { ...st, state: "COMPLETED" as const, progress: 100, completedAt: ctx.now() } : st.key === "APPROVAL" ? { ...st, state: "ACTIVE" as const, startedAt: st.startedAt ?? ctx.now() } : st),
        blockers: [...fresh.blockers.filter((b) => b.approvalRequestId !== pending.id), ...(req ? [{ id: `blk_${Date.now()}`, title: "Production deployment cannot start", reason: `${req.requiredApprovals} approval(s) required (risk ${req.risk}).`, missing: req.slots.map((sl) => `${sl.approver.label} approval`), waitingFor: { roleKey: req.slots[0].approver.kind.toLowerCase(), label: req.slots.filter((sl) => sl.status === "PENDING").map((sl) => sl.approver.label).join(", ") }, approvalRequestId: req.id, stageKey: "APPROVAL" as const, createdAt: ctx.now() }] : [])] };
    } else if (!pending) {
      const r = await this.changes.requestDeployment(aiCtx, change.id, { aiRunId: run.id });
      approvalRequestId2 = r.approvalRequestId; taskId = r.task.id;
      change = { ...(await this.store.changes.get(change.id))!, demoScenario: s.scenario };
    }
    approvalRequestId = approvalRequestId2 ?? approvalRequestId;
    await this.store.changes.put(change);
    if (taskId) { const t = await this.store.tasks.get(taskId); if (t) await this.store.tasks.put({ ...t, scenario: s.scenario }); }
    const finalReq = approvalRequestId ? await this.store.approvals.get(approvalRequestId) : undefined;
    await this.telemetry.trace(ctx, run.id, { kind: "POLICY", message: finalReq ? `Production deployment requires ${finalReq.requiredApprovals} approval(s) from ${finalReq.slots.map((sl) => sl.approver.label).join(", ")}` : "Policy evaluated", policyResult: finalReq ? "WAITING_APPROVAL" : "AUTO" });
    return { changeId: change.id, taskId, approvalRequestId, steps: this.steps(s.id, { changeId: change.id, taskId, approvalRequestId, approverLabels: finalReq?.slots.map((sl) => sl.approver.label).join(" + ") }) };
  }

  steps(scenarioId: string, refs: { changeId?: string; taskId?: string; approvalRequestId?: string; approverLabels?: string }): DemoScenarioStep[] {
    const base: DemoScenarioStep[] = scenarioId === "dotnet"
      ? [{ key: "request", label: "User request: create a .NET project", state: "DONE" }, { key: "task", label: "AI selects create-dotnet-project; Task Engine plans 12 steps", state: "DONE", href: refs.taskId && `/tasks/${refs.taskId}` }, { key: "sdk", label: "Discovery finds .NET 8, project needs .NET 10", state: "PENDING" }, { key: "recover", label: "Known recovery: install .NET 10 (98% success rate)", state: "PENDING" }, { key: "build", label: "Build and test succeed", state: "PENDING" }, { key: "learn", label: "AI optimization: 31 AI decisions avoided", state: "PENDING" }]
      : scenarioId === "docker"
      ? [{ key: "request", label: "Deploy payments-api to Development", state: "DONE" }, { key: "build", label: "Docker build fails (peer dependency mismatch)", state: "PENDING" }, { key: "retry", label: "Deterministic retries exhausted", state: "PENDING" }, { key: "ai", label: "AI diagnosis produces a recovery plan", state: "PENDING" }, { key: "success", label: "Rebuild succeeds, deployment healthy", state: "PENDING" }, { key: "learn", label: "Recommendation: make this recovery deterministic", state: "PENDING", href: "/ai/optimization" }]
      : [{ key: "request", label: "User: “Deploy Claims Portal v2.8 to Production.”", state: "DONE" }, { key: "change", label: "Change CHG-108: Development ✓ Testing ✓ Deployment Prep ✓ Policy ✓ · Risk HIGH", state: "DONE", href: refs.changeId && `/changes/${refs.changeId}` }, { key: "approval", label: refs.approverLabels ? `Approval WAITING — ${refs.approverLabels}` : "Approval WAITING", state: "PENDING", href: refs.approvalRequestId && `/approvals/${refs.approvalRequestId}` }, { key: "deploy", label: "Deployment executes (12 deterministic steps)", state: "PENDING", href: refs.taskId && `/tasks/${refs.taskId}` }, { key: "fail", label: "Health check fails → self-healing", state: "PENDING" }, { key: scenarioId === "rollback" ? "rollback" : "heal", label: scenarioId === "rollback" ? "Still failing → rollback → incident → Jira → owner notified" : "Retry → success → Production HEALTHY", state: "PENDING" }, { key: "learn", label: "AI optimization: 4 AI decisions, 12 task steps, 2 recoveries, 8 AI calls avoided", state: "PENDING", href: "/ai/optimization" }];
    return base;
  }

  async execute(ctx: T.RequestContext, taskId: string, hooks: ExecutionHooks): Promise<T.Task> {
    return this.tasks.execute(ctx, taskId, hooks);
  }
}
