import { estimateTokens } from "../../lib/text";
import type { ExtractedPage } from "./extract";

export interface Chunk { chunk_index: number; content: string; token_count: number; page_number: number | null; section: string | null }

/** Normalise whitespace, drop control characters, collapse blank runs, keep markdown headings. */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SENTENCE_SPLIT = /(?<=[。！？!?.])\s*/u;

/**
 * Paragraph-aware chunking with overlap. `target` is in characters (CJK-heavy text ≈ tokens). Headings (`# ...`, `第X章`, `Chapter N`)
 * set the `section` label of following chunks. When `pages` are supplied (PDF) each page is chunked separately so page numbers stay exact.
 */
export function chunkText(text: string, opts: { target?: number; overlap?: number; pages?: ExtractedPage[] | null } = {}): Chunk[] {
  const target = opts.target ?? 900, overlap = opts.overlap ?? 120;
  const out: Chunk[] = []; let section: string | null = null;
  const push = (content: string, page: number | null) => { const c = content.trim(); if (c.length > 20) out.push({ chunk_index: out.length, content: c, token_count: estimateTokens(c), page_number: page, section }); };
  const units: { text: string; page: number | null }[] = opts.pages?.length ? opts.pages.map((p) => ({ text: cleanText(p.text), page: p.page })) : [{ text: cleanText(text), page: null }];
  for (const unit of units) {
    const paragraphs = unit.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    let buf = "";
    const flush = () => { if (buf.trim()) { push(buf, unit.page); const tail = buf.slice(-overlap); buf = tail.length < buf.length ? tail : ""; } };
    for (const para of paragraphs) {
      const heading = para.match(/^#{1,6}\s+(.+)$/m) ?? para.match(/^(第[一二三四五六七八九十百零〇\d]+[章节回卷篇].*)$/m) ?? para.match(/^(Chapter\s+\d+.*)$/im);
      if (heading?.[1] && para.length < 120) { if (buf.trim()) push(buf, unit.page); buf = ""; section = heading[1].trim().slice(0, 80); }
      const pieces = para.length > target ? para.split(SENTENCE_SPLIT).filter(Boolean) : [para];
      for (const piece of pieces) {
        if (buf.length + piece.length + 1 > target && buf.trim()) flush();
        buf += (buf ? "\n" : "") + piece;
      }
      if (buf.length >= target) flush();
    }
    if (buf.trim()) push(buf, unit.page);
  }
  // Remove overlap-only fragments duplicated by flush tails.
  const seen = new Set<string>();
  return out.filter((c) => { if (seen.has(c.content)) return false; seen.add(c.content); return true; }).map((c, i) => ({ ...c, chunk_index: i }));
}
