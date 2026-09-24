import { useMemo, useState } from "react";
import { addDays, fmtDate, formatMinutes } from "@/services/format";

export interface TimelineTask { date: string; minutes: number; title: string; project: string; project_name?: string; group: string; group_label: string; start?: string | null; end?: string | null }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PALETTE = ["#1f6feb", "#2da44e", "#bf8700", "#8250df", "#cf222e", "#0969da", "#116329"];

function daysBetween(a: string, b: string): number { return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000); }
function mondayOf(iso: string): string { const d = new Date(iso + "T00:00:00"); return addDays(iso, -((d.getDay() + 6) % 7)); }

interface Row { key: string; label: string; project: string; first: string; last: string; minutes: number; days: Map<string, number>; tasks: TimelineTask[]; header?: boolean; color: string }

/** Project timeline: one lane per deliverable (grouped under its project), bar = first→last work day, darker ticks = actual work days. */
export function TimelineChart({ from, to, tasks, width = 1100, print = false, today, flat = false }: { from: string; to: string; tasks: TimelineTask[]; width?: number; print?: boolean; today?: string; flat?: boolean }) {
  const [hover, setHover] = useState<{ row: Row; x: number; y: number } | null>(null);
  const labelW = print ? 170 : 230;
  const rowH = 24, headH = 40, pad = 8;
  const totalDays = daysBetween(from, to) + 1;
  const plotW = width - labelW - pad;
  const pxDay = plotW / totalDays;
  const x = (iso: string) => labelW + daysBetween(from, iso) * pxDay;

  const rows = useMemo<Row[]>(() => {
    const projects = new Map<string, { name: string; groups: Map<string, Row> }>();
    for (const t of tasks) {
      if (t.date < from || t.date > to) continue;
      const p = projects.get(t.project) ?? { name: t.project_name ?? t.project, groups: new Map() };
      const g = p.groups.get(t.group) ?? { key: `${t.project}:${t.group}`, label: t.group_label, project: t.project, first: t.date, last: t.date, minutes: 0, days: new Map(), tasks: [], color: "" };
      g.first = g.first < t.date ? g.first : t.date; g.last = g.last > t.date ? g.last : t.date; g.minutes += t.minutes; g.tasks.push(t);
      g.days.set(t.date, (g.days.get(t.date) ?? 0) + t.minutes);
      p.groups.set(t.group, g); projects.set(t.project, p);
    }
    const out: Row[] = [];
    const ordered = [...projects.entries()].sort((a, b) => { const fa = [...a[1].groups.values()].map((g) => g.first).sort()[0]!; const fb = [...b[1].groups.values()].map((g) => g.first).sort()[0]!; return fa.localeCompare(fb); });
    ordered.forEach(([code, p], pi) => {
      const color = PALETTE[pi % PALETTE.length]!;
      const groups = [...p.groups.values()].sort((a, b) => a.first.localeCompare(b.first) || b.minutes - a.minutes);
      const first = groups[0]!.first, last = groups.map((g) => g.last).sort().at(-1)!;
      const days = new Map<string, number>();
      for (const g of groups) for (const [d, m] of g.days) days.set(d, (days.get(d) ?? 0) + m);
      out.push({ key: `p:${code}`, label: `${code} — ${p.name}`, project: code, first, last, minutes: groups.reduce((a, g) => a + g.minutes, 0), days, tasks: groups.flatMap((g) => g.tasks), header: true, color });
      for (const g of groups) out.push({ ...g, color });
    });
    return flat ? out.filter((r) => !r.header) : out;
  }, [tasks, from, to, flat]);

  const height = headH + rows.length * rowH + pad;
  const months: { label: string; x1: number; x2: number }[] = [];
  for (let d = from.slice(0, 8) + "01"; d <= to; d = addDays(d.slice(0, 8) + "28", 4).slice(0, 8) + "01") {
    const s = d < from ? from : d;
    const next = addDays(d.slice(0, 8) + "28", 4).slice(0, 8) + "01";
    const e = addDays(next, -1) > to ? to : addDays(next, -1);
    months.push({ label: `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`, x1: x(s), x2: x(e) + pxDay });
  }
  const weeks: string[] = [];
  for (let w = mondayOf(from); w <= to; w = addDays(w, 7)) if (w >= from) weeks.push(w);
  const todayIso = today ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="timeline-chart" style={{ position: "relative", overflowX: print ? "visible" : "auto" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block", maxWidth: print ? "100%" : undefined, height: print ? "auto" : undefined, fontFamily: "inherit" }} role="img" aria-label="Project timeline">
        {/* month header */}
        {months.map((m, i) => <g key={m.label}><rect x={m.x1} y={0} width={Math.max(0, m.x2 - m.x1)} height={20} fill={i % 2 ? "#f6f8fa" : "#eef1f4"} /><text x={m.x1 + 4} y={14} fontSize={11} fontWeight={600} fill="#24292f">{m.x2 - m.x1 > 44 ? m.label : ""}</text></g>)}
        {/* week ticks */}
        {weeks.map((w) => <g key={w}><line x1={x(w)} y1={20} x2={x(w)} y2={height} stroke="#eaeef2" strokeWidth={1} /><text x={x(w) + 2} y={33} fontSize={8} fill="#6e7781">{pxDay * 7 > 26 ? `${w.slice(8, 10)}/${w.slice(5, 7)}` : ""}</text></g>)}
        {/* rows */}
        {rows.map((r, i) => {
          const y = headH + i * rowH;
          const bx = x(r.first), bw = Math.max(pxDay, x(r.last) + pxDay - bx);
          return (
            <g key={r.key} onMouseEnter={(e) => setHover({ row: r, x: e.clientX, y: e.clientY })} onMouseMove={(e) => setHover((h) => h && { ...h, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={y} width={width} height={rowH} fill={r.header ? "#f6f8fa" : i % 2 ? "#fff" : "#fcfcfd"} />
              <line x1={0} y1={y + rowH} x2={width} y2={y + rowH} stroke="#eaeef2" />
              <text x={r.header ? 6 : 16} y={y + 16} fontSize={r.header ? 11 : 10} fontWeight={r.header ? 700 : 400} fill="#24292f">{truncate(r.label, r.header ? (print ? 24 : 34) : (print ? 26 : 38))}</text>
              {r.header ? (
                <rect x={bx} y={y + 9} width={bw} height={6} rx={3} fill={r.color} opacity={0.35} />
              ) : (
                <rect x={bx} y={y + 5} width={bw} height={rowH - 10} rx={4} fill={r.color} opacity={0.18} stroke={r.color} strokeOpacity={0.5} />
              )}
              {[...r.days.entries()].map(([d, m]) => <rect key={d} x={x(d)} y={r.header ? y + 8 : y + 5} width={Math.max(2, pxDay)} height={r.header ? 8 : rowH - 10} rx={1} fill={r.color} opacity={0.45 + Math.min(0.5, m / 480)} />)}
              {bx + bw + 46 <= width ? <text x={bx + bw + 4} y={y + 16} fontSize={9} fill="#57606a">{formatMinutes(r.minutes)}</text>
                : bx - 4 > labelW + 40 ? <text x={bx - 4} y={y + 16} fontSize={9} fill="#57606a" textAnchor="end">{formatMinutes(r.minutes)}</text>
                : <text x={bx + 4} y={y + 16} fontSize={9} fill="#24292f" fontWeight={600}>{formatMinutes(r.minutes)}</text>}
            </g>
          );
        })}
        {todayIso >= from && todayIso <= to && <g><line x1={x(todayIso)} y1={20} x2={x(todayIso)} y2={height} stroke="#cf222e" strokeWidth={1} strokeDasharray="3 2" /><text x={x(todayIso) - 3} y={31} fontSize={8} fill="#cf222e" textAnchor="end">today</text></g>}
      </svg>
      {hover && !print && (
        <div className="activity-tooltip shadow" style={{ position: "fixed", left: Math.min(hover.x + 12, window.innerWidth - 360), top: hover.y + 12, zIndex: 1080, maxWidth: 340 }}>
          <div className="fw-semibold">{hover.row.label}</div>
          <div className="text-secondary">{fmtDate(hover.row.first)} – {fmtDate(hover.row.last)} · {hover.row.days.size} day{hover.row.days.size === 1 ? "" : "s"} · {formatMinutes(hover.row.minutes)} · {hover.row.tasks.length} task{hover.row.tasks.length === 1 ? "" : "s"}</div>
          {!hover.row.header && hover.row.tasks.slice(0, 6).map((t, i) => <div key={i} className="text-truncate small">{fmtDate(t.date)} {t.start ? `${t.start}–${t.end}` : ""} · {t.title}</div>)}
          {!hover.row.header && hover.row.tasks.length > 6 && <div className="text-secondary small">+{hover.row.tasks.length - 6} more</div>}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string { return s.length > n ? s.slice(0, n - 1) + "…" : s; }
