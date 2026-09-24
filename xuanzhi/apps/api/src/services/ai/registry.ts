/**
 * Resolves the IAIProvider for a model (decrypting the admin-stored key or falling back to env secrets) and runs a chat with
 * automatic fallback to the system default model when the primary provider fails before producing output.
 */
import type { AppContext } from "../context";
import type { ModelRow, ProviderRow } from "../../repositories/types";
import { decryptString } from "../../lib/crypto";
import { Errors } from "../../lib/errors";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";
import { WorkersAIProvider } from "./workersai";
import { ProviderError, type ChatChunk, type ChatRequest, type IAIProvider, type ProviderConfig } from "./types";

export async function providerApiKey(ctx: AppContext, p: ProviderRow): Promise<string | null> {
  if (p.api_key_encrypted && ctx.env.ENCRYPTION_KEY) { try { return await decryptString(p.api_key_encrypted, ctx.env.ENCRYPTION_KEY); } catch { ctx.log.warn("provider_key_decrypt_failed", { provider: p.code }); } }
  const env = ctx.env;
  return p.code === "openai" ? env.OPENAI_API_KEY ?? null : p.code === "anthropic" ? env.ANTHROPIC_API_KEY ?? null : p.code === "google" ? env.GOOGLE_API_KEY ?? null : null;
}

export function buildProvider(code: ProviderRow["code"], cfg: ProviderConfig): IAIProvider {
  switch (code) {
    case "openai": return new OpenAIProvider(cfg, "openai");
    case "openai_compatible": return new OpenAIProvider(cfg, "openai_compatible");
    case "anthropic": return new AnthropicProvider(cfg);
    case "google": return new GoogleProvider(cfg);
    case "workers_ai": return new WorkersAIProvider(cfg);
  }
}

export async function providerForModel(ctx: AppContext, model: ModelRow): Promise<IAIProvider> {
  const p = await ctx.repos.providers.findById(model.provider_id);
  if (!p || !p.is_active) throw Errors.notConfigured("The provider for this model is disabled.");
  return buildProvider(p.code, { apiKey: await providerApiKey(ctx, p), baseUrl: p.base_url, ai: (ctx.env as { AI?: Ai }).AI });
}

/** Is the provider usable right now (key present / binding available)? Used by the model list so the UI can grey out unconfigured vendors. */
export async function providerConfigured(ctx: AppContext, p: ProviderRow): Promise<boolean> {
  if (p.code === "workers_ai") return !!(ctx.env as { AI?: Ai }).AI;
  if (p.code === "openai_compatible") return !!p.base_url;
  return !!(await providerApiKey(ctx, p));
}

export interface ChatRunResult { modelUsed: ModelRow; fellBack: boolean }

/**
 * Streams a chat. If the primary model's provider fails before any text arrives (bad key, outage, rate limit), retries once with
 * the fallback model (system default) so the user still gets an answer. Emits chunks to `onChunk`.
 */
export async function runChatWithFallback(ctx: AppContext, model: ModelRow, req: Omit<ChatRequest, "model">, onChunk: (c: ChatChunk) => Promise<void> | void, fallback?: ModelRow | null): Promise<ChatRunResult> {
  const attempt = async (m: ModelRow) => {
    const provider = await providerForModel(ctx, m);
    let produced = false;
    try {
      for await (const chunk of provider.chatStream({ ...req, model: m.model_identifier })) { if (chunk.type === "text" && chunk.text) produced = true; await onChunk(chunk); }
      return { ok: true as const };
    } catch (e) { return { ok: false as const, produced, error: e as Error }; }
  };
  const first = await attempt(model);
  if (first.ok) return { modelUsed: model, fellBack: false };
  if (req.signal?.aborted) throw first.error;
  ctx.log.warn("ai_provider_failed", { model: model.model_identifier, produced: first.produced, error: first.error });
  if (!first.produced && fallback && fallback.id !== model.id) {
    const second = await attempt(fallback);
    if (second.ok) return { modelUsed: fallback, fellBack: true };
    ctx.log.error("ai_fallback_failed", { model: fallback.model_identifier, error: second.error });
    throw toAppError(second.error, ctx.correlationId);
  }
  throw toAppError(first.error, ctx.correlationId);
}

function toAppError(e: Error, ref: string) {
  if (e instanceof ProviderError) return Errors.provider(`The AI provider returned an error: ${e.message}`, ref);
  if (e.name === "AbortError") return e;
  return Errors.provider("The AI provider is unavailable right now. Please try again.", ref);
}
