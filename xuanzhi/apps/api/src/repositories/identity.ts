import type { Queryable } from "../db/client";
import type { ApiKeyRow, EmailTokenRow, OAuthAccountRow, SessionRow, UserRow } from "./types";

export class UsersRepo {
  constructor(private readonly db: Queryable) {}
  findById(id: string) { return this.db.one<UserRow>(`SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]); }
  findByEmail(email: string) { return this.db.one<UserRow>(`SELECT * FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL`, [email]); }
  async create(u: { email: string; name: string; password_hash: string | null; locale?: string; avatar_url?: string | null; email_verified?: boolean; role?: string }) {
    return (await this.db.one<UserRow>(
      `INSERT INTO users (email, name, password_hash, locale, avatar_url, email_verified_at, role) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [u.email, u.name, u.password_hash, u.locale ?? "en", u.avatar_url ?? null, u.email_verified ? new Date().toISOString() : null, u.role ?? "user"],
    ))!;
  }
  async update(id: string, patch: Partial<Record<keyof UserRow, unknown>>) {
    const keys = Object.keys(patch).filter((k) => patch[k as keyof UserRow] !== undefined);
    if (!keys.length) return this.findById(id);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const vals = keys.map((k) => { const v = patch[k as keyof UserRow]; return Array.isArray(v) || (v && typeof v === "object" && !(v instanceof Date)) ? JSON.stringify(v) : v; });
    return this.db.one<UserRow>(`UPDATE users SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
  }
  async count(): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM users WHERE deleted_at IS NULL`))!.n; }
  list(q: { search?: string; role?: string; offset: number; limit: number }) {
    const where = ["deleted_at IS NULL"]; const p: unknown[] = [];
    if (q.search) { p.push(`%${q.search}%`); where.push(`(email ILIKE $${p.length} OR name ILIKE $${p.length})`); }
    if (q.role) { p.push(q.role); where.push(`role = $${p.length}`); }
    p.push(q.limit, q.offset);
    return this.db.query<UserRow & { total: number }>(`SELECT *, count(*) OVER()::int AS total FROM users WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  }
  softDelete(id: string) { return this.db.query(`UPDATE users SET deleted_at = now(), is_active = false, email = email || '.deleted.' || extract(epoch from now())::bigint WHERE id = $1`, [id]); }
}

export class SessionsRepo {
  constructor(private readonly db: Queryable) {}
  create(s: { user_id: string; token_hash: string; expires_at: string; user_agent: string | null; ip: string | null }) {
    return this.db.query(`INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip) VALUES ($1,$2,$3,$4,$5)`, [s.user_id, s.token_hash, s.expires_at, s.user_agent, s.ip]);
  }
  findByTokenHash(h: string) { return this.db.one<SessionRow>(`SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > now()`, [h]); }
  touch(id: string) { return this.db.query(`UPDATE sessions SET last_seen_at = now() WHERE id = $1 AND last_seen_at < now() - interval '5 minutes'`, [id]); }
  deleteByTokenHash(h: string) { return this.db.query(`DELETE FROM sessions WHERE token_hash = $1`, [h]); }
  deleteAllForUser(userId: string) { return this.db.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]); }
  purgeExpired() { return this.db.query(`DELETE FROM sessions WHERE expires_at < now()`); }
  async activeUsersSince(since: Date): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(DISTINCT user_id)::int AS n FROM sessions WHERE last_seen_at >= $1`, [since.toISOString()]))!.n; }
}

export class OAuthRepo {
  constructor(private readonly db: Queryable) {}
  find(provider: string, providerAccountId: string) { return this.db.one<OAuthAccountRow>(`SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_account_id = $2`, [provider, providerAccountId]); }
  link(a: { user_id: string; provider: string; provider_account_id: string; email: string | null }) {
    return this.db.query(`INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email) VALUES ($1,$2,$3,$4) ON CONFLICT (provider, provider_account_id) DO NOTHING`, [a.user_id, a.provider, a.provider_account_id, a.email]);
  }
  listForUser(userId: string) { return this.db.query<OAuthAccountRow>(`SELECT * FROM oauth_accounts WHERE user_id = $1`, [userId]); }
  saveState(s: { state: string; provider: string; code_verifier: string | null; redirect_to: string | null }) {
    return this.db.query(`INSERT INTO oauth_states (state, provider, code_verifier, redirect_to) VALUES ($1,$2,$3,$4)`, [s.state, s.provider, s.code_verifier, s.redirect_to]);
  }
  async consumeState(state: string) {
    return this.db.one<{ state: string; provider: string; code_verifier: string | null; redirect_to: string | null }>(`DELETE FROM oauth_states WHERE state = $1 AND created_at > now() - interval '15 minutes' RETURNING *`, [state]);
  }
}

export class EmailTokensRepo {
  constructor(private readonly db: Queryable) {}
  create(t: { user_id: string; purpose: "verify" | "reset"; token_hash: string; expires_at: string }) {
    return this.db.query(`INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1,$2,$3,$4)`, [t.user_id, t.purpose, t.token_hash, t.expires_at]);
  }
  consume(tokenHash: string, purpose: "verify" | "reset") {
    return this.db.one<EmailTokenRow>(`UPDATE email_tokens SET used_at = now() WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now() RETURNING *`, [tokenHash, purpose]);
  }
}

export class ApiKeysRepo {
  constructor(private readonly db: Queryable) {}
  create(k: { user_id: string; organization_id: string | null; name: string; key_prefix: string; key_hash: string }) {
    return this.db.one<ApiKeyRow>(`INSERT INTO api_keys (user_id, organization_id, name, key_prefix, key_hash) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [k.user_id, k.organization_id, k.name, k.key_prefix, k.key_hash]);
  }
  findByHash(h: string) { return this.db.one<ApiKeyRow>(`SELECT * FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`, [h]); }
  touch(id: string) { return this.db.query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [id]); }
  listForUser(userId: string) { return this.db.query<ApiKeyRow>(`SELECT * FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`, [userId]); }
  revoke(id: string, userId: string) { return this.db.query(`UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND user_id = $2`, [id, userId]); }
}

export class RateLimitsRepo {
  constructor(private readonly db: Queryable) {}
  /** Fixed window. Returns the count in the current window after this hit. */
  async hit(key: string, windowSeconds: number): Promise<number> {
    const r = await this.db.one<{ count: number }>(
      `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
       RETURNING count`, [key, windowSeconds]);
    return r?.count ?? 1;
  }
  purge() { return this.db.query(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`); }
}
