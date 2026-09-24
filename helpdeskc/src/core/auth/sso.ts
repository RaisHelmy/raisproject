// Super-admin SSO token verification (shared protocol with the
// saas.raishelmy.uk landing page). Pure Web Crypto — no bindings, so it
// stays in core/ and is unit-testable.
//
//   token = b64url(payloadJson) + "." + b64url(HMAC_SHA256(secret, b64url(payloadJson)))
//
// The HMAC key is the raw UTF-8 bytes of the secret string, not hex-decoded.

export const SSO_ISSUER = "saas-landing";
export const SSO_APP_ID = "helpdesk";

/** Tokens minted more than this far in the future are rejected (clock skew guard). */
const MAX_FUTURE_IAT_SECONDS = 60;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifySsoToken(
  token: string,
  secret: string,
  expectedApp: string = SSO_APP_ID,
  nowSeconds: number = Math.floor(Date.now() / 1000),
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
  // crypto.subtle.verify is constant-time; never compare signature strings.
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), new TextEncoder().encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;

  let p: unknown;
  try {
    p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
  } catch {
    return null;
  }
  if (typeof p !== "object" || p === null) return null;
  const claims = p as Record<string, unknown>;

  if (claims.iss !== SSO_ISSUER || claims.app !== expectedApp) return null;
  if (typeof claims.exp !== "number" || typeof claims.iat !== "number") return null;
  if (nowSeconds > claims.exp || claims.iat > nowSeconds + MAX_FUTURE_IAT_SECONDS) return null;
  if (typeof claims.email !== "string" || !claims.email) return null;

  return { email: claims.email.toLowerCase() };
}
