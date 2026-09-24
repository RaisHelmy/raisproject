import type { AppContext } from "./context";
import { Errors } from "../lib/errors";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "../lib/crypto";
import { uuid } from "../lib/ids";
import { nowIso } from "../lib/time";
import { audit } from "./audit";
import { toUserDTO } from "./mappers";
import type { UserDTO } from "@rais/shared-types";

export async function login(ctx: AppContext, email: string, password: string, userAgent: string | null): Promise<{ token: string; expires_at: string; user: UserDTO }> {
  const user = await ctx.repos.users.findByEmail(email);
  // Always verify against something to keep timing uniform.
  const okPw = user ? await verifyPassword(password, user.password_hash) : await verifyPassword(password, "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!user || !okPw || !user.is_active) {
    ctx.log.warn("auth_failed", { email_domain: email.split("@")[1] ?? "" });
    throw Errors.unauthorized("Incorrect email or password.");
  }
  return createSession(ctx, user, userAgent, "login");
}

/**
 * Suite-wide super-admin SSO (token already verified by the caller). Creates
 * exactly the same session row as a password login; only the audit action
 * differs so SSO logins are distinguishable in the audit trail.
 */
export async function ssoLogin(ctx: AppContext, email: string, userAgent: string | null): Promise<{ token: string; expires_at: string; user: UserDTO }> {
  const user = await ctx.repos.users.findByEmail(email);
  if (!user || !user.is_active) {
    ctx.log.warn("sso_failed", { email_domain: email.split("@")[1] ?? "" });
    throw Errors.forbidden("No active account for this SSO identity.");
  }
  return createSession(ctx, user, userAgent, "login_sso");
}

/** The one place a cookie session is minted — shared by password login and SSO. */
async function createSession(ctx: AppContext, user: NonNullable<Awaited<ReturnType<AppContext["repos"]["users"]["findByEmail"]>>>, userAgent: string | null, action: "login" | "login_sso"): Promise<{ token: string; expires_at: string; user: UserDTO }> {
  const token = randomToken(32);
  const ttlHours = Number(ctx.env.SESSION_TTL_HOURS ?? "168") || 168;
  const expires_at = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  await ctx.repos.sessions.create({ id: uuid(), user_id: user.id, token_hash: await sha256Hex(token), expires_at, created_at: nowIso(), user_agent: userAgent?.slice(0, 200) ?? null });
  await audit(ctx, { entity_type: "session", entity_id: user.id, action, actor_id: user.id });
  const roles = await ctx.repos.users.rolesFor(user.id);
  return { token, expires_at, user: toUserDTO(user, roles) };
}

export async function logout(ctx: AppContext, token: string | undefined): Promise<void> {
  if (token) await ctx.repos.sessions.deleteByTokenHash(await sha256Hex(token));
  if (ctx.user) await audit(ctx, { entity_type: "session", entity_id: ctx.user.id, action: "logout" });
}

export async function changePassword(ctx: AppContext, current: string, next: string): Promise<void> {
  const u = ctx.user!;
  const row = await ctx.repos.users.findById(u.id);
  if (!row || !(await verifyPassword(current, row.password_hash))) throw Errors.validation("Current password is incorrect.");
  if (next.length < 10) throw Errors.validation("New password must be at least 10 characters.");
  await ctx.repos.users.update(u.id, { password_hash: await hashPassword(next), updated_at: nowIso(), updated_by: u.id });
  await audit(ctx, { entity_type: "user", entity_id: u.id, action: "password_changed" });
}

export async function createApiToken(ctx: AppContext, name: string): Promise<{ id: string; token: string }> {
  const token = `rts_${randomToken(32)}`;
  const id = uuid();
  await ctx.repos.sessions.createApiToken({ id, user_id: ctx.user!.id, name: name.slice(0, 80), token_hash: await sha256Hex(token), created_at: nowIso(), last_used_at: null });
  await audit(ctx, { entity_type: "user", entity_id: ctx.user!.id, action: "api_token_created", after: { name } });
  return { id, token };
}

export async function revokeApiToken(ctx: AppContext, id: string): Promise<void> {
  await ctx.repos.sessions.deleteApiToken(id, ctx.user!.id);
  await audit(ctx, { entity_type: "user", entity_id: ctx.user!.id, action: "api_token_revoked", after: { id } });
}
