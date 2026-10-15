import { useEffect, useState } from "react";
import { api } from "./api";
import { Watchlist } from "./Watchlist";
import { StockTerminal } from "./StockTerminal";
import { BinaryTerminal } from "./BinaryTerminal";
import { INSTRUMENTS } from "../shared/market";
import { AutoTrade } from "./AutoTrade";
import { Activity } from "./Activity";
import { Combos } from "./Combos";
import { Toaster } from "./toast";
import { money } from "./api";
import { ModeHelp, randomDefault } from "./pickers";
import { ThemeToggle } from "./theme";
import { CurrencyToggle, useCurrency } from "./currency";
import { ScopeButton, codeShown, useScope } from "./scope";
import { SessionChip, Sessions } from "./Sessions";
import { Risk } from "./Risk";
import { DEMO, TOUR } from "./demo/clock";
import { Tour } from "./demo/Tour";

type Mode = "STOCK" | "BINARY";
type Page = "trade" | "auto" | "combos" | "activity" | "sessions" | "risk";

function readPref<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function writePref(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* ignore */ }
}

export default function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    api("/api/me").then((r) => setUser(r.user)).catch(() => setUser(null));
    const out = () => setUser(null);
    window.addEventListener("rt:logout", out);
    return () => window.removeEventListener("rt:logout", out);
  }, []);

  if (user === undefined) return <div className="p-5 text-center text-secondary">Loading…</div>;
  if (!user) return <Login onLogin={setUser} />;
  return <Shell user={user} onLogout={() => api("/api/logout", { method: "POST" }).finally(() => setUser(null))} />;
}

function Login({ onLogin }: { onLogin: (u: string) => void }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="login-bg d-flex align-items-center justify-content-center px-3 position-relative">
      <div className="position-absolute top-0 end-0 p-3"><ThemeToggle /></div>
      <form
        className="panel p-4 w-100" style={{ maxWidth: 380 }}
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr("");
          try { onLogin((await api("/api/login", { body: { username, password } })).user); }
          catch (x) { setErr((x as Error).message); }
          finally { setBusy(false); }
        }}
      >
        <h1 className="h3 brand mb-1">Rais<span>Trade</span></h1>
        <p className="text-secondary small mb-4">Demo trading terminal · simulated market (paper money)</p>
        <div className="mb-3">
          <label className="form-label small">Username</label>
          <input className="form-control" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} autoFocus />
        </div>
        <div className="mb-3">
          <label className="form-label small">Password</label>
          <input className="form-control" type="password" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} />
        </div>
        {err && <div className="alert alert-danger py-2 small">{err}</div>}
        <button className="btn btn-accent w-100" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function AccountStrip() {
  const [a, setA] = useState<any>(null);
  useEffect(() => {
    const load = () => api("/api/trd/accinfo").then(setA).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);
  if (!a) return null;
  const pl = a.stock.total_assets - a.stock.initial;
  return (
    <div className="d-none d-md-flex gap-3 small tabular">
      <span className="text-secondary">Stocks <b className="text-body-emphasis">{money(a.stock.total_assets)}</b> <span className={pl >= 0 ? "text-up" : "text-down"}>{pl >= 0 ? "+" : ""}{money(pl)}</span></span>
      <span className="text-secondary">Practice <b className="text-warning">{money(a.binary.balance)}</b></span>
    </div>
  );
}

function Shell({ user, onLogout }: { user: string; onLogout: () => void }) {
  useCurrency(); // re-render everything when the display currency changes
  const [mode, setModeState] = useState<Mode>(() => readPref<Mode>("rt.mode", "STOCK"));
  const [page, setPageState] = useState<Page>(() => readPref<Page>("rt.page", "trade"));
  const [code, setCodeState] = useState(() => readPref<string>("rt.code", "") || randomDefault());
  const setMode = (m: Mode) => { setModeState(m); writePref("rt.mode", m); setPage("trade"); };
  const setPage = (p: Page) => { setPageState(p); writePref("rt.page", p); };
  const setCode = (c: string) => { setCodeState(c); writePref("rt.code", c); };
  const scoped = useScope();
  const safeCode = INSTRUMENTS.some((i) => i.code === code) && codeShown(code) ? code : codeShown("US.NVDA") ? "US.NVDA" : randomDefault();
  const viewMode: Mode = scoped ? "STOCK" : mode;

  return (
    <>
      {DEMO && !TOUR && (
        <div className="demo-strip">🕹 <b>Live demo</b> — practice money, runs in your browser, nothing is saved. <a href="/ads">← Back to overview</a> · <a href="/">Sign in</a></div>
      )}
      <nav className="topbar">
        <div className="container-fluid d-flex flex-wrap align-items-center gap-2 py-2">
          <span className="h5 brand mb-0 me-2">Rais<span>Trade</span></span>
          <div className="seg seg-sm">
            <button className={page === "trade" && viewMode === "STOCK" ? "active" : ""} onClick={() => setMode("STOCK")}>📈 Stocks</button>
            {!scoped && <button className={page === "trade" && mode === "BINARY" ? "active" : ""} onClick={() => setMode("BINARY")}>⏱ Binary</button>}
            <button className={page === "auto" ? "active" : ""} onClick={() => setPage("auto")}>🤖 Auto-Trade</button>
            <button className={page === "combos" ? "active" : ""} onClick={() => setPage("combos")}>🏆 Combos</button>
            <button className={page === "activity" ? "active" : ""} onClick={() => setPage("activity")}>🧾 Activity</button>
            <button className={page === "sessions" ? "active" : ""} onClick={() => setPage("sessions")}>🗂 Sessions</button>
            <button className={page === "risk" ? "active" : ""} onClick={() => setPage("risk")}>🛡 Risk</button>
          </div>
          <ModeHelp />
          <span className="badge text-bg-warning d-none d-sm-inline">DEMO</span>
          <div className="ms-auto d-flex align-items-center gap-3">
            <AccountStrip />
            <SessionChip onOpen={() => setPage("sessions")} />
            <ScopeButton />
            <CurrencyToggle />
            <ThemeToggle />
            <div className="dropdown-ish d-flex align-items-center gap-2">
              <span className="avatar">{user[0]?.toUpperCase()}</span>
              <button className="btn btn-sm btn-outline-secondary" onClick={onLogout}>Logout</button>
            </div>
          </div>
        </div>
      </nav>
      <div className="container-fluid py-3">
        {page === "trade" ? (
          <div className="row g-2">
            <div className="col-lg-3 col-xl-2"><Watchlist code={safeCode} onSelect={setCode} /></div>
            <div className="col-lg-9 col-xl-10">
              {viewMode === "STOCK" ? <StockTerminal code={safeCode} /> : <BinaryTerminal code={safeCode} />}
            </div>
          </div>
        ) : page === "auto" ? <AutoTrade code={safeCode} /> : page === "combos" ? <Combos /> : page === "sessions" ? <Sessions /> : page === "risk" ? <Risk /> : <Activity />}
      </div>
      <Toaster />
      {TOUR && <Tour />}
    </>
  );
}
