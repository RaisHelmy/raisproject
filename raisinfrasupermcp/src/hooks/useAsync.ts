import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/app/providers";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn); fnRef.current = fn;
  const reload = useCallback(async (silent = false) => { if (!silent) setLoading(true); try { setData(await fnRef.current()); setError(undefined); } catch (e) { setError(errorMessage(e)); } finally { setLoading(false); } }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, loading, reload, setData };
}

export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: { onSuccess?: (r: R) => void; onError?: (msg: string) => void } = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const run = useCallback(async (...args: A): Promise<R | undefined> => { setBusy(true); setError(undefined); try { const r = await fn(...args); opts.onSuccess?.(r); return r; } catch (e) { const m = errorMessage(e); setError(m); opts.onError?.(m); return undefined; } finally { setBusy(false); } }, [fn, opts]);
  return { run, busy, error };
}

export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { meta?: boolean } = { meta: true }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key.toLowerCase() === key && (!opts.meta || e.metaKey || e.ctrlKey)) { e.preventDefault(); handler(e); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [key, handler, opts.meta]);
}
