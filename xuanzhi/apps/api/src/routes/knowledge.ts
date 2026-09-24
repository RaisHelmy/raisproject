import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { rateLimit, requireAuth } from "../middleware";
import { ok, parsePage } from "../lib/http";
import { Errors } from "../lib/errors";
import { entitlements } from "../services/entitlements";
import { toCategoryDTO, toDocumentDTO, toKnowledgeBaseDTO } from "../services/mappers";
import { retrieve } from "../services/knowledge/retrieval";
import { estimateTokens } from "../lib/text";
import type { AppContext } from "../services/context";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

async function visibleTo(c: { get(key: "ctx"): AppContext }) {
  const ctx = c.get("ctx");
  return { visibilities: await entitlements(ctx).visibleVisibilities(ctx.user!), orgIds: ctx.user!.org_ids };
}

/** Browse the library (only documents the caller may see). */
router.get("/", async (c) => {
  const ctx = c.get("ctx"); const q = c.req.query(); const p = parsePage(q, 24, 100);
  const rows = await ctx.repos.documents.list({ search: q.search, category_id: q.category_id, language: q.language, status: "ready", knowledge_base_id: q.knowledge_base_id, source_type: q.source_type, offset: p.offset, limit: p.page_size, visibleTo: await visibleTo(c) });
  const [cats, kbs] = await Promise.all([ctx.repos.categories.list(), ctx.repos.knowledgeBases.list(null)]);
  const ent = entitlements(ctx);
  const visibleKbs = [];
  for (const kb of kbs) if (await ent.canUseKnowledge(ctx.user!, kb.visibility, kb.organization_id)) visibleKbs.push(kb);
  for (const orgId of ctx.user!.org_ids) for (const kb of await ctx.repos.knowledgeBases.list(orgId)) if (kb.organization_id === orgId && !visibleKbs.some((x) => x.id === kb.id)) visibleKbs.push(kb);
  return ok(c, { items: rows.map((d) => ({ ...toDocumentDTO(d), processing_log: [] })), total: rows[0]?.total ?? 0, page: p.page, page_size: p.page_size, categories: cats.map(toCategoryDTO), knowledge_bases: visibleKbs.map(toKnowledgeBaseDTO) });
});

/** Semantic search in the library (counts toward the plan's knowledge-search quota). */
router.post("/search", rateLimit(60, 60, "ksearch"), async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ query: z.string().min(1).max(1000), category_codes: z.array(z.string()).max(10).optional(), limit: z.number().int().min(1).max(12).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Please enter a search query.");
  const ent = entitlements(ctx);
  if (!(await ent.knowledgeSearchAllowed(ctx.user!))) throw Errors.quota("You have used today's knowledge searches. Upgrade for higher limits.", { feature: "knowledge_search" });
  const results = await retrieve(ctx, ctx.user!, body.data.query, { categoryCodes: body.data.category_codes ?? [], limit: body.data.limit ?? 8, minScore: 0.25 });
  ctx.waitUntil(ctx.repos.usage.record({ user_id: ctx.user!.id, organization_id: ctx.user!.org_ids[0] ?? null, model_id: null, conversation_id: null, message_id: null, kind: "knowledge_search", request_tokens: estimateTokens(body.data.query), response_tokens: 0, estimated_cost: 0, knowledge_base_ids: [...new Set(results.map((r) => r.knowledge_base_id).filter((x): x is string => !!x))] }));
  return ok(c, results.map(({ content: _c, knowledge_base_id: _k, ...r }) => r));
});

router.get("/:id", async (c) => {
  const ctx = c.get("ctx");
  const d = await ctx.repos.documents.findById(c.req.param("id"));
  if (!d || d.status !== "ready") throw Errors.notFound("Document");
  const kb = await ctx.repos.knowledgeBases.findById(d.knowledge_base_id);
  if (!(await entitlements(ctx).canUseKnowledge(ctx.user!, d.visibility, kb?.organization_id ?? null))) throw Errors.forbidden("This document is not included in your plan.");
  const p = parsePage(c.req.query(), 20, 100);
  const chunks = await ctx.repos.chunks.listForDocument(d.id, p.offset, p.page_size);
  return ok(c, { document: { ...toDocumentDTO(d), processing_log: [] }, chunks: chunks.map((x) => ({ id: x.id, document_id: x.document_id, chunk_index: x.chunk_index, content: x.content, token_count: x.token_count, page_number: x.page_number, section: x.section })), total_chunks: chunks[0]?.total ?? 0, page: p.page, page_size: p.page_size });
});

/** Source viewer: the cited chunk with its neighbours, for highlighting the relevant passage. */
router.get("/:id/chunks/:chunkId", async (c) => {
  const ctx = c.get("ctx");
  const chunk = await ctx.repos.chunks.findById(c.req.param("chunkId"));
  if (!chunk || chunk.document_id !== c.req.param("id")) throw Errors.notFound("Passage");
  const d = await ctx.repos.documents.findById(chunk.document_id);
  if (!d) throw Errors.notFound("Document");
  const kb = await ctx.repos.knowledgeBases.findById(d.knowledge_base_id);
  if (!(await entitlements(ctx).canUseKnowledge(ctx.user!, d.visibility, kb?.organization_id ?? null))) throw Errors.forbidden("This document is not included in your plan.");
  const around = await ctx.repos.chunks.listForDocument(d.id, Math.max(0, chunk.chunk_index - 1), 3);
  return ok(c, { document: { ...toDocumentDTO(d), processing_log: [] }, chunk: { id: chunk.id, document_id: chunk.document_id, chunk_index: chunk.chunk_index, content: chunk.content, token_count: chunk.token_count, page_number: chunk.page_number, section: chunk.section }, context: around.map((x) => ({ id: x.id, chunk_index: x.chunk_index, content: x.content, page_number: x.page_number, section: x.section })) });
});

export default router;
