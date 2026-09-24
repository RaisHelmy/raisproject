import type { Bindings } from "../../env";
import type { Logger } from "../../lib/logger";
import type { AIProvider } from "./types";
import { HeuristicAIProvider } from "./heuristic";
import { AnthropicAIProvider } from "./anthropic";

export type { AIProvider, AIMessage, AIContext, AnalysisResult, ExtractedWorkItem } from "./types";

/**
 * Select the AI provider. Real Claude integration when AI_PROVIDER=anthropic and the API key
 * secret is present; otherwise the clearly-labelled heuristic demo provider.
 */
export function getAIProvider(env: Bindings, log: Logger): { provider: AIProvider; reason: string } {
  const wanted = (env.AI_PROVIDER ?? "anthropic").toLowerCase();
  if (wanted === "anthropic") {
    if (env.ANTHROPIC_API_KEY) return { provider: new AnthropicAIProvider(env.ANTHROPIC_API_KEY, env.AI_MODEL || "claude-opus-5", log), reason: "Anthropic API key configured." };
    return { provider: new HeuristicAIProvider(), reason: "ANTHROPIC_API_KEY is not set; using heuristic demo provider." };
  }
  return { provider: new HeuristicAIProvider(), reason: `AI_PROVIDER=${wanted}; using heuristic demo provider.` };
}

/** AI_PROVIDER=external: work extraction is done by Claude through the MCP server, so the in-app rule-based pass is only a helper. */
export function aiIsExternal(env: Bindings): boolean {
  return (env.AI_PROVIDER ?? "").toLowerCase() === "external";
}

export function aiIsDemo(env: Bindings): boolean {
  if (aiIsExternal(env)) return false;
  return !((env.AI_PROVIDER ?? "anthropic").toLowerCase() === "anthropic" && !!env.ANTHROPIC_API_KEY);
}
