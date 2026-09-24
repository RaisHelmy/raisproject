import { timingSafeEqual } from "node:crypto";

/**
 * Password hashing via Web Crypto PBKDF2 — Workers has no native bcrypt/argon2
 * binding, and Web Crypto is the platform-native, audited primitive
 * available everywhere the Worker runs. Stored format:
 *   pbkdf2$<iterations>$<saltBase64>$<hashBase64>
 */
// Workers' WebCrypto PBKDF2 implementation caps iterations at 100,000;
// verifyPassword reads the iteration count from the stored hash itself, so
// this only affects newly-hashed passwords, not existing ones.
const ITERATIONS = 100_000;
const HASH_BITS = 256;

function toBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    HASH_BITS,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await deriveBits(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt.buffer as ArrayBuffer)}$${toBase64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromBase64(parts[2] as string);
  const expected = fromBase64(parts[3] as string);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;

  const actual = new Uint8Array(await deriveBits(password, salt, iterations));
  if (actual.length !== expected.length) return false;
  // Timing-safe comparison — never a plain === on secret bytes.
  return timingSafeEqual(actual as NodeJS.ArrayBufferView, expected as NodeJS.ArrayBufferView);
}
