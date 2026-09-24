import { ProviderError, sseLines, type ChatChunk, type ChatRequest, type IAIProvider, type ProviderConfig } from "./types";

/**
 * Cloudflare Workers AI — open-weight models (Qwen, GLM, DeepSeek, Llama, gpt-oss) served from the account's AI binding.
 * No external API key; this is the provider that makes the product work immediately after setup. Also serves embeddings (bge-m3).
 */
export class WorkersAIProvider implements IAIProvider {
  readonly code = "workers_ai" as const;
  constructor(private readonly cfg: ProviderConfig) {}

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    if (!this.cfg.ai) throw new ProviderError("Workers AI binding is not available.", 503);
    let stream: ReadableStream<Uint8Array>;
    try {
      stream = (await this.cfg.ai.run(req.model as never, { messages: req.messages, stream: true, max_tokens: req.maxTokens, temperature: req.temperature ?? 0.6 } as never, { signal: req.signal } as never)) as unknown as ReadableStream<Uint8Array>;
    } catch (e) { throw new ProviderError((e as Error).message || "Workers AI request failed", 502, true); }
    if (!(stream instanceof ReadableStream)) { // non-streaming model: emit the whole response
      const text = (stream as { response?: string }).response ?? ""; if (text) yield { type: "text", text };
      yield { type: "done" }; return;
    }
    let input = 0, output = 0;
    for await (const data of sseLines(stream, req.signal)) {
      if (data === "[DONE]") break;
      let j: { response?: string; choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      try { j = JSON.parse(data); } catch { continue; }
      const t = j.response ?? j.choices?.[0]?.delta?.content;
      if (t) yield { type: "text", text: t };
      if (j.usage) { input = j.usage.prompt_tokens ?? input; output = j.usage.completion_tokens ?? output; }
    }
    if (input || output) yield { type: "usage", input, output };
    yield { type: "done" };
  }

  async embed(texts: string[], model: string): Promise<number[][]> {
    if (!this.cfg.ai) throw new ProviderError("Workers AI binding is not available.", 503);
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += 50) {
      const batch = texts.slice(i, i + 50);
      const r = (await this.cfg.ai.run(model as never, { text: batch } as never)) as { data?: number[][] };
      if (!r?.data || r.data.length !== batch.length) throw new ProviderError("Embedding response was malformed", 502, true);
      out.push(...r.data);
    }
    return out;
  }
}
