import type { PgDatabase } from "../../db/pg-adapter";
import type { AnalysisRepository, ImportRepository } from "../interfaces";
import type { AnalysisRow, ImportMessageRow, ImportRow, Page, WorkItemRow } from "../types";
import { all, batchAll, insertStatement, one, placeholders, run, updateStatement } from "./base";

type ImportJoined = ImportRow & { project_code: string };
const SELECT = "SELECT i.*, p.code AS project_code FROM imports i JOIN projects p ON p.id = i.project_id";

export class D1ImportRepository implements ImportRepository {
  constructor(private readonly db: PgDatabase) {}

  async create(i: ImportRow) { const s = insertStatement("imports", i as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  findById(id: string) { return one<ImportJoined>(this.db, `${SELECT} WHERE i.id = ?`, id); }

  async list(filter: { user_id?: string }, page: Page) {
    const where = filter.user_id ? " WHERE i.user_id = ?" : "";
    const params = filter.user_id ? [filter.user_id] : [];
    const [items, total] = await Promise.all([
      all<ImportJoined>(this.db, `${SELECT}${where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`, ...params, page.limit, page.offset),
      one<{ c: number }>(this.db, `SELECT count(*) AS c FROM imports i${where}`, ...params),
    ]);
    return { items, total: total?.c ?? 0 };
  }

  async update(id: string, patch: Partial<ImportRow>) { const s = updateStatement("imports", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }

  async replaceMessages(importId: string, messages: ImportMessageRow[]) {
    const cols = ["id", "import_id", "seq", "timestamp", "sender", "message", "is_system", "is_attachment", "is_deleted"] as const;
    const stmts = [this.db.prepare("DELETE FROM import_messages WHERE import_id = ?").bind(importId)];
    // Multi-row inserts: one statement per 100 messages instead of one per message.
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const values = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
      stmts.push(this.db.prepare(`INSERT INTO import_messages (${cols.join(", ")}) VALUES ${values}`).bind(...chunk.flatMap((m) => cols.map((c) => m[c]))));
    }
    await this.db.batch(stmts);
  }

  messages(importId: string) { return all<ImportMessageRow>(this.db, "SELECT * FROM import_messages WHERE import_id = ? ORDER BY seq", importId); }
  async messagesByIds(ids: string[]) {
    if (!ids.length) return [];
    return all<ImportMessageRow>(this.db, `SELECT * FROM import_messages WHERE id IN (${placeholders(ids.length)}) ORDER BY seq`, ...ids);
  }
  olderThan(iso: string, withRaw: boolean) {
    return all<ImportRow>(this.db, `SELECT * FROM imports WHERE created_at < ?${withRaw ? " AND r2_key_original IS NOT NULL AND raw_deleted_at IS NULL" : ""}`, iso);
  }
}

export class D1AnalysisRepository implements AnalysisRepository {
  constructor(private readonly db: PgDatabase) {}

  async create(a: AnalysisRow) { const s = insertStatement("ai_analyses", a as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  async update(id: string, patch: Partial<AnalysisRow>) { const s = updateStatement("ai_analyses", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
  latestForImport(importId: string) { return one<AnalysisRow>(this.db, "SELECT * FROM ai_analyses WHERE import_id = ? ORDER BY started_at DESC LIMIT 1", importId); }

  async replaceWorkItems(analysisId: string, items: WorkItemRow[]) {
    await run(this.db, "DELETE FROM ai_work_items WHERE analysis_id = ?", analysisId);
    const stmts = items.map((w) => { const s = insertStatement("ai_work_items", w as unknown as Record<string, unknown>); return this.db.prepare(s.sql).bind(...s.params); });
    await batchAll(this.db, stmts);
  }
  async deleteUnreviewedWorkItems(importId: string, keepAnalysisId: string) {
    const r = await run(this.db, "DELETE FROM ai_work_items WHERE import_id = ? AND analysis_id <> ? AND review_status <> 'ACCEPTED' AND timesheet_id IS NULL", importId, keepAnalysisId);
    return r.meta.changes ?? 0;
  }
  workItems(importId: string) { return all<WorkItemRow>(this.db, "SELECT * FROM ai_work_items WHERE import_id = ? ORDER BY sort_order, created_at", importId); }
  workItem(id: string) { return one<WorkItemRow>(this.db, "SELECT * FROM ai_work_items WHERE id = ?", id); }
  async updateWorkItem(id: string, patch: Partial<WorkItemRow>) { const s = updateStatement("ai_work_items", id, patch as Record<string, unknown>); if (s) await run(this.db, s.sql, ...s.params); }
  async insertWorkItem(item: WorkItemRow) { const s = insertStatement("ai_work_items", item as unknown as Record<string, unknown>); await run(this.db, s.sql, ...s.params); }
  async countPendingReview(userId: string) {
    const r = await one<{ c: number }>(this.db, "SELECT count(*) AS c FROM ai_work_items w JOIN imports i ON i.id = w.import_id WHERE i.user_id = ? AND w.review_status = 'PENDING' AND w.is_mine = 1", userId);
    return r?.c ?? 0;
  }
}
