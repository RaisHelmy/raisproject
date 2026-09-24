import type { ProviderCode } from "@xuanzhi/shared-types";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface ChatRequest { model: string; messages: ChatMessage[]; maxTokens: number; temperature?: number; signal?: AbortSignal }
export type ChatChunk = { type: "text"; text: string } | { type: "usage"; input: number; output: number } | { type: "done" };

/** Every AI vendor is wrapped in this interface. The application never talks to a vendor SDK directly. */
export interface IAIProvider {
  readonly code: ProviderCode;
  chatStream(req: ChatRequest): AsyncIterable<ChatChunk>;
  /** Optional: providers that can also produce embeddings. */
  embed?(texts: string[], model: string): Promise<number[][]>;
}

export interface ProviderConfig { apiKey?: string | null; baseUrl?: string | null; ai?: Ai }

export class ProviderError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryable = false) { super(message); this.name = "ProviderError"; }
}

/** Parse a `text/event-stream` body into `data:` payload strings. */
export async function* sseLines(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader(); const dec = new TextDecoder(); let buf = "";
  const onAbort = () => reader.cancel().catch(() => undefined);
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, ""); buf = buf.slice(idx + 1);
        if (line.startsWith("data:")) yield line.slice(5).trim();
      }
    }
    if (buf.startsWith("data:")) yield buf.slice(5).trim();
  } finally { signal?.removeEventListener("abort", onAbort); reader.releaseLock?.(); }
}

export async function readError(r: Response): Promise<string> {
  try { const j = (await r.json()) as { error?: { message?: string } | string; message?: string }; return (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? `HTTP ${r.status}`; } catch { return `HTTP ${r.status}`; }
}
