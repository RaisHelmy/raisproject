import { Hono } from "hono";
import type { HonoEnv } from "../middleware";
import { rateLimit } from "../middleware";
import { ok } from "../lib/http";
import { Errors } from "../lib/errors";
import { toMessageDTO } from "../services/mappers";

const router = new Hono<HonoEnv>();

/** Public read-only view of a shared conversation. No user identity is exposed. */
router.get("/:token", rateLimit(60, 60, "share"), async (c) => {
  const ctx = c.get("ctx");
  const conv = await ctx.repos.conversations.findByShareToken(c.req.param("token"));
  if (!conv) throw Errors.notFound("Shared conversation");
  const msgs = (await ctx.repos.messages.listForConversation(conv.id)).filter((m) => m.status === "complete" || m.status === "stopped");
  const sources = await ctx.repos.messageSources.listForMessages(msgs.map((m) => m.id));
  const model = conv.model_id ? await ctx.repos.models.findById(conv.model_id) : null;
  return ok(c, { title: conv.title, shared_at: conv.shared_at, model_name: model?.name ?? null, messages: msgs.map((m) => ({ ...toMessageDTO(m, sources.filter((s) => s.message_id === m.id)), attachments: [] })) });
});

export default router;
