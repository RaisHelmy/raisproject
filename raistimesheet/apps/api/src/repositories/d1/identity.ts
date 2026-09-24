import type { PgDatabase } from "../../db/pg-adapter";
import type { SessionRepository, UserRepository } from "../interfaces";
import type { ApiTokenRow, SessionRow, UserRow } from "../types";
import { all, insertStatement, one, placeholders, run, updateStatement } from "./base";

export class D1UserRepository implements UserRepository {
  constructor(private readonly db: PgDatabase) {}

  findById(id: string) { return one<UserRow>(this.db, "SELECT * FROM users WHERE id = ?", id); }
  findByEmail(email: string) { return one<UserRow>(this.db, "SELECT * FROM users WHERE lower(email) = lower(?)", email); }
  list() { return all<UserRow>(this.db, "SELECT * FROM users ORDER BY name"); }

  async create(u: UserRow) {
    const s = insertStatement("users", u as unknown as Record<string, unknown>);
    await run(this.db, s.sql, ...s.params);
  }

  async update(id: string, patch: Partial<UserRow>) {
    const s = updateStatement("users", id, patch as Record<string, unknown>);
    if (s) await run(this.db, s.sql, ...s.params);
  }

  async rolesFor(userId: string) {
    const rows = await all<{ name: string }>(this.db, "SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?", userId);
    return rows.map((r) => r.name);
  }

  async rolesForMany(userIds: string[]) {
    const map = new Map<string, string[]>();
    if (!userIds.length) return map;
    const rows = await all<{ user_id: string; name: string }>(this.db, `SELECT ur.user_id, r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id IN (${placeholders(userIds.length)})`, ...userIds);
    for (const r of rows) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.name]);
    return map;
  }

  async setRoles(userId: string, roles: string[]) {
    const stmts = [this.db.prepare("DELETE FROM user_roles WHERE user_id = ?").bind(userId)];
    for (const r of roles) stmts.push(this.db.prepare("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?").bind(userId, r));
    await this.db.batch(stmts);
  }
}

export class D1SessionRepository implements SessionRepository {
  constructor(private readonly db: PgDatabase) {}

  async create(s: SessionRow) {
    const st = insertStatement("sessions", s as unknown as Record<string, unknown>);
    await run(this.db, st.sql, ...st.params);
  }
  findByTokenHash(hash: string) { return one<SessionRow>(this.db, "SELECT * FROM sessions WHERE token_hash = ?", hash); }
  async deleteByTokenHash(hash: string) { await run(this.db, "DELETE FROM sessions WHERE token_hash = ?", hash); }
  async deleteExpired(now: string) {
    const r = await run(this.db, "DELETE FROM sessions WHERE expires_at < ?", now);
    return r.meta.changes ?? 0;
  }
  async createApiToken(t: ApiTokenRow) {
    const st = insertStatement("api_tokens", t as unknown as Record<string, unknown>);
    await run(this.db, st.sql, ...st.params);
  }
  findApiTokenByHash(hash: string) { return one<ApiTokenRow>(this.db, "SELECT * FROM api_tokens WHERE token_hash = ?", hash); }
  async touchApiToken(id: string, when: string) { await run(this.db, "UPDATE api_tokens SET last_used_at = ? WHERE id = ?", when, id); }
  listApiTokens(userId: string) { return all<ApiTokenRow>(this.db, "SELECT * FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC", userId); }
  async deleteApiToken(id: string, userId: string) { await run(this.db, "DELETE FROM api_tokens WHERE id = ? AND user_id = ?", id, userId); }
}
