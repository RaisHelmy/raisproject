import type { AIRun, AIRequestPurpose, AIProviderKind, MCPCall, RequestContext, OptimizationRecommendation, AITraceEntry, Task } from "../types";
import { ServiceBase } from "./context";
import { newId, hash } from "../ids";
import { aiEfficiencyScore, detectRedundantCalls, detectToolOveruse, generateRecommendations, toolUsage, detectProblemPatterns } from "../engines/optimization";
import { redact, redactObject } from "../engines/privacy";
import { TASK_CATALOG } from "../engines/taskCatalog";

export interface TelemetrySummary {
  aiRequests: number; mcpCalls: number; aiCallsAvoided: number; avgCallsPerChange: number; avgCallsPerTask: number; aiCostMyr: number; costIsEstimate: true; estimatedSavingsMyr: number;
  toolOveruse: number; redundantCalls: number; contextOverload: number; failureRate: number; recoveryRate: number; humanInterventions: number; efficiency: { score: number; factors: { name: string; value: string; impact: number }[] };
  byDay: { date: string; aiRequests: number; mcpCalls: number; avoided: number }[];
  byPurpose: { purpose: string; runs: number; cost: number }[];
  byProvider: { provider: string; runs: number; cost: number }[];
  maturityLevel: number;
}

let runSeq = 10490;

export class TelemetryService extends ServiceBase {
  private lastCallByRun = new Map<string, string>();

  /** Start an AI run. Only metadata is stored — never model chain-of-thought. */
  async startRun(ctx: RequestContext, input: { purpose: AIRequestPurpose; client: string; provider: AIProviderKind; model: string; changeId?: string; contextItemCount?: number; contextType?: string; relevantItemCount?: number; summary: string }): Promise<AIRun> {
    const at = ctx.now();
    const run: AIRun = {
      id: newId("air"), key: `AIR-${runSeq++}`, organizationId: ctx.actor.organizationId, userId: ctx.actor.userId, provider: input.provider, model: input.model, purpose: input.purpose, client: input.client, startTime: at, durationMs: 0, status: "RUNNING",
      inputTokens: 0, outputTokens: 0, estimatedCost: 0, costIsEstimate: true, mcpCallCount: 0, taskCount: 0, agentOperationCount: 0, successCount: 0, failureCount: 0, retryCount: 0, approvalCount: 0, humanInterventionCount: 0, recoveryCount: 0, rollbackCount: 0,
      aiDecisions: 1, deterministicOperations: 0, aiRequestsAvoided: 0, context: { contextType: input.contextType ?? "change", contextItemCount: input.contextItemCount ?? 0, contextSizeEstimate: (input.contextItemCount ?? 0) * 380, sourceCount: 1, relevantItemCount: input.relevantItemCount }, changeId: input.changeId, finalStatus: "RUNNING",
      trace: [{ at, kind: "REQUEST", message: redact(input.summary).text }, { at, kind: "DECISION", message: `AI interpreted request as ${input.purpose.toLowerCase().replace(/_/g, " ")}`, reasonCategory: input.purpose }],
    };
    await this.store.aiRuns.put(run);
    return run;
  }

  async trace(ctx: RequestContext, runId: string, entry: Omit<AITraceEntry, "at">): Promise<void> {
    const run = await this.store.aiRuns.get(runId);
    if (!run || run.organizationId !== ctx.actor.organizationId) return;
    run.trace.push({ at: ctx.now(), ...entry, message: redact(entry.message).text });
    if (entry.kind === "DECISION") run.aiDecisions += 1;
    if (entry.kind === "APPROVAL") run.approvalCount += 1;
    await this.store.aiRuns.put(run);
  }

  async recordCall(ctx: RequestContext, runId: string, input: { toolName: string; toolVersion?: string; durationMs: number; status: "SUCCESS" | "FAILED"; errorCode?: string; inputs?: unknown; changeId?: string; taskId?: string; agentId?: string }): Promise<MCPCall> {
    const run = await this.store.aiRuns.get(runId);
    const start = new Date(Date.now() - input.durationMs).toISOString();
    const inputHash = hash(input.toolName + JSON.stringify(redactObject(input.inputs ?? {})));
    const previous = await this.store.mcpCalls.list((c) => c.aiRunId === runId);
    const redundant = previous.some((c) => c.inputHash === inputHash && c.status === "SUCCESS");
    const call: MCPCall = { id: newId("mcp"), aiRunId: runId, organizationId: ctx.actor.organizationId, userId: ctx.actor.userId, toolName: input.toolName, toolVersion: input.toolVersion ?? "1.0.0", startTime: start, endTime: ctx.now(), durationMs: input.durationMs, status: input.status, errorCode: input.errorCode, taskId: input.taskId, changeId: input.changeId ?? run?.changeId, agentId: input.agentId, parentCallId: this.lastCallByRun.get(runId), sequenceNumber: previous.length + 1, cache: { hit: redundant, ageMs: redundant ? 500 : undefined, refreshReason: redundant ? undefined : "state-changed" }, redundant, inputHash };
    await this.store.mcpCalls.put(call);
    this.lastCallByRun.set(runId, call.id);
    if (run) { run.mcpCallCount += 1; if (input.status === "SUCCESS") run.successCount += 1; else run.failureCount += 1; run.trace.push({ at: call.endTime, kind: "TOOL", message: input.toolName, toolName: input.toolName, executionResult: input.status }); await this.store.aiRuns.put(run); }
    return call;
  }

  async finishRun(ctx: RequestContext, runId: string, input: { status: "COMPLETED" | "FAILED"; finalStatus: string; taskCount?: number; deterministicOperations?: number; aiRequestsAvoided?: number; recoveryCount?: number; rollbackCount?: number; inputTokens?: number; outputTokens?: number }): Promise<AIRun | undefined> {
    const run = await this.store.aiRuns.get(runId);
    if (!run || run.organizationId !== ctx.actor.organizationId) return undefined;
    const end = ctx.now();
    run.endTime = end; run.durationMs = new Date(end).getTime() - new Date(run.startTime).getTime(); run.status = input.status; run.finalStatus = input.finalStatus;
    run.taskCount += input.taskCount ?? 0; run.deterministicOperations += input.deterministicOperations ?? 0; run.agentOperationCount += input.deterministicOperations ?? 0; run.aiRequestsAvoided += input.aiRequestsAvoided ?? 0; run.recoveryCount += input.recoveryCount ?? 0; run.rollbackCount += input.rollbackCount ?? 0;
    run.inputTokens += input.inputTokens ?? 1200 + run.mcpCallCount * 400; run.outputTokens += input.outputTokens ?? 300 + run.aiDecisions * 120;
    run.estimatedCost = +((run.inputTokens * 0.000012 + run.outputTokens * 0.00006) * 4.7).toFixed(3); // MYR estimate
    run.trace.push({ at: end, kind: "RESULT", message: input.finalStatus, executionResult: input.status });
    await this.store.aiRuns.put(run);
    return run;
  }

  async summary(ctx: RequestContext, days = 30): Promise<TelemetrySummary> {
    this.require(ctx, "analytics.read");
    const since = Date.now() - days * 86400_000;
    const runs = (await this.store.aiRuns.list({ organizationId: ctx.actor.organizationId })).filter((r) => new Date(r.startTime).getTime() >= since);
    const runIds = new Set(runs.map((r) => r.id));
    const calls = (await this.store.mcpCalls.list({ organizationId: ctx.actor.organizationId })).filter((c) => runIds.has(c.aiRunId));
    const tasks = await this.store.tasks.list({ organizationId: ctx.actor.organizationId });
    const changes = await this.store.changes.list({ organizationId: ctx.actor.organizationId });
    const interventions = await this.store.humanInterventions.list({ organizationId: ctx.actor.organizationId });
    const avoided = runs.reduce((a, r) => a + r.aiRequestsAvoided, 0);
    const cost = runs.reduce((a, r) => a + r.estimatedCost, 0);
    const failures = runs.filter((r) => r.status === "FAILED").length;
    const recoveries = runs.reduce((a, r) => a + r.recoveryCount, 0);
    const byDayMap = new Map<string, { aiRequests: number; mcpCalls: number; avoided: number }>();
    for (let i = days - 1; i >= 0; i--) byDayMap.set(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10), { aiRequests: 0, mcpCalls: 0, avoided: 0 });
    for (const r of runs) { const d = byDayMap.get(r.startTime.slice(0, 10)); if (d) { d.aiRequests += 1; d.mcpCalls += r.mcpCallCount; d.avoided += r.aiRequestsAvoided; } }
    const group = <K extends string>(key: (r: AIRun) => K) => { const m = new Map<K, { runs: number; cost: number }>(); for (const r of runs) { const g = m.get(key(r)) ?? { runs: 0, cost: 0 }; g.runs += 1; g.cost += r.estimatedCost; m.set(key(r), g); } return [...m.entries()].map(([k, v]) => ({ key: k, ...v, cost: +v.cost.toFixed(2) })).sort((a, b) => b.runs - a.runs); };
    const det = runs.reduce((a, r) => a + r.deterministicOperations, 0);
    const detRatio = det / Math.max(1, det + runs.reduce((a, r) => a + r.aiDecisions, 0));
    const knowledge = await this.store.knowledge.count();
    const maturityLevel = detRatio > 0.8 && knowledge > 3 ? 4 : detRatio > 0.5 ? 3 : det > 0 ? 2 : 1;
    return {
      aiRequests: runs.length, mcpCalls: calls.length, aiCallsAvoided: avoided, avgCallsPerChange: +(calls.length / Math.max(1, changes.length)).toFixed(1), avgCallsPerTask: +(calls.length / Math.max(1, tasks.length)).toFixed(1),
      aiCostMyr: +cost.toFixed(2), costIsEstimate: true, estimatedSavingsMyr: +(avoided * 0.12).toFixed(2),
      toolOveruse: detectToolOveruse(calls).length, redundantCalls: calls.filter((c) => c.redundant).length, contextOverload: runs.filter((r) => r.context.contextItemCount > 500 && (r.context.relevantItemCount ?? 0) / r.context.contextItemCount < 0.05).length,
      failureRate: +((failures / Math.max(1, runs.length)) * 100).toFixed(1), recoveryRate: +((recoveries / Math.max(1, failures + recoveries)) * 100).toFixed(1), humanInterventions: interventions.length,
      efficiency: aiEfficiencyScore(runs, calls, tasks), byDay: [...byDayMap.entries()].map(([date, v]) => ({ date, ...v })),
      byPurpose: group((r) => r.purpose).map((g) => ({ purpose: g.key, runs: g.runs, cost: g.cost })), byProvider: group((r) => r.provider).map((g) => ({ provider: g.key, runs: g.runs, cost: g.cost })), maturityLevel,
    };
  }

  async runs(ctx: RequestContext, filter: { purpose?: string; provider?: string; status?: string; changeId?: string; userId?: string; client?: string; search?: string; limit?: number } = {}): Promise<AIRun[]> {
    this.require(ctx, "analytics.read");
    let list = await this.store.aiRuns.list({ organizationId: ctx.actor.organizationId });
    if (filter.purpose) list = list.filter((r) => r.purpose === filter.purpose);
    if (filter.provider) list = list.filter((r) => r.provider === filter.provider);
    if (filter.status) list = list.filter((r) => r.status === filter.status);
    if (filter.changeId) list = list.filter((r) => r.changeId === filter.changeId);
    if (filter.userId) list = list.filter((r) => r.userId === filter.userId);
    if (filter.client) list = list.filter((r) => r.client === filter.client);
    if (filter.search) { const s = filter.search.toLowerCase(); list = list.filter((r) => r.key.toLowerCase().includes(s) || r.model.includes(s) || r.trace.some((t) => t.message.toLowerCase().includes(s))); }
    return list.sort((a, b) => b.startTime.localeCompare(a.startTime)).slice(0, filter.limit ?? 200);
  }

  async run(ctx: RequestContext, id: string): Promise<{ run: AIRun; calls: MCPCall[]; tasks: Task[] }> {
    this.require(ctx, "analytics.read");
    const run = this.assertTenant(ctx, await this.store.aiRuns.get(id), "AI run");
    const calls = (await this.store.mcpCalls.list({ aiRunId: id })).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const tasks = await this.store.tasks.list((t) => t.aiRunId === id);
    return { run, calls, tasks };
  }

  async calls(ctx: RequestContext, filter: { toolName?: string; status?: string; changeId?: string; taskId?: string; agentId?: string; userId?: string; minDurationMs?: number; from?: string; to?: string; search?: string; redundant?: boolean; limit?: number } = {}): Promise<MCPCall[]> {
    this.require(ctx, "analytics.read");
    let list = await this.store.mcpCalls.list({ organizationId: ctx.actor.organizationId });
    if (filter.toolName) list = list.filter((c) => c.toolName === filter.toolName);
    if (filter.status) list = list.filter((c) => c.status === filter.status);
    if (filter.changeId) list = list.filter((c) => c.changeId === filter.changeId);
    if (filter.taskId) list = list.filter((c) => c.taskId === filter.taskId);
    if (filter.agentId) list = list.filter((c) => c.agentId === filter.agentId);
    if (filter.userId) list = list.filter((c) => c.userId === filter.userId);
    if (filter.minDurationMs) list = list.filter((c) => c.durationMs >= filter.minDurationMs!);
    if (filter.from) list = list.filter((c) => c.startTime >= filter.from!);
    if (filter.to) list = list.filter((c) => c.startTime <= filter.to!);
    if (filter.redundant !== undefined) list = list.filter((c) => c.redundant === filter.redundant);
    if (filter.search) { const s = filter.search.toLowerCase(); list = list.filter((c) => c.toolName.toLowerCase().includes(s) || c.aiRunId.toLowerCase().includes(s) || (c.errorCode ?? "").toLowerCase().includes(s)); }
    return list.sort((a, b) => b.startTime.localeCompare(a.startTime)).slice(0, filter.limit ?? 500);
  }

  async toolAnalytics(ctx: RequestContext) {
    this.require(ctx, "analytics.read");
    const calls = await this.store.mcpCalls.list({ organizationId: ctx.actor.organizationId });
    const runs = await this.store.aiRuns.list({ organizationId: ctx.actor.organizationId });
    const tasks = await this.store.tasks.list({ organizationId: ctx.actor.organizationId });
    return { usage: toolUsage(calls, runs, tasks), overuse: detectToolOveruse(calls), redundant: detectRedundantCalls(calls) };
  }

  async recommendations(ctx: RequestContext): Promise<OptimizationRecommendation[]> {
    this.require(ctx, "analytics.read");
    return (await this.store.recommendations.list({ organizationId: ctx.actor.organizationId })).sort((a, b) => b.estimatedReductionPct - a.estimatedReductionPct);
  }

  async updateRecommendation(ctx: RequestContext, id: string, status: OptimizationRecommendation["status"]): Promise<OptimizationRecommendation> {
    this.require(ctx, "analytics.read");
    if (status === "APPROVED" || status === "IMPLEMENTED") this.require(ctx, "automation.create");
    const rec = this.assertTenant(ctx, await this.store.recommendations.get(id), "Recommendation");
    const updated = { ...rec, status, updatedAt: ctx.now() };
    await this.store.recommendations.put(updated);
    await this.audit(ctx, "optimization.recommendation." + status.toLowerCase(), "recommendation", rec.id, rec.title, { risk: status === "IMPLEMENTED" ? "MEDIUM" : "LOW" });
    return updated;
  }

  /** Re-run the deterministic analysis and add any new recommendations. */
  async analyze(ctx: RequestContext): Promise<{ added: number; patterns: number }> {
    this.require(ctx, "analytics.read");
    const org = ctx.actor.organizationId;
    const calls = await this.store.mcpCalls.list({ organizationId: org });
    const runs = await this.store.aiRuns.list({ organizationId: org });
    const tasks = await this.store.tasks.list({ organizationId: org });
    const existing = await this.store.recommendations.list({ organizationId: org });
    const fresh = generateRecommendations(calls, runs, tasks, org, ctx.now()).filter((r) => !existing.some((e) => e.title === r.title));
    await this.store.recommendations.putMany(fresh);
    const patterns = detectProblemPatterns(tasks, org, ctx.now());
    const existingPatterns = await this.store.problemPatterns.list({ organizationId: org });
    await this.store.problemPatterns.putMany(patterns.filter((p) => !existingPatterns.some((e) => e.signature === p.signature)));
    await this.audit(ctx, "optimization.analyze", "organization", org, undefined, { detail: `${fresh.length} new recommendations` });
    return { added: fresh.length, patterns: patterns.length };
  }

  async learning(ctx: RequestContext) {
    this.require(ctx, "analytics.read");
    const org = ctx.actor.organizationId;
    const [patterns, knowledge, failures, recoveries, interventions, experiments, issues] = await Promise.all([
      this.store.problemPatterns.list({ organizationId: org }), this.store.knowledge.list((k) => k.organizationId === null || k.organizationId === org), this.store.aiFailures.list({ organizationId: org }),
      this.store.aiRecoveries.list({ organizationId: org }), this.store.humanInterventions.list({ organizationId: org }), this.store.experiments.list({ organizationId: org }), this.store.issues.list({ organizationId: org }),
    ]);
    return { patterns, knowledge, failures: failures.sort((a, b) => b.at.localeCompare(a.at)), recoveries, interventions: interventions.sort((a, b) => b.at.localeCompare(a.at)), experiments, issues };
  }

  /** Section 101 — learning data export. Secrets are redacted; nothing sensitive leaves. */
  async exportLearningData(ctx: RequestContext): Promise<Record<string, unknown[]>> {
    this.require(ctx, "data.export");
    const org = ctx.actor.organizationId;
    const data = {
      aiRuns: await this.store.aiRuns.list({ organizationId: org }), mcpCalls: await this.store.mcpCalls.list({ organizationId: org }),
      taskExecutions: (await this.store.tasks.list({ organizationId: org })).map((t) => ({ ...t, inputs: redactObject(t.inputs) })), taskSteps: (await this.store.tasks.list({ organizationId: org })).flatMap((t) => t.steps.map((s) => ({ taskId: t.id, ...s }))),
      failures: await this.store.aiFailures.list({ organizationId: org }), recoveries: await this.store.aiRecoveries.list({ organizationId: org }), issues: await this.store.issues.list({ organizationId: org }),
      problemPatterns: await this.store.problemPatterns.list({ organizationId: org }), recommendations: await this.store.recommendations.list({ organizationId: org }),
      toolMetrics: toolUsage(await this.store.mcpCalls.list({ organizationId: org }), await this.store.aiRuns.list({ organizationId: org }), await this.store.tasks.list({ organizationId: org })),
      agentMetrics: (await this.store.agents.list({ organizationId: org })).map((a) => ({ id: a.id, name: a.name, status: a.status, health: a.health, version: a.version })),
      changeMetrics: (await this.store.changes.list({ organizationId: org })).map((c) => ({ id: c.id, key: c.key, title: c.title, status: c.status, risk: c.risk, ...c.analytics })),
      taskDefinitions: TASK_CATALOG.map((d) => ({ id: d.id, version: d.version, aiDecisionsWithoutEngine: d.aiDecisionsWithoutEngine, aiDecisionsWithEngine: d.aiDecisionsWithEngine })),
    };
    await this.audit(ctx, "data.export", "export", "learning-data", "Learning data (JSON)", { risk: "MEDIUM" });
    return redactObject(data);
  }
}
