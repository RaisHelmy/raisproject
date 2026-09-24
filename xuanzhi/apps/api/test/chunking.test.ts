import { describe, expect, it } from "vitest";
import { chunkText, cleanText } from "../src/services/knowledge/chunk";
import { estimateTokens, detectLanguage, titleFromMessage } from "../src/lib/text";

describe("cleanText", () => {
  it("normalises line endings, strips control chars and collapses blank runs", () => {
    expect(cleanText("a\r\nbc\n\n\n\nd   e  ")).toBe("a\nbc\n\nd e");
  });
});

describe("chunkText", () => {
  it("splits long text into overlapping chunks under the target size and tracks sections", () => {
    const para = "The I Ching emphasises timing, position and conduct. ".repeat(12);
    const text = `# Introduction\n\n${para}\n\n## Hexagram 3\n\n${para}\n\n${para}`;
    const chunks = chunkText(text, { target: 400, overlap: 60 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(520);
    expect(chunks[0]!.section).toBe("Introduction");
    expect(chunks.some((c) => c.section === "Hexagram 3")).toBe(true);
    expect(chunks.map((c) => c.chunk_index)).toEqual(chunks.map((_, i) => i));
  });
  it("keeps page numbers when pages are supplied", () => {
    const chunks = chunkText("", { pages: [{ page: 1, text: "第一章 乾卦。天行健，君子以自强不息。".repeat(4) }, { page: 2, text: "第二章 坤卦。地势坤，君子以厚德载物。".repeat(4) }], target: 200 });
    expect(chunks.some((c) => c.page_number === 1)).toBe(true);
    expect(chunks.some((c) => c.page_number === 2)).toBe(true);
  });
  it("splits Chinese sentences when a paragraph exceeds the target", () => {
    const zh = "道可道，非常道。名可名，非常名。无名天地之始。有名万物之母。".repeat(20);
    const chunks = chunkText(zh, { target: 300, overlap: 30 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(400);
  });
  it("drops tiny fragments", () => { expect(chunkText("short")).toEqual([]); });
});

describe("text utils", () => {
  it("estimates tokens with CJK weighting", () => { expect(estimateTokens("道德经")).toBe(3); expect(estimateTokens("abcdefgh")).toBe(2); });
  it("detects language", () => { expect(detectLanguage("What does the I Ching say?")).toBe("en"); expect(detectLanguage("易经对创业有什么说法？")).toBe("zh-CN"); expect(detectLanguage("易經對創業有什麼說法？這個問題")).toBe("zh-TW"); });
  it("derives titles", () => { expect(titleFromMessage("  What   does\nthe I Ching say about starting a business in 2026 with limited capital?  ")).toHaveLength(60); });
});
