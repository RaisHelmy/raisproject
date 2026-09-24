import type { AppContext } from "../context";
import { WorkersAIProvider } from "../ai/workersai";

/** Embeddings always come from the configured EMBEDDING_MODEL on Workers AI so every vector in the index has the same dimensionality. */
export async function embedTexts(ctx: AppContext, texts: string[]): Promise<number[][]> {
  const model = ctx.env.EMBEDDING_MODEL || "@cf/baai/bge-m3";
  const provider = new WorkersAIProvider({ ai: (ctx.env as { AI?: Ai }).AI });
  const dims = Number(ctx.env.EMBEDDING_DIMENSIONS || "1024");
  const vectors = await provider.embed(texts.map((t) => t.slice(0, 6000)), model);
  return vectors.map((v) => (v.length === dims ? v : [...v.slice(0, dims), ...new Array(Math.max(0, dims - v.length)).fill(0)]));
}
export function embeddingModelName(ctx: AppContext): string { return ctx.env.EMBEDDING_MODEL || "@cf/baai/bge-m3"; }
