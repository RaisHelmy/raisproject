import type { Queryable } from "../db/client";
import type { ConversationRow, MessageRow, MessageSourceRow } from "./types";

export class ConversationsRepo {
  constructor(private readonly db: Queryable) {}
  findById(id: string, userId?: string) {
    return userId ? this.db.one<ConversationRow>(`SELECT * FROM conversations WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`, [id, userId])
      : this.db.one<ConversationRow>(`SELECT * FROM conversations WHERE id = $1 AND deleted_at IS NULL`, [id]);
  }
  findByShareToken(token: string) { return this.db.one<ConversationRow>(`SELECT * FROM conversations WHERE share_token = $1 AND deleted_at IS NULL`, [token]); }
  list(userId: string, q: { search?: string; archived?: boolean; offset: number; limit: number }) {
    const p: unknown[] = [userId]; const where = ["user_id = $1", "deleted_at IS NULL", `is_archived = ${q.archived ? "true" : "false"}`];
    if (q.search) { p.push(`%${q.search}%`); where.push(`(title ILIKE $${p.length} OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id AND m.content ILIKE $${p.length}))`); }
    p.push(q.limit, q.offset);
    return this.db.query<ConversationRow & { total: number }>(`SELECT *, count(*) OVER()::int AS total FROM conversations WHERE ${where.join(" AND ")} ORDER BY is_pinned DESC, updated_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  }
  async countForUser(userId: string): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM conversations WHERE user_id = $1 AND deleted_at IS NULL`, [userId]))!.n; }
  create(c: { user_id: string; organization_id: string | null; title: string; model_id: string | null; mode_id: string | null; use_knowledge: boolean }) {
    return this.db.one<ConversationRow>(`INSERT INTO conversations (user_id, organization_id, title, model_id, mode_id, use_knowledge) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [c.user_id, c.organization_id, c.title, c.model_id, c.mode_id, c.use_knowledge]);
  }
  update(id: string, patch: Partial<ConversationRow>) {
    const keys = Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined && k !== "id" && k !== "user_id");
    if (!keys.length) return this.findById(id);
    return this.db.one<ConversationRow>(`UPDATE conversations SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => (patch as Record<string, unknown>)[k])]);
  }
  bump(id: string) { return this.db.query(`UPDATE conversations SET message_count = (SELECT count(*) FROM messages WHERE conversation_id = $1), last_message_at = now(), updated_at = now() WHERE id = $1`, [id]); }
  softDelete(id: string, userId: string) { return this.db.query(`UPDATE conversations SET deleted_at = now(), share_token = NULL WHERE id = $1 AND user_id = $2`, [id, userId]); }
  deleteAllForUser(userId: string) { return this.db.query(`UPDATE conversations SET deleted_at = now(), share_token = NULL WHERE user_id = $1`, [userId]); }
}

export class MessagesRepo {
  constructor(private readonly db: Queryable) {}
  listForConversation(conversationId: string) { return this.db.query<MessageRow>(`SELECT * FROM messages WHERE conversation_id = $1 ORDER BY sequence, created_at`, [conversationId]); }
  findById(id: string) { return this.db.one<MessageRow>(`SELECT * FROM messages WHERE id = $1`, [id]); }
  async nextSequence(conversationId: string): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT coalesce(max(sequence), 0) + 1 AS n FROM messages WHERE conversation_id = $1`, [conversationId]))!.n; }
  create(m: { conversation_id: string; role: string; content: string; status: string; model_id: string | null; mode_id: string | null; parent_message_id: string | null; sequence: number; attachments?: { id: string; filename: string }[]; request_tokens?: number }) {
    return this.db.one<MessageRow>(
      `INSERT INTO messages (conversation_id, role, content, status, model_id, mode_id, parent_message_id, sequence, attachments, request_tokens) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [m.conversation_id, m.role, m.content, m.status, m.model_id, m.mode_id, m.parent_message_id, m.sequence, JSON.stringify(m.attachments ?? []), m.request_tokens ?? 0]);
  }
  update(id: string, patch: Partial<MessageRow>) {
    const keys = Object.keys(patch).filter((k) => (patch as Record<string, unknown>)[k] !== undefined && k !== "id");
    if (!keys.length) return this.findById(id);
    const vals = keys.map((k) => { const v = (patch as Record<string, unknown>)[k]; return Array.isArray(v) ? JSON.stringify(v) : v; });
    return this.db.one<MessageRow>(`UPDATE messages SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
  }
  /** Remove every message after `sequence` (edit / regenerate truncates the branch). */
  deleteAfter(conversationId: string, sequence: number) { return this.db.query(`DELETE FROM messages WHERE conversation_id = $1 AND sequence > $2`, [conversationId, sequence]); }
  deleteFrom(conversationId: string, sequence: number) { return this.db.query(`DELETE FROM messages WHERE conversation_id = $1 AND sequence >= $2`, [conversationId, sequence]); }
  bookmarks(userId: string, offset: number, limit: number) {
    return this.db.query<MessageRow & { conversation_title: string; total: number }>(
      `SELECT m.*, c.title AS conversation_title, count(*) OVER()::int AS total FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND c.deleted_at IS NULL AND m.is_bookmarked ORDER BY m.updated_at DESC LIMIT $2 OFFSET $3`, [userId, limit, offset]);
  }
  search(userId: string, term: string, limit = 10) {
    return this.db.query<{ id: string; conversation_id: string; title: string; content: string; role: string }>(
      `SELECT m.id, m.conversation_id, c.title, left(m.content, 240) AS content, m.role FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND c.deleted_at IS NULL AND m.content ILIKE $2 ORDER BY m.created_at DESC LIMIT $3`, [userId, `%${term}%`, limit]);
  }
}

export class MessageSourcesRepo {
  constructor(private readonly db: Queryable) {}
  listForMessages(messageIds: string[]) {
    if (!messageIds.length) return Promise.resolve([] as MessageSourceRow[]);
    return this.db.query<MessageSourceRow>(`SELECT * FROM message_sources WHERE message_id = ANY($1::uuid[]) ORDER BY message_id, rank`, [messageIds]);
  }
  async insertMany(rows: Omit<MessageSourceRow, "id" | "created_at">[]) {
    for (const r of rows) {
      await this.db.query(`INSERT INTO message_sources (message_id, rank, label, document_id, chunk_id, upload_id, document_title, section, page_number, excerpt, score, source_type) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [r.message_id, r.rank, r.label, r.document_id, r.chunk_id, r.upload_id, r.document_title, r.section, r.page_number, r.excerpt, r.score, r.source_type]);
    }
  }
}
