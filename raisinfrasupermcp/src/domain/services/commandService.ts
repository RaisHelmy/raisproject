import type * as T from "../types";
import { ServiceBase } from "./context";
import type { AIProvider, CommandIntent } from "../ai/provider";
import type { ChangeService } from "./changeService";
import type { TaskService } from "./taskService";
import type { TelemetryService } from "./telemetryService";
import { DomainError } from "../types";

export type CommandResult =
  | { kind: "NAVIGATE"; href: string; message: string; aiRunId: string }
  | { kind: "PLAN"; intent: string; message: string; aiRunId: string }
  | { kind: "TASK"; taskId: string; approvalRequestId?: string; message: string; aiRunId: string; href: string }
  | { kind: "CHANGE_DEPLOY"; changeId: string; message: string; aiRunId: string; href: string; approvalRequestId?: string }
  | { kind: "ANSWER"; message: string; aiRunId: string; href?: string }
  | { kind: "UNKNOWN"; message: string; aiRunId: string };

/** Section 105/139 — Command Center. Natural language → intent → governed action. Never raw shell. */
export class CommandService extends ServiceBase {
  constructor(store: ConstructorParameters<typeof ServiceBase>[0], private ai: AIProvider, private changes: ChangeService, private tasks: TaskService, private telemetry: TelemetryService) { super(store); }

  async run(ctx: T.RequestContext, text: string, client = "Super MCP Web"): Promise<CommandResult> {
    const run = await this.telemetry.startRun(ctx, { purpose: "CHECK_STATUS", client, provider: this.ai.kind, model: this.ai.model, summary: text, contextItemCount: 6, relevantItemCount: 6 });
    const t0 = Date.now();
    const intent = await this.ai.interpretCommand(text);
    const aiCtx: T.RequestContext = { ...ctx, executionMode: "AI" };
    const finish = async (result: CommandResult, finalStatus = "SUCCESS", extra: Parameters<TelemetryService["finishRun"]>[2] = { status: "COMPLETED", finalStatus }) => { await this.telemetry.finishRun(ctx, run.id, extra); return result; };
    const call = (toolName: string, inputs?: unknown) => this.telemetry.recordCall(ctx, run.id, { toolName, durationMs: Date.now() - t0 + 120, status: "SUCCESS", inputs });

    try {
      switch (intent.kind) {
        case "SHOW": {
          const hrefs: Record<Extract<CommandIntent, { kind: "SHOW" }>["target"], string> = { APPROVALS: "/approvals", BLOCKERS: "/changes?view=blocked", CHANGES: "/changes?view=mine", AGENTS: "/agents", INCIDENTS: "/incidents", OPTIMIZATION: "/ai/optimization", REPORT: "/work/reports", DEPLOYMENTS: "/infrastructure/deployments", TASKS: "/tasks" };
          await call("super.change.next_action");
          if (intent.target === "BLOCKERS") {
            const blocked = (await this.changes.list(ctx, { view: "blocked" }));
            return finish({ kind: "ANSWER", aiRunId: run.id, href: hrefs.BLOCKERS, message: blocked.length ? `${blocked.length} blocked change(s): ${blocked.map((c) => `${c.key} — ${c.blockers.find((b) => !b.resolvedAt)?.missing[0] ?? "blocked"}`).join("; ")}` : "Nothing is blocked right now." });
          }
          return finish({ kind: "NAVIGATE", href: hrefs[intent.target], message: `Opening ${intent.target.toLowerCase()}`, aiRunId: run.id });
        }
        case "HEALTH_CHECK": {
          await call("super.system.health");
          const { task } = await this.tasks.create(aiCtx, { definitionId: "health-check", inputs: {}, aiRunId: run.id, executionMode: "AI" });
          await this.telemetry.finishRun(ctx, run.id, { status: "COMPLETED", finalStatus: "TASK_CREATED", taskCount: 1 });
          return { kind: "TASK", taskId: task.id, message: `Health check ${task.key} queued for all environments.`, aiRunId: run.id, href: `/tasks/${task.id}` };
        }
        case "DIAGNOSE": {
          await call("super.incident.diagnose", { subject: intent.subject });
          const incidents = (await this.store.incidents.list({ organizationId: ctx.actor.organizationId })).filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED");
          const target = incidents.find((i) => intent.subject.toLowerCase().includes("docker") ? i.rootCause === "Docker" : intent.subject.toLowerCase().includes("production") ? i.environmentId?.includes("prod") : true) ?? incidents[0];
          if (!target) return finish({ kind: "ANSWER", aiRunId: run.id, message: "No open incidents match. All environments report healthy.", href: "/incidents" });
          const { task } = await this.tasks.create(aiCtx, { definitionId: "diagnose-incident", inputs: { incidentId: target.id }, name: `Diagnose ${target.key}: ${target.title}`, aiRunId: run.id, environmentId: target.environmentId, executionMode: "AI" });
          await this.telemetry.finishRun(ctx, run.id, { status: "COMPLETED", finalStatus: "TASK_CREATED", taskCount: 1, aiRequestsAvoided: 8 });
          return { kind: "TASK", taskId: task.id, message: `Diagnosing ${target.key} (${target.rootCause}). Known recoveries are tried before AI.`, aiRunId: run.id, href: `/tasks/${task.id}` };
        }
        case "CREATE_PROJECT": {
          await call("super.project.create", intent);
          const env = (await this.store.environments.list({ organizationId: ctx.actor.organizationId })).find((e) => e.kind === "DEVELOPMENT");
          const { task } = await this.tasks.create(aiCtx, { definitionId: "create-dotnet-project", inputs: { name: intent.name, architecture: intent.architecture, dotnetVersion: "10.0", database: "SQLite" }, environmentId: env?.id, aiRunId: run.id, scenario: "SDK_MISMATCH", executionMode: "AI" });
          await this.telemetry.finishRun(ctx, run.id, { status: "COMPLETED", finalStatus: "TASK_CREATED", taskCount: 1 });
          return { kind: "TASK", taskId: task.id, message: `Project factory ${task.key} created: ${intent.name} (${intent.architecture}, .NET 10, SQLite).`, aiRunId: run.id, href: `/tasks/${task.id}` };
        }
        case "DEPLOY": {
          await call("super.change.get", intent);
          const apps = await this.store.applications.list({ organizationId: ctx.actor.organizationId });
          const app = apps.find((a) => a.slug === intent.applicationSlug) ?? (intent.targetVm ? apps[0] : undefined);
          const envs = await this.store.environments.list({ organizationId: ctx.actor.organizationId });
          const env = envs.find((e) => e.kind === intent.environmentKind);
          if (!app || !env) return finish({ kind: "PLAN", intent: text, message: "I couldn't match an application. Let's create a Change so you can pick the target.", aiRunId: run.id });
          // Prefer an existing Change that is ready to deploy for this app/env.
          const candidates = (await this.store.changes.list({ organizationId: ctx.actor.organizationId })).filter((c) => c.applicationId === app.id && c.targetEnvironmentId === env.id && ["DEPLOYMENT_PREPARATION", "APPROVAL", "DEPLOYMENT"].includes(c.currentStageKey) && c.status !== "COMPLETED" && c.status !== "CANCELLED");
          const score = (c: T.Change) => (intent.version && c.version?.startsWith(intent.version) ? 2 : 0) + (c.blockers.some((b) => !b.resolvedAt && b.stageKey === "DEPLOYMENT_PREPARATION") ? -3 : 0) + (c.currentStageKey !== "DEPLOYMENT_PREPARATION" ? 1 : 0);
          const existing = candidates.sort((a, b) => score(b) - score(a))[0];
          if (existing) {
            await call("super.deployment.status", { changeId: existing.id });
            if (existing.currentStageKey === "DEPLOYMENT_PREPARATION") {
              const r = await this.changes.requestDeployment(aiCtx, existing.id, { aiRunId: run.id });
              return { kind: "CHANGE_DEPLOY", changeId: existing.id, approvalRequestId: r.approvalRequestId, aiRunId: run.id, href: r.approvalRequestId ? `/approvals/${r.approvalRequestId}` : `/changes/${existing.id}`, message: r.approvalRequestId ? `${existing.key} ${existing.title}: policy requires approval (risk ${existing.risk}). Approval requested.` : `${existing.key}: deployment unlocked.` };
            }
            const pending = (await this.store.approvals.list({ changeId: existing.id })).find((a) => a.status === "PENDING");
            await this.telemetry.finishRun(ctx, run.id, { status: "COMPLETED", finalStatus: pending ? "WAITING_APPROVAL" : "READY" });
            return { kind: "CHANGE_DEPLOY", changeId: existing.id, approvalRequestId: pending?.id, aiRunId: run.id, href: pending ? `/approvals/${pending.id}` : `/changes/${existing.id}`, message: pending ? `${existing.key} ${existing.title} is waiting for approval (${pending.key}) from ${pending.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ")}.` : `${existing.key} is ready to deploy.` };
          }
          return finish({ kind: "PLAN", intent: text, message: `No Change is ready to deploy ${app.name} to ${env.name}. I'll create one.`, aiRunId: run.id });
        }
        case "CREATE_CHANGE":
          await call("super.change.create", { intent: intent.intent });
          return finish({ kind: "PLAN", intent: intent.intent, message: "Understood. I'll draft a Change for you to review.", aiRunId: run.id }, "PLAN");
        default:
          return finish({ kind: "UNKNOWN", message: "I couldn't map that to an action. Try “Deploy claims-portal to production”, “What is blocking my release?” or describe a change to make.", aiRunId: run.id }, "UNKNOWN", { status: "FAILED", finalStatus: "UNKNOWN_INTENT" });
      }
    } catch (e) {
      const err = e as DomainError;
      await this.telemetry.finishRun(ctx, run.id, { status: "FAILED", finalStatus: err.code ?? "ERROR" });
      if (err instanceof DomainError && err.code === "POLICY_DENIED") await this.store.aiFailures.put({ id: `aif_${Date.now()}`, organizationId: ctx.actor.organizationId, aiRunId: run.id, type: "POLICY_BLOCK", rootCause: "Policy", message: err.message, at: ctx.now(), recovered: false });
      throw e;
    }
  }
}
