import { randomToken, sha256Hex } from "./util";

export const KEY_PREFIX = "rais_sk_";

/** Generates a credential like rais_sk_zakat_a8K2xxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars ≈ 185 bits). */
export async function generateKey(projectSlug: string): Promise<{ key: string; prefix: string; hash: string }> {
  const slug = projectSlug.replace(/[^a-z0-9]/g, "").slice(0, 16) || "key";
  const secret = randomToken(32);
  const key = `${KEY_PREFIX}${slug}_${secret}`;
  return { key, prefix: `${KEY_PREFIX}${slug}_${secret.slice(0, 4)}`, hash: await sha256Hex(key) };
}

export function extractBearer(request: Request): string | null {
  const auth = request.headers.get("Authorization") ?? "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const xk = request.headers.get("x-api-key");
  return xk ? xk.trim() : null;
}

export function maskKey(prefix: string): string {
  return `${prefix}${"•".repeat(12)}`;
}
