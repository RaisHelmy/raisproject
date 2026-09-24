/**
 * HR timesheet PDF: 1) overview (portrait), 2) project timeline (landscape), 3) daily timesheet (portrait).
 * Vector-drawn with the same primitives as the tabular reports, so it downloads as a file — no browser print dialog.
 */
import type { ReportData } from "./builder";
import { A4, GREY, LIGHT, MARGIN, NAVY, Page, ZEBRA, serialize, textWidth, wrap } from "./pdf";
import { formatDateShort, minutesToHuman } from "../../lib/time";

const INK = "0.12 0.16 0.22";
const RULE = "0.88 0.9 0.92";
const PALETTE = ["0.12 0.44 0.92", "0.18 0.64 0.31", "0.75 0.53 0.0", "0.51 0.31 0.87", "0.81 0.13 0.18", "0.04 0.41 0.85"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Row = ReportData["timesheets"][number];
export interface Lane { label: string; header: boolean; color: string; first: string; last: string; minutes: number; days: Map<string, number>; tasks: number }

function mix(color: string, amount: number): string {
  // blend towards white: amount 0 = colour, 1 = white
  return color.split(" ").map((c) => (Number(c) + (1 - Number(c)) * amount).toFixed(3)).join(" ");
}
function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a: string, b: string): number { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000); }
function mondayOf(iso: string): string { const d = new Date(iso + "T00:00:00Z"); return addDays(iso, -((d.getUTCDay() + 6) % 7)); }
function ellipsis(s: string, max: number, size: number, bold = false): string {
  if (textWidth(s, size, bold) <= max) return s;
  let t = s;
  while (t.length > 1 && textWidth(t + "...", size, bold) > max) t = t.slice(0, -1);
  return t + "...";
}

export function lanes(rows: Row[]): Lane[] {
  const projects = new Map<string, { name: string; groups: Map<string, Lane> }>();
  for (const r of rows) {
    const p = projects.get(r.project) ?? { name: r.project_name, groups: new Map() };
    const key = r.lane_key;
    const g = p.groups.get(key) ?? { label: r.lane_label, header: false, color: "", first: r.date, last: r.date, minutes: 0, days: new Map(), tasks: 0 };
    if (r.date < g.first) g.first = r.date;
    if (r.date > g.last) g.last = r.date;
    g.minutes += r.minutes; g.tasks++; g.days.set(r.date, (g.days.get(r.date) ?? 0) + r.minutes);
    p.groups.set(key, g); projects.set(r.project, p);
  }
  const out: Lane[] = [];
  const ordered = [...projects.entries()].sort((a, b) => [...a[1].groups.values()].map((g) => g.first).sort()[0]!.localeCompare([...b[1].groups.values()].map((g) => g.first).sort()[0]!));
  ordered.forEach(([code, p], i) => {
    const color = PALETTE[i % PALETTE.length]!;
    const groups = [...p.groups.values()].sort((a, b) => a.first.localeCompare(b.first) || b.minutes - a.minutes);
    const days = new Map<string, number>();
    for (const g of groups) for (const [d, m] of g.days) days.set(d, (days.get(d) ?? 0) + m);
    out.push({ label: p.name && p.name !== code ? `${code} - ${p.name}` : code, header: true, color, first: groups[0]!.first, last: groups.map((g) => g.last).sort().at(-1)!, minutes: groups.reduce((a, g) => a + g.minutes, 0), days, tasks: groups.reduce((a, g) => a + g.tasks, 0) });
    for (const g of groups) out.push({ ...g, color });
  });
  return out;
}

export function buildHrPdf(d: ReportData): Uint8Array {
  const pages: Page[] = [];
  const rows = d.timesheets;
  const totalMin = rows.reduce((a, r) => a + r.minutes, 0);
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const from = d.period.from, to = d.period.to;
  const simple = !!d.filters.simplified;

  const header = (page: Page, sectionLabel: string) => {
    page.rect(0, page.h - 34, page.w, 34, NAVY);
    page.text(MARGIN, page.h - 22, `${d.app.toUpperCase()}  |  HR TIMESHEET`, 10, true, "1 1 1");
    page.textRight(page.w - MARGIN, page.h - 22, `${sectionLabel}  |  ${d.period.label}`, 8.5, false, "1 1 1");
  };

  // ---------- 1. Overview (portrait) ----------
  {
    const page = new Page(A4.w, A4.h); pages.push(page); header(page, "1. Overview");
    const W = page.w, contentW = W - MARGIN * 2;
    let y = page.h - 34 - 30;
    page.text(MARGIN, y, `Timesheet - ${d.generated_by}`, 20, true, INK); y -= 18;
    page.text(MARGIN, y, d.client_project, 11, false, GREY); y -= 14;
    page.text(MARGIN, y, d.period.label, 10, false, GREY); y -= 26;

    const kpis = [
      { label: "Total hours", value: minutesToHuman(totalMin) },
      { label: "Tasks", value: String(rows.length) },
      { label: "Working days", value: String(dates.length) },
      { label: "Avg per working day", value: minutesToHuman(dates.length ? Math.round(totalMin / dates.length) : 0) },
    ];
    const gap = 10, tileW = (contentW - gap * (kpis.length - 1)) / kpis.length, tileH = 50;
    kpis.forEach((k, i) => { const x = MARGIN + i * (tileW + gap); page.rect(x, y - tileH, tileW, tileH, LIGHT); page.text(x + 10, y - 17, k.label.toUpperCase(), 7, true, GREY); page.text(x + 10, y - 38, k.value, 16, true, INK); });
    y -= tileH + 26;

    page.text(MARGIN, y, "Overview", 12, true, INK); y -= 16;
    const projects = [...new Set(rows.map((r) => r.project))];
    const kv: [string, string][] = [
      ["Name", d.generated_by], ["Period", d.period.label], ...(simple ? [] : [["Projects", projects.join(", ") || "-"] as [string, string]]),
      ["Scope", `${d.filters.status === "APPROVED" ? "Approved work only" : "All recorded work"}${d.filters.simplified ? " - summary view (activity types only)" : ""}`],
      ["First / last day", dates.length ? `${formatDateShort(dates[0]!)} - ${formatDateShort(dates[dates.length - 1]!)}` : "-"],
      ["Generated", `${d.generated_at.slice(0, 16).replace("T", " ")} UTC`],
    ];
    for (const [k, v] of kv) { page.text(MARGIN, y - 2, k, 9, true, GREY); page.text(MARGIN + 110, y - 2, ellipsis(v, contentW - 120, 9), 9, false, INK); page.line(MARGIN, y - 8, MARGIN + contentW, y - 8, RULE, 0.4); y -= 16; }
    y -= 14;

    const table = (title: string, cols: { header: string; width: number; align?: "right" }[], body: string[][], totals?: string[]) => {
      page.text(MARGIN, y, title, 12, true, INK); y -= 16;
      const units = cols.reduce((a, c) => a + c.width, 0); const colW = cols.map((c) => (c.width / units) * contentW);
      page.rect(MARGIN, y - 14, contentW, 18, NAVY);
      let x = MARGIN; cols.forEach((c, i) => { if (c.align === "right") page.textRight(x + colW[i]! - 6, y - 8, c.header, 8, true, "1 1 1"); else page.text(x + 6, y - 6, c.header, 8, true, "1 1 1"); x += colW[i]!; });
      y -= 20;
      body.forEach((r, ri) => { if (ri % 2) page.rect(MARGIN, y - 10, contentW, 14, ZEBRA); let x2 = MARGIN; r.forEach((cell, i) => { if (cols[i]!.align === "right") page.textRight(x2 + colW[i]! - 6, y - 6, cell, 8.5); else page.text(x2 + 6, y - 6, cell, 8.5); x2 += colW[i]!; }); page.line(MARGIN, y - 10, MARGIN + contentW, y - 10, RULE, 0.4); y -= 14; });
      if (totals) { page.rect(MARGIN, y - 10, contentW, 14, LIGHT); let x3 = MARGIN; totals.forEach((cell, i) => { if (cols[i]!.align === "right") page.textRight(x3 + colW[i]! - 6, y - 6, cell, 8.5, true); else page.text(x3 + 6, y - 6, cell, 8.5, true); x3 += colW[i]!; }); y -= 14; }
      y -= 22;
    };

    const byProject = d.hours_by_project;
    table(simple ? "Hours by activity type" : "Hours by project", [{ header: simple ? "Activity type" : "Project", width: 3 }, { header: "Tasks", width: 1, align: "right" }, { header: "Days", width: 1, align: "right" }, { header: "Hours", width: 1.4, align: "right" }, { header: "Share", width: 1, align: "right" }],
      byProject.map((p) => [simple ? p.project : `${p.project} - ${rows.find((r) => r.project === p.project)?.project_name ?? ""}`, String(p.tasks), String(new Set(rows.filter((r) => (simple ? r.task : r.project) === p.project).map((r) => r.date)).size), minutesToHuman(p.minutes), `${totalMin ? Math.round((p.minutes / totalMin) * 100) : 0}%`]),
      ["Total", String(rows.length), String(dates.length), minutesToHuman(totalMin), "100%"]);

    const byMonth = new Map<string, { tasks: number; minutes: number; days: Set<string> }>();
    for (const r of rows) { const k = r.date.slice(0, 7); const m = byMonth.get(k) ?? { tasks: 0, minutes: 0, days: new Set() }; m.tasks++; m.minutes += r.minutes; m.days.add(r.date); byMonth.set(k, m); }
    table("Hours by month", [{ header: "Month", width: 3 }, { header: "Working days", width: 1.4, align: "right" }, { header: "Tasks", width: 1, align: "right" }, { header: "Hours", width: 1.4, align: "right" }],
      [...byMonth.entries()].sort().map(([k, m]) => [`${MONTHS_LONG[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, String(m.days.size), String(m.tasks), minutesToHuman(m.minutes)]),
      ["Total", String(dates.length), String(rows.length), minutesToHuman(totalMin)]);

    page.text(MARGIN, y, "Report structure", 12, true, INK); y -= 16;
    for (const line of ["1. Overview - this page.", simple ? "2. Activity timeline (landscape) - one lane per activity type; bars span first to last work day, solid marks are the actual work days." : "2. Project timeline (landscape) - one lane per deliverable under its project; bars span first to last work day, solid marks are the actual work days.", simple ? "3. Daily timesheet - every activity with day, start and end time, duration, daily subtotals and grand total." : "3. Daily timesheet - every task with day, start and end time, duration, daily subtotals and grand total."]) {
      for (const ln of wrap(line, contentW, 9)) { page.text(MARGIN, y - 2, ln, 9, false, INK); y -= 12; }
    }
  }

  // ---------- 2. Timeline (landscape) ----------
  {
    const W = A4.h, H = A4.w;
    const all = simple ? lanes(rows).filter((l) => !l.header) : lanes(rows);
    const labelW = 190, plotX = MARGIN + labelW, plotW = W - MARGIN - plotX;
    const totalDays = daysBetween(from, to) + 1, pxDay = plotW / totalDays;
    const x = (iso: string) => plotX + daysBetween(from, iso) * pxDay;
    const headTop = H - 34 - 22, gridTop = headTop - 30, bottom = MARGIN + 24;
    // Few lanes (e.g. the simplified view): use the page height instead of thin 15pt rows.
    const rowH = Math.min(34, Math.max(15, Math.floor((gridTop - 12 - bottom) / Math.max(1, all.length))));
    const labelSize = rowH >= 24 ? 9 : 7;
    const perPage = Math.max(1, Math.floor((gridTop - bottom) / rowH));
    for (let start = 0; start < all.length; start += perPage) {
      const page = new Page(W, H); pages.push(page); header(page, simple ? "2. Activity timeline" : "2. Project timeline");
      page.text(MARGIN, headTop + 4, simple ? "Activity timeline" : "Project timeline", 13, true, INK);
      page.textRight(W - MARGIN, headTop + 4, "bar = first to last work day  |  solid marks = actual work days  |  label = hours", 7.5, false, GREY);
      // month bands
      for (let m = from.slice(0, 8) + "01", i = 0; m <= to; i++) {
        const next = addDays(addDays(m, 27).slice(0, 8) + "28", 4).slice(0, 8) + "01";
        const s = m < from ? from : m, e = addDays(next, -1) > to ? to : addDays(next, -1);
        const x1 = x(s), x2 = x(e) + pxDay;
        page.rect(x1, gridTop, x2 - x1, 14, i % 2 ? "0.965 0.97 0.98" : "0.93 0.94 0.955");
        if (x2 - x1 > 30) page.text(x1 + 3, gridTop + 4, `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`, 8, true, INK);
        m = next;
      }
      // week ticks
      const slice = all.slice(start, start + perPage);
      const gridBottom = gridTop - slice.length * rowH;
      for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) { if (w < from) continue; page.line(x(w), gridTop, x(w), gridBottom, "0.92 0.93 0.95", 0.4); if (pxDay * 7 > 22) page.text(x(w) + 1, gridTop - 8, `${w.slice(8, 10)}/${w.slice(5, 7)}`, 5.5, false, GREY); }
      page.line(MARGIN, gridTop - 12, W - MARGIN, gridTop - 12, RULE, 0.5);
      // lanes
      slice.forEach((l, i) => {
        const yTop = gridTop - 12 - i * rowH, yb = yTop - rowH;
        if (l.header) page.rect(MARGIN, yb, W - MARGIN * 2, rowH, "0.96 0.97 0.98");
        page.line(MARGIN, yb, W - MARGIN, yb, RULE, 0.3);
        const indent = l.header || simple ? 2 : 12;
        const size = l.header ? 7.5 : labelSize;
        page.text(MARGIN + indent, yb + rowH / 2 - size / 3, ellipsis(l.label, labelW - indent - 4, size, l.header), size, l.header, INK);
        const bx = x(l.first), bw = Math.max(pxDay, x(l.last) + pxDay - bx);
        if (l.header) page.rect(bx, yb + rowH / 2 - 2, bw, 4, mix(l.color, 0.55));
        else { page.rect(bx, yb + 3, bw, rowH - 6, mix(l.color, 0.82)); page.strokeRect(bx, yb + 3, bw, rowH - 6, mix(l.color, 0.45), 0.4); }
        for (const [day, m] of l.days) page.rect(x(day), l.header ? yb + rowH / 2 - 3.5 : yb + 3, Math.max(1.6, pxDay), l.header ? 7 : rowH - 6, mix(l.color, Math.max(0, 0.35 - m / 1400)));
        const label = minutesToHuman(l.minutes), lw = textWidth(label, 6.5);
        if (bx + bw + lw + 6 <= W - MARGIN) page.text(bx + bw + 3, yb + rowH / 2 - 2, label, 6.5, false, GREY);
        else if (bx - lw - 4 > plotX) page.text(bx - lw - 3, yb + rowH / 2 - 2, label, 6.5, false, GREY);
        else page.text(bx + 3, yb + rowH / 2 - 2, label, 6.5, true, INK);
      });
      const today = new Date().toISOString().slice(0, 10);
      if (today >= from && today <= to) { page.dashedLine(x(today), gridTop, x(today), gridBottom, "0.81 0.13 0.18"); page.text(x(today) + 2, gridBottom + 2, "today", 6, false, "0.81 0.13 0.18"); }
      if (all.length > perPage) page.textRight(W - MARGIN, bottom - 4, `Lanes ${start + 1}-${Math.min(all.length, start + perPage)} of ${all.length}`, 7, false, GREY);
    }
  }

  // ---------- 3. Daily timesheet (portrait) ----------
  {
    const W = A4.w, H = A4.h, contentW = W - MARGIN * 2;
    const allCols = [{ header: "No", width: 0.45, align: "right" as const }, { header: "Date", width: 1.35 }, { header: "Day", width: 1.05 }, { header: "Project", width: 0.9 }, { header: simple ? "Activity" : "Task", width: 4.35 }, { header: "Start", width: 0.8 }, { header: "End", width: 0.8 }, { header: "Duration", width: 0.95, align: "right" as const }];
    const cols = simple ? allCols.filter((c) => c.header !== "Project") : allCols;
    const units = cols.reduce((a, c) => a + c.width, 0), colW = cols.map((c) => (c.width / units) * contentW);
    const LINE = 10.5, SIZE = 7.5;
    let page!: Page, y = 0;
    const drawHead = () => { page.rect(MARGIN, y - 14, contentW, 18, NAVY); let x = MARGIN; cols.forEach((c, i) => { if (c.align === "right") page.textRight(x + colW[i]! - 5, y - 8, c.header, 7.5, true, "1 1 1"); else page.text(x + 5, y - 8, c.header, 7.5, true, "1 1 1"); x += colW[i]!; }); y -= 20; };
    const newPage = (first: boolean) => { page = new Page(W, H); pages.push(page); header(page, "3. Daily timesheet"); y = H - 34 - 26; if (first) { page.text(MARGIN, y, "Daily timesheet", 13, true, INK); y -= 6; page.text(MARGIN, y - 8, `${rows.length} tasks over ${dates.length} working days  |  ${minutesToHuman(totalMin)} total`, 8.5, false, GREY); y -= 22; } else y -= 4; drawHead(); };
    newPage(true);
    let n = 0;
    for (const date of dates) {
      const items = rows.filter((r) => r.date === date);
      items.forEach((r, idx) => {
        n++;
        const cells = [String(n), idx === 0 ? formatDateShort(r.date) : "", idx === 0 ? r.day : "", ...(simple ? [] : [r.project]), r.task, r.start || "-", r.end || "-", minutesToHuman(r.minutes)];
        const wrapped = cells.map((c, i) => wrap(c, colW[i]! - 10, SIZE));
        const lines = Math.max(...wrapped.map((l) => l.length)), rowH = lines * LINE + 5;
        if (y - rowH < MARGIN + 24) newPage(false);
        if (idx === 0 && n > 1) page.line(MARGIN, y + 4, MARGIN + contentW, y + 4, "0.75 0.78 0.82", 0.6);
        let x = MARGIN;
        wrapped.forEach((ls, i) => { ls.forEach((ln, li) => { const yy = y - 7 - li * LINE; if (cols[i]!.align === "right") page.textRight(x + colW[i]! - 5, yy, ln, SIZE); else page.text(x + 5, yy, ln, SIZE, i === 1); }); x += colW[i]!; });
        page.line(MARGIN, y - rowH + 4, MARGIN + contentW, y - rowH + 4, RULE, 0.3);
        y -= rowH;
      });
      const sub = items.reduce((a, r) => a + r.minutes, 0);
      if (y - 14 < MARGIN + 24) newPage(false);
      page.rect(MARGIN, y - 10, contentW, 14, ZEBRA);
      page.textRight(MARGIN + colW.slice(0, cols.length - 1).reduce((a, b) => a + b, 0) - 5, y - 6, `Total ${formatDateShort(date)}  (${items.length} task${items.length === 1 ? "" : "s"})`, 7, false, GREY);
      page.textRight(MARGIN + contentW - 5, y - 6, minutesToHuman(sub), 7.5, true, INK);
      y -= 14;
    }
    if (y - 18 < MARGIN + 24) newPage(false);
    page.rect(MARGIN, y - 12, contentW, 18, LIGHT);
    page.text(MARGIN + 5, y - 6, `Grand total - ${rows.length} tasks over ${dates.length} working days`, 8.5, true, INK);
    page.textRight(MARGIN + contentW - 5, y - 6, minutesToHuman(totalMin), 9, true, INK);
  }

  pages.forEach((p, i) => {
    p.line(MARGIN, MARGIN + 14, p.w - MARGIN, MARGIN + 14, "0.8 0.8 0.8", 0.5);
    p.text(MARGIN, MARGIN, `${d.generated_by}  |  Generated ${d.generated_at.slice(0, 16).replace("T", " ")} UTC  |  ${d.app}`, 7.5, false, GREY);
    p.textRight(p.w - MARGIN, MARGIN, `Page ${i + 1} of ${pages.length}`, 7.5, false, GREY);
  });
  return serialize(pages, `HR Timesheet - ${d.generated_by}`);
}
