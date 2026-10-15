import { DEMO } from "./demo/clock";
import { currency, fromUSD } from "./currency";

export async function api<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (DEMO) {
    const { mockApi } = await import("./demo/mock");
    const r = await mockApi(path, init?.method ?? (init?.body ? "POST" : "GET"), init?.body);
    if (r.status >= 400 || r.data.ret !== 0) throw Object.assign(new Error(r.data.msg ?? `HTTP ${r.status}`), { code: r.data.code, data: r.data });
    return r.data as T;
  }
  const res = await fetch(path, {
    method: init?.method ?? (init?.body ? "POST" : "GET"),
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  const data: any = await res.json().catch(() => ({ ret: -1, msg: res.statusText }));
  if (res.status === 401 && path !== "/api/login") window.dispatchEvent(new Event("rt:logout"));
  if (!res.ok || data.ret !== 0) throw Object.assign(new Error(data.msg ?? `HTTP ${res.status}`), { code: data.code, data });
  return data as T;
}

export const fmt = (v: number, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
/** Formats a USD amount in the display currency (MYR by default). */
export const money = (v: number) => { const x = fromUSD(v); return (x < 0 ? "-" : "") + (currency() === "MYR" ? "RM " : "$") + fmt(Math.abs(x)); };
