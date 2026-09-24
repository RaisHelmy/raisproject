/**
 * Dependency-free XLSX writer for Workers.
 * Supports: multiple sheets, bold header row, frozen header, autofilter, column widths,
 * number/date/duration formats, title rows, totals rows. Output is a ZIP (stored entries).
 */

export type CellValue = string | number | boolean | null | undefined | { date: string } | { minutes: number } | { formula: string } | { styled: string | number; s: CellStyleName } | { boldMinutes: number };

export interface SheetColumn { header: string; width?: number; type?: "text" | "number" | "date" | "duration" | "percent" }
export interface Sheet {
  name: string;
  title?: string;
  subtitle?: string;
  columns: SheetColumn[];
  rows: CellValue[][];
  totals?: CellValue[];
  freeze?: boolean;
  autofilter?: boolean;
  orientation?: "portrait" | "landscape";
  /** Rows frozen above the table in addition to the header (e.g. for a wide Gantt grid, freeze these leading columns). */
  freezeCols?: number;
}

// style indices (see STYLES cellXfs order)
const S = { normal: 0, header: 1, title: 2, subtitle: 3, date: 4, duration: 5, totals: 6, totalsDuration: 7, number: 8, percent: 9, totalsNumber: 10, section: 11, bold: 12, g1: 13, g2: 14, g3: 15, g4: 16, boldDuration: 17 };
export type CellStyleName = "section" | "bold" | "g1" | "g2" | "g3" | "g4";

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const files: { name: string; data: Uint8Array }[] = [];
  const enc = new TextEncoder();
  const add = (name: string, xml: string) => files.push({ name, data: enc.encode(xml) });

  add("[Content_Types].xml", contentTypes(sheets.length));
  add("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  add("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Rais Timesheet</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`);
  add("xl/workbook.xml", workbook(sheets));
  add("xl/_rels/workbook.xml.rels", workbookRels(sheets.length));
  add("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zipStore(files);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
}

function colName(n: number): string {
  let s = "";
  n += 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function excelDate(iso: string): number {
  const ms = Date.parse(iso.slice(0, 10) + "T00:00:00Z");
  return Math.round(ms / 86400000 + 25569);
}

function cell(ref: string, v: CellValue, style: number, colType?: SheetColumn["type"]): string {
  if (v === null || v === undefined || v === "") return `<c r="${ref}" s="${style}"/>`;
  if (typeof v === "object") {
    if ("date" in v) return `<c r="${ref}" s="${S.date}"><v>${excelDate(v.date)}</v></c>`;
    if ("minutes" in v) return `<c r="${ref}" s="${style === S.totals ? S.totalsDuration : S.duration}"><v>${(v.minutes / 1440).toFixed(8)}</v></c>`;
    if ("formula" in v) return `<c r="${ref}" s="${style}"><f>${esc(v.formula)}</f></c>`;
    if ("styled" in v) {
      const st = S[v.s];
      if (typeof v.styled === "number") return `<c r="${ref}" s="${st}"><v>${v.styled}</v></c>`;
      return `<c r="${ref}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${esc(v.styled)}</t></is></c>`;
    }
    if ("boldMinutes" in v) return `<c r="${ref}" s="${S.boldDuration}"><v>${(v.boldMinutes / 1440).toFixed(8)}</v></c>`;
  }
  if (typeof v === "number") {
    if (colType === "duration") return `<c r="${ref}" s="${style === S.totals ? S.totalsDuration : S.duration}"><v>${(v / 1440).toFixed(8)}</v></c>`;
    const st = colType === "percent" ? S.percent : style === S.totals ? S.totalsNumber : S.number;
    return `<c r="${ref}" s="${st}"><v>${v}</v></c>`;
  }
  if (typeof v === "boolean") return `<c r="${ref}" s="${style}" t="b"><v>${v ? 1 : 0}</v></c>`;
  if (colType === "date" && /^\d{4}-\d{2}-\d{2}/.test(v)) return `<c r="${ref}" s="${S.date}"><v>${excelDate(v)}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function headerRowIndex(s: Sheet): number {
  let r = 1;
  if (s.title) r++;
  if (s.subtitle) r++;
  if (s.title || s.subtitle) r++;
  return r;
}

function sheetXml(s: Sheet): string {
  const rows: string[] = [];
  let r = 1;
  const ncols = Math.max(1, s.columns.length);
  if (s.title) { rows.push(`<row r="${r}">${cell(`A${r}`, s.title, S.title)}</row>`); r++; }
  if (s.subtitle) { rows.push(`<row r="${r}">${cell(`A${r}`, s.subtitle, S.subtitle)}</row>`); r++; }
  if (s.title || s.subtitle) r++; // blank spacer
  const hr = r;
  if (s.columns.some((c) => c.header)) {
    rows.push(`<row r="${r}">${s.columns.map((c, i) => cell(`${colName(i)}${r}`, c.header, S.header)).join("")}</row>`);
    r++;
  }
  const firstData = r;
  for (const row of s.rows) {
    rows.push(`<row r="${r}">${row.map((v, i) => cell(`${colName(i)}${r}`, v, S.normal, s.columns[i]?.type)).join("")}</row>`);
    r++;
  }
  const lastData = r - 1;
  if (s.totals) {
    rows.push(`<row r="${r}">${s.totals.map((v, i) => cell(`${colName(i)}${r}`, v, S.totals, s.columns[i]?.type)).join("")}</row>`);
    r++;
  }
  const cols = `<cols>${s.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 18}" customWidth="1"/>`).join("")}</cols>`;
  const fc = s.freezeCols ?? 0;
  const freeze = s.freeze !== false ? `<sheetViews><sheetView workbookViewId="0"><pane ${fc ? `xSplit="${fc}" ` : ""}ySplit="${hr}" topLeftCell="${colName(fc)}${hr + 1}" activePane="${fc ? "bottomRight" : "bottomLeft"}" state="frozen"/></sheetView></sheetViews>` : `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>`;
  const filter = s.autofilter !== false && s.rows.length ? `<autoFilter ref="A${hr}:${colName(ncols - 1)}${Math.max(lastData, firstData)}"/>` : "";
  const merges = s.title ? `<mergeCells count="${s.subtitle ? 2 : 1}"><mergeCell ref="A1:${colName(ncols - 1)}1"/>${s.subtitle ? `<mergeCell ref="A2:${colName(ncols - 1)}2"/>` : ""}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>${freeze}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows.join("")}</sheetData>${filter}${merges}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${s.orientation ?? "landscape"}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L${esc(s.title ?? s.name)}&amp;RPage &amp;P of &amp;N</oddFooter></headerFooter></worksheet>`;
}

function workbook(sheets: Sheet[]): string {
  const names = sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  const defs = sheets
    .map((s, i) => (s.autofilter !== false && s.rows.length ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(s.name.slice(0, 31))}'!$A$${headerRowIndex(s)}:$${colName(Math.max(1, s.columns.length) - 1)}$${headerRowIndex(s) + s.rows.length}</definedName>` : ""))
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="20000" windowHeight="12000"/></bookViews><sheets>${names}</sheets><definedNames>${defs}</definedNames></workbook>`;
}

function workbookRels(n: number): string {
  const rels = Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypes(n: number): string {
  const sheets = Array.from({ length: n }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${sheets}</Types>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd mmm yyyy"/><numFmt numFmtId="165" formatCode="[h]&quot;h&quot; mm&quot;m&quot;"/><numFmt numFmtId="166" formatCode="0.0%"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF1F2937"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="9"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7FD18B"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF30A14E"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B5E30"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF9CA3AF"/></top><bottom style="double"><color rgb="FF9CA3AF"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="18">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center"/></xf>
<xf numFmtId="165" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

// ---------- minimal ZIP (store method) ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const dosTime = 0x0000;
  const dosDate = 0x21; // fixed timestamp for deterministic output
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true); local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true); local.setUint32(22, f.data.length, true); local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true); cd.setUint16(14, dosDate, true); cd.setUint32(16, crc, true); cd.setUint32(20, f.data.length, true); cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint16(30, 0, true); cd.setUint16(32, 0, true); cd.setUint16(34, 0, true); cd.setUint16(36, 0, true); cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of [...parts, ...central, new Uint8Array(end.buffer)]) { out.set(p, pos); pos += p.length; }
  return out;
}
