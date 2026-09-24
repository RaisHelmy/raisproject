/** Opaque identifier helpers shared by every layer. */
export type Id = string;

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Generates a short, URL-safe, collision-resistant id with a resource prefix (e.g. `app_8f2k1...`). */
export function newId(prefix: string): Id {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
