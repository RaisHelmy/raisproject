/**
 * PBKDF2-SHA256 password hashing via WebCrypto (available in every Workers
 * runtime, no nodejs_compat needed). Format: pbkdf2$<iterations>$<saltB64>$<hashB64>
 */
// Workers' WebCrypto PBKDF2 implementation caps iterations at 100,000;
// verifyPassword reads the iteration count from the stored hash itself, so
// this only affects newly-hashed passwords, not existing ones.
const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt.buffer as ArrayBuffer)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromBase64(parts[2]!);
  const expected = fromBase64(parts[3]!);
  if (!Number.isFinite(iterations) || salt.length === 0 || expected.length === 0) return false;
  const actual = new Uint8Array(await derive(password, salt, iterations));
  if (actual.length !== expected.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}
