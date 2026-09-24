/**
 * Suite-wide super-admin SSO token verifier (see the shared SSO protocol).
 *
 *   token = b64url(payloadJson) + "." + b64url(HMAC_SHA256(secret, b64url(payloadJson)))
 *
 * The HMAC key is the raw UTF-8 bytes of SAAS_SSO_SECRET (not hex-decoded).
 * Returns the (lower-cased) email on success, or null on ANY failure — the
 * caller never learns which check failed, and nothing is logged here.
 */
import { base64url, fromBase64url } from "./crypto";

const enc = new TextEncoder();

export async function verifySsoToken(token: string, secret: string, expectedApp: string): Promise<{ email: string } | null> {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let ok = false;
  try {
    const sigBytes = fromBase64url(sig);
    // Require the canonical encoding: atob() silently ignores the unused
    // trailing bits of the last sextet, so a few non-canonical spellings of
    // the same 32 bytes would otherwise decode to a valid signature. Not a
    // forgery risk, but any altered token must be rejected outright.
    if (sigBytes.byteLength !== 32 || base64url(sigBytes) !== sig) return null;
    // crypto.subtle.verify is constant-time.
    ok = await crypto.subtle.verify("HMAC", key, sigBytes as BufferSource, enc.encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  let p: { iss?: unknown; app?: unknown; email?: unknown; iat?: unknown; exp?: unknown };
  try {
    p = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
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
