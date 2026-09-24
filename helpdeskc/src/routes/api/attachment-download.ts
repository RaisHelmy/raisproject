import { tenantDb } from "../../db/client";
import { UnauthenticatedError, NotFoundError } from "../../core/errors";
import { presignDownload } from "../../storage/r2-presign";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import { loadVisibleTicket } from "../ticket-access";
import type { RouteHandler } from "../router";

/** Never a public bucket — authorised against ticket scope on every request (CLAUDE.md §11), not cached. */
export const downloadAttachment: RouteHandler = async (_request, env, _ctx, params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const attachment = await db.attachments.get(params.id!);
  if (!attachment || !attachment.ticketId) throw new NotFoundError("Attachment");

  await loadVisibleTicket(db, authCtx, attachment.ticketId);

  const url = await presignDownload(
    { accountId: env.CF_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    attachment.r2Key,
    attachment.filename,
  );

  return jsonResponse({ url }, { status: 200 });
};
