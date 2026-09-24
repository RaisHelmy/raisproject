import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { requireAuth } from "../middleware";
import { ok, parsePage } from "../lib/http";
import { Errors } from "../lib/errors";
import { toConversationDTO, toMessageDTO } from "../services/mappers";
import { randomToken } from "../lib/crypto";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

router.get("/", async (c) => {
  const ctx = c.get("ctx"); const q = c.req.query(); const p = parsePage(q, 50, 200);
  const rows = await ctx.repos.conversations.list(ctx.user!.id, { search: q.search, archived: q.archived === "true", offset: p.offset, limit: p.page_size });
  return ok(c, { items: rows.map(toConversationDTO), total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size });
});

router.post("/", async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ title: z.string().max(120).optional(), model_id: z.string().uuid().nullable().optional(), mode_id: z.string().uuid().nullable().optional(), use_knowledge: z.boolean().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid conversation.");
  const conv = await ctx.repos.conversations.create({ user_id: ctx.user!.id, organization_id: ctx.user!.org_ids[0] ?? null, title: body.data.title ?? "New chat", model_id: body.data.model_id ?? null, mode_id: body.data.mode_id ?? null, use_knowledge: body.data.use_knowledge ?? true });
  return ok(c, toConversationDTO(conv!), undefined, 201);
});

router.get("/:id", async (c) => {
  const ctx = c.get("ctx");
  const conv = await ctx.repos.conversations.findById(c.req.param("id"), ctx.user!.id);
  if (!conv) throw Errors.notFound("Conversation");
  const msgs = await ctx.repos.messages.listForConversation(conv.id);
  const sources = await ctx.repos.messageSources.listForMessages(msgs.filter((m) => m.role === "assistant").map((m) => m.id));
  return ok(c, { conversation: toConversationDTO(conv), messages: msgs.map((m) => toMessageDTO(m, sources.filter((s) => s.message_id === m.id))) });
});

router.patch("/:id", async (c) => {
  const ctx = c.get("ctx");
  const conv = await ctx.repos.conversations.findById(c.req.param("id"), ctx.user!.id);
  if (!conv) throw Errors.notFound("Conversation");
  const body = z.object({ title: z.string().min(1).max(120).optional(), is_archived: z.boolean().optional(), is_pinned: z.boolean().optional(), model_id: z.string().uuid().nullable().optional(), mode_id: z.string().uuid().nullable().optional(), use_knowledge: z.boolean().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid update.");
  const updated = await ctx.repos.conversations.update(conv.id, body.data as never);
  return ok(c, toConversationDTO(updated!));
});

router.delete("/:id", async (c) => {
  const ctx = c.get("ctx");
  const conv = await ctx.repos.conversations.findById(c.req.param("id"), ctx.user!.id);
  if (!conv) throw Errors.notFound("Conversation");
  await ctx.repos.conversations.softDelete(conv.id, ctx.user!.id);
  return ok(c, { deleted: true });
});

router.post("/:id/share", async (c) => {
  const ctx = c.get("ctx");
  const conv = await ctx.repos.conversations.findById(c.req.param("id"), ctx.user!.id);
  if (!conv) throw Errors.notFound("Conversation");
  const token = conv.share_token ?? randomToken(18);
  const u = await ctx.repos.conversations.update(conv.id, { share_token: token, shared_at: new Date() as never });
  return ok(c, { share_token: token, url: `${ctx.env.WEB_ORIGIN}/share/${token}`, conversation: toConversationDTO(u!) });
});
router.delete("/:id/share", async (c) => {
  const ctx = c.get("ctx");
  const conv = await ctx.repos.conversations.findById(c.req.param("id"), ctx.user!.id);
  if (!conv) throw Errors.notFound("Conversation");
  await ctx.repos.conversations.update(conv.id, { share_token: null, shared_at: null });
  return ok(c, { shared: false });
});

/** Message-level actions: feedback, bookmark. */
router.patch("/:id/messages/:mid", async (c) => {
  const ctx = c.get("ctx");
  const conv = await ctx.repos.conversations.findById(c.req.param("id"), ctx.user!.id);
  if (!conv) throw Errors.notFound("Conversation");
  const m = await ctx.repos.messages.findById(c.req.param("mid"));
  if (!m || m.conversation_id !== conv.id) throw Errors.notFound("Message");
  const body = z.object({ feedback: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(), is_bookmarked: z.boolean().optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid update.");
  const u = await ctx.repos.messages.update(m.id, body.data as never);
  const sources = await ctx.repos.messageSources.listForMessages([m.id]);
  return ok(c, toMessageDTO(u!, sources));
});

export default router;
