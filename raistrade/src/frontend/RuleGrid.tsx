import { useEffect, useRef } from "react";
import Highcharts from "highcharts/highstock";
import TreemapModule from "highcharts/modules/treemap";
import { BY_CODE } from "../shared/market";
import { money } from "./api";
import { chartColors, useTheme } from "./theme";
import type { Rule } from "./AutoTrade";

(TreemapModule as unknown as (h: typeof Highcharts) => void)(Highcharts);

/** Treemap of robots: tile size follows P/L — the biggest earner is the largest tile, the most negative the smallest. */
export function RuleGrid({ rules, onOpen }: { rules: Rule[]; onOpen: (id: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  useEffect(() => {
    if (!el.current) return;
    const C = chartColors();
    const pnls = rules.map((r) => r.pnl), min = Math.min(0, ...pnls), max = Math.max(0, ...pnls), range = Math.max(1, max - min);
    const best = Math.max(1e-9, ...pnls.filter((p) => p > 0)), worst = Math.max(1e-9, ...pnls.filter((p) => p < 0).map((p) => -p));
    const mix = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a.toFixed(2)})`; };
    const data = [...rules].sort((a, b) => b.pnl - a.pnl).map((r, i) => {
      const n = r.wins + r.losses;
      return {
        id: String(r.id), name: r.name.replace(/^(RM200 · |🏆 |🚀 |⚡ )/, ""), sortIndex: i,
        // Size: shifted P/L so the most negative robot is still a (small) visible tile.
        value: r.pnl - min + range * 0.06,
        color: r.pnl > 0 ? mix(C.up, 0.35 + 0.6 * (r.pnl / best)) : r.pnl < 0 ? mix(C.down, 0.35 + 0.6 * (-r.pnl / worst)) : mix(C.label, 0.3),
        pnl: r.pnl, rec: `${r.wins}W / ${r.losses}L${n ? ` · ${Math.round((r.wins / n) * 100)}%` : ""}`, status: r.status, code: r.code,
        be: r.mode === "BINARY" ? `needs ${(100 / (1 + BY_CODE[r.code]!.payout)).toFixed(1)}%` : "",
      };
    });
    const ch = Highcharts.chart(el.current, {
      chart: { backgroundColor: "transparent", height: Math.max(380, Math.min(760, 140 + rules.length * 22)), spacing: [0, 0, 0, 0] },
      title: { text: undefined }, credits: { enabled: false }, legend: { enabled: false },
      tooltip: {
        backgroundColor: C.tipBg, borderColor: C.axis, style: { color: C.fg }, useHTML: true,
        pointFormatter: function (this: any) { return `<b>${this.name}</b><br/>${this.code} · ${this.status}<br/>P/L <b>${money(this.pnl)}</b><br/>${this.rec} ${this.be ? `(${this.be})` : ""}`; },
      },
      series: [{
        type: "treemap", layoutAlgorithm: "squarified", alternateStartingDirection: true, borderColor: C.tipBg, borderWidth: 2, borderRadius: 6,
        cursor: "pointer", data,
        dataLabels: {
          enabled: true, useHTML: true, style: { textOutline: "none", color: C.fg, fontWeight: "500" },
          formatter: function (this: any) {
            const p = this.point, w = p.shapeArgs?.width ?? 0, h = p.shapeArgs?.height ?? 0;
            if (w < 46 || h < 28) return "";
            const big = w > 150 && h > 70;
            return `<div style="text-align:center;line-height:1.2;max-width:${w - 8}px;overflow:hidden">
              ${big ? `<div style="font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>` : `<div style="font-size:10px;opacity:.85">${p.code.split(".")[1]}</div>`}
              <div style="font-size:${big ? 18 : 12}px;font-weight:700">${money(p.pnl)}</div>
              ${big ? `<div style="font-size:11px;opacity:.75">${p.rec}</div>` : ""}</div>`;
          },
        },
        point: { events: { click: function (this: any) { onOpen(Number(this.id)); } } },
      } as any],
    });
    return () => ch.destroy();
  }, [rules, theme]);
  if (!rules.length) return <div className="panel p-4 text-center text-secondary">No robots to show</div>;
  return (
    <div className="panel p-2">
      <div ref={el} />
      <div className="d-flex justify-content-between small text-secondary px-1 pt-1">
        <span>Tile size = profit: biggest earner is largest, most negative is smallest · click a tile for details</span>
        <span><span className="text-up">■</span> profit <span className="text-down ms-2">■</span> loss</span>
      </div>
    </div>
  );
}
