/**
 * Dependency-free PDF writer for professional tabular reports (Workers-safe).
 * Standard Helvetica fonts (WinAnsi), landscape A4, repeated table headers,
 * page numbers, header/footer with report metadata.
 */

export interface PdfKpi { label: string; value: string }
export interface PdfTable {
  title: string;
  columns: { header: string; width: number; align?: "left" | "right" }[]; // width in relative units
  rows: string[][];
  totals?: string[];
  note?: string;
}
export interface PdfDocSpec {
  app: string;
  title: string;
  subtitle: string;      // e.g. "BNM Project"
  period: string;        // e.g. "01 September 2026 – 30 September 2026"
  generated_by: string;
  generated_at: string;
  kpis: PdfKpi[];
  sections: PdfTable[];
  orientation?: "landscape" | "portrait";
}

export const A4 = { w: 595.28, h: 841.89 };
export const MARGIN = 40;
const FONT_SIZE = 8.5;
const LINE = 12;

// Helvetica AFM widths (WinAnsi subset) — approximations for wrapping/alignment.
const HELV_WIDTHS: Record<string, number> = {};
const NARROW = "iljtfI.,;:'!|`";
const WIDE = "mwMW@%";
function charWidth(ch: string, size: number, bold = false): number {
  const cached = HELV_WIDTHS[ch];
  let w = cached ?? (NARROW.includes(ch) ? 0.28 : WIDE.includes(ch) ? 0.85 : ch === " " ? 0.28 : /[A-Z0-9]/.test(ch) ? 0.66 : 0.53);
  if (bold) w *= 1.05;
  return w * size;
}
export function textWidth(s: string, size: number, bold = false): number {
  let w = 0;
  for (const ch of s) w += charWidth(ch, size, bold);
  return w;
}

export function wrap(text: string, maxWidth: number, size: number): string[] {
  const words = (text ?? "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textWidth(t, size) <= maxWidth) cur = t;
    else {
      if (cur) lines.push(cur);
      // hard-break very long words
      let word = w;
      while (textWidth(word, size) > maxWidth && word.length > 1) {
        let i = word.length;
        while (i > 1 && textWidth(word.slice(0, i), size) > maxWidth) i--;
        lines.push(word.slice(0, i));
        word = word.slice(i);
      }
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function pdfEscape(s: string): string {
  // WinAnsi: replace unsupported chars, escape parens/backslashes
  return s
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?")
    .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export class Page {
  ops: string[] = [];
  constructor(public w: number, public h: number) {}
  text(x: number, y: number, s: string, size = FONT_SIZE, bold = false, color = "0 0 0") {
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(s)}) Tj ET`);
  }
  textRight(xRight: number, y: number, s: string, size = FONT_SIZE, bold = false, color = "0 0 0") {
    this.text(xRight - textWidth(s, size, bold), y, s, size, bold, color);
  }
  rect(x: number, y: number, w: number, h: number, fill: string) {
    this.ops.push(`${fill} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }
  line(x1: number, y1: number, x2: number, y2: number, color = "0.8 0.8 0.8", width = 0.5) {
    this.ops.push(`${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }
  strokeRect(x: number, y: number, w: number, h: number, color: string, width = 0.5) {
    this.ops.push(`${color} RG ${width} w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  }
  dashedLine(x1: number, y1: number, x2: number, y2: number, color: string, width = 0.6) {
    this.ops.push(`q [2 2] 0 d ${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }
}

export const NAVY = "0.12 0.31 0.47";
export const GREY = "0.42 0.45 0.5";
export const LIGHT = "0.93 0.95 0.97";
export const ZEBRA = "0.975 0.98 0.985";

export function buildPdf(spec: PdfDocSpec): Uint8Array {
  const landscape = (spec.orientation ?? "landscape") === "landscape";
  const W = landscape ? A4.h : A4.w;
  const H = landscape ? A4.w : A4.h;
  const pages: Page[] = [];
  let page!: Page;
  let y = 0;
  const contentW = W - MARGIN * 2;
  const bottomLimit = MARGIN + 30;

  const newPage = () => {
    page = new Page(W, H);
    pages.push(page);
    // header band
    page.rect(0, H - 34, W, 34, NAVY);
    page.text(MARGIN, H - 22, spec.app.toUpperCase(), 10, true, "1 1 1");
    page.textRight(W - MARGIN, H - 22, `${spec.subtitle}  |  ${spec.period}`, 8.5, false, "1 1 1");
    y = H - 34 - 24;
  };

  const ensure = (needed: number) => { if (y - needed < bottomLimit) newPage(); };

  newPage();
  // Title block
  page.text(MARGIN, y, spec.title, 18, true, "0.12 0.16 0.22");
  y -= 16;
  page.text(MARGIN, y, spec.subtitle, 11, false, GREY);
  y -= 14;
  page.text(MARGIN, y, spec.period, 10, false, GREY);
  y -= 22;

  // KPI tiles
  if (spec.kpis.length) {
    const gap = 10;
    const tileW = (contentW - gap * (spec.kpis.length - 1)) / spec.kpis.length;
    const tileH = 46;
    ensure(tileH + 10);
    spec.kpis.forEach((k, i) => {
      const x = MARGIN + i * (tileW + gap);
      page.rect(x, y - tileH, tileW, tileH, LIGHT);
      page.text(x + 10, y - 16, k.label.toUpperCase(), 7, true, GREY);
      page.text(x + 10, y - 36, k.value, 15, true, "0.12 0.16 0.22");
    });
    y -= tileH + 22;
  }

  for (const section of spec.sections) {
    const totalUnits = section.columns.reduce((a, c) => a + c.width, 0);
    const colW = section.columns.map((c) => (c.width / totalUnits) * contentW);
    const headerH = 18;

    const drawHeader = () => {
      page.rect(MARGIN, y - headerH + 4, contentW, headerH, NAVY);
      let x = MARGIN;
      section.columns.forEach((c, i) => {
        const w = colW[i]!;
        if (c.align === "right") page.textRight(x + w - 6, y - 8, c.header, 8, true, "1 1 1");
        else page.text(x + 6, y - 8, c.header, 8, true, "1 1 1");
        x += w;
      });
      y -= headerH + 2;
    };

    ensure(60);
    page.text(MARGIN, y, section.title, 12, true, "0.12 0.16 0.22");
    y -= 16;
    if (!section.rows.length) {
      page.text(MARGIN, y - 4, "No records for this period.", 9, false, GREY);
      y -= 24;
      continue;
    }
    drawHeader();
    let zebra = false;
    for (const row of section.rows) {
      const wrapped = row.map((cellText, i) => wrap(cellText ?? "", colW[i]! - 12, FONT_SIZE));
      const lines = Math.max(...wrapped.map((l) => l.length));
      const rowH = lines * LINE + 6;
      if (y - rowH < bottomLimit) { newPage(); drawHeader(); }
      if (zebra) page.rect(MARGIN, y - rowH + 4, contentW, rowH, ZEBRA);
      zebra = !zebra;
      let x = MARGIN;
      wrapped.forEach((lines2, i) => {
        const w = colW[i]!;
        lines2.forEach((ln, li) => {
          const yy = y - 8 - li * LINE;
          if (section.columns[i]?.align === "right") page.textRight(x + w - 6, yy, ln);
          else page.text(x + 6, yy, ln);
        });
        x += w;
      });
      page.line(MARGIN, y - rowH + 4, MARGIN + contentW, y - rowH + 4, "0.88 0.9 0.92", 0.4);
      y -= rowH;
    }
    if (section.totals) {
      const rowH = LINE + 8;
      if (y - rowH < bottomLimit) { newPage(); drawHeader(); }
      page.rect(MARGIN, y - rowH + 4, contentW, rowH, LIGHT);
      let x = MARGIN;
      section.totals.forEach((t, i) => {
        const w = colW[i]!;
        if (section.columns[i]?.align === "right") page.textRight(x + w - 6, y - 9, t, FONT_SIZE, true);
        else page.text(x + 6, y - 9, t, FONT_SIZE, true);
        x += w;
      });
      y -= rowH;
    }
    if (section.note) { y -= 4; page.text(MARGIN, y - 4, section.note, 7.5, false, GREY); y -= 14; }
    y -= 18;
  }

  // Footers
  pages.forEach((p, i) => {
    p.line(MARGIN, MARGIN + 14, W - MARGIN, MARGIN + 14, "0.8 0.8 0.8", 0.5);
    p.text(MARGIN, MARGIN, `Generated by ${spec.generated_by} on ${spec.generated_at}`, 7.5, false, GREY);
    p.textRight(W - MARGIN, MARGIN, `Page ${i + 1} of ${pages.length}`, 7.5, false, GREY);
  });

  return serialize(pages, spec.title);
}

export function serialize(pages: Page[], title: string): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalogId = add(""); // placeholder 1
  const pagesId = add(""); // placeholder 2
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  for (const p of pages) {
    const content = p.ops.join("\n");
    const contentId = add(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`);
    const pid = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${p.w.toFixed(2)} ${p.h.toFixed(2)}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pid);
  }
  const infoId = add(`<< /Title (${pdfEscape(title)}) /Producer (Rais Timesheet) /Creator (Rais Timesheet) >>`);
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [enc.encode(out)];
  let pos = chunks[0]!.length;
  objects.forEach((body, i) => {
    offsets.push(pos);
    const s = `${i + 1} 0 obj\n${body}\nendobj\n`;
    const b = latin1(s);
    chunks.push(b);
    pos += b.length;
  });
  const xrefPos = pos;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) xref += `${String(o).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  chunks.push(latin1(xref));
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const result = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { result.set(c, o); o += c.length; }
  return result;
}

function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}
