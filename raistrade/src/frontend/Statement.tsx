import { useState } from "react";
import { BY_CODE } from "../shared/market";
import { TEMPLATE_BY_ID } from "../shared/strategies";
import { activityShariah, purification, PURIFY_NOTE, SHARIAH_LABEL, type ShariahStatus } from "../shared/shariah";
import { DISCLAIMER } from "../shared/adsContent";
import { FEE_SCHEDULE } from "../shared/fees";
import { api } from "./api";
import { rate } from "./currency";
import { toast } from "./toast";

// Activity statement for a session, in MYR, laid out the way Malaysian statements usually are:
// period, currency and FX rate disclosed, itemised fees and taxes (stamp duty, SST), a full
// transaction ledger, Shariah classification with purification, and the audit trail.
// Bank Negara Malaysia prescribes no format for personal investment statements — this follows
// common local practice and is not a regulatory filing.

interface Data { s: any; rules: any[]; trades: any[]; orders: any[]; bins: any[]; audit: any[]; fx: number; at: Date }

async function gather(sessionId: number): Promise<Data> {
  const q = `session=${sessionId}`;
  const [d, t, o, b, a] = await Promise.all([api(`/api/sessions/${sessionId}`), api(`/api/trades/all?${q}`), api(`/api/trd/orders?${q}`), api(`/api/binary/trades?${q}`), api(`/api/audit?${q}`)]);
  return { s: d.data.summary, rules: d.data.rules, trades: t.data, orders: o.data, bins: b.data, audit: a.data, fx: rate() === 1 ? 4.3 : rate(), at: new Date() };
}

const dt = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" }) : "—");
const rm = (usd: number, fx: number) => Math.round(usd * fx * 100) / 100;

function sections(d: Data) {
  const fx = d.fx, s = d.s;
  const rows = d.trades.filter((t) => t.status === "WON" || t.status === "LOST").map((t) => ({ mode: (t.kind === "BINARY" ? "BINARY" : "STOCK") as "BINARY" | "STOCK", code: t.code, pnl: t.pnl ?? 0, mm: d.rules.find((r) => r.id === t.rule_id)?.money_mgmt }));
  for (const b of d.bins) if (!b.rule_id && b.status !== "OPEN") rows.push({ mode: "BINARY", code: b.code, pnl: b.profit ?? 0, mm: undefined });
  for (const o of d.orders) if (o.realized_net != null && !o.rule_id) rows.push({ mode: "STOCK", code: o.code, pnl: o.realized_net, mm: undefined });
  const p = purification(rows);
  const summary: [string, string | number][] = [
    ["Statement", `RaisTrade activity statement — Session ${s.id} (${s.name})`],
    ["Period", `${dt(s.created_at)} – ${s.stopped_at ? dt(s.stopped_at) : `${dt(d.at.getTime())} (session running)`}`],
    ["Generated", dt(d.at.getTime())],
    ["Reporting currency", "MYR (Ringgit Malaysia)"],
    ["Exchange rate used", `1 USD = RM ${fx.toFixed(4)} (simulated USD/MYR at generation time)`],
    ["Account type", "Paper trading (practice) — simulated market"],
    ["Opening balance — practice (binary)", rm(s.start_binary, fx)], ["Closing balance — practice (binary)", rm(s.end_binary, fx)],
    ["Opening balance — stock", rm(s.start_stock, fx)], ["Closing balance — stock", rm(s.end_stock, fx)],
    ["Net realised P/L", rm(s.pnl, fx)], ["Closed trades", s.trades], ["Win rate", s.win_rate == null ? "—" : `${(s.win_rate * 100).toFixed(1)}%`],
    ["Robots (running / total)", `${s.active_rules} / ${s.rules}`], ["Stock fees & taxes", rm(s.fees ?? 0, fx)], ["Total trading costs", rm(s.costs, fx)],
    ["Purification — must give away (haram)", rm(p.mustPurify, fx)], ["Purification — recommended (syubhah)", rm(p.recommendPurify, fx)], ["Clean (halal) net result", rm(p.halalNet, fx)],
    ["Fee schedule", `${FEE_SCHEDULE.version} (${FEE_SCHEDULE.basis})`],
  ];
  const shariah = (["compliant", "doubtful", "not"] as ShariahStatus[]).map((k) => { const c = p.classes[k]; return [SHARIAH_LABEL[k].long, c.trades, rm(c.profit, fx), rm(c.loss, fx), rm(c.net, fx), `${(c.shareOfProfit * 100).toFixed(1)}%`, rm(c.purify, fx)]; });
  const robots = d.rules.map((r) => { const n = r.wins + r.losses; return [r.name, TEMPLATE_BY_ID[r.template]?.name ?? r.template, r.code, r.mode, r.mode === "BINARY" ? rm(r.amount, fx) : r.amount, r.wins, r.losses, n ? `${((r.wins / n) * 100).toFixed(1)}%` : "—", r.mode === "BINARY" ? `${(100 / (1 + (BY_CODE[r.code]?.payout ?? 0.85))).toFixed(1)}%` : "—", rm(r.pnl, fx), r.status, SHARIAH_LABEL[activityShariah(r.mode, r.code, r.money_mgmt).status].short]; });
  const ledger = d.trades.map((t) => [t.id, dt(t.opened_at), dt(t.closed_at), t.rule_name, t.code, t.kind, t.side, t.kind === "BINARY" ? rm(t.qty, fx) : t.qty, t.entry_price, t.exit_price ?? "", t.status, t.pnl == null ? "" : rm(t.pnl, fx), SHARIAH_LABEL[activityShariah(t.kind === "BINARY" ? "BINARY" : "STOCK", t.code).status].short]);
  const bins = d.bins.map((b) => [b.id, dt(b.open_time), dt(b.expire_time), b.code, b.direction === "CALL" ? "Higher" : "Lower", rm(b.amount, fx), b.strike, b.close_price ?? "", `${Math.round(b.payout * 100)}%`, b.status, b.profit == null ? "" : rm(b.profit, fx), b.rule_id ? "Robot" : "Manual"]);
  const fee = (o: any, kind: string) => { try { return rm((JSON.parse(o.costs ?? "[]") as any[]).filter((l) => l.kind === kind).reduce((a, l) => a + l.amount, 0), fx); } catch { return 0; } };
  const orders = d.orders.map((o) => [o.id, dt(o.create_time), o.code, o.trd_side, o.order_type === "NORMAL" ? "Limit" : "Market", o.qty, o.dealt_avg_price ?? "", o.status, fee(o, "commission"), fee(o, "platform"), fee(o, "exchange"), fee(o, "regulatory"), fee(o, "tax"), rm(o.fee ?? 0, fx), rm(o.spread_cost ?? 0, fx), rm(Math.max(0, o.slippage ?? 0), fx), o.realized_net == null ? "" : rm(o.realized_net, fx), o.fee_version ?? ""]);
  const audit = d.audit.map((a) => [dt(a.ts), a.actor, a.event, a.rule_name ?? "", String(a.detail ?? "").slice(0, 300)]);
  return {
    p, summary,
    tables: [
      { name: "Shariah & purification", head: ["Source", "Trades", "Profit (RM)", "Loss (RM)", "Net (RM)", "% of profit", "To purify (RM)"], rows: shariah, money: [2, 3, 4, 6] },
      { name: "Robots", head: ["Robot", "Strategy", "Market", "Mode", "Stake (RM) / Qty", "Wins", "Losses", "Win rate", "Break-even", "Net P/L (RM)", "Status", "Shariah"], rows: robots, money: [9] },
      { name: "Robot trades", head: ["#", "Opened", "Closed", "Robot", "Market", "Type", "Side", "Size", "Entry", "Exit", "Result", "P/L (RM)", "Shariah"], rows: ledger, money: [11] },
      { name: "Binary options", head: ["#", "Opened", "Expiry", "Market", "Direction", "Stake (RM)", "Strike", "Close", "Payout", "Result", "Profit (RM)", "Source"], rows: bins, money: [5, 10] },
      { name: "Stock orders & fees", head: ["#", "Time", "Market", "Side", "Type", "Qty", "Fill", "Status", "Commission", "Platform", "Exchange", "Regulatory", "Stamp duty + SST", "Total fees (RM)", "Spread (RM)", "Slippage (RM)", "Net P/L (RM)", "Fee schedule"], rows: orders, money: [8, 9, 10, 11, 12, 13, 14, 15, 16] },
      { name: "Audit trail", head: ["Time", "Actor", "Event", "Robot", "Detail"], rows: audit, money: [] },
    ],
  };
}

async function excel(d: Data) {
  const ExcelJS = (await import("exceljs")).default;
  const { summary, tables } = sections(d);
  const wb = new ExcelJS.Workbook();
  wb.creator = "RaisTrade"; wb.created = d.at;
  const ORANGE = "FFF97316", DARK = "FF09090B", ZEBRA = "FFF4F4F5";
  const ws = wb.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 42 }, { width: 70 }];
  ws.mergeCells("A1:B1"); ws.getCell("A1").value = "RaisTrade — Activity Statement";
  ws.getCell("A1").font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } }; ws.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  ws.getRow(1).height = 32;
  ws.mergeCells("A2:B2"); ws.getCell("A2").value = DISCLAIMER; ws.getCell("A2").font = { italic: true, size: 9, color: { argb: "FF71717A" } };
  summary.forEach(([k, v], i) => {
    const r = ws.getRow(i + 4); r.getCell(1).value = k; r.getCell(2).value = v;
    r.getCell(1).font = { bold: true, color: { argb: "FF3F3F46" } };
    if (typeof v === "number") { r.getCell(2).numFmt = '"RM" #,##0.00;[Red]-"RM" #,##0.00'; r.getCell(2).alignment = { horizontal: "left" }; }
    if (i % 2 === 0) [1, 2].forEach((c) => (r.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } }));
  });
  const n = summary.length + 5;
  ws.mergeCells(`A${n}:B${n}`); ws.getCell(`A${n}`).value = PURIFY_NOTE; ws.getCell(`A${n}`).alignment = { wrapText: true }; ws.getRow(n).height = 45;
  for (const t of tables) {
    const sh = wb.addWorksheet(t.name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
    sh.addRow(t.head);
    t.rows.forEach((r) => sh.addRow(r));
    sh.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ORANGE } }; c.alignment = { vertical: "middle", wrapText: true }; });
    sh.getRow(1).height = 30;
    t.money.forEach((i) => (sh.getColumn(i + 1).numFmt = '#,##0.00;[Red]-#,##0.00'));
    sh.columns.forEach((col, i) => { let w = String(t.head[i]).length; col.eachCell?.({ includeEmpty: false }, (c) => { w = Math.max(w, String(c.value ?? "").length); }); col.width = Math.min(60, Math.max(10, w + 2)); });
    sh.eachRow((row, i) => { if (i > 1 && i % 2 === 0) row.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } })); });
    if (t.rows.length) sh.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.head.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `RaisTrade-statement-session-${d.s.id}.xlsx`);
}

async function pdf(d: Data) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const { summary, tables, p } = sections(d);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const ORANGE: [number, number, number] = [249, 115, 22], DARK: [number, number, number] = [9, 9, 11];
  // Cover band
  doc.setFillColor(...DARK); doc.rect(0, 0, W, 86, "F");
  doc.setFillColor(...ORANGE); doc.roundedRect(36, 24, 38, 38, 7, 7, "F");
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(3); doc.lines([[7, -7], [5, 5], [8, -10]], 42, 50);
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.text("Rais", 86, 50);
  doc.setTextColor(...ORANGE); doc.text("Trade", 86 + doc.getTextWidth("Rais"), 50);
  doc.setTextColor(200, 200, 205); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("Activity statement · reporting currency MYR", 86, 66);
  doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.text(`Session ${d.s.id} · ${d.s.name}`, W - 36, 44, { align: "right" });
  doc.setTextColor(200, 200, 205); doc.setFontSize(9); doc.text(String(summary[1]![1]), W - 36, 60, { align: "right" });
  // KPI cards
  const kpis: [string, string, boolean | null][] = [
    ["Net realised P/L", `RM ${rm(d.s.pnl, d.fx).toFixed(2)}`, d.s.pnl >= 0],
    ["Closing balance (practice)", `RM ${rm(d.s.end_binary, d.fx).toFixed(2)}`, null],
    ["Win rate", d.s.win_rate == null ? "—" : `${(d.s.win_rate * 100).toFixed(1)}%`, null],
    ["Closed trades", String(d.s.trades), null],
    ["Must purify (haram)", `RM ${rm(p.mustPurify, d.fx).toFixed(2)}`, p.mustPurify > 0 ? false : null],
    ["Clean (halal) net", `RM ${rm(p.halalNet, d.fx).toFixed(2)}`, p.halalNet >= 0],
  ];
  const cw = (W - 72 - 5 * 10) / 6;
  kpis.forEach(([l, v, good], i) => {
    const x = 36 + i * (cw + 10), y = 104;
    doc.setFillColor(244, 244, 245); doc.roundedRect(x, y, cw, 54, 6, 6, "F");
    doc.setFontSize(8); doc.setTextColor(113, 113, 122); doc.text(l.toUpperCase(), x + 10, y + 18);
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.setTextColor(...(good === true ? [22, 163, 74] : good === false ? [220, 38, 38] : [9, 9, 11]) as [number, number, number]);
    doc.text(v, x + 10, y + 40); doc.setFont("helvetica", "normal");
  });
  const common = { theme: "striped" as const, headStyles: { fillColor: ORANGE, textColor: 255, fontStyle: "bold" as const, fontSize: 8 }, bodyStyles: { fontSize: 7.5, textColor: 30 }, alternateRowStyles: { fillColor: [244, 244, 245] as [number, number, number] }, margin: { left: 36, right: 36, top: 40, bottom: 40 } };
  autoTable(doc, { ...common, startY: 176, head: [["Item", "Value"]], body: summary.map(([k, v]) => [k, typeof v === "number" ? `RM ${v.toFixed(2)}` : v]), columnStyles: { 0: { fontStyle: "bold", cellWidth: 240 } } });
  const fmt = (r: unknown[], money: number[]) => r.map((v, i) => (typeof v === "number" && money.includes(i) ? v.toFixed(2) : v == null ? "" : String(v)));
  for (const t of tables) {
    const rows = t.name === "Audit trail" ? t.rows.slice(0, 400) : t.rows;
    doc.addPage();
    doc.setFontSize(13); doc.setTextColor(...DARK); doc.setFont("helvetica", "bold"); doc.text(t.name, 36, 32); doc.setFont("helvetica", "normal");
    if (t.name === "Shariah & purification") { doc.setFontSize(8); doc.setTextColor(113, 113, 122); doc.text(doc.splitTextToSize(PURIFY_NOTE, W - 72), 36, 46); }
    autoTable(doc, { ...common, startY: t.name === "Shariah & purification" ? 70 : 44, head: [t.head], body: rows.map((r) => fmt(r, t.money)), columnStyles: Object.fromEntries(t.money.map((i) => [i, { halign: "right" as const }])) });
    if (rows.length < t.rows.length) { doc.setFontSize(8); doc.text(`First ${rows.length} of ${t.rows.length} entries — see the Excel statement for all.`, 36, (doc as any).lastAutoTable.finalY + 14); }
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(140, 140, 150);
    doc.text(`RaisTrade · generated ${dt(d.at.getTime())} · 1 USD = RM ${d.fx.toFixed(4)} · ${DISCLAIMER}`, 36, H - 18, { maxWidth: W - 140 });
    doc.text(`Page ${i} of ${pages}`, W - 36, H - 18, { align: "right" });
  }
  doc.save(`RaisTrade-statement-session-${d.s.id}.pdf`);
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Excel + PDF statement buttons for a session. */
export function StatementButtons({ sessionId }: { sessionId: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (kind: "xlsx" | "pdf") => {
    setBusy(kind);
    try { const d = await gather(sessionId); await (kind === "xlsx" ? excel(d) : pdf(d)); toast.ok(`Statement downloaded (${kind.toUpperCase()})`); }
    catch (e) { toast.err((e as Error).message); }
    setBusy(null);
  };
  return (
    <div className="d-inline-flex gap-1">
      <button className="btn btn-sm btn-outline-secondary" disabled={!!busy} onClick={() => run("xlsx")} title="Statement as an Excel workbook (summary, Shariah & purification, robots, ledgers, fees, audit)">{busy === "xlsx" ? "Preparing…" : "📊 Excel"}</button>
      <button className="btn btn-sm btn-outline-secondary" disabled={!!busy} onClick={() => run("pdf")} title="Statement as a PDF">{busy === "pdf" ? "Preparing…" : "📄 PDF"}</button>
    </div>
  );
}
