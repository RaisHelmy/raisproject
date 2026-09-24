import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/services/api";

export interface ApiState<T> { data: T | null; error: ApiError | null; loading: boolean; warnings: string[]; reload: () => void; setData: (d: T | null | ((prev: T | null) => T | null)) => void }

/** Fetch JSON from the API; re-fetches when `path` or `query` change. Pass null path to skip. */
export function useApi<T>(path: string | null, query?: Record<string, string | number | boolean | null | undefined>, opts: { poll?: number } = {}): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(!!path);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(query ?? {});
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!path) { setLoading(false); return; }
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setLoading(true);
    api<T>(path, { query: JSON.parse(key), signal: ac.signal })
      .then((r) => { if (!ac.signal.aborted) { setData(r.data); setWarnings(r.warnings); setError(null); } })
      .catch((e) => { if (!ac.signal.aborted) setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", String(e), 0)); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [path, key, tick]);

  useEffect(() => {
    if (!opts.poll || !path) return;
    const id = setInterval(() => setTick((t) => t + 1), opts.poll);
    return () => clearInterval(id);
  }, [opts.poll, path]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, warnings, reload, setData };
}

/** Debounce a value (search inputs). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

/** Track an async action with busy/error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = useCallback(async <R,>(fn: () => Promise<R>): Promise<R | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e) { setError(e instanceof ApiError ? e : new ApiError("UNKNOWN", e instanceof Error ? e.message : String(e), 0)); return undefined; } finally { setBusy(false); }
  }, []);
  return { busy, error, run, clear: () => setError(null) };
}
