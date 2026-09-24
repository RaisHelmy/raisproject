import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

export interface UseApiResult<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  refetch: () => void;
}

/** Fetches once, and optionally re-polls on an interval (used for live metrics/logs/deployments). */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[], opts: { pollMs?: number } = {}): UseApiResult<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run(true);
    if (!opts.pollMs) return;
    const id = setInterval(() => run(false), opts.pollMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch: () => run(false) };
}
