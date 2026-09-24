import type { AppDatabase } from "./db";
/**
 * Fixed-window rate limiter backed by D1, for public/unauthenticated endpoints
 * (guest booking widget, QR ordering, public feedback) where per-IP throttling
 * is the only abuse protection available at this layer.
 */
export async function checkRateLimit(
  db: AppDatabase,
  key: string,
  opts: { limit: number; windowSeconds: number },
): Promise<{ allowed: boolean; remaining: number }> {
  const nowMs = Date.now();
  const windowMs = opts.windowSeconds * 1000;
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const bucketKey = `${key}:${windowStart}`;

  const row = await db
    .prepare(`SELECT count FROM rate_limit_buckets WHERE bucket_key = ?`)
    .bind(bucketKey)
    .first<{ count: number }>();

  if (!row) {
    await db
      .prepare(
        `INSERT INTO rate_limit_buckets (bucket_key, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT (bucket_key) DO UPDATE SET count = count + 1`,
      )
      .bind(bucketKey, windowStart)
      .run();
    return { allowed: true, remaining: opts.limit - 1 };
  }

  if (row.count >= opts.limit) {
    return { allowed: false, remaining: 0 };
  }

  await db.prepare(`UPDATE rate_limit_buckets SET count = count + 1 WHERE bucket_key = ?`).bind(bucketKey).run();
  return { allowed: true, remaining: opts.limit - row.count - 1 };
}
