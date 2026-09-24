import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { ChatStreamEvent, MessageDTO } from "@xuanzhi/shared-types";
import type { HonoEnv } from "../middleware";
import { rateLimit, requireAuth } from "../middleware";
import { ok } from "../lib/http";
import { AppError, Errors } from "../lib/errors";
import { streamChat } from "../services/chat/service";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

const ChatSchema = z.object({
  conversation_id: z.string().uuid().nullable().optional(), content: z.string().min(1).max(12_000), model_id: z.string().uuid().nullable().optional(), mode_id: z.string().uuid().nullable().optional(),
  use_knowledge: z.boolean().optional(), upload_ids: z.array(z.string().uuid()).max(5).optional(), regenerate_message_id: z.string().uuid().nullable().optional(), edit_message_id: z.string().uuid().nullable().optional(),
});

/** Streaming chat (SSE). Events: meta, status, sources, token, done, error. */
router.post("/stream", rateLimit(60, 60, "chat"), async (c) => {
  const ctx = c.get("ctx");
  const body = ChatSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid chat request.", body.error.issues);
  const controller = new AbortController();
  return streamSSE(c, async (stream) => {
    stream.onAbort(() => controller.abort());
    const emit = async (e: ChatStreamEvent) => { await stream.writeSSE({ event: e.type, data: JSON.stringify(e) }); };
    try {
      await streamChat(ctx, ctx.user!, { ...body.data, signal: controller.signal }, emit);
    } catch (e) {
      const err = e instanceof AppError ? e : null;
      ctx.log.warn("chat_stream_error", { error: e as Error });
      await emit({ type: "error", code: err?.code ?? "INTERNAL_ERROR", message: err?.message ?? "Something went wrong.", ...(err?.details ? { details: err.details } : {}) } as ChatStreamEvent);
    }
  }, async (err, stream) => { ctx.log.error("sse_failure", { error: err }); await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", code: "STREAM_FAILED", message: "Stream failed." }) }); });
});

/** Non-streaming chat (API keys / integrations): same pipeline, returns the final message. */
router.post("/", rateLimit(60, 60, "chat"), async (c) => {
  const ctx = c.get("ctx");
  const body = ChatSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid chat request.", body.error.issues);
  let message: MessageDTO | null = null; let conversation_id: string | null = null; let error: ChatStreamEvent | null = null;
  await streamChat(ctx, ctx.user!, body.data, async (e) => { if (e.type === "meta") conversation_id = e.conversation_id; if (e.type === "done") message = e.message; if (e.type === "error") error = e; });
  if (error) throw new AppError((error as { code: string }).code, (error as { message: string }).message, 502);
  return ok(c, { conversation_id, message });
});

export default router;
