/** HR timesheet workbook: sheet 1 Overview, sheet 2 Timeline (weekly Gantt grid), sheet 3 Timesheet — same order as the PDF. */
import type { ReportData } from "./builder";
import { lanes } from "./hr-pdf";
import { buildXlsx, type CellValue, type Sheet } from "./xlsx";
import { minutesToHuman } from "../../lib/time";

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function mondayOf(iso: string): string { const d = new Date(iso + "T00:00:00Z"); return addDays(iso, -((d.getUTCDay() + 6) % 7)); }

export function buildHrXlsx(d: ReportData): Uint8Array {
  const rows = d.timesheets;
  const total = rows.reduce((a, r) => a + r.minutes, 0);
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const simple = !!d.filters.simplified;
  const sub = `${d.generated_by} · ${d.period.label} · ${d.filters.status === "APPROVED" ? "Approved work only" : "All recorded work"}${simple ? " · summary of work activities" : ""}`;
  const blank = (n: number): CellValue[] => Array.from({ length: n }, () => "");
  const W = 6;

  // ---- Sheet 1: Overview ----
  const ov: CellValue[][] = [];
  const section = (t: string) => { ov.push(blank(W)); ov.push([{ styled: t, s: "section" }, ...Array.from({ length: W - 1 }, () => ({ styled: "", s: "section" as const }))]); };
  section("Summary");
  const kv: [string, CellValue][] = [
    ["Name", d.generated_by], ["Period", d.period.label], ...(simple ? [] : [["Projects", [...new Set(rows.map((r) => r.project))].join(", ")] as [string, CellValue]]),
    ["Total hours", { boldMinutes: total }], ["Tasks", rows.length], ["Working days", dates.length],
    ["Average per working day", { minutes: dates.length ? Math.round(total / dates.length) : 0 }],
    ["First / last day", dates.length ? `${dates[0]} – ${dates[dates.length - 1]}` : "—"], ["Generated", `${d.generated_at.slice(0, 16).replace("T", " ")} UTC`],
  ];
  for (const [k, v] of kv) ov.push([{ styled: k, s: "bold" }, v, "", "", "", ""]);
  section(simple ? "Hours by activity type" : "Hours by project");
  ov.push([{ styled: simple ? "Activity type" : "Project", s: "bold" }, { styled: simple ? "" : "Name", s: "bold" }, { styled: "Tasks", s: "bold" }, { styled: "Days", s: "bold" }, { styled: "Hours", s: "bold" }, { styled: "Share", s: "bold" }]);
  for (const p of d.hours_by_project) ov.push([p.project, simple ? "" : rows.find((r) => r.project === p.project)?.project_name ?? "", p.tasks, new Set(rows.filter((r) => (simple ? r.task : r.project) === p.project).map((r) => r.date)).size, { minutes: p.minutes }, `${total ? Math.round((p.minutes / total) * 100) : 0}%`]);
  ov.push([{ styled: "Total", s: "bold" }, "", rows.length, dates.length, { boldMinutes: total }, "100%"]);
  section("Hours by month");
  ov.push([{ styled: "Month", s: "bold" }, "", { styled: "Working days", s: "bold" }, { styled: "Tasks", s: "bold" }, { styled: "Hours", s: "bold" }, ""]);
  const byMonth = new Map<string, { tasks: number; minutes: number; days: Set<string> }>();
  for (const r of rows) { const k = r.date.slice(0, 7); const m = byMonth.get(k) ?? { tasks: 0, minutes: 0, days: new Set() }; m.tasks++; m.minutes += r.minutes; m.days.add(r.date); byMonth.set(k, m); }
  for (const [k, m] of [...byMonth.entries()].sort()) ov.push([`${MONTHS_LONG[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, "", m.days.size, m.tasks, { minutes: m.minutes }, ""]);
  ov.push([{ styled: "Total", s: "bold" }, "", dates.length, rows.length, { boldMinutes: total }, ""]);
  section("Workbook");
  ov.push(["Sheet 1", "Overview (this sheet)", "", "", "", ""]);
  ov.push(["Sheet 2", `${simple ? "Activity timeline — one row per activity type" : "Timeline — one row per deliverable"}, one column per week, shaded cells show hours worked that week`, "", "", "", ""]);
  if (simple) ov.push(["Note", "Summary view: work is shown by activity type; dates, times and durations are unchanged.", "", "", "", ""]);
  ov.push(["Sheet 3", "Timesheet — every task with day, start/end time and duration", "", "", "", ""]);

  // ---- Sheet 2: Timeline (weekly Gantt grid) ----
  const weeks: string[] = [];
  for (let w = mondayOf(d.period.from); w <= d.period.to; w = addDays(w, 7)) weeks.push(w);
  const all = simple ? lanes(rows).filter((l) => !l.header) : lanes(rows);
  const maxWeek = Math.max(1, ...all.filter((l) => !l.header).flatMap((l) => weeks.map((w) => weekMinutes(l.days, w))));
  const tl: CellValue[][] = all.map((l) => {
    const cells: CellValue[] = weeks.map((w) => {
      const m = weekMinutes(l.days, w);
      if (!m) return "";
      const hours = Math.round((m / 60) * 10) / 10;
      if (l.header) return { styled: hours, s: "bold" };
      const r = m / maxWeek;
      return { styled: hours, s: r > 0.66 ? "g4" : r > 0.33 ? "g3" : r > 0.12 ? "g2" : "g1" };
    });
    const label: CellValue = l.header ? { styled: l.label, s: "section" } : simple ? l.label : `   ${l.label}`;
    return [label, { date: l.first }, { date: l.last }, l.days.size, l.tasks, l.header ? { boldMinutes: l.minutes } : { minutes: l.minutes }, ...cells];
  });

  // ---- Sheet 3: Timesheet ----
  const ts: CellValue[][] = [];
  let n = 0;
  for (const date of dates) {
    const items = rows.filter((r) => r.date === date);
    items.forEach((r) => { n++; ts.push([n, r.date, r.day, ...(simple ? [] : [r.project]), r.task, r.start, r.end, r.minutes, Math.round((r.minutes / 60) * 100) / 100, ...(simple ? [] : [r.jira_key, r.reference])]); });
    ts.push(["", "", "", ...(simple ? [] : [""]), { styled: `Total ${date} (${items.length} task${items.length === 1 ? "" : "s"})`, s: "bold" }, "", "", { boldMinutes: items.reduce((a, r) => a + r.minutes, 0) }, "", ...(simple ? [] : ["", ""])]);
  }

  const sheets: Sheet[] = [
    { name: "1 Overview", title: `Timesheet — ${d.generated_by}`, subtitle: sub, columns: [{ header: "", width: 26 }, { header: "", width: 34 }, { header: "", width: 14 }, { header: "", width: 10 }, { header: "", width: 14 }, { header: "", width: 10 }], rows: ov, freeze: false, autofilter: false, orientation: "portrait" },
    {
      name: "2 Timeline", title: simple ? "Activity timeline — hours per week" : "Project timeline — hours per week", subtitle: `${sub} · shaded cells = hours worked that week`,
      columns: [{ header: simple ? "Activity type" : "Project / deliverable", width: simple ? 36 : 58 }, { header: "First day", width: 12, type: "date" }, { header: "Last day", width: 12, type: "date" }, { header: "Days", width: 7 }, { header: "Tasks", width: 7 }, { header: "Hours", width: 10, type: "duration" }, ...weeks.map((w) => ({ header: `${w.slice(8, 10)}/${w.slice(5, 7)}`, width: 6 }))],
      rows: tl, autofilter: false, orientation: "landscape", freezeCols: 1,
    },
    {
      name: "3 Timesheet", title: `Daily timesheet — ${d.generated_by}`, subtitle: `${sub} · ${rows.length} tasks over ${dates.length} working days · ${minutesToHuman(total)}`,
      columns: [{ header: "No", width: 6 }, { header: "Date", width: 13, type: "date" }, { header: "Day", width: 11 }, ...(simple ? [] : [{ header: "Project", width: 10 }]), { header: simple ? "Activity" : "Task", width: simple ? 40 : 70 }, { header: "Start", width: 8 }, { header: "End", width: 8 }, { header: "Duration", width: 11, type: "duration" }, { header: "Hours", width: 8 }, ...(simple ? [] : [{ header: "Jira", width: 11 }, { header: "Reference", width: 16 }])],
      rows: ts, totals: ["", "", "", ...(simple ? [] : [""]), `Grand total — ${rows.length} tasks, ${dates.length} working days`, "", "", total, Math.round((total / 60) * 100) / 100, ...(simple ? [] : ["", ""])], autofilter: false, orientation: "portrait",
    },
  ];
  return buildXlsx(sheets);
}

function weekMinutes(days: Map<string, number>, monday: string): number {
  let m = 0;
  for (let i = 0; i < 7; i++) m += days.get(addDays(monday, i)) ?? 0;
  return m;
}
