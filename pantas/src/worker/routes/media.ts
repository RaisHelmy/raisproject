import { Hono } from "hono";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth } from "../middleware/auth";
import { newId } from "../../db/ids";
import { appendAuditLog } from "../../db/repositories/auditLog";
import { getRequestContext } from "../requestContext";

const media = new Hono<AppEnv>();
media.use("*", requireAuth);

const ALLOWED_KINDS = ["proof_of_delivery", "kyc", "vendor_image", "receipt"] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

/**
 * Proof of delivery (photo/signature) to R2, linked to the job — CLAUDE.md
 * "Jobs and matching". Also doubles as the general media upload path for
 * KYC docs, vendor images, and receipts, since they share the same
 * "binary blob linked to an entity" shape. R2 writes sit outside the D1
 * repository layer, so this route logs the upload directly via
 * appendAuditLog rather than through withAudit.
 */
media.post("/upload", async (c) => {
  const session = c.get("session")!;
  const kind = c.req.query("kind");
  const entityId = c.req.query("entityId");
  if (!kind || !ALLOWED_KINDS.includes(kind as Kind)) {
    return c.json({ error: `kind must be one of ${ALLOWED_KINDS.join(", ")}` }, 400);
  }
  if (!entityId) return c.json({ error: "entityId is required" }, 400);

  const contentType = c.req.header("Content-Type") ?? "application/octet-stream";
  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return c.json({ error: "empty body" }, 400);
  if (body.byteLength > 20 * 1024 * 1024) return c.json({ error: "file too large (20MB max)" }, 413);

  const key = `${kind}/${entityId}/${newId()}`;
  await c.env.MEDIA.put(key, body, { httpMetadata: { contentType } });

  const db = await createDb(c.env);
  const ctx = getRequestContext();
  await appendAuditLog(db, {
    actorUserId: session.userId,
    actorRole: session.activeRole,
    groupId: session.groupId,
    action: "media.upload",
    entityType: kind,
    entityId,
    afterJson: { key, contentType, sizeBytes: body.byteLength },
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
    requestId: c.get("requestId"),
    result: "success",
  });

  return c.json({ key }, 201);
});

/**
 * Streams the object back rather than buffering — required for anything
 * beyond trivially small files (see workers-best-practices: never
 * `await response.text()`/buffer unbounded payloads).
 */
media.get("/*", async (c) => {
  const key = c.req.path.replace(/^\/api\/media\//, "");
  const object = await c.env.MEDIA.get(key);
  if (!object) return c.json({ error: "not found" }, 404);
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export default media;
