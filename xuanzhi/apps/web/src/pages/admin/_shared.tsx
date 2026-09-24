import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

/** Small data hook for admin pages: fetch on mount/deps, expose reload. */
export function useLoad<T>(path: string, query?: Record<string, string | number | boolean | null | undefined>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(true);
  const reload = useCallback(() => { setLoading(true); api<T>(path, { query }).then((r) => { setData(r.data); setError(null); }).catch((e) => setError((e as Error).message)).finally(() => setLoading(false)); }, [path, JSON.stringify(query)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload, setData };
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return <div className="d-flex align-items-start justify-content-between gap-3 mb-4 flex-wrap"><div><h1 className="h3 mb-1">{title}</h1>{subtitle && <div className="text-muted fs-14">{subtitle}</div>}</div>{actions && <div className="d-flex gap-2">{actions}</div>}</div>;
}
export function Stat({ k, v, sub }: { k: string; v: React.ReactNode; sub?: React.ReactNode }) { return <div className="xz-stat"><div className="k">{k}</div><div className="v">{v}</div>{sub && <div className="text-faint fs-13">{sub}</div>}</div>; }
export function StatusBadge({ s }: { s: string }) {
  const cls = s === "ready" || s === "active" || s === "ok" ? "badge-jade" : s === "failed" || s === "error" || s === "canceled" ? "badge-cinnabar" : "badge-soft";
  return <span className={`badge ${cls}`}>{s}</span>;
}
