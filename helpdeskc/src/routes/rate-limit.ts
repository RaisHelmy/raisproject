/**
 * Soft abuse guard, not a strict counter — KV is eventually consistent, so
 * concurrent requests can both slip through. That's an acceptable
 * trade-off for rate limiting (CLAUDE.md §2: KV for counters/rate limits;
 * reach for a Durable Object only where strong consistency is required).
 * Returns true if the request is allowed.
 */
export async function checkRateLimit(kv: KVNamespace, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const cacheKey = `rl:${key}`;
  const current = await kv.get(cacheKey);
  const count = current ? Number(current) : 0;
  if (count >= limit) return false;
  await kv.put(cacheKey, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}
