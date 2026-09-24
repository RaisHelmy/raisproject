import type { Task, TaskDefinition, RequestContext, Deployment, Incident, DemoFailureScenario, ExecutionMode } from "../types";
import { DomainError } from "../types";
import { ServiceBase } from "./context";
import { TASK_TYPE_PERMISSION } from "../permissions";
import { findDefinition, TASK_CATALOG } from "../engines/taskCatalog";
import { runTask, aiRequestsAvoided, type TaskEngineHooks } from "../engines/taskEngine";
import { isActive } from "../engines/taskStateMachine";
import { completeStage, setStageState } from "../engines/changeLifecycle";
import { newId } from "../ids";
import { planById } from "../billing";
import type { ApprovalService } from "./approvalService";
import type { PolicyService } from "./policyService";
import type { TelemetryService } from "./telemetryService";

export interface CreateTaskInput {
  definitionId: string;
  inputs?: Record<string, string | number | boolean>;
  name?: string;
  changeId?: string;
  environmentId?: string;
  applicationId?: string;
  aiRunId?: string;
  scenario?: DemoFailureScenario;
  executionMode?: ExecutionMode;
  destructive?: boolean;
}

export interface ExecutionHooks { sleep?: (ms: number) => Promise<void>; speed?: number; onUpdate?: (task: Task) => void }

let taskSeq = 2051;
let incidentSeq = 20;

export class TaskService extends ServiceBase {
  constructor(store: ConstructorParameters<typeof ServiceBase>[0], private approvals: ApprovalService, private policies: PolicyService, private telemetry: TelemetryService) { super(store); }

  definitions(): TaskDefinition[] { return TASK_CATALOG; }

  async list(ctx: RequestContext, filter: { status?: "active" | "scheduled" | "completed" | "failed"; changeId?: string } = {}): Promise<Task[]> {
    this.require(ctx, "change.read");
    let list = await this.store.tasks.list({ organizationId: ctx.actor.organizationId });
    if (filter.changeId) list = list.filter((t) => t.changeId === filter.changeId);
    if (filter.status === "active") list = list.filter((t) => isActive(t.status) && !t.scheduledFor);
    if (filter.status === "scheduled") list = list.filter((t) => Boolean(t.scheduledFor) && t.status === "QUEUED");
    if (filter.status === "completed") list = list.filter((t) => t.status === "COMPLETED");
    if (filter.status === "failed") list = list.filter((t) => ["FAILED", "DIAGNOSING", "RECOVERY", "RETRY", "ESCALATED", "ROLLED_BACK"].includes(t.status));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(ctx: RequestContext, id: string): Promise<{ task: Task; definition?: TaskDefinition; deployment?: Deployment; aiRequestsAvoided: number }> {
    this.require(ctx, "change.read");
    const task = this.assertTenant(ctx, await this.store.tasks.get(id), "Task");
    const definition = findDefinition(task.definitionId);
    const deployment = (await this.store.deployments.list((d) => d.taskId === id))[0];
    return { task, definition, deployment, aiRequestsAvoided: definition ? aiRequestsAvoided(definition, task) : 0 };
  }

  /**
   * Create a task: authorization → policy → risk → approval (if required). Never executes directly.
   */
  async create(ctx: RequestContext, input: CreateTaskInput): Promise<{ task: Task; approvalRequestId?: string }> {
    const def = findDefinition(input.definitionId);
    if (!def) throw new DomainError("NOT_FOUND", `Task definition ${input.definitionId} not found`);
    this.require(ctx, TASK_TYPE_PERMISSION[def.type] ?? "task.create");
    for (const i of def.inputs) if (i.required && (input.inputs?.[i.name] === undefined || input.inputs?.[i.name] === "")) throw new DomainError("VALIDATION", `Missing required input: ${i.name}`);
    const env = input.environmentId ? this.assertTenant(ctx, await this.store.environments.get(input.environmentId), "Environment") : undefined;
    const app = input.applicationId ? this.assertTenant(ctx, await this.store.applications.get(input.applicationId), "Application") : undefined;
    const agent = env?.agentId ? await this.store.agents.get(env.agentId) : undefined;
    if (agent && (agent.status === "QUARANTINED" || agent.status === "DISABLED" || agent.status === "REVOKED")) throw new DomainError("INVALID_STATE", `Agent ${agent.name} is ${agent.status.toLowerCase()} and cannot execute tasks`);
    const org = (await this.store.organizations.get(ctx.actor.organizationId))!;
    const plan = planById(org.planId);
    const monthTasks = (await this.store.tasks.list({ organizationId: org.id })).filter((t) => t.createdAt.slice(0, 7) === ctx.now().slice(0, 7)).length;
    if (plan.limits.taskExecutionsPerMonth !== null && monthTasks >= plan.limits.taskExecutionsPerMonth) throw new DomainError("LIMIT_EXCEEDED", `Plan limit reached: ${plan.limits.taskExecutionsPerMonth} task executions per month. Upgrade your plan to continue.`);

    const includesMigration = Boolean(input.inputs?.includesMigration) || def.type === "DATABASE_MIGRATION";
    const decision = await this.policies.evaluateFor(ctx, { taskType: def.type, environmentId: env?.id, includesDatabaseMigration: includesMigration, destructive: input.destructive || def.type === "VM_DELETE", capabilities: ctx.executionMode === "AI" ? def.steps.filter((s) => includesMigration || (s.id !== "migrate" && s.id !== "restore-db" && s.id !== "backup")).map((s) => s.capability).filter((c): c is NonNullable<typeof c> => Boolean(c)) : undefined, resourceId: app?.id });
    const task: Task = {
      id: newId("tsk"), organizationId: ctx.actor.organizationId, key: `TSK-${taskSeq++}`, changeId: input.changeId, definitionId: def.id, definitionVersion: def.version, type: def.type, name: input.name ?? `${def.name}${app ? ": " + app.name : ""}${env ? " → " + env.name : ""}`,
      status: "QUEUED", risk: decision.risk, environmentId: env?.id, agentId: agent?.id, applicationId: app?.id, requestedById: ctx.actor.userId, executionMode: input.executionMode ?? ctx.executionMode, aiRunId: input.aiRunId, inputs: input.inputs ?? {}, steps: [], log: [], attemptCount: 0, recoveryCount: 0, rolledBack: false, policyDecision: decision, scenario: input.scenario ?? "NONE", createdAt: ctx.now(),
    };
    if (decision.result === "DENIED") {
      await this.audit(ctx, "task.denied", "task", task.id, task.name, { risk: decision.risk, result: "DENIED", detail: decision.explanation.join(" ") });
      throw new DomainError("POLICY_DENIED", `Policy denied: ${decision.matchedPolicies.map((p) => p.name).join(", ")}`, { decision });
    }
    task.log.push({ at: ctx.now(), level: "INFO", message: `Task created by ${ctx.actor.userName} (${task.executionMode}). ${decision.explanation[decision.explanation.length - 1]}`, executionMode: "SYSTEM" });
    await this.store.tasks.put(task);
    await this.audit(ctx, "task.create", "task", task.id, task.name, { risk: decision.risk, detail: decision.result });
    if (input.aiRunId) await this.telemetry.trace(ctx, input.aiRunId, { kind: "POLICY", message: decision.explanation[decision.explanation.length - 1], policyResult: decision.result });

    let approvalRequestId: string | undefined;
    if (decision.result === "WAITING_APPROVAL") {
      const summary = [app ? `${app.name} ${input.inputs?.version ?? ""}`.trim() : def.name, includesMigration ? "Database migration included" : "No database migration", env ? `Target: ${env.name}` : "", agent ? `Agent: ${agent.name} (${agent.status.toLowerCase()})` : ""].filter(Boolean);
      const req = await this.approvals.createFromDecision(ctx, { decision, title: task.name, kind: def.type === "DEPLOYMENT" ? "DEPLOYMENT" : def.type === "DATABASE_MIGRATION" ? "DATABASE_MIGRATION" : def.type === "RESTART" ? "RESTART" : def.type === "VM_DELETE" ? "DELETION" : def.type === "CREDENTIAL_CHANGE" ? "CREDENTIAL" : def.type === "POLICY_CHANGE" ? "POLICY" : "TASK", changeId: input.changeId, taskId: task.id, environmentId: env?.id, environmentName: env?.name, summary });
      approvalRequestId = req.id;
      task.approvalRequestId = req.id; task.status = "WAITING_APPROVAL";
      task.log.push({ at: ctx.now(), level: "INFO", message: `Waiting for ${decision.requiredApprovals} approval(s): ${decision.approvers.map((a) => a.label).join(", ")} (${req.key})`, executionMode: "SYSTEM" });
      await this.store.tasks.put(task);
      if (input.aiRunId) await this.telemetry.trace(ctx, input.aiRunId, { kind: "APPROVAL", message: `Approval ${req.key} requested from ${decision.approvers.map((a) => a.label).join(", ")}` });
    }
    return { task, approvalRequestId };
  }

  async cancel(ctx: RequestContext, id: string): Promise<Task> {
    this.require(ctx, "task.cancel");
    const task = this.assertTenant(ctx, await this.store.tasks.get(id), "Task");
    if (!["QUEUED", "WAITING_APPROVAL", "ESCALATED", "PLANNING", "DISCOVERING", "POLICY_CHECK"].includes(task.status)) throw new DomainError("INVALID_STATE", `Task in state ${task.status} cannot be cancelled`);
    task.status = "CANCELLED"; task.finishedAt = ctx.now(); task.log.push({ at: ctx.now(), level: "WARN", message: `Cancelled by ${ctx.actor.userName}`, executionMode: "HUMAN" });
    await this.store.tasks.put(task);
    if (task.approvalRequestId) { const a = await this.store.approvals.get(task.approvalRequestId); if (a && a.status === "PENDING") await this.store.approvals.put({ ...a, status: "CANCELLED", decidedAt: ctx.now() }); }
    await this.audit(ctx, "task.cancel", "task", task.id, task.name, { risk: task.risk });
    return task;
  }

  /**
   * Execute a task through the Task Engine. Refuses to run while approval is pending.
   * Wires engine events to deployments, changes, incidents, notifications and telemetry.
   */
  async execute(ctx: RequestContext, id: string, hooks: ExecutionHooks = {}): Promise<Task> {
    this.require(ctx, "task.execute");
    const initial = this.assertTenant(ctx, await this.store.tasks.get(id), "Task");
    const def = findDefinition(initial.definitionId);
    if (!def) throw new DomainError("NOT_FOUND", "Task definition not found");
    if (initial.status === "WAITING_APPROVAL") {
      const approval = initial.approvalRequestId ? await this.store.approvals.get(initial.approvalRequestId) : undefined;
      if (!approval || approval.status !== "APPROVED") {
        await this.audit(ctx, "task.execute.blocked", "task", initial.id, initial.name, { risk: initial.risk, result: "DENIED", detail: "Approval pending" });
        throw new DomainError("POLICY_DENIED", "This task is waiting for approval and cannot be executed", { approvalRequestId: initial.approvalRequestId, waitingFor: approval?.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label) });
      }
    } else if (!["QUEUED", "RETRY", "ESCALATED"].includes(initial.status)) throw new DomainError("INVALID_STATE", `Task in state ${initial.status} cannot be executed`);
    if (initial.status === "ESCALATED") { this.require(ctx, "task.execute"); initial.status = "RETRY"; initial.steps = []; initial.rolledBack = false; initial.error = undefined; initial.log.push({ at: ctx.now(), level: "INFO", message: `Manual retry by ${ctx.actor.userName}`, executionMode: "HUMAN" }); }

    const env = initial.environmentId ? await this.store.environments.get(initial.environmentId) : undefined;
    const app = initial.applicationId ? await this.store.applications.get(initial.applicationId) : undefined;
    const change = initial.changeId ? await this.store.changes.get(initial.changeId) : undefined;
    const version = String(initial.inputs.version ?? app?.deployedVersions[env?.id ?? ""] ?? "");
    let deployment: Deployment | undefined = def.type === "DEPLOYMENT" && app && env ? {
      id: newId("dep"), organizationId: ctx.actor.organizationId, changeId: change?.id, taskId: initial.id, applicationId: app.id, applicationName: app.slug, environmentId: env.id, environmentName: env.name, version, previousVersion: app.deployedVersions[env.id], status: "PENDING", health: "UNKNOWN", agentId: initial.agentId, startedAt: ctx.now(), healthChecks: [], executionMode: initial.executionMode,
    } : undefined;
    if (deployment) await this.store.deployments.put(deployment);
    await this.audit(ctx, "task.execute", "task", initial.id, initial.name, { risk: initial.risk });
    if (change) {
      await this.store.timeline.put({ id: newId("tl"), changeId: change.id, at: ctx.now(), kind: "TASK", message: `${initial.key} ${initial.name} started`, actor: "Task Engine", executionMode: "TASK_ENGINE" });
      if (def.type === "DEPLOYMENT" && change.currentStageKey === "DEPLOYMENT") { await this.store.changes.put({ ...setStageState(change, "DEPLOYMENT", "ACTIVE", ctx.now(), 10), status: "DEPLOYING" }); }
    }
    const timeline = async (kind: "TASK" | "DEPLOYMENT" | "INCIDENT" | "SYSTEM" | "AI", message: string, actor = "Task Engine", mode: ExecutionMode = "TASK_ENGINE") => { if (change) await this.store.timeline.put({ id: newId("tl"), changeId: change.id, at: ctx.now(), kind, message, actor, executionMode: mode }); };
    const setDeployment = async (patch: Partial<Deployment>) => { if (deployment) { deployment = { ...deployment, ...patch }; await this.store.deployments.put(deployment); } };

    const engineHooks: TaskEngineHooks = {
      now: ctx.now, speed: hooks.speed ?? 0, sleep: hooks.sleep ?? (async () => {}),
      onUpdate: async (t) => { await this.store.tasks.put(t); hooks.onUpdate?.(t); },
      onEvent: async (e, t) => {
        switch (e.type) {
          case "STATUS":
            if (e.status === "EXECUTING") { await setDeployment({ status: "DEPLOYING" }); if (deployment) { await this.notify(ctx, [t.requestedById], "DEPLOYMENT_STARTED", `Deployment started: ${deployment.applicationName} ${deployment.version}`, `Target ${deployment.environmentName}.`, `/deployments/${deployment.id}`); await timeline("DEPLOYMENT", `Deploying ${deployment.applicationName} ${deployment.version} to ${deployment.environmentName}`); } }
            if (e.status === "DIAGNOSING") { await setDeployment({ status: "HEALING", health: "DEGRADED" }); }
            break;
          case "STEP":
            if (e.step.stepId === "build" && deployment) await setDeployment({ status: "BUILDING" });
            if (e.step.stepId === "unit-tests" && deployment) await setDeployment({ status: "TESTING" });
            if (e.step.stepId === "docker-build" && deployment) await setDeployment({ status: "PACKAGING" });
            if (e.step.stepId === "deploy" && deployment) await setDeployment({ status: "VERIFYING" });
            if (change && e.step.status !== "FAILED") { const c = await this.store.changes.get(change.id); if (c && c.currentStageKey === "DEPLOYMENT") await this.store.changes.put(setStageState(c, "DEPLOYMENT", "ACTIVE", ctx.now(), Math.min(95, Math.round((e.step.sequence / def.steps.length) * 100)))); }
            break;
          case "HEALTH":
            if (deployment) await setDeployment({ healthChecks: [...deployment.healthChecks, { name: "GET /health", status: e.status, at: ctx.now(), detail: e.detail }], health: e.status === "PASS" ? "HEALTHY" : "UNHEALTHY" });
            if (e.status === "FAIL") { await timeline("DEPLOYMENT", `Health check failed: ${e.detail} → workflow paused → self-healing`); await this.notify(ctx, [t.requestedById], "SELF_HEALING_STARTED", `Self-healing started: ${t.name}`, e.detail, `/tasks/${t.id}`); }
            break;
          case "RECOVERY":
            await timeline("TASK", `Recovery ${e.attempt} (${e.kind.toLowerCase().replace("_", " ")}): ${e.strategy}`);
            if (e.knowledgeRecordId) { const kr = await this.store.knowledge.get(e.knowledgeRecordId); if (kr) await this.store.knowledge.put({ ...kr, applications: kr.applications + 1 }); }
            if (e.kind === "AI_DIAGNOSIS") { await this.store.aiFailures.put({ id: newId("aif"), organizationId: ctx.actor.organizationId, aiRunId: t.aiRunId ?? "", taskId: t.id, type: "TOOL_FAILURE", rootCause: "Docker", message: t.steps.filter((s) => s.status === "FAILED").slice(-1)[0]?.error ?? "Unknown", at: ctx.now(), recovered: true }); }
            break;
          case "AI_DIAGNOSIS":
            await timeline("AI", `AI diagnosis: ${e.summary}`, "AI", "AI");
            if (t.aiRunId) await this.telemetry.trace(ctx, t.aiRunId, { kind: "DECISION", message: `AI diagnosis: ${e.summary}`, reasonCategory: "DIAGNOSE_FAILURE" });
            break;
          case "ROLLBACK":
            await setDeployment({ status: "ROLLED_BACK", health: "HEALTHY", finishedAt: ctx.now() });
            await timeline("DEPLOYMENT", `Rollback executed: ${e.reason}`);
            await this.notify(ctx, [t.requestedById, ...(change ? [change.ownerId] : [])], "ROLLBACK", `Rolled back: ${t.name}`, e.reason, `/tasks/${t.id}`);
            break;
          case "ESCALATED": {
            const incident: Incident = { id: newId("inc"), organizationId: ctx.actor.organizationId, key: `INC-${incidentSeq++}`, title: `${t.name} failed${t.rolledBack ? " (rolled back)" : ""}`, severity: env?.kind === "PRODUCTION" ? "SEV2" : "SEV3", status: "OPEN", changeId: change?.id, deploymentId: deployment?.id, taskId: t.id, environmentId: env?.id, rootCause: t.steps.some((s) => s.stepId === "docker-build" && s.status === "FAILED") ? "Docker" : "Application", summary: e.reason, selfHealed: false, jiraKey: change?.jira[0]?.key, createdAt: ctx.now() };
            await this.store.incidents.put(incident);
            await this.store.issues.put({ id: newId("iss"), organizationId: ctx.actor.organizationId, key: `ISS-${80 + incidentSeq}`, type: t.rolledBack ? "DEPLOYMENT_FAILURE" : "SELF_HEALING_FAILURE", title: incident.title, status: "OPEN", rootCause: incident.rootCause, links: { changeId: change?.id, taskId: t.id, deploymentId: deployment?.id, incidentId: incident.id, aiRunId: t.aiRunId, agentId: t.agentId, jiraKey: incident.jiraKey }, createdAt: ctx.now() });
            await timeline("INCIDENT", `${incident.key} created${incident.jiraKey ? ` · Jira ${incident.jiraKey} updated` : ""} · owner notified`, "System", "SYSTEM");
            await this.notify(ctx, [t.requestedById, ...(change ? [change.ownerId] : [])], "INCIDENT_CREATED", `${incident.key}: ${incident.title}`, e.reason, `/incidents/${incident.id}`);
            if (change) { const c = await this.store.changes.get(change.id); if (c) await this.store.changes.put({ ...setStageState(c, "DEPLOYMENT", "FAILED", ctx.now()), status: "BLOCKED", blockers: [...c.blockers, { id: newId("blk"), title: "Deployment failed and was rolled back", reason: e.reason, missing: ["Fix root cause", "Re-run deployment"], waitingFor: { userId: c.ownerId, label: "Change owner" }, stageKey: "DEPLOYMENT", createdAt: ctx.now() }], analytics: { ...c.analytics, failures: c.analytics.failures + 1, rollbacks: c.analytics.rollbacks + (t.rolledBack ? 1 : 0), recoveries: c.analytics.recoveries + t.recoveryCount } }); }
            await this.audit(ctx, "task.escalated", "task", t.id, t.name, { risk: t.risk, result: "FAILED", detail: e.reason });
            await this.notify(ctx, [t.requestedById], "DEPLOYMENT_FAILED", `Deployment failed: ${t.name}`, e.reason, `/tasks/${t.id}`);
            break;
          }
          case "COMPLETED": {
            if (deployment && app && env) {
              await setDeployment({ status: "HEALTHY", health: "HEALTHY", finishedAt: ctx.now() });
              await this.store.applications.put({ ...app, deployedVersions: { ...app.deployedVersions, [env.id]: deployment.version } });
              await this.store.environments.put({ ...env, health: "HEALTHY" });
              await this.notify(ctx, [t.requestedById, ...(change ? [change.ownerId] : [])], "DEPLOYMENT_COMPLETED", `${deployment.applicationName} ${deployment.version} deployed to ${deployment.environmentName}`, `Health checks passed.${t.recoveryCount ? ` ${t.recoveryCount} self-healing recovery action(s).` : ""}`, `/deployments/${deployment.id}`);
              await this.audit(ctx, "deployment.completed", "deployment", deployment.id, `${deployment.applicationName} ${deployment.version} → ${deployment.environmentName}`, { risk: t.risk });
            }
            if (change) {
              let c = await this.store.changes.get(change.id);
              if (c) {
                if (def.type === "DEPLOYMENT" && deployment) {
                  await this.store.evidence.putMany([
                    { id: newId("evd"), changeId: c.id, stageKey: "DEPLOYMENT", type: "DEPLOYMENT_LOG", title: `${deployment.applicationName} ${deployment.version} → ${deployment.environmentName}`, reference: deployment.id, summary: t.summary, source: "TASK_ENGINE", createdAt: ctx.now(), classification: "INTERNAL" },
                    { id: newId("evd"), changeId: c.id, stageKey: "LIVE_VALIDATION", type: "SERVER_HEALTH", title: "Health check passed", reference: "GET /health → 200", source: "AGENT", createdAt: ctx.now(), classification: "INTERNAL" },
                    { id: newId("evd"), changeId: c.id, stageKey: "LIVE_VALIDATION", type: "SMOKE_TEST", title: "Smoke tests passed", summary: "6/6 checks green", source: "AGENT", createdAt: ctx.now(), classification: "INTERNAL" },
                  ]);
                  if (c.currentStageKey === "DEPLOYMENT") { c = completeStage(c, "DEPLOYMENT", ctx.now()); await timeline("DEPLOYMENT", `Deployment successful → Live Validation activated`); c = completeStage(c, "LIVE_VALIDATION", ctx.now()); await timeline("SYSTEM", `Live validation passed → UAT activated`, "System", "SYSTEM"); }
                  c.checklist = c.checklist.map((i) => i.stageKey === "LIVE_VALIDATION" || (i.stageKey === "DEPLOYMENT_PREPARATION" && i.automated) ? { ...i, state: "DONE" } : i);
                  c.blockers = c.blockers.map((b) => b.stageKey === "DEPLOYMENT" ? { ...b, resolvedAt: ctx.now() } : b);
                  c.status = "ACTIVE";
                }
                c.analytics = { ...c.analytics, taskCount: c.analytics.taskCount + 1, agentOperationCount: c.analytics.agentOperationCount + t.steps.filter((s) => s.executionMode === "AGENT").length, recoveries: c.analytics.recoveries + t.recoveryCount, failures: c.analytics.failures + (t.recoveryCount > 0 ? 1 : 0) };
                await this.store.changes.put(c);
              }
            }
            if (t.recoveryCount > 0) { await this.store.incidents.put({ id: newId("inc"), organizationId: ctx.actor.organizationId, key: `INC-${incidentSeq++}`, title: `${t.name}: transient failure self-healed`, severity: "SEV4", status: "RESOLVED", changeId: change?.id, deploymentId: deployment?.id, taskId: t.id, environmentId: env?.id, rootCause: "Application", summary: `${t.recoveryCount} recovery action(s) applied by the Task Engine without AI or human intervention.`, selfHealed: true, createdAt: ctx.now(), resolvedAt: ctx.now() }); }
            if (t.aiRunId) await this.telemetry.finishRun(ctx, t.aiRunId, { status: "COMPLETED", finalStatus: "SUCCESS", taskCount: 1, deterministicOperations: t.steps.filter((s) => s.status !== "SKIPPED").length, aiRequestsAvoided: aiRequestsAvoided(def, t), recoveryCount: t.recoveryCount });
            await this.audit(ctx, "task.completed", "task", t.id, t.name, { risk: t.risk });
            break;
          }
        }
      },
    };
    const result = await runTask(initial, def, engineHooks);
    if (result.status === "ESCALATED" && result.aiRunId) await this.telemetry.finishRun(ctx, result.aiRunId, { status: "FAILED", finalStatus: result.summary ?? "ESCALATED", taskCount: 1, deterministicOperations: result.steps.length, aiRequestsAvoided: aiRequestsAvoided(def, result), recoveryCount: result.recoveryCount, rollbackCount: result.rolledBack ? 1 : 0 });
    return result;
  }
}
