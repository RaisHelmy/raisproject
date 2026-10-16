import { useEffect, useState } from "react";
import { BY_CODE, ICONS, INSTRUMENTS, UNIVERSE, snapshot, type AssetClass } from "../shared/market";
import { fmt } from "./api";
import { SHARIAH_LABEL, SHARIAH_NOTE, activityShariah, shariahOf } from "../shared/shariah";
import { moomooSupported } from "../shared/moomoo";
import { moomooOnly } from "./scope";
import { shownInstruments, useScope } from "./scope";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function AssetIcon({ code, size = 32, shariah = true }: { code: string; size?: number; shariah?: boolean }) {
  const nm = BY_CODE[code]?.name ?? code.split(".")[1] ?? "?";
  const [glyph, bg] = ICONS[code] ?? [nm.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?", `hsl(${[...code].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 360} 45% 42%)`];
  const s = shariahOf(code), b = Math.max(10, Math.round(size * 0.42));
  return (
    <span className="asset-icon-wrap" style={{ width: size, height: size }}>
      <span className="asset-icon" style={{ width: size, height: size, background: bg, fontSize: size * (glyph.length > 2 ? 0.3 : glyph.length > 1 ? 0.38 : 0.5) }}>
        {glyph}
      </span>
      {shariah && (
        <span className={`shariah-dot ${s.status}`} style={{ width: b, height: b, fontSize: b * 0.62 }}
          title={`${SHARIAH_LABEL[s.status].long}${s.verified ? "" : " (unverified)"} — ${s.reason} Source: ${s.source}. ${SHARIAH_NOTE}`}>
          {SHARIAH_LABEL[s.status].icon}
        </span>
      )}
    </span>
  );
}

/** Text badge for a Shariah status (asset or activity). */
export function ShariahBadge({ code, mode, mm }: { code: string; mode?: "STOCK" | "BINARY"; mm?: string }) {
  const s = mode ? activityShariah(mode, code, mm) : shariahOf(code);
  return (
    <span className={`badge shariah-badge ${s.status}`} title={`${s.reason} Source: ${s.source}${s.verified ? "" : " (unverified)"}. ${SHARIAH_NOTE}`}>
      ☪ {SHARIAH_LABEL[s.status].short}{s.verified ? "" : "*"}
    </span>
  );
}

export function AssetLabel({ code }: { code: string }) {
  return (
    <span className="d-inline-flex align-items-center gap-2">
      <AssetIcon code={code} size={22} />
      <span>{code}</span>
    </span>
  );
}

const FILTERS: [string, AssetClass[] | null][] = [
  ["All", null], ["Stocks", ["stock", "index"]], ["FX", ["forex"]], ["Crypto", ["crypto"]], ["Cmdty", ["commodity"]],
];

export function Watchlist({ code, onSelect }: { code: string; onSelect: (c: string) => void }) {
  const now = useNow(1000);
  const [filter, setFilter] = useState(0);
  const [q, setQ] = useState("");
  const [halal, setHalal] = useState(false);
  const [bursa, setBursa] = useState(false);
  const allowed = FILTERS[filter]![1];
  useScope();
  // Core markets by default; searching, the Shariah filter or the Bursa filter reach the full 1,000+ universe.
  const wide = !!q || halal || bursa;
  const pool = wide ? UNIVERSE.filter((i) => !moomooOnly() || moomooSupported(i.code)) : shownInstruments();
  const all = pool.filter((i) => (!allowed || allowed.includes(i.cls)) && (!bursa || i.code.startsWith("MY.")) && (!q || `${i.code} ${i.name}`.toLowerCase().includes(q.toLowerCase())) && (!halal || shariahOf(i.code).status === "compliant"));
  const list = all.slice(0, 60);
  return (
    <div className="panel">
      <div className="p-2 border-bottom border-secondary-subtle">
        <input className="form-control form-control-sm mb-2" placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="d-flex gap-1 flex-wrap">
          {FILTERS.map(([label], i) => (
            <button key={label} className={`chip ${i === filter ? "active" : ""}`} onClick={() => setFilter(i)}>{label}</button>
          ))}
          <button className={`chip ${halal ? "active" : ""}`} title={`Show only Shariah-compliant assets. ${SHARIAH_NOTE}`} onClick={() => setHalal((h) => !h)}>☪ Shariah</button>
          <button className={`chip ${bursa ? "active" : ""}`} title="All Bursa Malaysia stocks on the SC Shariah list" onClick={() => setBursa((b) => !b)}>🇲🇾 Bursa</button>
        </div>
        <div className="small text-secondary mt-1" style={{ fontSize: ".7rem" }}>
          {wide ? `${all.length.toLocaleString()} match${all.length === 1 ? "" : "es"}${all.length > list.length ? ` · showing ${list.length}, refine search` : ""}` : `${list.length} core markets · search ${UNIVERSE.length.toLocaleString()} assets`}
        </div>
      </div>
      <div className="watchlist">
        {list.map((i) => {
          const s = snapshot(i.code, now);
          const up = s.change_rate >= 0;
          return (
            <div key={i.code} className={`watch-item d-flex align-items-center gap-2 px-2 py-2 ${i.code === code ? "active" : ""}`} onClick={() => onSelect(i.code)}>
              <AssetIcon code={i.code} />
              <div className="text-truncate flex-grow-1">
                <div className="fw-semibold small">{i.code.split(".")[1]}</div>
                <div className="text-secondary text-truncate" style={{ fontSize: ".72rem" }}>{i.name}</div>
              </div>
              <div className="text-end tabular">
                <div className="small">{fmt(s.last_price, i.decimals)}</div>
                <span className={`pct ${up ? "up" : "down"}`}>{up ? "+" : ""}{s.change_rate.toFixed(2)}%</span>
              </div>
            </div>
          );
        })}
        {!list.length && <div className="text-secondary small text-center py-4">No match</div>}
      </div>
    </div>
  );
}

export const assetName = (code: string) => BY_CODE[code]?.name ?? code;
