/**
 * Retrieval: query → embedding → vector search (permission-filtered) → lexical boost → source-quality reranking → top-k with labels.
 * Primary classical texts outrank commentary at equal similarity (source_weight), so random uploads never override the canon.
 */
import type { SourceDTO, Visibility } from "@xuanzhi/shared-types";
import type { AppContext, AuthUser } from "../context";
import { embedTexts } from "./embed";
import { entitlements } from "../entitlements";
import type { RetrievedChunkRow } from "../../repositories/types";
import { truncate } from "../../lib/text";

export const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

export interface RetrievalOptions { categoryCodes?: string[]; limit?: number; minScore?: number; uploadIds?: string[]; knowledgeBaseIds?: string[]; documentIds?: string[] }
export interface RetrievedSource extends SourceDTO { content: string; knowledge_base_id: string | null }

export function keywordOverlap(query: string, content: string): number {
  const q = query.toLowerCase(); const c = content.toLowerCase();
  const terms = new Set<string>();
  for (const w of q.split(/[^\p{L}\p{N}]+/u)) if (w.length >= 3) terms.add(w);
  for (const m of q.match(/[一-鿿]{2}/g) ?? []) terms.add(m);
  if (!terms.size) return 0;
  let hit = 0; for (const t of terms) if (c.includes(t)) hit++;
  return hit / terms.size;
}

/** Blend vector similarity, source authority and literal keyword overlap into one ranking score. */
export function rerankScore(similarity: number, sourceWeight: number, overlap: number): number {
  return similarity * (0.55 + 0.45 * sourceWeight) + 0.12 * overlap;
}

export async function retrieve(ctx: AppContext, user: AuthUser, query: string, opts: RetrievalOptions = {}): Promise<RetrievedSource[]> {
  const ent = entitlements(ctx);
  const visibilities = (await ent.visibleVisibilities(user)) as Visibility[];
  const limit = opts.limit ?? 6;
  const [vec] = await embedTexts(ctx, [query]);
  if (!vec) return [];
  const search = { limit: 24, visibilities, orgIds: user.org_ids, categoryCodes: opts.categoryCodes ?? [], knowledgeBaseIds: opts.knowledgeBaseIds, documentIds: opts.documentIds };
  const [vectorHits, lexicalHits, uploadHits] = await Promise.all([
    ctx.repos.chunks.vectorSearch(vec, search),
    query.length >= 2 ? ctx.repos.chunks.lexicalSearch(query.slice(0, 60), { ...search, limit: 8 }).catch(() => [] as RetrievedChunkRow[]) : Promise.resolve([] as RetrievedChunkRow[]),
    opts.uploadIds?.length ? ctx.repos.uploads.vectorSearch(vec, opts.uploadIds, 6) : Promise.resolve([]),
  ]);
  const byId = new Map<string, RetrievedChunkRow & { final: number }>();
  for (const h of vectorHits) byId.set(h.id, { ...h, final: rerankScore(Number(h.score), Number(h.source_weight), keywordOverlap(query, h.content)) });
  for (const h of lexicalHits) { const ex = byId.get(h.id); if (ex) ex.final += 0.05; else byId.set(h.id, { ...h, final: rerankScore(0.45, Number(h.source_weight), keywordOverlap(query, h.content)) }); }
  const ranked = [...byId.values()].filter((x) => Number(x.score) >= (opts.minScore ?? 0.3) || x.final >= 0.5).sort((a, b) => b.final - a.final);
  // Diversity: at most 3 chunks per document.
  const perDoc = new Map<string, number>(); const picked: (RetrievedChunkRow & { final: number })[] = [];
  for (const r of ranked) { const n = perDoc.get(r.document_id) ?? 0; if (n >= 3) continue; perDoc.set(r.document_id, n + 1); picked.push(r); if (picked.length >= limit) break; }
  const sources: RetrievedSource[] = picked.map((r, i) => ({
    id: r.id, rank: i + 1, label: CIRCLED[i] ?? `[${i + 1}]`, document_id: r.document_id, document_title: r.document_title, chunk_id: r.id, section: r.section, page_number: r.page_number,
    excerpt: truncate(r.content, 480), score: Number(r.final.toFixed(4)), source_type: r.source_type, author: r.author, category: r.category_code, content: r.content, knowledge_base_id: r.knowledge_base_id,
  }));
  // Chat attachments: always included (the user asked about them), ranked after knowledge sources.
  for (const u of uploadHits.slice(0, 4)) {
    const i = sources.length; if (i >= 10) break;
    sources.push({ id: u.id, rank: i + 1, label: CIRCLED[i] ?? `[${i + 1}]`, document_id: u.upload_id, document_title: u.filename ?? "Uploaded file", chunk_id: u.id, section: u.section, page_number: u.page_number, excerpt: truncate(u.content, 480), score: Number(Number(u.score ?? 0).toFixed(4)), source_type: "community", author: null, category: null, content: u.content, knowledge_base_id: null, is_upload: true });
  }
  return sources;
}
