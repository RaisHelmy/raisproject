import { AppError, newId, type AuthContext, type Sen } from "@raisai/shared";
import type { WorkflowDocument, NodeInstance } from "./document";
import { dependenciesOf, downstreamClosure, incomingEdges, topologicalOrder } from "./graph";
import { getNodeDefinition, type EngineServices, type NodeDefinition } from "./registry";
import type { PortValue } from "./values";

export type NodeStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cached";

export interface NodeRunState {
  nodeId: string;
  nodeRunId: string;
  nodeType: string;
  status: NodeStatus;
  attempt: number;
  outputs?: Record<string, PortValue>;
  actualCostSen?: Sen;
  estimatedCostSen?: Sen;
  error?: { code: string; message: string; action?: string };
  cacheKey?: string;
  generationId?: string;
  providerRequestId?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export type RunStatus = "running" | "completed" | "failed" | "cancelled" | "paused";

export interface RunResult {
  status: RunStatus;
  nodes: NodeRunState[];
  outputs: Record<string, PortValue>;
  actualCostSen: Sen;
  /** Set when the run stopped because it would exceed its budget (§139). */
  pauseReason?: "budget";
  error?: { code: string; message: string; nodeId?: string };
}

export interface CacheStore {
  get(cacheKey: string): Promise<Record<string, PortValue> | null>;
  set(cacheKey: string, outputs: Record<string, PortValue>): Promise<void>;
}

export interface ExecutionHooks {
  onNodeStart?(state: NodeRunState): Promise<void> | void;
  onNodeFinish?(state: NodeRunState): Promise<void> | void;
}

export interface RunOptions {
  doc: WorkflowDocument;
  variables: Record<string, unknown>;
  auth: AuthContext;
  projectId: string;
  workflowRunId: string;
  services: EngineServices;
  cache?: CacheStore;
  hooks?: ExecutionHooks;
  /** Run only these nodes and everything downstream (§26). */
  fromNodeIds?: string[];
  /** Outputs of skipped upstream nodes, carried over from an earlier run. */
  seedOutputs?: Record<string, Record<string, PortValue>>;
  maxCostSen?: Sen;
  signal?: AbortSignal;
  /** Injectable so retry delays do not slow tests down. */
  sleep?: (ms: number) => Promise<void>;
  /**
   * Wraps each node's execution. The default runs it directly (inline mode).
   * The durable runner passes Cloudflare Workflows' `step.do`, which makes a
   * node a checkpoint that survives eviction and resumes where it stopped
   * (ADR-003). The engine itself stays free of any Cloudflare import.
   */
  runStep?: <T>(nodeId: string, fn: () => Promise<T>) => Promise<T>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Deterministic cache key over node identity, config and resolved inputs (§27). */
export async function computeCacheKey(node: NodeInstance, inputs: Record<string, PortValue | undefined>): Promise<string> {
  const material = JSON.stringify({ type: node.type, version: node.version, config: node.config, inputs });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Executes a workflow graph.
 *
 * Nodes run in dependency waves, several at a time, with per-node retries and
 * an optional result cache. The engine is pure TypeScript: Cloudflare Workflows
 * adapts it for durable execution (ADR-003), and tests drive it directly.
 */
export async function runWorkflow(options: RunOptions): Promise<RunResult> {
  const { doc } = options;
  const sleep = options.sleep ?? defaultSleep;
  const maxParallel = doc.settings.maxParallel ?? 3;

  const { order } = topologicalOrder(doc);
  if (order === null) {
    throw new AppError("workflow_invalid", "This workflow contains a loop and cannot run.", {
      action: "Remove a connection to break the loop.",
    });
  }

  const nodesById = new Map(doc.nodes.map((n) => [n.id, n]));
  const states = new Map<string, NodeRunState>();
  const outputsByNode = new Map<string, Record<string, PortValue>>();

  // Partial execution: everything outside the selected subgraph is skipped and
  // its previous outputs are reused rather than paid for again (§26).
  const selected = options.fromNodeIds?.length ? downstreamClosure(doc, options.fromNodeIds) : null;

  for (const node of doc.nodes) {
    const skipped = selected !== null && !selected.has(node.id);
    const seeded = options.seedOutputs?.[node.id];
    if (seeded) outputsByNode.set(node.id, seeded);
    states.set(node.id, {
      nodeId: node.id,
      nodeRunId: newId(),
      nodeType: node.type,
      status: skipped ? "skipped" : "pending",
      attempt: 0,
      ...(skipped && seeded ? { outputs: seeded } : {}),
    });
  }

  let totalCostSen = 0;
  let runStatus: RunStatus = "running";
  let runError: RunResult["error"];
  let pauseReason: RunResult["pauseReason"];

  const remaining = new Set(order.filter((id) => states.get(id)!.status === "pending"));

  while (remaining.size > 0 && runStatus === "running") {
    const ready = [...remaining].filter((id) =>
      dependenciesOf(doc, id).every((dep) => {
        const state = states.get(dep);
        return !state || state.status === "completed" || state.status === "cached" || state.status === "skipped";
      }),
    );
    if (ready.length === 0) break; // dependencies failed; nothing more can run

    const wave = ready.slice(0, maxParallel);
    const results = await Promise.all(
      wave.map((nodeId) => runNode(nodeId, { ...options, sleep }, nodesById, states, outputsByNode, totalCostSen)),
    );

    for (const result of results) {
      remaining.delete(result.state.nodeId);
      states.set(result.state.nodeId, result.state);
      if (result.state.outputs) outputsByNode.set(result.state.nodeId, result.state.outputs);
      totalCostSen += result.state.actualCostSen ?? 0;

      if (result.pauseForBudget) {
        runStatus = "paused";
        pauseReason = "budget";
      } else if (result.state.status === "failed") {
        runStatus = "failed";
        runError = {
          code: result.state.error?.code ?? "internal",
          message: result.state.error?.message ?? "A node failed.",
          nodeId: result.state.nodeId,
        };
      }
    }

    if (options.signal?.aborted) runStatus = "cancelled";
  }

  // Anything still pending after a failure is reported as skipped, not lost.
  for (const nodeId of remaining) {
    const state = states.get(nodeId)!;
    if (state.status === "pending") states.set(nodeId, { ...state, status: "skipped" });
  }

  if (runStatus === "running") runStatus = "completed";

  const outputs: Record<string, PortValue> = {};
  for (const node of doc.nodes) {
    if (node.type !== "output") continue;
    const state = states.get(node.id);
    if (state?.outputs?.value === undefined) continue;
    const name = typeof node.config.name === "string" && node.config.name ? node.config.name : node.id;
    outputs[name] = state.outputs.value;
  }

  return {
    status: runStatus,
    nodes: [...states.values()],
    outputs,
    actualCostSen: totalCostSen,
    ...(pauseReason ? { pauseReason } : {}),
    ...(runError ? { error: runError } : {}),
  };
}

interface NodeOutcome {
  state: NodeRunState;
  pauseForBudget?: boolean;
}

async function runNode(
  nodeId: string,
  options: RunOptions & { sleep: (ms: number) => Promise<void> },
  nodesById: Map<string, NodeInstance>,
  states: Map<string, NodeRunState>,
  outputsByNode: Map<string, Record<string, PortValue>>,
  costSoFarSen: Sen,
): Promise<NodeOutcome> {
  const node = nodesById.get(nodeId)!;
  const state = { ...states.get(nodeId)! };
  const definition = getNodeDefinition(node.type);

  if (!definition) {
    return {
      state: {
        ...state, status: "failed",
        error: { code: "workflow_invalid", message: `Unknown node type "${node.type}".` },
      },
    };
  }

  const inputs = resolveInputs(options.doc, node, outputsByNode, definition);

  // A node fed only by branches that produced nothing is not on the path this
  // run took. Running it anyway would feed it nulls and, for an AI node, spend
  // money on a branch the condition rejected.
  const incoming = incomingEdges(options.doc, nodeId);
  if (incoming.length > 0 && Object.keys(inputs).length === 0) {
    return { state: { ...state, status: "skipped" } };
  }

  // Budget check happens before spending, so a run pauses instead of overshooting.
  if (options.maxCostSen !== undefined && definition.estimate) {
    const estimate = await definition
      .estimate({
        nodeId, projectId: options.projectId, auth: options.auth, config: node.config,
        inputs, variables: options.variables,
        services: { getModel: options.services.getModel, estimateCost: options.services.estimateCost, findModels: options.services.findModels },
      })
      .catch(() => null);
    if (estimate && costSoFarSen + estimate.estimatedSen > options.maxCostSen) {
      return {
        state: {
          ...state, status: "skipped", estimatedCostSen: estimate.estimatedSen,
          error: {
            code: "budget_exceeded",
            message: "Running this step would go over the budget for this workflow.",
            action: "Raise the budget or simplify the workflow.",
          },
        },
        pauseForBudget: true,
      };
    }
    state.estimatedCostSen = estimate?.estimatedSen;
  }

  // Cache lookup: identical node, config and inputs means the previous result stands.
  const cacheEnabled = node.cache ?? options.doc.settings.cache;
  const cacheKey = cacheEnabled ? await computeCacheKey(node, inputs) : undefined;
  if (cacheKey && options.cache) {
    const hit = await options.cache.get(cacheKey);
    if (hit) {
      const cached: NodeRunState = {
        ...state, status: "cached", cacheKey, outputs: hit,
        startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), durationMs: 0,
        actualCostSen: 0,
      };
      await options.hooks?.onNodeFinish?.(cached);
      return { state: cached };
    }
  }

  const retry = node.retry;
  const maxAttempts = (retry?.count ?? 0) + 1;
  let lastError: NodeRunState["error"];
  // Tracked rather than assumed: the debug panel reports real attempts (§83).
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) {
      return { state: { ...state, status: "failed", attempt, error: { code: "cancelled", message: "Run cancelled." } } };
    }

    attemptsMade = attempt;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    await options.hooks?.onNodeStart?.({ ...state, status: "running", attempt, startedAt });

    try {
      const runStep = options.runStep ?? (<T,>(_id: string, fn: () => Promise<T>) => fn());
      const result = await runStep(`${nodeId}#${attempt}`, () => definition.execute({
        nodeId,
        nodeRunId: state.nodeRunId,
        workflowRunId: options.workflowRunId,
        projectId: options.projectId,
        auth: options.auth,
        config: node.config,
        inputs,
        variables: options.variables,
        services: options.services,
        signal: options.signal,
      }));

      const completed: NodeRunState = {
        ...state, status: "completed", attempt, outputs: result.outputs,
        actualCostSen: result.actualCostSen ?? 0,
        generationId: result.generationId,
        providerRequestId: result.providerRequestId,
        cacheKey, startedAt,
        completedAt: new Date().toISOString(), durationMs: Date.now() - startedMs,
      };
      if (cacheKey && options.cache) await options.cache.set(cacheKey, result.outputs);
      await options.hooks?.onNodeFinish?.(completed);
      return { state: completed };
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError("internal", error instanceof Error ? error.message : String(error));
      lastError = { code: appError.code, message: appError.message, action: appError.action };

      // Only failures the node opted into are retried. Bad input, insufficient
      // balance and permission errors never are (§63).
      const retryable = retry !== undefined && (retry.on as string[]).includes(appError.code);
      if (!retryable || attempt === maxAttempts) break;
      await options.sleep(retry.delayMs * attempt);
    }
  }

  const failed: NodeRunState = {
    ...state, status: "failed", attempt: attemptsMade, error: lastError,
    completedAt: new Date().toISOString(),
  };
  await options.hooks?.onNodeFinish?.(failed);
  return { state: failed };
}

/** Gathers the values arriving on a node's input ports. */
function resolveInputs(
  doc: WorkflowDocument,
  node: NodeInstance,
  outputsByNode: Map<string, Record<string, PortValue>>,
  definition: NodeDefinition,
): Record<string, PortValue | undefined> {
  const inputs: Record<string, PortValue | undefined> = {};
  const multiplePorts = new Set(definition.inputs.filter((p) => p.multiple).map((p) => p.name));

  for (const edge of incomingEdges(doc, node.id)) {
    const upstream = outputsByNode.get(edge.from.node);
    if (!upstream) continue;
    const value = upstream[edge.from.port];
    if (value === undefined) continue;

    if (multiplePorts.has(edge.to.port)) {
      const existing = inputs[edge.to.port];
      inputs[edge.to.port] = Array.isArray(existing) ? [...existing, value] : existing === undefined ? [value] : [existing, value];
    } else {
      inputs[edge.to.port] = value;
    }
  }
  return inputs;
}

/** Sum of node estimates for a whole workflow, shown before running (§28). */
export async function estimateWorkflow(options: {
  doc: WorkflowDocument;
  variables: Record<string, unknown>;
  auth: AuthContext;
  projectId: string;
  services: Pick<EngineServices, "getModel" | "estimateCost"> & Partial<Pick<EngineServices, "findModels">>;
}): Promise<{ totalSen: Sen; approximate: boolean; perNode: { nodeId: string; estimatedSen: Sen }[] }> {
  let totalSen = 0;
  let approximate = false;
  const perNode: { nodeId: string; estimatedSen: Sen }[] = [];

  for (const node of options.doc.nodes) {
    const definition = getNodeDefinition(node.type);
    if (!definition?.estimate) continue;
    try {
      const estimate = await definition.estimate({
        nodeId: node.id,
        projectId: options.projectId,
        auth: options.auth,
        config: node.config,
        inputs: {},
        variables: options.variables,
        services: options.services,
      });
      totalSen += estimate.estimatedSen;
      approximate = approximate || estimate.approximate;
      perNode.push({ nodeId: node.id, estimatedSen: estimate.estimatedSen });
    } catch {
      // A node that cannot be estimated yet (no model chosen) contributes
      // nothing but makes the total approximate.
      approximate = true;
    }
  }
  return { totalSen, approximate, perNode };
}
