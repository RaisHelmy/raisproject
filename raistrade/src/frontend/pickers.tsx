import { useEffect, useRef, useState } from "react";
import { INSTRUMENTS, type Instrument } from "../shared/market";
import { AssetIcon } from "./Watchlist";
import { shownInstruments } from "./scope";

export const GROUPS: { id: string; label: string; icon: string; match: (i: Instrument) => boolean }[] = [
  { id: "US", label: "US Stocks", icon: "🇺🇸", match: (i) => i.code.startsWith("US.") },
  { id: "FX", label: "Forex", icon: "💱", match: (i) => i.cls === "forex" },
  { id: "CC", label: "Crypto", icon: "🪙", match: (i) => i.cls === "crypto" },
  { id: "HK", label: "HK Stocks", icon: "🇭🇰", match: (i) => i.code.startsWith("HK.") },
  { id: "MY", label: "MY Stocks", icon: "🇲🇾", match: (i) => i.code.startsWith("MY.") },
  { id: "IDX", label: "Indices", icon: "📊", match: (i) => i.cls === "index" },
  { id: "CM", label: "Commodities", icon: "🛢️", match: (i) => i.cls === "commodity" },
];
export const groupOf = (code: string) => GROUPS.find((g) => g.match(INSTRUMENTS.find((i) => i.code === code)!))!;

/** Default pool: US stocks and forex pairs. */
export const DEFAULT_POOL = INSTRUMENTS.filter((i) => i.code.startsWith("US.") || i.cls === "forex").map((i) => i.code);
export const randomDefault = () => DEFAULT_POOL[Math.floor(Math.random() * DEFAULT_POOL.length)]!;
export const preferredCode = (c: string) => (DEFAULT_POOL.includes(c) ? c : randomDefault());

export type AssetStats = Record<string, { wins: number; trials: number; pnl: number }>;

type Props = { stats?: AssetStats; statsLabel?: string } & (
  | { multi?: false; value: string; onChange: (v: string) => void }
  | { multi: true; value: string[]; onChange: (v: string[]) => void });

function RateCell({ s }: { s?: { wins: number; trials: number; pnl: number } }) {
  if (!s) return null;
  if (!s.trials) return <span className="rate-cell text-secondary">no signals</span>;
  const r = s.wins / s.trials;
  const ok = r >= 0.7;
  return (
    <span className="rate-cell" title={`${s.wins}/${s.trials} wins · P/L ${s.pnl.toFixed(2)}`}>
      <span className="mini-bar"><span className={ok ? "ok" : r >= 0.5 ? "mid" : "bad"} style={{ width: `${r * 100}%` }} /></span>
      <b className={ok ? "text-up" : r >= 0.5 ? "text-warning" : "text-down"}>{Math.round(r * 100)}%</b>
      <span className="text-secondary">{s.trials}</span>
    </span>
  );
}
const rateOf = (s?: { wins: number; trials: number }) => (s?.trials ? s.wins / s.trials : -1);

export function AssetPicker(props: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [byRate, setByRate] = useState(!!props.stats);
  const stats = props.stats;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const selected = props.multi ? props.value : [props.value];
  const hit = (i: Instrument) => !q || `${i.code} ${i.name}`.toLowerCase().includes(q.toLowerCase());
  const pick = (code: string) => {
    if (props.multi) props.onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
    else { props.onChange(code); setOpen(false); }
  };
  const toggleGroup = (codes: string[]) => {
    if (!props.multi) return;
    const all = codes.every((c) => selected.includes(c));
    props.onChange(all ? selected.filter((c) => !codes.includes(c)) : [...new Set([...selected, ...codes])]);
  };

  return (
    <div className="picker" ref={box}>
      <button type="button" className="form-select form-select-sm text-start d-flex align-items-center gap-2" onClick={() => setOpen((o) => !o)}>
        {props.multi ? (
          selected.length ? (
            <span className="d-flex align-items-center gap-1 text-truncate">
              {selected.slice(0, 6).map((c) => <AssetIcon key={c} code={c} size={18} />)}
              <span className="ms-1">{selected.length} asset{selected.length > 1 ? "s" : ""}</span>
            </span>
          ) : <span className="text-secondary">Choose assets…</span>
        ) : (
          <><AssetIcon code={props.value} size={20} /><span>{props.value}</span><span className="text-secondary small text-truncate">{INSTRUMENTS.find((i) => i.code === props.value)?.name}</span></>
        )}
      </button>
      {open && (
        <div className="picker-menu">
          <input autoFocus className="form-control form-control-sm mb-2" placeholder="Search symbol or name…" value={q} onChange={(e) => setQ(e.target.value)} />
          {props.multi && (
            <div className="d-flex gap-1 mb-2 flex-wrap">
              <button type="button" className="chip" onClick={() => props.onChange(shownInstruments().map((i) => i.code))}>All</button>
              <button type="button" className="chip" onClick={() => props.onChange(DEFAULT_POOL)}>US + Forex</button>
              <button type="button" className="chip" onClick={() => props.onChange([randomDefault()])}>🎲 Random</button>
              <button type="button" className="chip" onClick={() => props.onChange([])}>Clear</button>
            </div>
          )}
          {stats && (
            <div className="d-flex align-items-center gap-2 mb-2 small">
              <div className="seg seg-sm">
                <button type="button" className={byRate ? "active" : ""} onClick={() => setByRate(true)}>🏆 Best success</button>
                <button type="button" className={!byRate ? "active" : ""} onClick={() => setByRate(false)}>By market</button>
              </div>
              {props.multi && (
                <button type="button" className="chip" onClick={() => props.onChange(shownInstruments().filter((i) => rateOf(stats[i.code]) >= 0.7).map((i) => i.code))}>
                  ✓ Select ≥70% ({shownInstruments().filter((i) => rateOf(stats[i.code]) >= 0.7).length})
                </button>
              )}
            </div>
          )}
          {stats && props.statsLabel && <div className="text-secondary mb-1" style={{ fontSize: ".7rem" }}>{props.statsLabel}</div>}
          <div className="picker-list">
            {stats && byRate && [...shownInstruments()].filter(hit).sort((a, b) => rateOf(stats[b.code]) - rateOf(stats[a.code]) || (stats[b.code]?.pnl ?? 0) - (stats[a.code]?.pnl ?? 0)).map((i, n) => (
              <div key={i.code} className={`picker-item ${selected.includes(i.code) ? "sel" : ""}`} onClick={() => pick(i.code)}>
                {props.multi && <input type="checkbox" readOnly checked={selected.includes(i.code)} />}
                <span className="rank">{n < 3 && stats[i.code]?.trials ? ["🥇", "🥈", "🥉"][n] : n + 1}</span>
                <AssetIcon code={i.code} size={22} />
                <span className="fw-semibold small">{i.code.split(".")[1]}</span>
                <span className="text-secondary small text-truncate flex-grow-1">{groupOf(i.code).icon}</span>
                <RateCell s={stats[i.code]} />
              </div>
            ))}
            {!(stats && byRate) && GROUPS.map((g) => {
              const items = shownInstruments().filter((i) => g.match(i) && hit(i));
              if (!items.length) return null;
              const codes = items.map((i) => i.code);
              return (
                <div key={g.id}>
                  <div className="picker-group" onClick={() => toggleGroup(codes)} style={{ cursor: props.multi ? "pointer" : "default" }}>
                    <span>{g.icon} {g.label}</span>
                    {props.multi && <input type="checkbox" readOnly checked={codes.every((c) => selected.includes(c))} />}
                  </div>
                  {items.map((i) => (
                    <div key={i.code} className={`picker-item ${selected.includes(i.code) ? "sel" : ""}`} onClick={() => pick(i.code)}>
                      {props.multi && <input type="checkbox" readOnly checked={selected.includes(i.code)} />}
                      <AssetIcon code={i.code} size={22} />
                      <span className="fw-semibold small">{i.code.split(".")[1]}</span>
                      <span className="text-secondary small text-truncate flex-grow-1">{i.name}</span>
                      <RateCell s={stats?.[i.code]} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Hover / focus help explaining Stocks vs Binary. */
export function ModeHelp() {
  return (
    <span className="mode-help" tabIndex={0}>
      ⓘ
      <span className="mode-help-pop">
        <b>Stocks vs Binary — what's the difference?</b>
        <table className="table table-sm mt-2 mb-2 small">
          <thead><tr><th></th><th>📈 Stocks (moomoo)</th><th>⏱ Binary (IQ Option)</th></tr></thead>
          <tbody>
            <tr><td>You trade</td><td>Shares / units you own</td><td>A yes/no bet on direction</td></tr>
            <tr><td>Signal BUY</td><td>Buy qty, hold until exit</td><td>Open <span className="text-up">▲ CALL</span> (higher)</td></tr>
            <tr><td>Signal SELL</td><td>Sell the holding (exit)</td><td>Open <span className="text-down">▼ PUT</span> (lower)</td></tr>
            <tr><td>Ends when</td><td>Exit signal, stop-loss or take-profit</td><td>Fixed expiry (30s – 15m)</td></tr>
            <tr><td>Profit</td><td>Price move × qty (unlimited)</td><td>Fixed payout (80–90%)</td></tr>
            <tr><td>Loss</td><td>Price move × qty (limit with SL)</td><td>The whole stake</td></tr>
            <tr><td>Trial = win if</td><td>Round trip P/L &gt; 0</td><td>Price ends on your side of strike</td></tr>
            <tr><td colSpan={3} className="text-secondary pt-2"><b>Example</b> — AAPL at $228:</td></tr>
            <tr><td>Stocks</td><td colSpan={2}>Buy 10 @ $228 → sell @ $231 = <span className="text-up">+$30</span>; sell @ $225 = <span className="text-down">−$30</span></td></tr>
            <tr><td>Binary</td><td colSpan={2}>$100 CALL @ $228, 1m, 82% → ends $228.40 = <span className="text-up">+$82</span>; ends $227.90 = <span className="text-down">−$100</span></td></tr>
          </tbody>
        </table>
        <span className="text-secondary">Binary trials settle fast — best for testing many rules quickly.</span>
      </span>
    </span>
  );
}
