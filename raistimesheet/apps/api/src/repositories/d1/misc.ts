import type { PgDatabase } from "../../db/pg-adapter";
import type { AuditRepository, NotificationRepository, RateLimitRepository, ReportRepository, SettingsRepository } from "../interfaces";
import type { AuditRow, NotificationRow, Page, ReportJobRow } from "../types";
import { all, insertStatement, one, placeholders, run, updateStatement } from "./base";

export class D1NotificationRepository implements NotificationRepository {
  constructor(private readonly db: PgDatabase) {}
  async create(n: NotificationRow) { const s = insertStatement("notifications", n as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  async list(userId: string, page: Page, unreadOnly = false) {
    const where = ` WHERE user_id = ?${unreadOnly ? " AND is_read = 0" : ""}`;
    const [items, total, unread] = await Promise.all([
      all<NotificationRow>(this.db, `SELECT * FROM notifications${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, userId, page.limit, page.offset),
      one<{ c: number }>(this.db, `SELECT count(*) AS c FROM notifications${where}`, userId),
      one<{ c: number }>(this.db, "SELECT count(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0", userId),
    ]);
    return { items, total: total?.c ?? 0, unread: unread?.c ?? 0 };
  }
  async markRead(userId: string, ids: string[] | "all") {
    if (ids === "all") await run(this.db, "UPDATE notifications SET is_read = 1 WHERE user_id = ?", userId);
    else if (ids.length) await run(this.db, `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders(ids.length)})`, userId, ...ids);
  }
}

export class D1AuditRepository implements AuditRepository {
  constructor(private readonly db: PgDatabase) {}
  async append(a: AuditRow) { const s = insertStatement("audit_logs", a as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  forEntity(entityType: string, entityId: string) {
    return all<AuditRow>(this.db, "SELECT a.*, u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id WHERE a.entity_type = ? AND a.entity_id = ? ORDER BY a.created_at", entityType, entityId);
  }
  async list(filter: { entity_type?: string; actor_id?: string; action?: string; from?: string; to?: string }, page: Page) {
    const w: string[] = [];
    const p: unknown[] = [];
    if (filter.entity_type) { w.push("a.entity_type = ?"); p.push(filter.entity_type); }
    if (filter.actor_id) { w.push("a.actor_id = ?"); p.push(filter.actor_id); }
    if (filter.action) { w.push("a.action ILIKE ?"); p.push(`%${filter.action}%`); }
    if (filter.from) { w.push("a.created_at >= ?"); p.push(filter.from); }
    if (filter.to) { w.push("a.created_at <= ?"); p.push(filter.to + "T23:59:59Z"); }
    const where = w.length ? " WHERE " + w.join(" AND ") : "";
    const [items, total] = await Promise.all([
      all<AuditRow>(this.db, `SELECT a.*, u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, ...p, page.limit, page.offset),
      one<{ c: number }>(this.db, `SELECT count(*) AS c FROM audit_logs a${where}`, ...p),
    ]);
    return { items, total: total?.c ?? 0 };
  }
  async deleteOlderThan(iso: string) { const r = await run(this.db, "DELETE FROM audit_logs WHERE created_at < ?", iso); return r.meta.changes ?? 0; }
}

export class D1ReportRepository implements ReportRepository {
  constructor(private readonly db: PgDatabase) {}
  async create(r: ReportJobRow) { const s = insertStatement("report_jobs", r as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  findById(id: string) { return one<ReportJobRow>(this.db, "SELECT * FROM report_jobs WHERE id = ?", id); }
  async update(id: string, patch: Partial<ReportJobRow>) { const s = updateStatement("report_jobs", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
  async list(userId: string | null, page: Page) {
    const where = userId ? " WHERE user_id = ?" : "";
    const p = userId ? [userId] : [];
    const [items, total] = await Promise.all([
      all<ReportJobRow>(this.db, `SELECT * FROM report_jobs${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, ...p, page.limit, page.offset),
      one<{ c: number }>(this.db, `SELECT count(*) AS c FROM report_jobs${where}`, ...p),
    ]);
    return { items, total: total?.c ?? 0 };
  }
  olderThan(iso: string) { return all<ReportJobRow>(this.db, "SELECT * FROM report_jobs WHERE created_at < ? AND r2_key IS NOT NULL", iso); }
  async delete(id: string) { await run(this.db, "DELETE FROM report_jobs WHERE id = ?", id); }
}

export class D1SettingsRepository implements SettingsRepository {
  constructor(private readonly db: PgDatabase) {}
  async get<T>(key: string) {
    const r = await one<{ value_json: string }>(this.db, "SELECT value_json FROM settings WHERE key = ?", key);
    return r ? (JSON.parse(r.value_json) as T) : null;
  }
  async set(key: string, value: unknown, updatedBy: string | null) {
    await run(this.db, "INSERT INTO settings (key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by", key, JSON.stringify(value), new Date().toISOString(), updatedBy);
  }
  async all() {
    const rows = await all<{ key: string; value_json: string }>(this.db, "SELECT key, value_json FROM settings");
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = JSON.parse(r.value_json);
    return out;
  }
}

export class D1RateLimitRepository implements RateLimitRepository {
  constructor(private readonly db: PgDatabase) {}
  /** Fixed-window counter. Returns the count within the current window. */
  async hit(key: string, windowSeconds: number, now: Date) {
    const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
    const r = await one<{ count: number }>(
      this.db,
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
         window_start = excluded.window_start RETURNING count`,
      key, windowStart,
    );
    return r?.count ?? 1;
  }
}
