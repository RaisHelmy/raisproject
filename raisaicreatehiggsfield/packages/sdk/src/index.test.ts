import { describe, expect, it, vi } from "vitest";
import { RaisAI, RaisAIError, InsufficientBalanceError, formatMYR } from "./index";

/** A fetch that plays back scripted responses and records what it was sent. */
function scriptedFetch(responses: { status: number; body: unknown; headers?: Record<string, string> }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  let index = 0;
  const impl = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = responses[Math.min(index++, responses.length - 1)]!;
    return new Response(next.status === 204 ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json", ...(next.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function client(fetchImpl: typeof fetch, maxRetries = 0) {
  return new RaisAI({ apiKey: "rk_test", baseUrl: "https://example.test", fetch: fetchImpl, maxRetries });
}

describe("client basics", () => {
  it("refuses to start without an API key", () => {
    expect(() => new RaisAI({ apiKey: "" })).toThrowError(/API key is required/);
  });

  it("sends the key as a bearer token", async () => {
    const { impl, calls } = scriptedFetch([{ status: 200, body: { items: [] } }]);
    await client(impl).models.list();
    expect(new Headers(calls[0]!.init.headers).get("authorization")).toBe("Bearer rk_test");
  });

  it("passes filters through as query parameters", async () => {
    const { impl, calls } = scriptedFetch([{ status: 200, body: { items: [] } }]);
    await client(impl).models.list({ category: "image", capability: "image-input" });
    expect(calls[0]!.url).toContain("category=image");
    expect(calls[0]!.url).toContain("capability=image-input");
  });
});

describe("errors", () => {
  it("raises a typed error carrying the shortfall", async () => {
    const { impl } = scriptedFetch([
      {
        status: 402,
        body: { error: { code: "insufficient_balance", message: "Not enough balance.", action: "Add balance.", details: { estimatedSen: 3800, availableSen: 320 } } },
      },
    ]);

    const error = await client(impl)
      .generations.create({ modelId: "m", prompt: "x" })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InsufficientBalanceError);
    const typed = error as InsufficientBalanceError;
    expect(typed.estimatedSen).toBe(3800);
    expect(typed.availableSen).toBe(320);
    // The message carries the action, so a log line is enough to act on.
    expect(typed.message).toContain("Add balance.");
  });

  it("keeps the request id so a failure can be traced", async () => {
    const { impl } = scriptedFetch([
      { status: 500, body: { error: { code: "internal", message: "Boom." } }, headers: { "x-request-id": "req-42" } },
    ]);
    const error = (await client(impl).balance.get().catch((e: unknown) => e)) as RaisAIError;
    expect(error.requestId).toBe("req-42");
  });

  it("marks transient failures retryable and permanent ones not", async () => {
    const transient = new RaisAIError({ code: "rate_limited", message: "Slow down." }, 429);
    const permanent = new RaisAIError({ code: "invalid_input", message: "Bad prompt." }, 400);
    expect(transient.retryable).toBe(true);
    expect(permanent.retryable).toBe(false);
  });
});

describe("retries", () => {
  it("retries a read that failed transiently", async () => {
    const { impl, calls } = scriptedFetch([
      { status: 429, body: { error: { code: "rate_limited", message: "Slow down." } }, headers: { "retry-after": "0" } },
      { status: 200, body: { availableSen: 5000, reservedSen: 0, currency: "MYR" } },
    ]);
    const balance = await client(impl, 2).balance.get();
    expect(balance.availableSen).toBe(5000);
    expect(calls).toHaveLength(2);
  });

  it("never retries a charge without an idempotency key", async () => {
    const { impl, calls } = scriptedFetch([
      { status: 500, body: { error: { code: "internal", message: "Boom." } } },
    ]);
    await client(impl, 3).generations.create({ modelId: "m", prompt: "x" }).catch(() => undefined);
    // Retrying blind would risk billing twice.
    expect(calls).toHaveLength(1);
  });

  it("retries a charge when the caller supplied an idempotency key", async () => {
    const { impl, calls } = scriptedFetch([
      { status: 500, body: { error: { code: "internal", message: "Boom." } } },
      { status: 201, body: { generation: { id: "g1", status: "completed" }, balanceAfterSen: 4962 } },
    ]);
    const result = await client(impl, 2).generations.create({ modelId: "m", prompt: "x", idempotencyKey: "key-1" });

    expect(result.generation.id).toBe("g1");
    expect(calls).toHaveLength(2);
    expect(new Headers(calls[0]!.init.headers).get("idempotency-key")).toBe("key-1");
  });
});

describe("waiting for a run", () => {
  it("polls until the run settles", async () => {
    const { impl } = scriptedFetch([
      { status: 200, body: { id: "r1", status: "running", estimatedCostSen: 100, chargedSen: 0, outputs: {} } },
      { status: 200, body: { id: "r1", status: "completed", estimatedCostSen: 100, chargedSen: 88, outputs: { image: {} } } },
    ]);
    const run = await client(impl).workflows.waitForRun("r1", { intervalMs: 1 });
    expect(run.status).toBe("completed");
    expect(run.chargedSen).toBe(88);
  });

  it("gives up with something actionable rather than waiting forever", async () => {
    const { impl } = scriptedFetch([
      { status: 200, body: { id: "r1", status: "running", estimatedCostSen: 0, chargedSen: 0, outputs: {} } },
    ]);
    const error = (await client(impl)
      .workflows.waitForRun("r1", { timeoutMs: 5, intervalMs: 1 })
      .catch((e: unknown) => e)) as RaisAIError;

    expect(error.code).toBe("provider_timeout");
    expect(error.message).toContain("getRun");
  });
});

describe("money formatting", () => {
  it("reads sen as ringgit so nobody divides by 100 by hand", () => {
    expect(formatMYR(4962)).toBe("RM49.62");
    expect(formatMYR(1)).toBe("RM0.01");
    expect(formatMYR(123456)).toBe("RM1,234.56");
    expect(formatMYR(-5)).toBe("-RM0.05");
  });
});

describe("assets", () => {
  it("builds an absolute content URL", () => {
    const raisai = new RaisAI({ apiKey: "rk", baseUrl: "https://example.test", fetch: vi.fn() as unknown as typeof fetch });
    expect(raisai.assets.url("a1")).toBe("https://example.test/api/v1/assets/a1/content");
    expect(raisai.assets.url("a1", 2)).toContain("?version=2");
  });
});
