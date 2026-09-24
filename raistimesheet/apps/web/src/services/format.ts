export { formatMinutes } from "@rais/shared-types";

export function fmtDate(iso: string | null | undefined, style: "short" | "long" | "month" = "short"): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (style === "long") return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  if (style === "month") return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function pct(n: number | null | undefined): string { return n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`; }

export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function todayIso(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function addDays(iso: string, n: number): string { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function monthStart(iso: string): string { return iso.slice(0, 8) + "01"; }
export function monthEnd(iso: string): string { const [y, m] = iso.split("-").map(Number) as [number, number]; const last = new Date(y, m, 0).getDate(); return `${iso.slice(0, 8)}${String(last).padStart(2, "0")}`; }

export function dateShortcut(key: string): { from: string; to: string } {
  const t = todayIso();
  const dow = new Date(t + "T00:00:00").getDay() || 7; // Mon=1..Sun=7
  switch (key) {
    case "today": return { from: t, to: t };
    case "yesterday": return { from: addDays(t, -1), to: addDays(t, -1) };
    case "this_week": return { from: addDays(t, -(dow - 1)), to: addDays(t, 7 - dow) };
    case "last_week": return { from: addDays(t, -(dow - 1) - 7), to: addDays(t, -dow) };
    case "this_month": return { from: monthStart(t), to: monthEnd(t) };
    case "last_month": { const lm = addDays(monthStart(t), -1); return { from: monthStart(lm), to: lm }; }
    case "quarter": { const m = Number(t.slice(5, 7)); const qs = Math.floor((m - 1) / 3) * 3 + 1; const from = `${t.slice(0, 4)}-${String(qs).padStart(2, "0")}-01`; return { from, to: monthEnd(`${t.slice(0, 4)}-${String(qs + 2).padStart(2, "0")}-01`) }; }
    default: return { from: monthStart(t), to: monthEnd(t) };
  }
}
