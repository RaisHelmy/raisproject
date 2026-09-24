import type { AppContext, AuthUser } from "./context";
import { Errors } from "../lib/errors";
import { hashPassword, randomToken, sha256Hex, verifyPassword } from "../lib/crypto";
import { audit } from "./audit";
import { emailSender, layout } from "./email";
import { toUserDTO } from "./mappers";
import type { UserRow } from "../repositories/types";
import type { UserDTO } from "@xuanzhi/shared-types";

export interface SessionResult { token: string; expires_at: string; user: UserDTO }

export async function createSession(ctx: AppContext, user: UserRow, userAgent: string | null): Promise<SessionResult> {
  const token = randomToken(32);
  const ttlHours = Number(ctx.env.SESSION_TTL_HOURS ?? "336") || 336;
  const expires_at = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  await ctx.repos.sessions.create({ user_id: user.id, token_hash: await sha256Hex(token), expires_at, user_agent: userAgent?.slice(0, 200) ?? null, ip: ctx.ip });
  await ctx.repos.users.update(user.id, { last_login_at: new Date().toISOString() });
  return { token, expires_at, user: toUserDTO(user) };
}

export function validatePassword(pw: string) {
  if (pw.length < 8) throw Errors.validation("Password must be at least 8 characters.");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw Errors.validation("Password must contain letters and numbers.");
}

export async function register(ctx: AppContext, input: { email: string; password: string; name: string; locale?: string }, userAgent: string | null): Promise<SessionResult & { verification_sent: boolean }> {
  const email = input.email.trim().toLowerCase();
  validatePassword(input.password);
  if (await ctx.repos.users.findByEmail(email)) throw Errors.conflict("An account with this email already exists. Try signing in.");
  const sender = emailSender(ctx);
  const isFirst = (await ctx.repos.users.count()) === 0;
  const user = await ctx.repos.users.create({ email, name: input.name.trim().slice(0, 100), password_hash: await hashPassword(input.password), locale: input.locale, email_verified: !sender.configured, role: isFirst ? "super_admin" : "user" });
  await audit(ctx, { action: "user.register", resource_type: "user", resource_id: user.id, actor_id: user.id, details: { method: "password", first_user: isFirst } });
  let verification_sent = false;
  if (sender.configured) { await sendVerification(ctx, user); verification_sent = true; }
  const s = await createSession(ctx, user, userAgent);
  return { ...s, verification_sent };
}

export async function login(ctx: AppContext, email: string, password: string, userAgent: string | null): Promise<SessionResult> {
  const user = await ctx.repos.users.findByEmail(email.trim());
  const okPw = await verifyPassword(password, user?.password_hash);
  if (!user || !okPw || !user.is_active) {
    ctx.log.warn("auth_failed", { email_domain: email.split("@")[1] ?? "" });
    await audit(ctx, { action: "user.login_failed", resource_type: "user", resource_id: user?.id ?? null, actor_id: null, result: "error", details: { email_domain: email.split("@")[1] ?? "" } });
    throw Errors.unauthorized("Incorrect email or password.");
  }
  await audit(ctx, { action: "user.login", resource_type: "user", resource_id: user.id, actor_id: user.id });
  return createSession(ctx, user, userAgent);
}

export async function logout(ctx: AppContext, token: string | undefined): Promise<void> {
  if (token) await ctx.repos.sessions.deleteByTokenHash(await sha256Hex(token));
}

export async function sendVerification(ctx: AppContext, user: UserRow): Promise<void> {
  const token = randomToken(32);
  await ctx.repos.emailTokens.create({ user_id: user.id, purpose: "verify", token_hash: await sha256Hex(token), expires_at: new Date(Date.now() + 24 * 3600e3).toISOString() });
  const url = `${ctx.env.WEB_ORIGIN}/verify?token=${token}`;
  await emailSender(ctx).send({ to: user.email, subject: "Verify your XuanZhi AI email", text: `Verify your email: ${url}`, html: layout("Verify your email", `<p>Welcome, ${user.name}. Please confirm your email address:</p><p><a href="${url}" style="background:#a8322d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Verify email</a></p><p style="font-size:12px;color:#8a7d6a">${url}</p>`) });
}

export async function verifyEmail(ctx: AppContext, token: string): Promise<UserDTO> {
  const t = await ctx.repos.emailTokens.consume(await sha256Hex(token), "verify");
  if (!t) throw Errors.validation("This verification link is invalid or has expired.");
  const u = await ctx.repos.users.update(t.user_id, { email_verified_at: new Date().toISOString() });
  await audit(ctx, { action: "user.email_verified", resource_type: "user", resource_id: t.user_id, actor_id: t.user_id });
  return toUserDTO(u!);
}

export async function requestPasswordReset(ctx: AppContext, email: string): Promise<{ email_configured: boolean }> {
  const sender = emailSender(ctx);
  const user = await ctx.repos.users.findByEmail(email.trim());
  if (user && user.is_active) {
    const token = randomToken(32);
    await ctx.repos.emailTokens.create({ user_id: user.id, purpose: "reset", token_hash: await sha256Hex(token), expires_at: new Date(Date.now() + 2 * 3600e3).toISOString() });
    const url = `${ctx.env.WEB_ORIGIN}/reset-password?token=${token}`;
    await sender.send({ to: user.email, subject: "Reset your XuanZhi AI password", text: `Reset your password: ${url}`, html: layout("Reset your password", `<p>We received a request to reset the password for ${user.email}.</p><p><a href="${url}" style="background:#a8322d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Choose a new password</a></p><p style="font-size:12px;color:#8a7d6a">This link expires in 2 hours.</p>`) });
    await audit(ctx, { action: "user.password_reset_requested", resource_type: "user", resource_id: user.id, actor_id: user.id });
  }
  return { email_configured: sender.configured };
}

export async function resetPassword(ctx: AppContext, token: string, password: string): Promise<void> {
  validatePassword(password);
  const t = await ctx.repos.emailTokens.consume(await sha256Hex(token), "reset");
  if (!t) throw Errors.validation("This reset link is invalid or has expired.");
  await ctx.repos.users.update(t.user_id, { password_hash: await hashPassword(password) });
  await ctx.repos.sessions.deleteAllForUser(t.user_id);
  await audit(ctx, { action: "user.password_reset", resource_type: "user", resource_id: t.user_id, actor_id: t.user_id });
}

export async function changePassword(ctx: AppContext, user: AuthUser, current: string, next: string): Promise<void> {
  const row = await ctx.repos.users.findById(user.id);
  if (!row) throw Errors.unauthorized();
  if (row.password_hash && !(await verifyPassword(current, row.password_hash))) throw Errors.validation("Current password is incorrect.");
  validatePassword(next);
  await ctx.repos.users.update(user.id, { password_hash: await hashPassword(next) });
  await audit(ctx, { action: "user.password_changed", resource_type: "user", resource_id: user.id });
}

export async function createApiKey(ctx: AppContext, user: AuthUser, name: string): Promise<{ id: string; key: string; key_prefix: string }> {
  const key = `xz_${randomToken(32)}`;
  const key_prefix = key.slice(0, 10);
  const row = (await ctx.repos.apiKeys.create({ user_id: user.id, organization_id: user.org_ids[0] ?? null, name: name.slice(0, 80), key_prefix, key_hash: await sha256Hex(key) }))!;
  await audit(ctx, { action: "user.api_key_created", resource_type: "api_key", resource_id: row.id, details: { name } });
  return { id: row.id, key, key_prefix };
}
