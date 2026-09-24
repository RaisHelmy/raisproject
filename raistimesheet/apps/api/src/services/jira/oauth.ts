/** Atlassian OAuth 2.0 (3LO) helpers. Client secret never leaves the Worker. */
import type { Bindings } from "../../env";
import { JiraApiError } from "./client";

export const JIRA_SCOPES = ["read:jira-work", "write:jira-work", "read:jira-user", "offline_access"];

export function oauthConfigured(env: Bindings): boolean {
  return !!(env.JIRA_OAUTH_CLIENT_ID && env.JIRA_OAUTH_CLIENT_SECRET);
}

export function redirectUri(env: Bindings, requestUrl: string): string {
  const u = new URL(requestUrl);
  return `${u.origin}${env.JIRA_OAUTH_REDIRECT_PATH || "/api/jira/oauth/callback"}`;
}

export function authorizeUrl(env: Bindings, state: string, redirect: string): string {
  const u = new URL("https://auth.atlassian.com/authorize");
  u.searchParams.set("audience", "api.atlassian.com");
  u.searchParams.set("client_id", env.JIRA_OAUTH_CLIENT_ID ?? "");
  u.searchParams.set("scope", JIRA_SCOPES.join(" "));
  u.searchParams.set("redirect_uri", redirect);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("prompt", "consent");
  return u.toString();
}

export interface TokenSet { access_token: string; refresh_token: string | null; expires_at: string }

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch("https://auth.atlassian.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new JiraApiError(`Atlassian token endpoint returned HTTP ${res.status}${t ? `: ${t.slice(0, 200)}` : ""}`, res.status, "JIRA_OAUTH_FAILED", res.status >= 500);
  }
  const j = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  return { access_token: j.access_token, refresh_token: j.refresh_token ?? null, expires_at: new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() };
}

export function exchangeCode(env: Bindings, code: string, redirect: string): Promise<TokenSet> {
  return tokenRequest({ grant_type: "authorization_code", client_id: env.JIRA_OAUTH_CLIENT_ID ?? "", client_secret: env.JIRA_OAUTH_CLIENT_SECRET ?? "", code, redirect_uri: redirect });
}

export function refreshToken(env: Bindings, refresh: string): Promise<TokenSet> {
  return tokenRequest({ grant_type: "refresh_token", client_id: env.JIRA_OAUTH_CLIENT_ID ?? "", client_secret: env.JIRA_OAUTH_CLIENT_SECRET ?? "", refresh_token: refresh });
}

export async function accessibleResources(accessToken: string): Promise<{ id: string; url: string; name: string }[]> {
  const res = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (!res.ok) throw new JiraApiError("Could not list accessible Jira sites.", res.status, "JIRA_OAUTH_FAILED", res.status >= 500);
  return (await res.json()) as { id: string; url: string; name: string }[];
}
