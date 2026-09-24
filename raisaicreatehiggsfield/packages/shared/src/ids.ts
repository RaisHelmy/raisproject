const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** ULID-like: 10 chars time + 16 chars randomness, Crockford base32, lexicographically sortable. */
export function newId(now: number = Date.now()): string {
  let t = now;
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let rand = "";
  for (let i = 0; i < 16; i++) rand += ALPHABET[bytes[i]! % 32];
  return time + rand;
}
