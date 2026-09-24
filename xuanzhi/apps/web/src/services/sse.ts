import type { ChatStreamEvent } from "@xuanzhi/shared-types";
import { API_BASE, CSRF_HEADER, ApiError } from "./api";

/** POST + parse a text/event-stream response (fetch-based, so we can send a JSON body and cookies). */
export async function streamChat(body: unknown, onEvent: (e: ChatStreamEvent) => void, signal: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/chat/stream`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-Requested-With": CSRF_HEADER }, credentials: "include", body: JSON.stringify(body), signal });
  } catch (e) { if ((e as Error).name === "AbortError") return; throw new ApiError("NETWORK", "Could not reach the server.", 0); }
  if (!res.ok || !res.body) {
    let msg = `Request failed (${res.status})`; let code = "REQUEST_FAILED"; let details: unknown;
    try { const j = await res.json(); msg = j.error?.message ?? msg; code = j.error?.code ?? code; details = j.error?.details; } catch { /* ignore */ }
    if (res.status === 401) window.dispatchEvent(new CustomEvent("xz:unauthorized"));
    throw new ApiError(code, msg, res.status, undefined, details);
  }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, idx); buf = buf.slice(idx + 2);
        const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
        if (!data) continue;
        try { onEvent(JSON.parse(data) as ChatStreamEvent); } catch { /* skip malformed */ }
      }
    }
  } catch (e) { if ((e as Error).name !== "AbortError") throw e; }
}
