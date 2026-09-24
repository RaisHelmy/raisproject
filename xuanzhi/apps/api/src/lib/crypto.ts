/** Web Crypto helpers. PBKDF2 stays at 100k iterations (Workers' WebCrypto cap). Secrets are never logged. */
const enc = new TextEncoder();
const dec = new TextDecoder();

export function randomToken(bytes = 32): string { const b = new Uint8Array(bytes); crypto.getRandomValues(b); return base64url(b); }
export function base64url(bytes: Uint8Array): string { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
export function fromBase64url(s: string): Uint8Array {
  const b = s.replace(/-/g, "+").replace(/_/g, "/"); const pad = b.length % 4 === 0 ? "" : "=".repeat(4 - (b.length % 4));
  const bin = atob(b + pad); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}
export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function hashPassword(password: string, iterations = 100_000): Promise<string> {
  const salt = new Uint8Array(16); crypto.getRandomValues(salt);
  return `pbkdf2$${iterations}$${base64url(salt)}$${base64url(await pbkdf2(password, salt, iterations))}`;
}
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) { await pbkdf2(password, new Uint8Array(16), 100_000); return false; } // uniform timing
  const p = stored.split("$"); if (p.length !== 4 || p[0] !== "pbkdf2") return false;
  return timingSafeEqual(await pbkdf2(password, fromBase64url(p[2]!), Number(p[1])), fromBase64url(p[3]!));
}
async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256));
}
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean { if (a.byteLength !== b.byteLength) return false; let d = 0; for (let i = 0; i < a.byteLength; i++) d |= a[i]! ^ b[i]!; return d === 0; }
export async function timingSafeEqualString(a: string, b: string): Promise<boolean> { const [ha, hb] = await Promise.all([sha256Hex(a), sha256Hex(b)]); return timingSafeEqual(enc.encode(ha), enc.encode(hb)); }

async function aesKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
/** AES-256-GCM: base64url(iv).base64url(ciphertext) */
export async function encryptString(plain: string, secret: string): Promise<string> {
  const key = await aesKey(secret); const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return `${base64url(iv)}.${base64url(new Uint8Array(ct))}`;
}
export async function decryptString(payload: string, secret: string): Promise<string> {
  const [ivB, ctB] = payload.split("."); if (!ivB || !ctB) throw new Error("Malformed ciphertext");
  const key = await aesKey(secret);
  return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(ivB) as BufferSource }, key, fromBase64url(ctB) as BufferSource));
}
export async function hmacSign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}
export async function hmacHex(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** ES256 JWT (Apple client secret). `pem` is a PKCS#8 private key. */
export async function signJwtES256(payload: Record<string, unknown>, header: Record<string, unknown>, pem: string): Promise<string> {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const part = (o: unknown) => base64url(enc.encode(JSON.stringify(o)));
  const signingInput = `${part({ alg: "ES256", typ: "JWT", ...header })}.${part(payload)}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(sig))}`;
}
export function decodeJwtPayload<T = Record<string, unknown>>(jwt: string): T | null {
  const p = jwt.split("."); if (p.length < 2) return null;
  try { return JSON.parse(dec.decode(fromBase64url(p[1]!))) as T; } catch { return null; }
}
