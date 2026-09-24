import type { Queryable } from "../db/client";
import { toVectorLiteral } from "../db/client";
import type { CategoryRow, ChunkRow, DocumentRow, FileUploadRow, KnowledgeBaseRow, RetrievedChunkRow, UploadChunkRow } from "./types";

export class CategoriesRepo {
  constructor(private readonly db: Queryable) {}
  list() {
    return this.db.query<CategoryRow>(`SELECT c.*, (SELECT count(*)::int FROM documents d WHERE d.category_id = c.id AND d.deleted_at IS NULL AND d.status = 'ready') AS document_count FROM knowledge_categories c ORDER BY sort_order, name`);
  }
  findById(id: string) { return this.db.one<CategoryRow>(`SELECT * FROM knowledge_categories WHERE id = $1`, [id]); }
  findByCode(code: string) { return this.db.one<CategoryRow>(`SELECT * FROM knowledge_categories WHERE code = $1`, [code]); }
  create(c: { code: string; name: string; name_zh: string; name_zh_tw: string; description: string | null; icon: string; sort_order: number }) {
    return this.db.one<CategoryRow>(`INSERT INTO knowledge_categories (code, name, name_zh, name_zh_tw, description, icon, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [c.code, c.name, c.name_zh, c.name_zh_tw, c.description, c.icon, c.sort_order]);
  }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && !["id", "code", "is_system"].includes(k));
    if (!keys.length) return this.findById(id);
    return this.db.one<CategoryRow>(`UPDATE knowledge_categories SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => patch[k])]);
  }
  delete(id: string) { return this.db.query(`DELETE FROM knowledge_categories WHERE id = $1 AND NOT is_system`, [id]); }
}

export class KnowledgeBasesRepo {
  constructor(private readonly db: Queryable) {}
  list(orgId?: string | null) {
    return this.db.query<KnowledgeBaseRow>(
      `SELECT kb.*, (SELECT count(*)::int FROM documents d WHERE d.knowledge_base_id = kb.id AND d.deleted_at IS NULL) AS document_count FROM knowledge_bases kb
       WHERE kb.deleted_at IS NULL ${orgId === undefined ? "" : orgId === null ? "AND kb.organization_id IS NULL" : "AND (kb.organization_id IS NULL OR kb.organization_id = $1)"} ORDER BY kb.is_default DESC, kb.name`, orgId ? [orgId] : []);
  }
  findById(id: string) { return this.db.one<KnowledgeBaseRow>(`SELECT * FROM knowledge_bases WHERE id = $1 AND deleted_at IS NULL`, [id]); }
  findDefault() { return this.db.one<KnowledgeBaseRow>(`SELECT * FROM knowledge_bases WHERE is_default AND deleted_at IS NULL LIMIT 1`); }
  create(k: { name: string; description: string | null; organization_id: string | null; visibility: string }) {
    return this.db.one<KnowledgeBaseRow>(`INSERT INTO knowledge_bases (name, description, organization_id, visibility) VALUES ($1,$2,$3,$4) RETURNING *`, [k.name, k.description, k.organization_id, k.visibility]);
  }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== "id");
    if (!keys.length) return this.findById(id);
    return this.db.one<KnowledgeBaseRow>(`UPDATE knowledge_bases SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => patch[k])]);
  }
  softDelete(id: string) { return this.db.query(`UPDATE knowledge_bases SET deleted_at = now() WHERE id = $1 AND NOT is_default`, [id]); }
}

const DOC_SELECT = `SELECT d.*, c.code AS category_code, c.name AS category_name FROM documents d LEFT JOIN knowledge_categories c ON c.id = d.category_id`;

export class DocumentsRepo {
  constructor(private readonly db: Queryable) {}
  findById(id: string) { return this.db.one<DocumentRow>(`${DOC_SELECT} WHERE d.id = $1 AND d.deleted_at IS NULL`, [id]); }
  list(q: { search?: string; category_id?: string; language?: string; status?: string; visibility?: string; author?: string; knowledge_base_id?: string; source_type?: string; offset: number; limit: number; visibleTo?: { visibilities: string[]; orgIds: string[] } }) {
    const where = ["d.deleted_at IS NULL"]; const p: unknown[] = [];
    if (q.search) { p.push(`%${q.search}%`); where.push(`(d.title ILIKE $${p.length} OR d.author ILIKE $${p.length} OR d.filename ILIKE $${p.length})`); }
    for (const k of ["category_id", "language", "status", "visibility", "knowledge_base_id", "source_type"] as const) { if (q[k]) { p.push(q[k]); where.push(`d.${k} = $${p.length}`); } }
    if (q.author) { p.push(`%${q.author}%`); where.push(`d.author ILIKE $${p.length}`); }
    if (q.visibleTo) {
      p.push(q.visibleTo.visibilities); const vi = p.length; p.push(q.visibleTo.orgIds); const oi = p.length;
      where.push(`(d.visibility = ANY($${vi}::text[]) OR (d.visibility = 'private' AND EXISTS (SELECT 1 FROM knowledge_bases kb WHERE kb.id = d.knowledge_base_id AND kb.organization_id = ANY($${oi}::uuid[]))))`);
    }
    p.push(q.limit, q.offset);
    return this.db.query<DocumentRow & { total: number }>(`${DOC_SELECT.replace("d.*", "d.*, count(*) OVER()::int AS total")} WHERE ${where.join(" AND ")} ORDER BY d.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
  }
  create(d: { knowledge_base_id: string; category_id: string | null; title: string; filename: string; mime_type: string; file_key: string | null; file_size: number; language: string; author: string | null; source: string | null; publication_date: string | null; tags: string[]; source_type: string; source_weight: number; visibility: string; is_demo: boolean; uploaded_by: string | null; extracted_text?: string | null }) {
    return this.db.one<DocumentRow>(
      `INSERT INTO documents (knowledge_base_id, category_id, title, filename, mime_type, file_key, file_size, language, author, source, publication_date, tags, source_type, source_weight, visibility, is_demo, uploaded_by, extracted_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [d.knowledge_base_id, d.category_id, d.title, d.filename, d.mime_type, d.file_key, d.file_size, d.language, d.author, d.source, d.publication_date, JSON.stringify(d.tags), d.source_type, d.source_weight, d.visibility, d.is_demo, d.uploaded_by, d.extracted_text ?? null]);
  }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== "id");
    if (!keys.length) return this.findById(id);
    const vals = keys.map((k) => (Array.isArray(patch[k]) || (patch[k] && typeof patch[k] === "object" && !(patch[k] instanceof Date)) ? JSON.stringify(patch[k]) : patch[k]));
    return this.db.one<DocumentRow>(`UPDATE documents SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, [id, ...vals]);
  }
  appendLog(id: string, step: string, message: string, status?: string, progress?: number) {
    return this.db.query(
      `UPDATE documents SET processing_log = processing_log || $2::jsonb, status = coalesce($3, status), progress = coalesce($4, progress), updated_at = now() WHERE id = $1`,
      [id, JSON.stringify([{ at: new Date().toISOString(), step, message }]), status ?? null, progress ?? null]);
  }
  softDelete(id: string) { return this.db.query(`UPDATE documents SET deleted_at = now(), status = 'disabled', updated_at = now() WHERE id = $1`, [id]); }
  async stats() {
    return (await this.db.one<{ documents: number; chunks: number; embeddings: number; storage_bytes: number; ready: number; processing: number; failed: number }>(
      `SELECT (SELECT count(*)::int FROM documents WHERE deleted_at IS NULL) AS documents,
              (SELECT count(*)::int FROM document_chunks c JOIN documents d ON d.id = c.document_id WHERE d.deleted_at IS NULL) AS chunks,
              (SELECT count(*)::int FROM document_embeddings e JOIN documents d ON d.id = e.document_id WHERE d.deleted_at IS NULL) AS embeddings,
              (SELECT coalesce(sum(file_size), 0)::bigint FROM documents WHERE deleted_at IS NULL) AS storage_bytes,
              (SELECT count(*)::int FROM documents WHERE deleted_at IS NULL AND status = 'ready') AS ready,
              (SELECT count(*)::int FROM documents WHERE deleted_at IS NULL AND status NOT IN ('ready','failed','disabled')) AS processing,
              (SELECT count(*)::int FROM documents WHERE deleted_at IS NULL AND status = 'failed') AS failed`))!;
  }
  searchTitles(term: string, limit = 8, visibleTo?: { visibilities: string[]; orgIds: string[] }) {
    const p: unknown[] = [`%${term}%`, limit]; let extra = "";
    if (visibleTo) { p.push(visibleTo.visibilities, visibleTo.orgIds); extra = `AND (d.visibility = ANY($3::text[]) OR (d.visibility = 'private' AND EXISTS (SELECT 1 FROM knowledge_bases kb WHERE kb.id = d.knowledge_base_id AND kb.organization_id = ANY($4::uuid[]))))`; }
    return this.db.query<DocumentRow>(`${DOC_SELECT} WHERE d.deleted_at IS NULL AND d.status = 'ready' AND (d.title ILIKE $1 OR d.author ILIKE $1) ${extra} ORDER BY d.title LIMIT $2`, p);
  }
}

export class ChunksRepo {
  constructor(private readonly db: Queryable) {}
  deleteForDocument(documentId: string) { return this.db.query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]); }
  async insertMany(documentId: string, chunks: { chunk_index: number; content: string; token_count: number; page_number: number | null; section: string | null; content_hash: string }[]): Promise<string[]> {
    const ids: string[] = [];
    for (const c of chunks) {
      const r = await this.db.one<{ id: string }>(`INSERT INTO document_chunks (document_id, chunk_index, content, token_count, page_number, section, content_hash) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [documentId, c.chunk_index, c.content, c.token_count, c.page_number, c.section, c.content_hash]);
      ids.push(r!.id);
    }
    return ids;
  }
  listForDocument(documentId: string, offset = 0, limit = 50) { return this.db.query<ChunkRow & { total: number }>(`SELECT *, count(*) OVER()::int AS total FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index LIMIT $2 OFFSET $3`, [documentId, limit, offset]); }
  findById(id: string) { return this.db.one<ChunkRow>(`SELECT * FROM document_chunks WHERE id = $1`, [id]); }
  listUnembedded(documentId: string, limit: number) { return this.db.query<ChunkRow>(`SELECT c.* FROM document_chunks c LEFT JOIN document_embeddings e ON e.chunk_id = c.id WHERE c.document_id = $1 AND e.chunk_id IS NULL ORDER BY c.chunk_index LIMIT $2`, [documentId, limit]); }
  async insertEmbeddings(documentId: string, rows: { chunk_id: string; embedding: number[] }[], model: string) {
    for (const r of rows) await this.db.query(`INSERT INTO document_embeddings (chunk_id, document_id, embedding, model) VALUES ($1,$2,$3::vector,$4) ON CONFLICT (chunk_id) DO UPDATE SET embedding = excluded.embedding, model = excluded.model`, [r.chunk_id, documentId, toVectorLiteral(r.embedding), model]);
  }
  async countEmbedded(documentId: string): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM document_embeddings WHERE document_id = $1`, [documentId]))!.n; }

  /**
   * Vector search restricted to what the caller may see. `visibilities` = visibility levels the caller's plan allows;
   * `orgIds` = organizations whose private knowledge bases are visible. Category filter = category codes ([] = all).
   */
  vectorSearch(embedding: number[], q: { limit: number; visibilities: string[]; orgIds: string[]; categoryCodes: string[]; knowledgeBaseIds?: string[]; documentIds?: string[] }) {
    const p: unknown[] = [toVectorLiteral(embedding), q.visibilities, q.orgIds, q.limit];
    const where = [`d.deleted_at IS NULL`, `d.status = 'ready'`,
      `(d.visibility = ANY($2::text[]) OR (d.visibility = 'private' AND kb.organization_id = ANY($3::uuid[])))`];
    if (q.categoryCodes.length) { p.push(q.categoryCodes); where.push(`cat.code = ANY($${p.length}::text[])`); }
    if (q.knowledgeBaseIds?.length) { p.push(q.knowledgeBaseIds); where.push(`d.knowledge_base_id = ANY($${p.length}::uuid[])`); }
    if (q.documentIds?.length) { p.push(q.documentIds); where.push(`d.id = ANY($${p.length}::uuid[])`); }
    return this.db.query<RetrievedChunkRow>(
      `SELECT c.*, 1 - (e.embedding <=> $1::vector) AS score, d.title AS document_title, d.source_type, d.source_weight, d.author, cat.code AS category_code, d.knowledge_base_id, d.visibility
       FROM document_embeddings e JOIN document_chunks c ON c.id = e.chunk_id JOIN documents d ON d.id = e.document_id
       JOIN knowledge_bases kb ON kb.id = d.knowledge_base_id LEFT JOIN knowledge_categories cat ON cat.id = d.category_id
       WHERE ${where.join(" AND ")} ORDER BY e.embedding <=> $1::vector LIMIT $4`, p);
  }
  /** Lexical fallback/hybrid signal (pg_trgm) — used to boost chunks that literally contain the query terms. */
  lexicalSearch(term: string, q: { limit: number; visibilities: string[]; orgIds: string[]; categoryCodes: string[] }) {
    const p: unknown[] = [term, q.visibilities, q.orgIds, q.limit];
    const where = [`d.deleted_at IS NULL`, `d.status = 'ready'`, `(d.visibility = ANY($2::text[]) OR (d.visibility = 'private' AND kb.organization_id = ANY($3::uuid[])))`, `c.content ILIKE '%' || $1 || '%'`];
    if (q.categoryCodes.length) { p.push(q.categoryCodes); where.push(`cat.code = ANY($${p.length}::text[])`); }
    return this.db.query<RetrievedChunkRow>(
      `SELECT c.*, similarity(c.content, $1) AS score, d.title AS document_title, d.source_type, d.source_weight, d.author, cat.code AS category_code, d.knowledge_base_id, d.visibility
       FROM document_chunks c JOIN documents d ON d.id = c.document_id JOIN knowledge_bases kb ON kb.id = d.knowledge_base_id LEFT JOIN knowledge_categories cat ON cat.id = d.category_id
       WHERE ${where.join(" AND ")} LIMIT $4`, p);
  }
}

export class FileUploadsRepo {
  constructor(private readonly db: Queryable) {}
  create(u: { user_id: string; conversation_id: string | null; filename: string; mime_type: string; size: number; file_key: string }) {
    return this.db.one<FileUploadRow>(`INSERT INTO file_uploads (user_id, conversation_id, filename, mime_type, size, file_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [u.user_id, u.conversation_id, u.filename, u.mime_type, u.size, u.file_key]);
  }
  findById(id: string, userId?: string) { return userId ? this.db.one<FileUploadRow>(`SELECT * FROM file_uploads WHERE id = $1 AND user_id = $2`, [id, userId]) : this.db.one<FileUploadRow>(`SELECT * FROM file_uploads WHERE id = $1`, [id]); }
  findMany(ids: string[], userId: string) { return ids.length ? this.db.query<FileUploadRow>(`SELECT * FROM file_uploads WHERE id = ANY($1::uuid[]) AND user_id = $2`, [ids, userId]) : Promise.resolve([] as FileUploadRow[]); }
  update(id: string, patch: Record<string, unknown>) {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
    return this.db.one<FileUploadRow>(`UPDATE file_uploads SET ${keys.map((k, i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1 RETURNING *`, [id, ...keys.map((k) => patch[k])]);
  }
  async countToday(userId: string): Promise<number> { return (await this.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM file_uploads WHERE user_id = $1 AND created_at >= date_trunc('day', now())`, [userId]))!.n; }
  async insertChunks(uploadId: string, chunks: { chunk_index: number; content: string; page_number: number | null; section: string | null; embedding: number[] | null }[]) {
    for (const c of chunks) await this.db.query(`INSERT INTO file_upload_chunks (upload_id, chunk_index, content, page_number, section, embedding) VALUES ($1,$2,$3,$4,$5,$6::vector)`, [uploadId, c.chunk_index, c.content, c.page_number, c.section, c.embedding ? toVectorLiteral(c.embedding) : null]);
  }
  vectorSearch(embedding: number[], uploadIds: string[], limit: number) {
    return this.db.query<UploadChunkRow>(`SELECT c.id, c.upload_id, c.chunk_index, c.content, c.page_number, c.section, 1 - (c.embedding <=> $1::vector) AS score, u.filename FROM file_upload_chunks c JOIN file_uploads u ON u.id = c.upload_id WHERE c.upload_id = ANY($2::uuid[]) AND c.embedding IS NOT NULL ORDER BY c.embedding <=> $1::vector LIMIT $3`, [toVectorLiteral(embedding), uploadIds, limit]);
  }
  purgeExpired() { return this.db.query<{ file_key: string }>(`DELETE FROM file_uploads WHERE expires_at < now() RETURNING file_key`); }
}
