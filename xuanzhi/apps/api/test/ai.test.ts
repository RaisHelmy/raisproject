import { describe, expect, it } from "vitest";
import { runChatWithFallback, buildProvider } from "../src/services/ai/registry";
import { ProviderError, sseLines } from "../src/services/ai/types";
import { splitFollowups, FOLLOWUP_MARKER } from "../src/services/chat/prompt-builder";
import { rerankScore, keywordOverlap } from "../src/services/knowledge/retrieval";
import { fakeCtx, model } from "./helpers";

/** Fake OpenAI-compatible servers keyed by URL prefix. */
function fakeFetch(handlers: Record<string, (init: RequestInit) => Response>) {
  return async (input: RequestInfo | URL, init?: RequestInit) => { const url = String(input); const h = Object.entries(handlers).find(([k]) => url.startsWith(k)); return h ? h[1](init ?? {}) : new Response("not found", { status: 404 }); };
}
const sse = (chunks: string[]) => new Response(chunks.map((t) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`).join("") + "data: [DONE]\n\n", { status: 200, headers: { "Content-Type": "text/event-stream" } });

describe("provider registry", () => {
  it("builds the right provider class per code", () => {
    expect(buildProvider("openai", {}).code).toBe("openai");
    expect(buildProvider("anthropic", {}).code).toBe("anthropic");
    expect(buildProvider("google", {}).code).toBe("google");
    expect(buildProvider("workers_ai", {}).code).toBe("workers_ai");
    expect(buildProvider("openai_compatible", { baseUrl: "http://x" }).code).toBe("openai_compatible");
  });
  it("fails fast without an API key", async () => {
    const p = buildProvider("openai", {});
    await expect((async () => { for await (const _ of p.chatStream({ model: "x", messages: [], maxTokens: 10 })) { /* */ } })()).rejects.toMatchObject({ status: 503 });
  });
});

describe("runChatWithFallback", () => {
  const providers = { pA: { id: "pA", code: "openai_compatible", is_active: true, base_url: "http://primary.test/v1", api_key_encrypted: null }, pB: { id: "pB", code: "openai_compatible", is_active: true, base_url: "http://fallback.test/v1", api_key_encrypted: null } };
  const ctx = fakeCtx({ providers: { findById: async (id: string) => providers[id as "pA"] } });
  const primary = model({ id: "m-primary", provider_id: "pA", model_identifier: "prim" }); const fallback = model({ id: "m-fallback", provider_id: "pB", model_identifier: "fb" });

  it("falls back to the default model when the primary fails before producing text", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = fakeFetch({ "http://primary.test": () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 }), "http://fallback.test": () => sse(["hello ", "world"]) }) as typeof fetch;
    try {
      let out = "";
      const r = await runChatWithFallback(ctx, primary, { messages: [{ role: "user", content: "hi" }], maxTokens: 10 }, (c) => { if (c.type === "text") out += c.text; }, fallback);
      expect(out).toBe("hello world"); expect(r.fellBack).toBe(true); expect(r.modelUsed.id).toBe("m-fallback");
    } finally { globalThis.fetch = orig; }
  });
  it("uses the primary when it works and surfaces a provider error when both fail", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = fakeFetch({ "http://primary.test": () => sse(["ok"]), "http://fallback.test": () => sse(["nope"]) }) as typeof fetch;
    try {
      let out = ""; const r = await runChatWithFallback(ctx, primary, { messages: [], maxTokens: 10 }, (c) => { if (c.type === "text") out += c.text; }, fallback);
      expect(out).toBe("ok"); expect(r.fellBack).toBe(false);
      globalThis.fetch = fakeFetch({ "http://primary.test": () => new Response("x", { status: 500 }), "http://fallback.test": () => new Response("y", { status: 500 }) }) as typeof fetch;
      await expect(runChatWithFallback(ctx, primary, { messages: [], maxTokens: 10 }, () => undefined, fallback)).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR" });
    } finally { globalThis.fetch = orig; }
  });
  it("does not fall back once text has been produced", async () => {
    const orig = globalThis.fetch;
    let pulls = 0;
    const broken = () => new Response(new ReadableStream({ pull(c) { if (pulls++ === 0) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "partial" } }] })}\n\n`)); else c.error(new Error("cut")); } }), { status: 200 });
    globalThis.fetch = fakeFetch({ "http://primary.test": broken, "http://fallback.test": () => sse(["should not run"]) }) as typeof fetch;
    try {
      let out = "";
      await expect(runChatWithFallback(ctx, primary, { messages: [], maxTokens: 10 }, (c) => { if (c.type === "text") out += c.text; }, fallback)).rejects.toBeTruthy();
      expect(out).toBe("partial");
    } finally { globalThis.fetch = orig; }
  });
});

describe("SSE parsing", () => {
  it("yields data payloads across chunk boundaries", async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode("data: {\"a\":1}\n\nda")); c.enqueue(enc.encode("ta: [DONE]\n")); c.close(); } });
    const got: string[] = []; for await (const d of sseLines(body)) got.push(d);
    expect(got).toEqual(['{"a":1}', "[DONE]"]);
  });
  it("ProviderError carries status", () => { expect(new ProviderError("x", 429, true).retryable).toBe(true); });
});

describe("follow-ups and citations", () => {
  it("splits answer and follow-up questions", () => {
    const r = splitFollowups(`### Answer\nText ①\n${FOLLOWUP_MARKER}\n1. What is Hexagram 3?\n- How do I read moving lines?\nShould I consult a teacher?\n`);
    expect(r.answer).toBe("### Answer\nText ①");
    expect(r.suggestions).toEqual(["What is Hexagram 3?", "How do I read moving lines?", "Should I consult a teacher?"]);
  });
  it("returns no suggestions without the marker", () => { expect(splitFollowups("plain").suggestions).toEqual([]); });
});

describe("reranking", () => {
  it("prefers primary classical texts over community content at equal similarity", () => {
    expect(rerankScore(0.8, 1.0, 0)).toBeGreaterThan(rerankScore(0.8, 0.5, 0));
  });
  it("measures keyword overlap for English and Chinese", () => {
    expect(keywordOverlap("starting a business", "the business of starting")).toBe(1);
    expect(keywordOverlap("易经 创业", "易经说创业要看时机")).toBe(1);
    expect(keywordOverlap("feng shui", "unrelated text")).toBe(0);
  });
});
