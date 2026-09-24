import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { CloudflareAIProvider, classifyProviderError } from "../src/providers/cloudflare/cloudflare-provider";
import { buildProviderInput } from "../src/providers/cloudflare/mapping";
import { ModelSeedService } from "../src/services/model-seed-service";
import { ModelService } from "../src/services/model-service";

/** Stub AI binding: records the call and returns a scripted response. */
function stubAI(response: unknown | (() => unknown)) {
  const calls: { model: string; body: Record<string, unknown> }[] = [];
  const ai = {
    run: async (model: string, body: Record<string, unknown>) => {
      calls.push({ model, body });
      return typeof response === "function" ? (response as () => unknown)() : response;
    },
  };
  return { ai: ai as unknown as Ai, calls };
}

const FLUX_ID = "@cf/black-forest-labs/flux-1-schnell";

async function models() {
  await new ModelSeedService(env).seed();
  return new ModelService(env);
}

describe("provider input mapping", () => {
  it("omits fields a model does not advertise", async () => {
    const flux = await (await models()).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    // FLUX.1 Schnell has no negative prompt and no width/height in its schema.
    const body = buildProviderInput(flux, {
      prompt: "a street",
      negativePrompt: "blurry",
      width: 512,
      height: 512,
      steps: 4,
    });
    expect(body).toMatchObject({ prompt: "a street", steps: 4 });
    expect(body).not.toHaveProperty("negative_prompt");
    expect(body).not.toHaveProperty("width");
  });

  it("uses each model's own field names via mapsTo", async () => {
    const lucid = await (await models()).getEnabled("@cf/leonardo/lucid-origin");
    const body = buildProviderInput(lucid, { prompt: "a street", width: 1120, height: 1120, parameters: { steps: 30 } });
    // Lucid Origin's steps parameter maps to num_steps.
    expect(body).toMatchObject({ prompt: "a street", width: 1120, height: 1120, num_steps: 30 });
    expect(body).not.toHaveProperty("steps");
  });

  it("passes an image only to a model that accepts one", async () => {
    const service = await models();
    const vision = await service.getEnabled("@cf/meta/llama-3.2-11b-vision-instruct");
    const flux = await service.getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const image = { mime: "image/png", bytes: new Uint8Array([1, 2, 3]).buffer as ArrayBuffer };

    expect(buildProviderInput(vision, { prompt: "what is this", images: [image] })).toHaveProperty("image");
    expect(buildProviderInput(flux, { prompt: "x", images: [image] })).not.toHaveProperty("image");
  });
});

describe("provider validation", () => {
  it("explains an unsupported reference image and what to do", async () => {
    const flux = await (await models()).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const provider = new CloudflareAIProvider({ AI: stubAI({}).ai, AI_GATEWAY_ID: "g" });
    const result = provider.validateInput(flux, { prompt: "x", images: [{ mime: "image/png" }] });

    expect(result.ok).toBe(false);
    expect(result.issues[0]!.message).toContain("does not support image references");
    expect(result.issues[0]!.action).toContain("supports image input");
  });

  it("checks numeric ranges declared by the model", async () => {
    const flux = await (await models()).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const provider = new CloudflareAIProvider({ AI: stubAI({}).ai, AI_GATEWAY_ID: "g" });
    const result = provider.validateInput(flux, { prompt: "x", parameters: { steps: 99 } });

    expect(result.ok).toBe(false);
    expect(result.issues[0]!.message).toContain("at most 8");
  });

  it("checks enum options declared by the model", async () => {
    const melo = await (await models()).getEnabled("@cf/myshell-ai/melotts");
    const provider = new CloudflareAIProvider({ AI: stubAI({}).ai, AI_GATEWAY_ID: "g" });
    const result = provider.validateInput(melo, { text: "hello", parameters: { lang: "martian" } });

    expect(result.ok).toBe(false);
    expect(result.issues[0]!.message).toContain("must be one of");
  });

  it("accepts a valid request", async () => {
    const flux = await (await models()).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const provider = new CloudflareAIProvider({ AI: stubAI({}).ai, AI_GATEWAY_ID: "g" });
    expect(provider.validateInput(flux, { prompt: "a street", parameters: { steps: 4 } }).ok).toBe(true);
  });
});

describe("provider execution", () => {
  it("decodes a base64 image response and routes through the gateway", async () => {
    const flux = await (await models()).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const { ai, calls } = stubAI({ image: png });
    const provider = new CloudflareAIProvider({ AI: ai, AI_GATEWAY_ID: "raisai" });

    const job = await provider.execute(flux, { prompt: "a street" }, { requestId: "req-1" });
    expect(job.status).toBe("completed");
    expect(job.output?.image?.bytes?.byteLength).toBeGreaterThan(0);
    expect(calls[0]!.model).toBe("@cf/black-forest-labs/flux-1-schnell");
  });

  it("reads text and token usage from an LLM response", async () => {
    const llama = await (await models()).getEnabled("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    const { ai } = stubAI({ response: "A thief steals a city.", usage: { prompt_tokens: 12, completion_tokens: 7 } });
    const provider = new CloudflareAIProvider({ AI: ai, AI_GATEWAY_ID: "raisai" });

    const job = await provider.execute(llama, { prompt: "logline" }, { requestId: "req-2" });
    expect(job.output?.text).toBe("A thief steals a city.");
    expect(job.usage?.measures).toMatchObject({ tokensIn: 12, tokensOut: 7 });
  });

  it("reports a failure with a retryable flag instead of throwing", async () => {
    const flux = await (await models()).getEnabled("@cf/black-forest-labs/flux-1-schnell");
    const { ai } = stubAI(() => {
      throw new Error("Request timed out after 30s");
    });
    const provider = new CloudflareAIProvider({ AI: ai, AI_GATEWAY_ID: "raisai" });

    const job = await provider.execute(flux, { prompt: "x" }, { requestId: "req-3" });
    expect(job.status).toBe("failed");
    expect(job.error).toMatchObject({ code: "provider_timeout", retryable: true });
  });

  it("treats an incomplete third-party state as still running", async () => {
    const vidu = await (await models()).getAny("vidu/q3-turbo");
    const { ai } = stubAI({ state: "Processing" });
    const provider = new CloudflareAIProvider({ AI: ai, AI_GATEWAY_ID: "raisai" });

    const job = await provider.execute(vidu!, { prompt: "x", durationSeconds: 5 }, { requestId: "req-4" });
    expect(job.status).toBe("running");
    expect(job.handle).toBeTruthy();
  });
});

describe("error classification", () => {
  const model = { displayName: "Test Model" } as never;
  it("marks transient provider problems retryable", () => {
    expect(classifyProviderError(new Error("429 too many requests"), model).retryable).toBe(true);
    expect(classifyProviderError(new Error("503 service unavailable"), model).retryable).toBe(true);
  });
  it("never retries a bad request", () => {
    expect(classifyProviderError(new Error("400 invalid schema"), model)).toMatchObject({
      code: "invalid_input",
      retryable: false,
    });
  });
});

describe("async queue protocol", () => {
  /** Matches Cloudflare's documented flow: queueRequest -> request_id -> poll. */
  it("queues a request for a model that declares async-job and polls it to completion", async () => {
    const service = await models();
    const vidu = (await service.getAny("vidu/q3-turbo"))!;
    const calls: Record<string, unknown>[] = [];
    let poll = 0;

    const ai = {
      run: async (_model: string, body: Record<string, unknown>, options?: Record<string, unknown>) => {
        calls.push({ ...body, ...(options ?? {}) });
        if (body.request_id === undefined) return { request_id: "req-abc", status: "queued" };
        poll += 1;
        if (poll === 1) return { status: "running" };
        return { video: "https://example.com/video.mp4" };
      },
    } as unknown as Ai;

    const provider = new CloudflareAIProvider({ AI: ai, AI_GATEWAY_ID: "raisai" });
    const started = await provider.execute(vidu, { prompt: "a street", durationSeconds: 5 }, { requestId: "r1" });

    expect(started.status).toBe("queued");
    expect(started.handle).toBe("vidu/q3-turbo::req-abc");
    // The submit call opted into the queue, as the documented protocol requires.
    expect(calls[0]!.queueRequest).toBe(true);

    const running = await provider.getJob(started.handle!, vidu);
    expect(running.status).toBe("running");
  });

  it("does not queue a model that has not declared async-job", async () => {
    const flux = await (await models()).getEnabled(FLUX_ID);
    const calls: Record<string, unknown>[] = [];
    const ai = {
      run: async (_m: string, body: Record<string, unknown>, options?: Record<string, unknown>) => {
        calls.push({ ...body, ...(options ?? {}) });
        return { image: "aGk=" };
      },
    } as unknown as Ai;

    const provider = new CloudflareAIProvider({ AI: ai, AI_GATEWAY_ID: "g" });
    await provider.execute(flux, { prompt: "x" }, { requestId: "r" });
    expect(calls[0]!.queueRequest).toBeUndefined();
  });

  it("reports a polling failure in the model's own words", async () => {
    const vidu = (await (await models()).getAny("vidu/q3-turbo"))!;
    const ai = {
      run: async () => {
        throw new Error("503 service unavailable");
      },
    } as unknown as Ai;
    const provider = new CloudflareAIProvider({ AI: ai, AI_GATEWAY_ID: "g" });

    const job = await provider.getJob("vidu/q3-turbo::req-1", vidu);
    expect(job.status).toBe("failed");
    expect(job.error?.message).toContain("Vidu Q3 Turbo");
    expect(job.error?.retryable).toBe(true);
  });
});
