import type { Env } from "../env";

/**
 * Reversible encryption for secrets the server must later replay — a
 * connector's bearer token, for instance.
 *
 * This is deliberately different from how passwords and API keys are stored.
 * Those are hashed, because nothing ever needs the original back. A connector
 * token does need to go back out on the wire, so it can only be encrypted, and
 * the key lives in the environment rather than in D1. Someone who reads a
 * database dump therefore gets ciphertext and nothing else.
 */
async function keyFor(env: Env): Promise<CryptoKey> {
  const secret = env.SECRETS_KEY ?? env.SESSION_SECRET ?? "dev-insecure-secret";
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`connector:${secret}`));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Returns `v1.<iv>.<ciphertext>`, both base64. */
export async function seal(env: Env, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await keyFor(env),
    new TextEncoder().encode(plaintext),
  );
  return `v1.${b64(iv)}.${b64(new Uint8Array(sealed))}`;
}

/**
 * Returns null rather than throwing when the value cannot be opened. A rotated
 * key should make one connector stop working, not break every page that lists
 * connectors.
 */
export async function open(env: Env, sealed: string): Promise<string | null> {
  const [version, ivPart, bodyPart] = sealed.split(".");
  if (version !== "v1" || !ivPart || !bodyPart) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(ivPart) },
      await keyFor(env),
      unb64(bodyPart),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const byte of bytes) s += String.fromCharCode(byte);
  return btoa(s);
}

function unb64(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
