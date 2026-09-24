import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne, recordAudit } from "../../core/db";
import { requireAuth } from "../../core/middleware";
import { canUploadToRecord, canViewRecordAttachments } from "./service";
import type { Attachment } from "./types";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const auth = c.get("auth");
  const module = c.req.query("module");
  const recordId = c.req.query("recordId");
  if (!module || !recordId) return c.json({ error: "module and recordId are required" }, 400);

  if (!(await canViewRecordAttachments(c.env.DB, auth, module, recordId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const attachments = await queryAll<Attachment>(
    c.env.DB,
    `SELECT * FROM attachments WHERE tenant_id = ? AND module = ? AND record_id = ? ORDER BY created_at`,
    [auth.tenantId, module, recordId],
  );
  return c.json({ attachments });
});

app.post("/", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;

  const body = await c.req.parseBody().catch(() => null);
  const file = body?.file;
  const module = typeof body?.module === "string" ? body.module : null;
  const recordId = typeof body?.recordId === "string" ? body.recordId : null;

  if (!(file instanceof File) || !module || !recordId) {
    return c.json({ error: "file, module, and recordId are required" }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return c.json({ error: "File exceeds the 10MB limit" }, 400);
  }
  if (!(await canUploadToRecord(db, auth, module, recordId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const id = newId();
  const r2Key = `${auth.tenantId}/${module}/${recordId}/${id}-${file.name}`;
  await c.env.ATTACHMENTS.put(r2Key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  await exec(
    db,
    `INSERT INTO attachments (id, tenant_id, module, record_id, file_name, content_type, size_bytes, r2_key, uploaded_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, module, recordId, file.name, file.type || "application/octet-stream", file.size, r2Key, auth.userId],
  );

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module,
    recordId,
    action: "attachment_uploaded",
    actorUserId: auth.userId,
    remarks: file.name,
  });

  const attachment = await queryOne<Attachment>(db, `SELECT * FROM attachments WHERE id = ?`, [id]);
  return c.json({ attachment }, 201);
});

app.get("/:id/download", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const attachment = await queryOne<Attachment>(
    db,
    `SELECT * FROM attachments WHERE id = ? AND tenant_id = ?`,
    [c.req.param("id"), auth.tenantId],
  );
  if (!attachment) return c.json({ error: "Not found" }, 404);
  if (!(await canViewRecordAttachments(db, auth, attachment.module, attachment.record_id))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const object = await c.env.ATTACHMENTS.get(attachment.r2_key);
  if (!object) return c.json({ error: "File is missing from storage" }, 404);

  return new Response(object.body, {
    headers: {
      "Content-Type": attachment.content_type,
      "Content-Disposition": `attachment; filename="${attachment.file_name}"`,
      "Content-Length": String(attachment.size_bytes),
    },
  });
});

app.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const attachment = await queryOne<Attachment>(
    db,
    `SELECT * FROM attachments WHERE id = ? AND tenant_id = ?`,
    [c.req.param("id"), auth.tenantId],
  );
  if (!attachment) return c.json({ error: "Not found" }, 404);

  const isOwner = attachment.uploaded_by_user_id === auth.userId;
  const isAdmin = auth.role === "admin" || auth.role === "hr";
  if (!isOwner && !isAdmin) return c.json({ error: "Forbidden" }, 403);

  await c.env.ATTACHMENTS.delete(attachment.r2_key);
  await exec(db, `DELETE FROM attachments WHERE id = ?`, [attachment.id]);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: attachment.module,
    recordId: attachment.record_id,
    action: "attachment_deleted",
    actorUserId: auth.userId,
    remarks: attachment.file_name,
  });

  return c.json({ ok: true });
});

export default app;
