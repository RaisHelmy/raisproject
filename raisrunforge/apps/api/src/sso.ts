/**
 * Super-admin SSO token verification for the Raishelmy SaaS landing page
 * (https://saas.raishelmy.uk/admin). The landing page mints
 * `b64url(payload) + "." + b64url(HMAC_SHA256(SAAS_SSO_SECRET, b64url(payload)))`
 * and redirects the browser to `GET /api/auth/sso?token=...` on this API.
 *
 * Verification is done with Web Crypto only (works unchanged in Workers).
 * The HMAC key is the raw UTF-8 bytes of the secret string (not hex-decoded).
 */

export const SSO_APP_ID = "runforge";
export const SSO_ISSUER = "saas-landing";

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Returns the (lower-cased) email carried by a valid token, or null when the
 * token is malformed, has a bad signature, is for another app/issuer, is
 * expired, or was issued too far in the future.
 */
export async function verifySsoToken(token: string, secret: string, expectedApp: string = SSO_APP_ID): Promise<{ email: string } | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let ok = false;
  try {
    // crypto.subtle.verify is constant-time.
    ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), new TextEncoder().encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  let p: any;
  try {
    p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (p?.iss !== SSO_ISSUER || p?.app !== expectedApp) return null;
  if (typeof p.exp !== "number" || typeof p.iat !== "number") return null;
  if (now > p.exp || p.iat > now + 60) return null;
  if (typeof p.email !== "string" || !p.email) return null;
  return { email: p.email.toLowerCase() };
}
