/**
 * OAuth 2.0 / OpenID Connect sign-in: Google, Microsoft (common tenant), Apple. Authorization-code flow with PKCE + state stored
 * server-side. Identity comes from the ID token (Apple/Google/Microsoft all issue one); we only trust the `sub` + verified email.
 */
import type { AppContext } from "./context";
import { Errors } from "../lib/errors";
import { base64url, decodeJwtPayload, randomToken, signJwtES256 } from "../lib/crypto";
import { audit } from "./audit";
import { createSession, type SessionResult } from "./auth";

export type OAuthProviderCode = "google" | "microsoft" | "apple";

interface ProviderDef { authUrl: string; tokenUrl: string; scope: string; clientId?: string; clientSecret?: string; responseMode?: string }

export function providerDefs(ctx: AppContext): Record<OAuthProviderCode, ProviderDef | null> {
  const e = ctx.env;
  return {
    google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { authUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scope: "openid email profile", clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : null,
    microsoft: e.MICROSOFT_CLIENT_ID && e.MICROSOFT_CLIENT_SECRET ? { authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", scope: "openid email profile", clientId: e.MICROSOFT_CLIENT_ID, clientSecret: e.MICROSOFT_CLIENT_SECRET } : null,
    apple: e.APPLE_CLIENT_ID && e.APPLE_TEAM_ID && e.APPLE_KEY_ID && e.APPLE_PRIVATE_KEY ? { authUrl: "https://appleid.apple.com/auth/authorize", tokenUrl: "https://appleid.apple.com/auth/token", scope: "name email", clientId: e.APPLE_CLIENT_ID, responseMode: "form_post" } : null,
  };
}

export function enabledProviders(ctx: AppContext): OAuthProviderCode[] { return (Object.entries(providerDefs(ctx)).filter(([, v]) => v) as [OAuthProviderCode, ProviderDef][]).map(([k]) => k); }

function redirectUri(ctx: AppContext, provider: string) { return `${ctx.env.API_ORIGIN}/api/auth/oauth/${provider}/callback`; }

export async function startOAuth(ctx: AppContext, provider: OAuthProviderCode, redirectTo: string | null): Promise<string> {
  const def = providerDefs(ctx)[provider];
  if (!def) throw Errors.notConfigured(`${provider} sign-in is not configured.`);
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  await ctx.repos.oauth.saveState({ state, provider, code_verifier: verifier, redirect_to: redirectTo });
  const u = new URL(def.authUrl);
  u.searchParams.set("client_id", def.clientId!); u.searchParams.set("redirect_uri", redirectUri(ctx, provider)); u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", def.scope); u.searchParams.set("state", state);
  if (provider !== "apple") { u.searchParams.set("code_challenge", challenge); u.searchParams.set("code_challenge_method", "S256"); }
  if (def.responseMode) u.searchParams.set("response_mode", def.responseMode);
  if (provider === "google") u.searchParams.set("prompt", "select_account");
  return u.toString();
}

async function appleClientSecret(ctx: AppContext): Promise<string> {
  const e = ctx.env; const now = Math.floor(Date.now() / 1000);
  return signJwtES256({ iss: e.APPLE_TEAM_ID, iat: now, exp: now + 3600, aud: "https://appleid.apple.com", sub: e.APPLE_CLIENT_ID }, { kid: e.APPLE_KEY_ID }, e.APPLE_PRIVATE_KEY!);
}

export async function completeOAuth(ctx: AppContext, provider: OAuthProviderCode, code: string, state: string, userAgent: string | null, appleUser?: { name?: { firstName?: string; lastName?: string } } | null): Promise<SessionResult & { redirect_to: string | null }> {
  const def = providerDefs(ctx)[provider];
  if (!def) throw Errors.notConfigured(`${provider} sign-in is not configured.`);
  const st = await ctx.repos.oauth.consumeState(state);
  if (!st || st.provider !== provider) throw Errors.validation("Sign-in session expired. Please try again.");
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(ctx, provider), client_id: def.clientId! });
  if (provider === "apple") body.set("client_secret", await appleClientSecret(ctx)); else { body.set("client_secret", def.clientSecret!); if (st.code_verifier) body.set("code_verifier", st.code_verifier); }
  const r = await fetch(def.tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) { ctx.log.warn("oauth_token_failed", { provider, status: r.status }); throw Errors.unauthorized("Sign-in failed. Please try again."); }
  const tok = (await r.json()) as { id_token?: string; access_token?: string };
  const claims = tok.id_token ? decodeJwtPayload<{ sub: string; email?: string; email_verified?: boolean | string; name?: string; given_name?: string; family_name?: string; picture?: string; preferred_username?: string }>(tok.id_token) : null;
  if (!claims?.sub) throw Errors.unauthorized("Sign-in failed (no identity token).");
  const email = (claims.email ?? claims.preferred_username ?? "").toLowerCase();
  const name = claims.name ?? [claims.given_name ?? appleUser?.name?.firstName, claims.family_name ?? appleUser?.name?.lastName].filter(Boolean).join(" ") ?? email.split("@")[0] ?? "User";

  let linked = await ctx.repos.oauth.find(provider, claims.sub);
  let user = linked ? await ctx.repos.users.findById(linked.user_id) : null;
  if (!user) {
    if (!email) throw Errors.unauthorized("Your identity provider did not share an email address.");
    user = await ctx.repos.users.findByEmail(email);
    if (!user) {
      const isFirst = (await ctx.repos.users.count()) === 0;
      user = await ctx.repos.users.create({ email, name: name || email, password_hash: null, avatar_url: claims.picture ?? null, email_verified: true, role: isFirst ? "super_admin" : "user" });
      await audit(ctx, { action: "user.register", resource_type: "user", resource_id: user.id, actor_id: user.id, details: { method: provider } });
    } else if (!user.email_verified_at) await ctx.repos.users.update(user.id, { email_verified_at: new Date().toISOString() });
    await ctx.repos.oauth.link({ user_id: user.id, provider, provider_account_id: claims.sub, email: email || null });
    linked = await ctx.repos.oauth.find(provider, claims.sub);
  }
  if (!user.is_active) throw Errors.forbidden("This account is disabled.");
  await audit(ctx, { action: "user.login", resource_type: "user", resource_id: user.id, actor_id: user.id, details: { method: provider } });
  const s = await createSession(ctx, user, userAgent);
  return { ...s, redirect_to: st.redirect_to };
}
