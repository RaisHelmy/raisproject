import { tenantDb } from "../../db/client";
import { verifyPassword } from "../../core/auth/password";
import { generateToken, hashToken, CONTACT_SESSION_TTL_SECONDS } from "../../core/auth/tokens";
import { uuidv7 } from "../../core/id/uuid7";
import { UnauthenticatedError, ValidationError } from "../../core/errors";
import { sessionCookie, jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

export const contactPasswordLogin: RouteHandler = async (request, env, _ctx, _params, data) => {
  const { email, password } = (await request.json()) as { email?: string; password?: string };
  if (!email || !password) throw new ValidationError("email and password are required");

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const contact = await db.contacts.findByEmail(email.toLowerCase().trim());
  // A Contact who has only ever used magic link has no passwordHash yet
  // (CLAUDE.md §7) — treat that the same as a wrong password.
  const ok = contact?.passwordHash
    ? await verifyPassword(password, contact.passwordHash)
    : await verifyPassword(password, "pbkdf2$1$AA$AA");
  if (!contact || !contact.passwordHash || !ok) throw new UnauthenticatedError("Invalid email or password");

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CONTACT_SESSION_TTL_SECONDS * 1000);

  await db.sessions.create({
    id: uuidv7(),
    subjectType: "contact",
    subjectId: contact.id,
    hostname: data.hostname,
    tokenHash,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return jsonResponse(
    { contactId: contact.id },
    { status: 200, headers: { "Set-Cookie": sessionCookie(token, CONTACT_SESSION_TTL_SECONDS) } },
  );
};
