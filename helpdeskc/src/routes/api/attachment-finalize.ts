import { tenantDb } from "../../db/client";
import { ALLOWED_EXTENSIONS, MAX_ATTACHMENT_BYTES, contentTypeMatchesExtension, extensionOf, sniffContentType } from "../../core/attachments/policy";
import { uuidv7 } from "../../core/id/uuid7";
import { UnauthenticatedError, ValidationError, ConflictError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import { loadVisibleTicket } from "../ticket-access";
import type { RouteHandler } from "../router";

/**
 * Registers an attachment after the client has PUT the bytes directly to
 * R2. Re-reads the object to sniff its actual content — the declared MIME
 * from presign time is never trusted on its own (CLAUDE.md §11).
 */
export const finalizeAttachmentUpload: RouteHandler = async (request, env, _ctx, params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();

  const { r2Key, filename } = (await request.json()) as { r2Key?: string; filename?: string };
  if (!r2Key || !filename) throw new ValidationError("r2Key and filename are required");
  // The key must be scoped to this tenant+ticket — reject anything else
  // outright rather than trusting the client-supplied key.
  if (!r2Key.startsWith(`${data.tenantId}/${params.id}/`)) throw new ValidationError("Invalid r2Key");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const ticket = await loadVisibleTicket(db, authCtx, params.id!);

  const head = await env.ATTACHMENTS.head(r2Key);
  if (!head) throw new ConflictError("Upload not found — did the PUT to the upload URL complete?");
  if (head.size > MAX_ATTACHMENT_BYTES) {
    await env.ATTACHMENTS.delete(r2Key);
    throw new ValidationError("File exceeds the size limit");
  }

  // Sniff only a small prefix rather than pulling the whole object into
  // memory (CLAUDE.md §3.4 — bounded CPU/memory per request).
  const sample = await env.ATTACHMENTS.get(r2Key, { range: { offset: 0, length: 4096 } });
  if (!sample) throw new ConflictError("Upload not found — did the PUT to the upload URL complete?");
  const sampleBytes = new Uint8Array(await sample.arrayBuffer());
  const sniffed = sniffContentType(sampleBytes);
  const extension = extensionOf(filename);
  if (!extension || !contentTypeMatchesExtension(sniffed, extension)) {
    await env.ATTACHMENTS.delete(r2Key);
    throw new ValidationError("File content does not match its extension");
  }

  const now = new Date().toISOString();
  const attachmentId = uuidv7();
  await db.attachments.create({
    id: attachmentId,
    ticketId: ticket.id,
    messageId: null,
    r2Key,
    filename,
    contentType: ALLOWED_EXTENSIONS[extension]!,
    sizeBytes: head.size,
    uploadedByType: authCtx.subjectType,
    uploadedById: authCtx.subjectId,
    createdAt: now,
  });

  await db.tenantUsage.incrementAttachmentBytes(head.size);

  return jsonResponse({ id: attachmentId }, { status: 201 });
};
