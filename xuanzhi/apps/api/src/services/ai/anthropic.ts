import { ProviderError, readError, sseLines, type ChatChunk, type ChatRequest, type IAIProvider, type ProviderConfig } from "./types";

/** Anthropic Messages API with streaming. */
export class AnthropicProvider implements IAIProvider {
  readonly code = "anthropic" as const;
  constructor(private readonly cfg: ProviderConfig) {}

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    if (!this.cfg.apiKey) throw new ProviderError("Anthropic API key is not configured.", 503);
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const messages = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    const r = await fetch(`${(this.cfg.baseUrl || "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`, {
      method: "POST", signal: req.signal,
      headers: { "Content-Type": "application/json", "x-api-key": this.cfg.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: req.model, system: system || undefined, messages, max_tokens: req.maxTokens, temperature: req.temperature ?? 0.6, stream: true }),
    });
    if (!r.ok || !r.body) throw new ProviderError(await readError(r), r.status, r.status === 429 || r.status >= 500);
    let input = 0, output = 0;
    for await (const data of sseLines(r.body, req.signal)) {
      let j: { type: string; delta?: { type?: string; text?: string }; message?: { usage?: { input_tokens: number } }; usage?: { output_tokens: number }; error?: { message: string } };
      try { j = JSON.parse(data); } catch { continue; }
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta" && j.delta.text) yield { type: "text", text: j.delta.text };
      else if (j.type === "message_start") input = j.message?.usage?.input_tokens ?? 0;
      else if (j.type === "message_delta") output = j.usage?.output_tokens ?? output;
      else if (j.type === "error") throw new ProviderError(j.error?.message ?? "Anthropic stream error", 502, true);
    }
    yield { type: "usage", input, output };
    yield { type: "done" };
  }
}
