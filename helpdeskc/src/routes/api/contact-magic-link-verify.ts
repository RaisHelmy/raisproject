import { tenantDb } from "../../db/client";
import { generateToken, hashToken, CONTACT_SESSION_TTL_SECONDS } from "../../core/auth/tokens";
import { uuidv7 } from "../../core/id/uuid7";
import { UnauthenticatedError, ValidationError } from "../../core/errors";
import { sessionCookie, jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

export const verifyMagicLink: RouteHandler = async (request, env, _ctx, _params, data) => {
  const { token } = (await request.json()) as { token?: string };
  if (!token) throw new ValidationError("token is required");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const tokenHash = await hashToken(token);
  const record = await db.magicLinkTokens.findByTokenHash(tokenHash);

  // Single-use, short expiry, bound to this tenant AND this hostname
  // (CLAUDE.md §7) — a token issued for tenant A / host A must fail
  // everywhere else, including a different hostname of the same tenant.
  if (
    !record ||
    record.consumedAt ||
    record.invalidatedAt ||
    record.hostname !== data.hostname ||
    Date.parse(record.expiresAt) <= Date.now() ||
    !record.contactId
  ) {
    throw new UnauthenticatedError("This link is invalid or has expired");
  }

  await db.magicLinkTokens.consume(record.id);

  const sessionToken = generateToken();
  const sessionTokenHash = await hashToken(sessionToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONTACT_SESSION_TTL_SECONDS * 1000);

  await db.sessions.create({
    id: uuidv7(),
    subjectType: "contact",
    subjectId: record.contactId,
    hostname: data.hostname,
    tokenHash: sessionTokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return jsonResponse(
    { contactId: record.contactId },
    { status: 200, headers: { "Set-Cookie": sessionCookie(sessionToken, CONTACT_SESSION_TTL_SECONDS) } },
  );
};
