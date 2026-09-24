export function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff); const future = diff < 0;
  const m = Math.round(abs / 60000);
  const label = m < 1 ? "just now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 43200 ? `${Math.round(m / 1440)}d` : new Date(iso).toLocaleDateString();
  return m < 1 ? label : future ? `in ${label}` : `${label} ago`;
}
export function fmtDate(iso?: string, withTime = true): string { if (!iso) return "—"; const d = new Date(iso); return withTime ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : d.toLocaleDateString(undefined, { dateStyle: "medium" }); }
export function fmtTime(iso?: string): string { return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"; }
export function myr(n?: number | null, digits = 0): string { if (n === null || n === undefined) return "—"; return `RM${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`; }
export function num(n?: number): string { return (n ?? 0).toLocaleString(); }
export function pct(n?: number | null): string { return n === null || n === undefined ? "—" : `${n}%`; }
export function ms(n?: number): string { if (n === undefined) return "—"; return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`; }
export function minutes(m?: number): string { if (!m) return "—"; if (m < 60) return `${m}m`; if (m < 1440) return `${(m / 60).toFixed(1)}h`; return `${(m / 1440).toFixed(1)}d`; }
export function titleCase(s: string): string { return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
export function initials(name: string): string { return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(); }
export function downloadFile(name: string, content: string, type = "application/json") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
export function toCsv(rows: Record<string, unknown>[]): string { if (!rows.length) return ""; const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]; const esc = (v: unknown) => { const s = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n"); }
