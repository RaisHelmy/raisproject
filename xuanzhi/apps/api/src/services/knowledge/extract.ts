/** Text extraction for supported upload types. Runs inside the Worker (queue consumer), never inside an HTTP request. */
import { unzipSync, strFromU8 } from "fflate";

export interface ExtractedPage { page: number; text: string }
export interface Extracted { text: string; pages: ExtractedPage[] | null }

export function kindFor(mime: string, filename: string): "pdf" | "docx" | "html" | "csv" | "json" | "md" | "txt" | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.includes("wordprocessingml") || ext === "docx") return "docx";
  if (mime === "text/html" || ext === "html" || ext === "htm") return "html";
  if (mime === "text/csv" || ext === "csv") return "csv";
  if (mime === "application/json" || ext === "json") return "json";
  if (mime === "text/markdown" || ext === "md" || ext === "markdown") return "md";
  if (mime.startsWith("text/") || ext === "txt") return "txt";
  return null;
}

export async function extractText(bytes: ArrayBuffer, mime: string, filename: string): Promise<Extracted> {
  const kind = kindFor(mime, filename);
  const dec = new TextDecoder("utf-8");
  switch (kind) {
    case "pdf": {
      const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const r = await pdfExtract(pdf, { mergePages: false });
      const pages = (r.text as string[]).map((t, i) => ({ page: i + 1, text: t }));
      return { text: pages.map((p) => p.text).join("\n\n"), pages };
    }
    case "docx": {
      const files = unzipSync(new Uint8Array(bytes));
      const xml = files["word/document.xml"]; if (!xml) throw new Error("Not a valid DOCX (word/document.xml missing)");
      const s = strFromU8(xml)
        .replace(/<w:tab\/>/g, "\t").replace(/<w:br[^>]*\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<w:pStyle w:val="Heading(\d)"\/>/g, (_m, n: string) => "#".repeat(Number(n)) + " ")
        .replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      return { text: s, pages: null };
    }
    case "html": {
      const s = dec.decode(bytes).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<h([1-6])[^>]*>/gi, (_m, n: string) => "\n" + "#".repeat(Number(n)) + " ").replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      return { text: s, pages: null };
    }
    case "json": {
      const raw = dec.decode(bytes);
      try { const j = JSON.parse(raw); return { text: flattenJson(j), pages: null }; } catch { return { text: raw, pages: null }; }
    }
    case "csv": case "md": case "txt": return { text: dec.decode(bytes), pages: null };
    default: throw new Error(`Unsupported file type: ${mime || filename}`);
  }
}

function flattenJson(v: unknown, path = ""): string {
  if (Array.isArray(v)) return v.map((x, i) => flattenJson(x, `${path}[${i}]`)).join("\n");
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => flattenJson(x, path ? `${path}.${k}` : k)).join("\n");
  return `${path}: ${String(v)}`;
}
