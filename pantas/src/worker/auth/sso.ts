/**
 * Super-admin SSO token verification for the suite landing page
 * (https://saas.raishelmy.uk/admin). The landing page mints a short-lived
 * HMAC-SHA256 token; this app verifies it and then mints its OWN normal
 * session (see routes/auth.ts GET /sso). No password is ever exchanged.
 *
 * Token format: b64url(payloadJson) + "." + b64url(HMAC_SHA256(secret, b64url(payloadJson)))
 * HMAC key = raw UTF-8 bytes of SAAS_SSO_SECRET (not hex-decoded).
 */

export const SSO_APP_ID = "pantas";

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface SsoPayload {
  iss?: unknown;
  app?: unknown;
  email?: unknown;
  iat?: unknown;
  exp?: unknown;
  nonce?: unknown;
}

export async function verifySsoToken(
  token: string,
  secret: string,
  expectedApp: string,
): Promise<{ email: string } | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let ok = false;
  try {
    // crypto.subtle.verify is constant-time.
    ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), new TextEncoder().encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  let p: SsoPayload;
  try {
    p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as SsoPayload;
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (p?.iss !== "saas-landing" || p?.app !== expectedApp) return null;
  if (typeof p.exp !== "number" || typeof p.iat !== "number") return null;
  if (now > p.exp || p.iat > now + 60) return null;
  if (typeof p.email !== "string" || !p.email) return null;
  return { email: p.email.toLowerCase() };
}
