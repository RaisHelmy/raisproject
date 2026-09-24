import type { DemoFailureScenario, ExecutionMode, Task, TaskDefinition, TaskLogEntry, TaskStepExecution } from "../types";
import { canTransition } from "./taskStateMachine";
import { newId } from "../ids";

export type TaskEngineEvent =
  | { type: "STATUS"; status: Task["status"] }
  | { type: "STEP"; step: TaskStepExecution }
  | { type: "RECOVERY"; strategy: string; kind: string; attempt: number; knowledgeRecordId?: string }
  | { type: "AI_DIAGNOSIS"; summary: string }
  | { type: "ROLLBACK"; reason: string }
  | { type: "HEALTH"; status: "PASS" | "FAIL"; detail: string }
  | { type: "ESCALATED"; reason: string }
  | { type: "COMPLETED"; summary: string };

export interface TaskEngineHooks {
  now: () => string;
  sleep: (ms: number) => Promise<void>;
  onUpdate: (task: Task) => Promise<void> | void;
  onEvent: (event: TaskEngineEvent, task: Task) => Promise<void> | void;
  /** speed multiplier: 1 = estimatedSeconds*1000ms, 0 = instant */
  speed: number;
}

interface StepPlan {
  failOnAttempt?: number; // fail when attemptCount on this step is <= failOnAttempt
  error?: string;
  code?: string;
}

/**
 * Scenario injection used by the Demo Lab. Real executions would receive results from the Agent.
 */
function scenarioPlan(scenario: DemoFailureScenario | undefined, stepId: string): StepPlan {
  switch (scenario) {
    case "HEALTH_CHECK_FAIL_THEN_RECOVER": return stepId === "health-check" ? { failOnAttempt: 2, error: "Health endpoint returned 503 (container still warming up)", code: "HEALTH_CHECK_FAILED" } : {};
    case "HEALTH_CHECK_FAIL_ROLLBACK": return stepId === "health-check" ? { failOnAttempt: 99, error: "Health endpoint returned 500 (unhandled exception on startup)", code: "HEALTH_CHECK_FAILED" } : {};
    case "SDK_MISMATCH": return stepId === "check-sdk" ? { failOnAttempt: 1, error: "Project requires .NET 10; Agent has .NET 8", code: "SDK_MISMATCH" } : {};
    case "DOCKER_BUILD_FAIL": return stepId === "docker-build" ? { failOnAttempt: 3, error: "npm ERR! peer dependency mismatch while building image layer 7/12", code: "BUILD_FAILED" } : {};
    default: return {};
  }
}

function log(task: Task, level: TaskLogEntry["level"], message: string, executionMode: ExecutionMode, now: string) {
  task.log.push({ at: now, level, message, executionMode });
}

function setStatus(task: Task, status: Task["status"]) {
  if (task.status === status) return;
  if (!canTransition(task.status, status)) throw new Error(`Task ${task.key}: invalid transition ${task.status} → ${status}`);
  task.status = status;
}

/**
 * Runs a task deterministically. Applies the self-healing hierarchy on failure:
 *  1. Known deterministic recovery → 2. Retry → 3. Alternative → 4. Rollback → 5. AI diagnosis → 6. AI plan → 7. Human approval → 8. Escalation
 * Steps that don't apply (e.g. migration when no migration is included) are skipped.
 */
export async function runTask(input: Task, def: TaskDefinition, hooks: TaskEngineHooks): Promise<Task> {
  const task: Task = { ...input, steps: [...input.steps], log: [...input.log] };
  const wait = (s: number) => hooks.sleep(Math.round(s * 1000 * hooks.speed));
  const emit = async (e: TaskEngineEvent) => { await hooks.onEvent(e, task); };
  const persist = async () => { await hooks.onUpdate({ ...task }); };

  const includesMigration = Boolean(task.inputs.includesMigration);
  const skipStep = (stepId: string) => (!includesMigration && (stepId === "migrate" || stepId === "restore-db")) || (stepId === "install-sdk" && task.scenario !== "SDK_MISMATCH" && !task.steps.some((s) => s.recoveryAction));

  task.startedAt = task.startedAt ?? hooks.now();
  if (task.status === "WAITING_APPROVAL") { setStatus(task, "EXECUTING"); log(task, "INFO", "Approval granted — execution unlocked", "SYSTEM", hooks.now()); }
  else if (task.status === "QUEUED") {
    setStatus(task, "PLANNING"); log(task, "INFO", `Planning ${def.name} v${def.version}`, "TASK_ENGINE", hooks.now()); await persist(); await wait(0.4);
    setStatus(task, "DISCOVERING"); log(task, "INFO", `Discovery: ${def.discovery.join(", ")}`, "TASK_ENGINE", hooks.now()); await persist(); await wait(0.6);
    setStatus(task, "POLICY_CHECK"); log(task, "INFO", `Policy evaluated: ${task.policyDecision?.result ?? "AUTO"} (risk ${task.risk})`, "SYSTEM", hooks.now()); await persist(); await wait(0.3);
    if (task.policyDecision?.result === "WAITING_APPROVAL") { setStatus(task, "WAITING_APPROVAL"); log(task, "INFO", `Waiting for ${task.policyDecision.requiredApprovals} approval(s): ${task.policyDecision.approvers.map((a) => a.label).join(", ")}`, "SYSTEM", hooks.now()); await persist(); await emit({ type: "STATUS", status: "WAITING_APPROVAL" }); return task; }
    setStatus(task, "EXECUTING");
  } else if (task.status === "RETRY" || task.status === "ESCALATED") {
    setStatus(task, "EXECUTING");
  }
  await persist(); await emit({ type: "STATUS", status: "EXECUTING" });

  const attempts: Record<string, number> = {};
  const usedStrategies: Record<string, number> = {};

  for (let i = 0; i < def.steps.length; i++) {
    const sd = def.steps[i];
    if (skipStep(sd.id)) { task.steps.push({ id: newId("stp"), stepId: sd.id, name: sd.name, sequence: i + 1, status: "SKIPPED", executionMode: "TASK_ENGINE" }); continue; }
    // eslint-disable-next-line no-constant-condition
    while (true) {
      attempts[sd.id] = (attempts[sd.id] ?? 0) + 1;
      const exec: TaskStepExecution = { id: newId("stp"), stepId: sd.id, name: sd.name, sequence: i + 1, status: "RUNNING", startedAt: hooks.now(), executionMode: sd.capability ? "AGENT" : "TASK_ENGINE" };
      task.steps.push(exec);
      if (sd.kind === "VALIDATE" && task.status === "EXECUTING") setStatus(task, "VERIFYING");
      await persist();
      await wait(sd.estimatedSeconds);
      const plan = scenarioPlan(task.scenario, sd.id);
      const shouldFail = plan.failOnAttempt !== undefined && attempts[sd.id] <= plan.failOnAttempt;
      const finished = hooks.now();
      if (!shouldFail) {
        exec.status = attempts[sd.id] > 1 ? "RECOVERED" : "COMPLETED"; exec.finishedAt = finished; exec.durationMs = Math.round(sd.estimatedSeconds * 1000);
        exec.output = sd.id === "health-check" ? "GET /health → 200 OK (42ms)" : sd.id === "check-sdk" ? ".NET SDK 10.0.100 detected" : sd.id === "docker-build" ? "Image built: sha256:9f2c…a1 (184 MB)" : undefined;
        log(task, "INFO", `✓ ${sd.name}`, exec.executionMode, finished);
        if (sd.id === "health-check") await emit({ type: "HEALTH", status: "PASS", detail: exec.output ?? "" });
        await emit({ type: "STEP", step: exec }); await persist();
        break;
      }
      // ---- failure path ----
      exec.status = "FAILED"; exec.finishedAt = finished; exec.durationMs = Math.round(sd.estimatedSeconds * 1000); exec.error = plan.error;
      task.attemptCount += 1;
      log(task, "ERROR", `✕ ${sd.name}: ${plan.error}`, exec.executionMode, finished);
      if (sd.id === "health-check") await emit({ type: "HEALTH", status: "FAIL", detail: plan.error ?? "" });
      await emit({ type: "STEP", step: exec });
      if (task.status === "EXECUTING" || task.status === "VERIFYING") setStatus(task, "FAILED");
      await persist(); await emit({ type: "STATUS", status: "FAILED" }); await wait(0.5);
      setStatus(task, "DIAGNOSING"); log(task, "INFO", `Diagnosing ${plan.code}`, "TASK_ENGINE", hooks.now()); await persist(); await emit({ type: "STATUS", status: "DIAGNOSING" }); await wait(0.6);

      // Self-healing hierarchy
      const candidates = def.recoveryStrategies.filter((r) => (r.trigger === plan.code || r.trigger === "*") && (usedStrategies[r.id] ?? 0) < r.maxAttempts);
      const order = ["KNOWN_RECOVERY", "RETRY", "ALTERNATIVE", "ROLLBACK", "AI_DIAGNOSIS"];
      candidates.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
      let strategy = candidates.find((c) => c.kind !== "ROLLBACK" && c.kind !== "AI_DIAGNOSIS");
      let aiDiagnosed = false;

      if (!strategy && plan.code === "BUILD_FAILED" && !task.log.some((l) => l.executionMode === "AI")) {
        // Nothing deterministic left: escalate to AI diagnosis (level 5–6) before rollback
        setStatus(task, "RECOVERY"); task.recoveryCount += 1;
        const summary = "Dependency mismatch detected in lockfile. Recovery plan: clear build cache, pin peer dependency, rebuild.";
        log(task, "WARN", `AI diagnosis: ${summary}`, "AI", hooks.now());
        await emit({ type: "AI_DIAGNOSIS", summary }); await emit({ type: "RECOVERY", strategy: "AI-generated recovery plan", kind: "AI_DIAGNOSIS", attempt: task.recoveryCount });
        aiDiagnosed = true; await persist(); await wait(1);
        setStatus(task, "RETRY"); log(task, "INFO", "Retrying with AI recovery plan", "TASK_ENGINE", hooks.now()); await persist(); await emit({ type: "STATUS", status: "RETRY" }); await wait(0.3);
        setStatus(task, "EXECUTING");
        continue;
      }
      if (strategy) {
        usedStrategies[strategy.id] = (usedStrategies[strategy.id] ?? 0) + 1;
        setStatus(task, "RECOVERY"); task.recoveryCount += 1;
        exec.recoveryAction = strategy.name;
        log(task, "WARN", `Recovery (${strategy.kind.toLowerCase().replace("_", " ")}): ${strategy.name}`, "TASK_ENGINE", hooks.now());
        await emit({ type: "RECOVERY", strategy: strategy.name, kind: strategy.kind, attempt: task.recoveryCount, knowledgeRecordId: strategy.knowledgeRecordId });
        await persist(); await wait(1.2);
        setStatus(task, "RETRY"); log(task, "INFO", `Retrying ${sd.name} (attempt ${attempts[sd.id] + 1})`, "TASK_ENGINE", hooks.now()); await persist(); await emit({ type: "STATUS", status: "RETRY" }); await wait(0.3);
        setStatus(task, sd.kind === "VALIDATE" ? "VERIFYING" : "EXECUTING");
        continue;
      }
      const rollback = candidates.find((c) => c.kind === "ROLLBACK");
      if (rollback && !aiDiagnosed) {
        usedStrategies[rollback.id] = 1;
        setStatus(task, "RECOVERY"); task.recoveryCount += 1;
        log(task, "WARN", `Still failing after ${task.recoveryCount - 1} recovery action(s). Rolling back: ${def.rollback.join(" → ")}`, "TASK_ENGINE", hooks.now());
        await emit({ type: "ROLLBACK", reason: plan.error ?? "Validation failed" }); await persist(); await wait(1.5);
        for (const rb of def.rollback) { task.steps.push({ id: newId("stp"), stepId: "rollback", name: `Rollback: ${rb}`, sequence: task.steps.length + 1, status: "COMPLETED", executionMode: "AGENT", startedAt: hooks.now(), finishedAt: hooks.now(), durationMs: 800 }); await persist(); await wait(0.5); }
        task.rolledBack = true;
        setStatus(task, "ROLLED_BACK"); log(task, "INFO", "Rollback complete. Previous version restored and healthy.", "TASK_ENGINE", hooks.now()); await persist();
        setStatus(task, "ESCALATED"); task.error = plan.error; task.finishedAt = hooks.now(); task.summary = `Rolled back after failed ${sd.name.toLowerCase()}: ${plan.error}`;
        log(task, "ERROR", "Escalated to owner. Incident created.", "SYSTEM", hooks.now());
        await persist(); await emit({ type: "ESCALATED", reason: task.summary });
        return task;
      }
      setStatus(task, "ESCALATED"); task.error = plan.error; task.finishedAt = hooks.now(); task.summary = `Escalated: ${plan.error}`;
      log(task, "ERROR", "No recovery strategy left. Escalated.", "SYSTEM", hooks.now()); await persist(); await emit({ type: "ESCALATED", reason: task.summary });
      return task;
    }
  }
  if (task.status === "EXECUTING") setStatus(task, "VERIFYING");
  setStatus(task, "COMPLETED"); task.finishedAt = hooks.now();
  const recovered = task.steps.filter((s) => s.status === "RECOVERED").length;
  task.summary = `${def.name} completed: ${task.steps.filter((s) => s.status !== "SKIPPED").length} deterministic steps${task.recoveryCount ? `, ${task.recoveryCount} recovery action(s)` : ""}${recovered ? `, ${recovered} step(s) self-healed` : ""}.`;
  log(task, "INFO", task.summary, "TASK_ENGINE", hooks.now());
  await persist(); await emit({ type: "COMPLETED", summary: task.summary });
  return task;
}

export function aiRequestsAvoided(def: TaskDefinition, task: Task): number {
  const extraAi = task.log.filter((l) => l.executionMode === "AI").length;
  return Math.max(0, def.aiDecisionsWithoutEngine - (def.aiDecisionsWithEngine + extraAi));
}
