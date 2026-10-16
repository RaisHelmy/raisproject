// Quick Invest screening: backtests the requested rules × markets per preset in the background.
import { type Candle } from "../shared/market";
import { type ComboStats, evaluate, finalize, historyFor } from "../shared/combos";
import { LIB_BY_ID, PRESET_BY_ID } from "../shared/library";

export type ScreenMsg = { type: "progress"; done: number; total: number } | { type: "done"; results: ComboStats[] };

const off = Number((self.name || "").split("off:")[1] || 0);
if (off) { const real = Date.now.bind(Date); Date.now = () => real() + off; }

self.onmessage = (e: MessageEvent<{ jobs: { preset: string; codes: string[]; rules: string[] }[] }>) => {
  const cache = new Map<string, Candle[]>(), now = Date.now(), all: ComboStats[] = [];
  const total = e.data.jobs.reduce((s, j) => s + j.codes.length * j.rules.length, 0);
  let done = 0;
  for (const j of e.data.jobs) {
    const p = PRESET_BY_ID[j.preset]!, out: ComboStats[] = [];
    for (const id of j.rules) {
      for (const c of j.codes) out.push(evaluate(LIB_BY_ID[id]!, c, historyFor(cache, c, p, now)));
      done += j.codes.length;
      (self as unknown as Worker).postMessage({ type: "progress", done, total } satisfies ScreenMsg);
    }
    finalize(out); all.push(...out);
  }
  (self as unknown as Worker).postMessage({ type: "done", results: all } satisfies ScreenMsg);
};
