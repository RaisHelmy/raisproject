import { tenantDb } from "../../db/client";
import { hashPassword } from "../../core/auth/password";
import { UnauthenticatedError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

/**
 * A Contact can set a password at any time without disabling magic link
 * (CLAUDE.md §7) — this keeps the same Contact ID and ticket history since
 * it updates the existing row rather than creating one.
 */
export const setContactPassword: RouteHandler = async (request, env, _ctx, _params, data) => {
  if (!data.session || data.session.subjectType !== "contact") {
    throw new UnauthenticatedError();
  }
  const { password } = (await request.json()) as { password?: string };
  if (!password || password.length < 8) throw new ValidationError("password must be at least 8 characters");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const passwordHash = await hashPassword(password);
  await db.contacts.setPasswordHash(data.session.subjectId, passwordHash);

  return jsonResponse({ ok: true }, { status: 200 });
};
