/**
 * Background document pipeline: Upload → Extract → Clean → Chunk → Embed → Index → Ready. Runs in the queue consumer.
 * Progress and a step log are written to the document row so the admin UI can show it live.
 */
import { SOURCE_TYPE_WEIGHTS } from "@xuanzhi/shared-types";
import type { AppContext } from "../context";
import { extractText } from "./extract";
import { chunkText, cleanText } from "./chunk";
import { embedTexts, embeddingModelName } from "./embed";
import { contentHash } from "../../lib/text";

export async function processDocument(ctx: AppContext, documentId: string): Promise<void> {
  const repos = ctx.repos;
  const doc = await repos.documents.findById(documentId);
  if (!doc) { ctx.log.warn("process_document_missing", { document_id: documentId }); return; }
  const log = ctx.log.child({ document_id: documentId });
  try {
    await repos.documents.appendLog(doc.id, "extract", "Extracting text", "extracting", 10);
    let text: string; let pages: { page: number; text: string }[] | null = null;
    if (doc.file_key) {
      const obj = await ctx.env.FILES.get(doc.file_key);
      if (!obj) throw new Error("Stored file not found");
      const ex = await extractText(await obj.arrayBuffer(), doc.mime_type, doc.filename);
      text = ex.text; pages = ex.pages;
    } else if (doc.extracted_text) text = doc.extracted_text;
    else throw new Error("No file or inline content to process");

    await repos.documents.appendLog(doc.id, "clean", `Cleaning text (${text.length.toLocaleString()} characters)`, "cleaning", 25);
    const cleaned = cleanText(text);
    if (cleaned.length < 20) throw new Error("No readable text was found in this file");

    await repos.documents.appendLog(doc.id, "chunk", "Splitting into chunks", "chunking", 35);
    const chunks = chunkText(cleaned, { pages });
    await repos.chunks.deleteForDocument(doc.id);
    const withHash = await Promise.all(chunks.map(async (c) => ({ ...c, content_hash: await contentHash(c.content) })));
    const chunkIds = await repos.chunks.insertMany(doc.id, withHash);
    await repos.documents.update(doc.id, { chunk_count: chunks.length, embedded_count: 0, extracted_text: cleaned.slice(0, 2_000_000), source_weight: SOURCE_TYPE_WEIGHTS[doc.source_type] ?? 0.7 });
    await repos.documents.appendLog(doc.id, "chunk", `${chunks.length} chunks created`, "embedding", 45);

    const model = embeddingModelName(ctx);
    const BATCH = 20; let embedded = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vectors = await embedTexts(ctx, slice.map((c) => c.content));
      await repos.chunks.insertEmbeddings(doc.id, slice.map((c, j) => ({ chunk_id: chunkIds[i + j]!, embedding: vectors[j]! })), model);
      embedded += slice.length;
      await repos.documents.update(doc.id, { embedded_count: embedded, progress: 45 + Math.round((embedded / chunks.length) * 45) });
    }
    await repos.documents.appendLog(doc.id, "index", "Vectors indexed (pgvector HNSW)", "indexing", 95);
    await repos.usage.record({ user_id: doc.uploaded_by, organization_id: null, model_id: null, conversation_id: null, message_id: null, kind: "embedding", request_tokens: chunks.reduce((a, c) => a + c.token_count, 0), response_tokens: 0, estimated_cost: 0 });
    await repos.documents.appendLog(doc.id, "ready", `Ready: ${chunks.length} chunks, ${embedded} embeddings (${model})`, "ready", 100);
    await repos.documents.update(doc.id, { error: null });
    log.info("document_ready", { chunks: chunks.length });
  } catch (e) {
    const msg = (e as Error).message ?? "Processing failed";
    log.error("document_failed", { error: e as Error });
    await repos.documents.appendLog(doc.id, "failed", msg, "failed");
    await repos.documents.update(doc.id, { error: msg });
  }
}

/** Chat attachment pipeline: same steps, stored in file_upload_chunks (temporary, per user). */
export async function processUpload(ctx: AppContext, uploadId: string): Promise<void> {
  const repos = ctx.repos;
  const up = await repos.uploads.findById(uploadId);
  if (!up) return;
  try {
    await repos.uploads.update(up.id, { status: "extracting" });
    const obj = await ctx.env.FILES.get(up.file_key);
    if (!obj) throw new Error("Stored file not found");
    const ex = await extractText(await obj.arrayBuffer(), up.mime_type, up.filename);
    const chunks = chunkText(cleanText(ex.text), { pages: ex.pages, target: 800 }).slice(0, 400);
    if (!chunks.length) throw new Error("No readable text was found in this file");
    await repos.uploads.update(up.id, { status: "embedding", chunk_count: chunks.length });
    for (let i = 0; i < chunks.length; i += 20) {
      const slice = chunks.slice(i, i + 20);
      const vectors = await embedTexts(ctx, slice.map((c) => c.content));
      await repos.uploads.insertChunks(up.id, slice.map((c, j) => ({ chunk_index: c.chunk_index, content: c.content, page_number: c.page_number, section: c.section, embedding: vectors[j] ?? null })));
    }
    await repos.uploads.update(up.id, { status: "ready", error: null });
  } catch (e) {
    await repos.uploads.update(up.id, { status: "failed", error: (e as Error).message });
  }
}
