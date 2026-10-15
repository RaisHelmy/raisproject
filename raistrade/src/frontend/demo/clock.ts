// Demo mode (the /ads showcase iframe): pins the clock to a fixed start so the simulated market
// plays out identically on every visit, and keeps storage in memory so the real app's prefs are
// never touched. Must be imported before anything else.

const qs = new URLSearchParams(location.search);
export const DEMO = qs.get("demo") === "1";
export const TOUR = DEMO && qs.get("tour") === "1";
export const START_SCENE = Number(qs.get("scene") ?? 0) || 0;

/** Fixed demo start: 14 Oct 2026 14:00 UTC. */
export const DEMO_EPOCH = Date.UTC(2026, 9, 14, 14, 0, 0);
export let DEMO_OFFSET = 0;

if (DEMO) {
  const real = Date.now.bind(Date);
  DEMO_OFFSET = DEMO_EPOCH - real();
  Date.now = () => real() + DEMO_OFFSET;

  const mem = new Map<string, string>();
  const store: Storage = {
    get length() { return mem.size; },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    key: (i) => [...mem.keys()][i] ?? null,
    removeItem: (k) => void mem.delete(k),
    setItem: (k, v) => void mem.set(k, String(v)),
  };
  mem.set("rt.theme", qs.get("theme") === "light" ? "light" : "dark");
  mem.set("rt.code", "US.NVDA");
  mem.set("rt.moomooOnly", "0"); // the showcase demonstrates every feature, incl. simulator-only binaries
  try { Object.defineProperty(window, "localStorage", { value: store, configurable: true }); } catch { /* ignore */ }
  window.confirm = () => true;
}
