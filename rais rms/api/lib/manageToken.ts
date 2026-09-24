/**
 * Stateless "magic link" token so a guest can view/cancel/reschedule their own
 * reservation without an account: HMAC-SHA256(JWT_SECRET, `${tenantId}:${reservationId}`),
 * hex-encoded and truncated. No DB column or extra table needed, and it's
 * automatically invalidated tenant-wide if JWT_SECRET is ever rotated.
 */
async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createManageToken(
  secret: string,
  tenantId: string,
  reservationId: string,
): Promise<string> {
  const full = await hmac(secret, `${tenantId}:${reservationId}`);
  return full.slice(0, 32);
}

export async function verifyManageToken(
  secret: string,
  tenantId: string,
  reservationId: string,
  token: string,
): Promise<boolean> {
  const expected = await createManageToken(secret, tenantId, reservationId);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
