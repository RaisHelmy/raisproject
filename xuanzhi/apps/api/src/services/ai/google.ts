import { ProviderError, readError, sseLines, type ChatChunk, type ChatRequest, type IAIProvider, type ProviderConfig } from "./types";

/** Google Gemini (Generative Language API) streaming. */
export class GoogleProvider implements IAIProvider {
  readonly code = "google" as const;
  constructor(private readonly cfg: ProviderConfig) {}

  async *chatStream(req: ChatRequest): AsyncIterable<ChatChunk> {
    if (!this.cfg.apiKey) throw new ProviderError("Google AI API key is not configured.", 503);
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const base = (this.cfg.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    const r = await fetch(`${base}/v1beta/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`, {
      method: "POST", signal: req.signal, headers: { "Content-Type": "application/json", "x-goog-api-key": this.cfg.apiKey },
      body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents, generationConfig: { maxOutputTokens: req.maxTokens, temperature: req.temperature ?? 0.6 } }),
    });
    if (!r.ok || !r.body) throw new ProviderError(await readError(r), r.status, r.status === 429 || r.status >= 500);
    let input = 0, output = 0;
    for await (const data of sseLines(r.body, req.signal)) {
      let j: { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
      try { j = JSON.parse(data); } catch { continue; }
      for (const p of j.candidates?.[0]?.content?.parts ?? []) if (p.text) yield { type: "text", text: p.text };
      if (j.usageMetadata) { input = j.usageMetadata.promptTokenCount ?? input; output = j.usageMetadata.candidatesTokenCount ?? output; }
    }
    yield { type: "usage", input, output };
    yield { type: "done" };
  }
}
