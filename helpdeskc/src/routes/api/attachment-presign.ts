import { tenantDb } from "../../db/client";
import { validateUploadRequest } from "../../core/attachments/policy";
import { uuidv7 } from "../../core/id/uuid7";
import { UnauthenticatedError, ValidationError } from "../../core/errors";
import { presignUpload } from "../../storage/r2-presign";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import { loadVisibleTicket } from "../ticket-access";
import type { RouteHandler } from "../router";

export const presignAttachmentUpload: RouteHandler = async (request, env, _ctx, params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();

  const { filename, sizeBytes } = (await request.json()) as { filename?: string; sizeBytes?: number };
  if (!filename || typeof sizeBytes !== "number") throw new ValidationError("filename and sizeBytes are required");

  // Validated server-side before issuing the URL (CLAUDE.md §11).
  const { extension, expectedContentType } = validateUploadRequest(filename, sizeBytes);

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const ticket = await loadVisibleTicket(db, authCtx, params.id!);

  // {tenant_id}/{ticket_id}/{uuid} — never the client's filename as a path (CLAUDE.md §11).
  const r2Key = `${data.tenantId}/${ticket.id}/${uuidv7()}${extension}`;

  const uploadUrl = await presignUpload(
    { accountId: env.CF_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    r2Key,
    expectedContentType,
  );

  return jsonResponse({ uploadUrl, r2Key, contentType: expectedContentType }, { status: 200 });
};
