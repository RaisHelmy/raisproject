// Background scanner: backtests every library rule × asset, then re-runs a style whenever one of
// its candles closes, so rankings, verdicts and outlooks stay live without blocking the page.
import { type Candle, INSTRUMENTS, KTYPES } from "../shared/market";
import { type ComboStats, LIBRARY, PRESETS, evaluate, finalize, historyFor } from "../shared/combos";

export type ScanMsg =
  | { type: "progress"; done: number; total: number }
  | { type: "results"; results: ComboStats[]; scannedAt: Record<string, number>; ms: number; changed: string[] };

// Demo mode passes the pinned-clock offset through the worker name.
const off = Number((self.name || "").split("off:")[1] || 0);
if (off) { const real = Date.now.bind(Date); Date.now = () => real() + off; }

const cache = new Map<string, Candle[]>();
const byPreset = new Map<string, ComboStats[]>();
const scannedAt: Record<string, number> = {};
const barOf = (ktype: string, t: number) => Math.floor(t / (KTYPES[ktype]! * 1000));
const post = (m: ScanMsg) => (self as unknown as Worker).postMessage(m);

function scan(ids: string[], progress: boolean) {
  const t0 = performance.now(), now = Date.now();
  for (const k of [...cache.keys()]) if (ids.some((id) => k.includes(`|${PRESETS.find((p) => p.id === id)!.ktype}|`))) cache.delete(k);
  const total = LIBRARY.filter((r) => ids.includes(r.preset)).length;
  let done = 0;
  for (const id of ids) {
    const p = PRESETS.find((x) => x.id === id)!, out: ComboStats[] = [];
    for (const r of LIBRARY) {
      if (r.preset !== id) continue;
      for (const i of INSTRUMENTS) out.push(evaluate(r, i.code, historyFor(cache, i.code, p, now)));
      if (progress && ++done % 40 === 0) post({ type: "progress", done, total });
    }
    finalize(out);
    byPreset.set(id, out);
    scannedAt[id] = now;
  }
  post({ type: "results", results: [...byPreset.values()].flat(), scannedAt: { ...scannedAt }, ms: Math.round(performance.now() - t0), changed: ids });
}

scan(PRESETS.map((p) => p.id), true);
setInterval(() => {
  const now = Date.now();
  const due = PRESETS.filter((p) => barOf(p.ktype, now) !== barOf(p.ktype, scannedAt[p.id] ?? 0)).map((p) => p.id);
  if (due.length) scan(due, false);
}, 1000);
