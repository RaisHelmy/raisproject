import { ProviderError, readError, sseLines, type ChatChunk, type ChatRequest, type IAIProvider, type ProviderConfig } from "./types";
import type { ProviderCode } from "@xuanzhi/shared-types";

/** OpenAI Chat Completions (also used for OpenAI-compatible servers such as vLLM/Ollama/OpenRouter via base_url). */
export class OpenAIProvider implements IAIProvider {
  constructor(private readonly cfg: ProviderConfig, public readonly code: ProviderCode = "openai") {}
  private get base() { return (this.cfg.baseUrl || "https://api.openai.com/v1").replace(/\/$/, ""); }

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    if (!this.cfg.apiKey && this.code === "openai") throw new ProviderError("OpenAI API key is not configured.", 503);
    const r = await fetch(`${this.base}/chat/completions`, {
      method: "POST", signal: req.signal,
      headers: { "Content-Type": "application/json", ...(this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {}) },
      body: JSON.stringify({ model: req.model, messages: req.messages, stream: true, stream_options: { include_usage: true }, max_completion_tokens: req.maxTokens, temperature: req.temperature ?? 0.6 }),
    });
    if (!r.ok || !r.body) throw new ProviderError(await readError(r), r.status, r.status === 429 || r.status >= 500);
    for await (const data of sseLines(r.body, req.signal)) {
      if (data === "[DONE]") break;
      let j: { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens: number; completion_tokens: number } };
      try { j = JSON.parse(data); } catch { continue; }
      const t = j.choices?.[0]?.delta?.content; if (t) yield { type: "text", text: t };
      if (j.usage) yield { type: "usage", input: j.usage.prompt_tokens, output: j.usage.completion_tokens };
    }
    yield { type: "done" };
  }

  async embed(texts: string[], model: string): Promise<number[][]> {
    const r = await fetch(`${this.base}/embeddings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.apiKey}` }, body: JSON.stringify({ model, input: texts }) });
    if (!r.ok) throw new ProviderError(await readError(r), r.status);
    const j = (await r.json()) as { data: { embedding: number[]; index: number }[] };
    return j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
