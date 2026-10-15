import { useEffect, useState } from "react";
import { BY_CODE, ICONS, INSTRUMENTS, snapshot, type AssetClass } from "../shared/market";
import { fmt } from "./api";
import { shownInstruments, useScope } from "./scope";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function AssetIcon({ code, size = 32 }: { code: string; size?: number }) {
  const [glyph, bg] = ICONS[code] ?? [code.split(".")[1]?.[0] ?? "?", "#495057"];
  return (
    <span className="asset-icon" style={{ width: size, height: size, background: bg, fontSize: size * (glyph.length > 2 ? 0.3 : glyph.length > 1 ? 0.38 : 0.5) }}>
      {glyph}
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
  const allowed = FILTERS[filter]![1];
  useScope();
  const list = shownInstruments().filter((i) => (!allowed || allowed.includes(i.cls)) && (!q || `${i.code} ${i.name}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="panel">
      <div className="p-2 border-bottom border-secondary-subtle">
        <input className="form-control form-control-sm mb-2" placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="d-flex gap-1 flex-wrap">
          {FILTERS.map(([label], i) => (
            <button key={label} className={`chip ${i === filter ? "active" : ""}`} onClick={() => setFilter(i)}>{label}</button>
          ))}
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
