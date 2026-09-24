import type { AIRun, MCPCall, MCPToolUsage, OptimizationRecommendation, ProblemPattern, Task, KnowledgeRecord } from "../types";
import { newId } from "../ids";

export function toolUsage(calls: MCPCall[], runs: AIRun[], tasks: Task[]): MCPToolUsage[] {
  const byTool = new Map<string, MCPCall[]>();
  for (const c of calls) byTool.set(c.toolName, [...(byTool.get(c.toolName) ?? []), c]);
  const runCount = Math.max(1, runs.length);
  const changeCount = Math.max(1, new Set(calls.map((c) => c.changeId).filter(Boolean)).size);
  const taskCount = Math.max(1, tasks.length);
  return [...byTool.entries()].map(([toolName, list]) => {
    const durations = list.map((c) => c.durationMs).sort((a, b) => a - b);
    const p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] ?? 0;
    return {
      toolName, totalCalls: list.length,
      successfulCalls: list.filter((c) => c.status === "SUCCESS").length,
      failedCalls: list.filter((c) => c.status === "FAILED").length,
      avgDurationMs: Math.round(durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length)),
      p95DurationMs: p95,
      retries: list.filter((c) => c.errorCode === "RETRY").length,
      avgCallsPerRun: +(list.length / runCount).toFixed(2),
      avgCallsPerChange: +(list.length / changeCount).toFixed(2),
      avgCallsPerTask: +(list.length / taskCount).toFixed(2),
      redundantCalls: list.filter((c) => c.redundant).length,
    };
  }).sort((a, b) => b.totalCalls - a.totalCalls);
}

/** Section 72 — detect tools called many times inside a single run (inspect ×14 …). */
export function detectToolOveruse(calls: MCPCall[]): { toolName: string; maxPerRun: number; runs: number; suggestion: string; estimatedReductionPct: number }[] {
  const perRun = new Map<string, Map<string, number>>();
  for (const c of calls) {
    const m = perRun.get(c.aiRunId) ?? new Map();
    m.set(c.toolName, (m.get(c.toolName) ?? 0) + 1);
    perRun.set(c.aiRunId, m);
  }
  const agg = new Map<string, { max: number; runs: number }>();
  for (const m of perRun.values()) for (const [tool, n] of m) { if (n >= 4) { const a = agg.get(tool) ?? { max: 0, runs: 0 }; a.max = Math.max(a.max, n); a.runs += 1; agg.set(tool, a); } }
  return [...agg.entries()].map(([toolName, a]) => ({
    toolName, maxPerRun: a.max, runs: a.runs,
    suggestion: toolName.includes("inspect") ? "super.environment.snapshot" : toolName.includes("status") ? "super.change.get (snapshot)" : "batch / cache",
    estimatedReductionPct: Math.min(90, Math.round((1 - 1 / a.max) * 100)),
  })).sort((a, b) => b.maxPerRun - a.maxPerRun);
}

/** Section 73 — identical calls where no state changed. */
export function detectRedundantCalls(calls: MCPCall[]): { toolName: string; redundant: number; total: number; pct: number }[] {
  const out = new Map<string, { redundant: number; total: number }>();
  for (const c of calls) { const o = out.get(c.toolName) ?? { redundant: 0, total: 0 }; o.total += 1; if (c.redundant) o.redundant += 1; out.set(c.toolName, o); }
  return [...out.entries()].filter(([, v]) => v.redundant > 0).map(([toolName, v]) => ({ toolName, ...v, pct: Math.round((v.redundant / v.total) * 100) })).sort((a, b) => b.redundant - a.redundant);
}

/** Section 78 — heuristic AI efficiency score (not a scientific benchmark). */
export function aiEfficiencyScore(runs: AIRun[], calls: MCPCall[], tasks: Task[]): { score: number; factors: { name: string; value: string; impact: number }[] } {
  const totalCalls = Math.max(1, calls.length);
  const redundantRatio = calls.filter((c) => c.redundant).length / totalCalls;
  const retries = runs.reduce((a, r) => a + r.retryCount, 0);
  const deterministic = runs.reduce((a, r) => a + r.deterministicOperations, 0);
  const aiDecisions = Math.max(1, runs.reduce((a, r) => a + r.aiDecisions, 0));
  const detRatio = deterministic / (deterministic + aiDecisions);
  const ctxEff = runs.length ? runs.reduce((a, r) => a + ((r.context.relevantItemCount ?? r.context.contextItemCount) / Math.max(1, r.context.contextItemCount)), 0) / runs.length : 1;
  const overuse = detectToolOveruse(calls).length;
  const failed = runs.filter((r) => r.status === "FAILED").length / Math.max(1, runs.length);
  const avgDuration = runs.length ? runs.reduce((a, r) => a + r.durationMs, 0) / runs.length : 0;
  const factors = [
    { name: "Redundant calls", value: `${Math.round(redundantRatio * 100)}%`, impact: -Math.round(redundantRatio * 25) },
    { name: "Retries", value: String(retries), impact: -Math.min(10, retries) },
    { name: "Deterministic execution ratio", value: `${Math.round(detRatio * 100)}%`, impact: Math.round(detRatio * 30) },
    { name: "Context efficiency", value: `${Math.round(ctxEff * 100)}%`, impact: Math.round(ctxEff * 15) - 15 },
    { name: "Tool overuse patterns", value: String(overuse), impact: -Math.min(10, overuse * 3) },
    { name: "Failure rate", value: `${Math.round(failed * 100)}%`, impact: -Math.round(failed * 15) },
    { name: "Completion time", value: `${(avgDuration / 1000).toFixed(1)}s avg`, impact: avgDuration > 60_000 ? -5 : 0 },
  ];
  const score = Math.max(0, Math.min(100, 70 + factors.reduce((a, f) => a + f.impact, 0)));
  return { score, factors };
}

/** Section 86 — repeated failure signatures across tasks. */
export function detectProblemPatterns(tasks: Task[], organizationId: string, now: string): ProblemPattern[] {
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    const failed = t.steps.filter((s) => s.status === "FAILED");
    for (const s of failed) { const sig = `${t.type}:${s.stepId}`; groups.set(sig, [...(groups.get(sig) ?? []), t]); }
  }
  return [...groups.entries()].filter(([, list]) => list.length >= 2).map(([signature, list]) => {
    const step = list[0].steps.find((s) => s.status === "FAILED")!;
    const repos = new Set(list.map((t) => t.applicationId ?? t.changeId ?? t.id));
    const cause = step.stepId === "docker-build" ? "Dependency mismatch" : step.stepId === "health-check" ? "Slow container warm-up" : step.stepId === "check-sdk" ? "SDK version drift" : "Unknown";
    return {
      id: newId("pp"), organizationId, title: `${step.name} failed ×${list.length}`, signature, occurrences: list.length, affectedRepositories: repos.size,
      likelyCause: cause, recommendation: `Create deterministic ${step.name.toLowerCase()} recovery task`, rootCause: step.stepId === "docker-build" ? "Docker" : step.stepId === "health-check" ? "Application" : "Configuration",
      firstSeenAt: list[list.length - 1].createdAt, lastSeenAt: now,
    };
  });
}

/** Section 88/99 — generate recommendations from telemetry. Deterministic; AI is not required for this. */
export function generateRecommendations(calls: MCPCall[], runs: AIRun[], tasks: Task[], organizationId: string, now: string): OptimizationRecommendation[] {
  const recs: OptimizationRecommendation[] = [];
  const base = { organizationId, status: "NEW" as const, createdAt: now, updatedAt: now };
  for (const o of detectToolOveruse(calls)) {
    recs.push({ ...base, id: newId("rec"), type: "CONSOLIDATE_MCP_TOOL", title: `Consolidate ${o.toolName} into ${o.suggestion}`, description: `${o.toolName} is called up to ${o.maxPerRun}× per AI run across ${o.runs} runs. A single snapshot resource would return everything at once.`, evidence: `${calls.filter((c) => c.toolName === o.toolName).length.toLocaleString()} calls, max ${o.maxPerRun}/run`, estimatedReductionPct: o.estimatedReductionPct });
  }
  for (const r of detectRedundantCalls(calls)) {
    recs.push({ ...base, id: newId("rec"), type: "ADD_CACHE", title: `Cache ${r.toolName} results`, description: `${r.redundant} of ${r.total} calls returned identical data while nothing changed. Cache with invalidation on webhook/agent events.`, evidence: `${r.redundant.toLocaleString()} redundant calls (${r.pct}%)`, estimatedReductionPct: r.pct });
  }
  for (const p of detectProblemPatterns(tasks, organizationId, now)) {
    recs.push({ ...base, id: newId("rec"), type: p.signature.includes("docker") ? "CREATE_DETERMINISTIC_TASK" : "IMPROVE_FAILURE_RECOVERY", title: p.recommendation, description: `${p.title}. Likely cause: ${p.likelyCause}. Encoding this recovery as a task step removes the AI diagnosis from the loop.`, evidence: `${p.occurrences} occurrences across ${p.affectedRepositories} repositories`, estimatedReductionPct: 90 });
  }
  const bigContext = runs.filter((r) => r.context.contextItemCount > 500 && (r.context.relevantItemCount ?? 0) / r.context.contextItemCount < 0.05);
  if (bigContext.length) {
    const avgItems = Math.round(bigContext.reduce((a, r) => a + r.context.contextItemCount, 0) / bigContext.length);
    recs.push({ ...base, id: newId("rec"), type: "IMPROVE_REPOSITORY_INDEX", title: "Incremental repository indexing", description: `${bigContext.length} runs loaded ~${avgItems.toLocaleString()} repository files with fewer than 5% relevant. Incremental indexing on the Agent would send only the relevant slice.`, evidence: `${bigContext.length} runs with context overload`, estimatedReductionPct: 31 });
  }
  const slow = toolUsage(calls, runs, tasks).filter((t) => t.avgDurationMs > 2000);
  for (const s of slow) recs.push({ ...base, id: newId("rec"), type: "IMPROVE_AGENT_ROUTING", title: `Improve ${s.toolName} retrieval`, description: `Average latency ${(s.avgDurationMs / 1000).toFixed(1)}s (p95 ${(s.p95DurationMs / 1000).toFixed(1)}s). Route via Agent local cache or add incremental fetch.`, evidence: `avg ${(s.avgDurationMs / 1000).toFixed(1)}s`, estimatedReductionPct: 60 });
  return recs.sort((a, b) => b.estimatedReductionPct - a.estimatedReductionPct);
}

export function knowledgeFromPattern(p: ProblemPattern): KnowledgeRecord {
  return { id: newId("kr"), organizationId: p.organizationId, type: "KNOWN_FAILURE", title: p.title, condition: p.signature, resolution: p.recommendation, successRate: 0, applications: 0, createdAt: p.lastSeenAt };
}
