import { InsufficientBalanceError, RaisAIError, type ErrorBody } from "./errors";
import type { AssetRef, Balance, CostEstimate, Generation, Model, Template, WorkflowRun } from "./types";

export * from "./errors";
export * from "./types";

export interface RaisAIOptions {
  apiKey: string;
  baseUrl?: string;
  /** Retries for transient failures. Set to 0 to handle them yourself. */
  maxRetries?: number;
  fetch?: typeof fetch;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

const DEFAULT_BASE_URL = "https://api.raisai.dev";

/**
 * Node client for RaisAI Create.
 *
 * Deliberately thin: it speaks the same REST API the web app uses, so there is
 * one implementation of every rule (§141, §161). Amounts are integer sen in
 * ringgit throughout; `formatMYR` is provided so nobody divides by 100 by hand.
 */
export class RaisAI {
  readonly models: ModelsClient;
  readonly generations: GenerationsClient;
  readonly workflows: WorkflowsClient;
  readonly templates: TemplatesClient;
  readonly assets: AssetsClient;
  readonly balance: BalanceClient;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RaisAIOptions) {
    if (!options.apiKey) throw new Error("An API key is required. Create one in Developer settings.");
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

    this.models = new ModelsClient(this);
    this.generations = new GenerationsClient(this);
    this.workflows = new WorkflowsClient(this);
    this.templates = new TemplatesClient(this);
    this.assets = new AssetsClient(this);
    this.balance = new BalanceClient(this);
  }

  /** @internal */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let lastError: RaisAIError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const response = await this.fetchImpl(url.toString(), {
        method: options.method ?? "GET",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          ...(options.body ? { "content-type": "application/json" } : {}),
          ...(options.idempotencyKey ? { "idempotency-key": options.idempotencyKey } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        ...(options.signal ? { signal: options.signal } : {}),
      });

      if (response.ok) {
        return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
      }

      const body = (await response.json().catch(() => null)) as { error?: ErrorBody } | null;
      const error = body?.error ?? { code: "internal", message: response.statusText };
      const requestId = response.headers.get("x-request-id") ?? undefined;

      lastError =
        error.code === "insufficient_balance"
          ? new InsufficientBalanceError(error, response.status, requestId)
          : new RaisAIError(error, response.status, requestId);

      // Retrying a charge without an idempotency key could bill twice, so a
      // mutation is only retried when the caller supplied one.
      const safeToRetry = options.method === undefined || options.method === "GET" || Boolean(options.idempotencyKey);
      if (!lastError.retryable || !safeToRetry || attempt === this.maxRetries) break;

      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    throw lastError ?? new RaisAIError({ code: "internal", message: "The request failed." }, 500);
  }
}

class ModelsClient {
  constructor(private readonly client: RaisAI) {}

  async list(filter: { category?: string; capability?: string; task?: string } = {}): Promise<Model[]> {
    const { items } = await this.client.request<{ items: Model[] }>("/models", { query: filter });
    return items;
  }

  get(modelId: string): Promise<Model> {
    return this.client.request<Model>(`/models/${modelId}`);
  }

  /** What a request would cost, before running it. */
  estimate(modelId: string, input: { prompt?: string; durationSeconds?: number; imageCount?: number }): Promise<CostEstimate> {
    return this.client.request<CostEstimate>(`/models/${modelId}/estimate`, { method: "POST", body: input });
  }
}

class GenerationsClient {
  constructor(private readonly client: RaisAI) {}

  /**
   * Creates a generation. Pass `idempotencyKey` if you may retry: without one,
   * a retry is a second charge.
   */
  create(input: {
    modelId: string;
    prompt: string;
    negativePrompt?: string;
    imageAssetIds?: string[];
    parameters?: Record<string, unknown>;
    projectId?: string;
    idempotencyKey?: string;
  }): Promise<{ generation: Generation; balanceAfterSen: number }> {
    const { idempotencyKey, ...body } = input;
    return this.client.request("/generations", { method: "POST", body, idempotencyKey });
  }

  get(generationId: string): Promise<Generation> {
    return this.client.request<Generation>(`/generations/${generationId}`);
  }

  async list(filter: { projectId?: string; modelId?: string; limit?: number } = {}): Promise<Generation[]> {
    const { items } = await this.client.request<{ items: Generation[] }>("/generations", { query: filter });
    return items;
  }
}

class WorkflowsClient {
  constructor(private readonly client: RaisAI) {}

  async list(): Promise<{ id: string; name: string; version: number }[]> {
    const { items } = await this.client.request<{ items: { id: string; name: string; version: number }[] }>("/workflows");
    return items;
  }

  /** Validates and prices a workflow without running it. */
  preview(workflowId: string, variables: Record<string, unknown> = {}): Promise<{ valid: boolean; estimatedSen: number; errors: { message: string }[] }> {
    return this.client.request(`/workflows/${workflowId}/preview`, { method: "POST", body: { variables } });
  }

  run(
    workflowId: string,
    variables: Record<string, unknown> = {},
    options: { maxCostSen?: number; idempotencyKey?: string } = {},
  ): Promise<WorkflowRun> {
    return this.client.request<WorkflowRun>(`/workflows/${workflowId}/run`, {
      method: "POST",
      body: { variables, ...(options.maxCostSen ? { maxCostSen: options.maxCostSen } : {}) },
      idempotencyKey: options.idempotencyKey,
    });
  }

  getRun(runId: string): Promise<WorkflowRun> {
    return this.client.request<WorkflowRun>(`/workflow-runs/${runId}`);
  }

  /** Polls until a run settles. Long work runs durably, so this may take a while. */
  async waitForRun(runId: string, options: { timeoutMs?: number; intervalMs?: number } = {}): Promise<WorkflowRun> {
    const deadline = Date.now() + (options.timeoutMs ?? 10 * 60_000);
    const interval = options.intervalMs ?? 2000;

    for (;;) {
      const run = await this.getRun(runId);
      if (["completed", "failed", "cancelled", "paused"].includes(run.status)) return run;
      if (Date.now() >= deadline) {
        throw new RaisAIError(
          { code: "provider_timeout", message: `Run ${runId} did not finish in time.`, action: "Check it later with getRun." },
          504,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

class TemplatesClient {
  constructor(private readonly client: RaisAI) {}

  async list(filter: { category?: string; q?: string; scope?: "public" } = {}): Promise<Template[]> {
    const { items } = await this.client.request<{ items: Template[] }>("/templates", { query: filter });
    return items;
  }

  get(templateId: string): Promise<Template> {
    return this.client.request<Template>(`/templates/${templateId}`);
  }

  run(templateId: string, variables: Record<string, unknown> = {}, options: { idempotencyKey?: string } = {}): Promise<WorkflowRun> {
    return this.client.request<WorkflowRun>(`/templates/${templateId}/execute`, {
      method: "POST",
      body: { variables },
      idempotencyKey: options.idempotencyKey,
    });
  }
}

class AssetsClient {
  constructor(private readonly client: RaisAI) {}

  async list(filter: { kind?: string; projectId?: string; limit?: number } = {}): Promise<(AssetRef & { id: string; name: string; url: string })[]> {
    const { items } = await this.client.request<{ items: (AssetRef & { id: string; name: string; url: string })[] }>("/assets", { query: filter });
    return items;
  }

  /** The absolute URL of a stored file. Requests still need the API key. */
  url(assetId: string, version?: number): string {
    const base = (this.client as unknown as { baseUrl: string }).baseUrl;
    return `${base}/api/v1/assets/${assetId}/content${version ? `?version=${version}` : ""}`;
  }
}

class BalanceClient {
  constructor(private readonly client: RaisAI) {}

  get(): Promise<Balance> {
    return this.client.request<Balance>("/balance");
  }

  usage(days = 30): Promise<{ totalSpentSen: number; generations: number }> {
    return this.client.request("/usage", { query: { days } });
  }
}

/** Integer sen to a readable ringgit string: 4962 becomes "RM49.62". */
export function formatMYR(sen: number): string {
  const sign = sen < 0 ? "-" : "";
  const abs = Math.abs(sen);
  return `${sign}RM${Math.floor(abs / 100).toLocaleString("en-MY")}.${String(abs % 100).padStart(2, "0")}`;
}

export default RaisAI;
