import { Hono } from "hono";
import { SUPPORTED_UPLOAD_TYPES } from "@xuanzhi/shared-types";
import type { HonoEnv } from "../middleware";
import { rateLimit, requireAuth } from "../middleware";
import { ok } from "../lib/http";
import { Errors } from "../lib/errors";
import { entitlements } from "../services/entitlements";
import { toFileUploadDTO } from "../services/mappers";
import { kindFor } from "../services/knowledge/extract";
import { uuid } from "../lib/ids";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

const CHAT_TYPES = new Set(["pdf", "docx", "txt", "md"]);

/** Upload a document to ask questions about it in chat (plan-gated). Processing happens in the background. */
router.post("/upload", rateLimit(30, 3600, "upload"), async (c) => {
  const ctx = c.get("ctx");
  const gate = await entitlements(ctx).canUploadFile(ctx.user!);
  if (!gate.allowed) throw Errors.upgradeRequired(gate.reason ?? "File upload is not available on your plan.", gate.required_plan ?? null, "file_upload");
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) throw Errors.validation("Attach a file in the `file` field.");
  const max = Number(ctx.env.MAX_UPLOAD_BYTES || "26214400");
  if (file.size > max) throw Errors.tooLarge(max);
  const kind = kindFor(file.type, file.name);
  if (!kind || !CHAT_TYPES.has(kind)) throw Errors.unsupported("Supported chat attachments: PDF, DOCX, TXT, Markdown.");
  const mime = file.type || Object.entries(SUPPORTED_UPLOAD_TYPES).find(([, v]) => v === kind)?.[0] || "application/octet-stream";
  const key = `uploads/${ctx.user!.id}/${uuid()}-${file.name.replace(/[^\w.\-一-鿿]+/g, "_").slice(0, 120)}`;
  await ctx.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: mime } });
  const conversationId = typeof form.conversation_id === "string" && form.conversation_id ? form.conversation_id : null;
  const up = (await ctx.repos.uploads.create({ user_id: ctx.user!.id, conversation_id: conversationId, filename: file.name.slice(0, 200), mime_type: mime, size: file.size, file_key: key }))!;
  await ctx.enqueue({ type: "PROCESS_UPLOAD", upload_id: up.id, correlation_id: ctx.correlationId });
  return ok(c, toFileUploadDTO(up), undefined, 201);
});

router.get("/:id", async (c) => {
  const ctx = c.get("ctx");
  const up = await ctx.repos.uploads.findById(c.req.param("id"), ctx.user!.id);
  if (!up) throw Errors.notFound("Upload");
  return ok(c, toFileUploadDTO(up));
});

export default router;
