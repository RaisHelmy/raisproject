import { tenantDb } from "../../db/client";
import { generateToken, hashToken, MAGIC_LINK_TTL_SECONDS } from "../../core/auth/tokens";
import { uuidv7 } from "../../core/id/uuid7";
import { ValidationError } from "../../core/errors";
import { tenantUrl } from "../../core/domain/tenant-url";
import { enqueueEmail } from "../../jobs/email";
import { checkRateLimit } from "../rate-limit";
import { jsonResponse } from "../cookies";
import type { RouteHandler } from "../router";

const IDENTICAL_RESPONSE = { message: "If that email has an account, a sign-in link has been sent." };

/**
 * Request a magic link. Never reveals whether the email exists — the
 * response is identical either way (CLAUDE.md §7).
 */
export const requestMagicLink: RouteHandler = async (request, env, _ctx, _params, data) => {
  const { email } = (await request.json()) as { email?: string };
  if (!email) throw new ValidationError("email is required");
  const normalizedEmail = email.toLowerCase().trim();

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const emailOk = await checkRateLimit(env.KV, `magic-link:email:${data.tenantId}:${normalizedEmail}`, 5, 15 * 60);
  const ipOk = await checkRateLimit(env.KV, `magic-link:ip:${ip}`, 20, 15 * 60);
  if (!emailOk || !ipOk) {
    // Still return the identical response — rate limiting must not leak
    // whether the email exists either.
    return jsonResponse(IDENTICAL_RESPONSE, { status: 200 });
  }

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const contact = await db.contacts.findByEmail(normalizedEmail);

  if (contact) {
    await db.magicLinkTokens.invalidateActiveForEmail(normalizedEmail, data.hostname);

    const token = generateToken();
    const tokenHash = await hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_SECONDS * 1000);

    await db.magicLinkTokens.create({
      id: uuidv7(),
      contactId: contact.id,
      email: normalizedEmail,
      hostname: data.hostname,
      tokenHash,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    const magicLinkUrl = tenantUrl(
      { slug: data.tenant.slug, primaryHostname: data.hostname },
      `/auth/magic?token=${encodeURIComponent(token)}`,
    );
    await enqueueEmail(env.JOBS, { type: "magic_link", tenantId: data.tenantId, to: normalizedEmail, magicLinkUrl });
  }

  return jsonResponse(IDENTICAL_RESPONSE, { status: 200 });
};
