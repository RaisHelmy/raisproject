import { purification, PURIFY_NOTE, SHARIAH_LABEL, type PurifyRow, type ShariahStatus } from "../shared/shariah";
import { money } from "./api";

const LABEL: Record<ShariahStatus, string> = { compliant: "Shariah-compliant (halal)", doubtful: "Doubtful (syubhah)", not: "Non-compliant (haram)" };

/** Shariah cleansing breakdown: where the result came from and how much to purify. */
export function Cleansing({ rows, title = "☪ Shariah cleansing" }: { rows: PurifyRow[]; title?: string }) {
  const p = purification(rows);
  const cls = (["compliant", "doubtful", "not"] as ShariahStatus[]).map((s) => p.classes[s]);
  return (
    <div className="cleansing">
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="step-title mb-0">{title}</div>
        <span className="small text-secondary">{rows.length} closed trades</span>
      </div>
      <div className="cleanse-bar mb-2" title="Share of total profit by Shariah status">
        {cls.map((c) => c.shareOfProfit > 0 && <span key={c.status} className={c.status} style={{ width: `${c.shareOfProfit * 100}%` }}>{c.shareOfProfit >= 0.08 ? `${Math.round(c.shareOfProfit * 100)}%` : ""}</span>)}
      </div>
      <table className="table table-sm small-table tabular mb-2">
        <thead><tr><th>Source</th><th className="text-end">Trades</th><th className="text-end">Profit</th><th className="text-end">Loss</th><th className="text-end">Net</th><th className="text-end">% of profit</th><th className="text-end">To purify</th></tr></thead>
        <tbody>
          {cls.map((c) => (
            <tr key={c.status}>
              <td><span className={`badge shariah-badge ${c.status} me-1`}>{SHARIAH_LABEL[c.status].icon}</span>{LABEL[c.status]}</td>
              <td className="text-end">{c.trades}</td>
              <td className="text-end text-up">{money(c.profit)}</td>
              <td className="text-end text-down">−{money(c.loss)}</td>
              <td className={`text-end ${c.net >= 0 ? "text-up" : "text-down"}`}>{money(c.net)}</td>
              <td className="text-end fw-semibold">{(c.shareOfProfit * 100).toFixed(1)}%</td>
              <td className={`text-end ${c.purify ? "fw-bold " + (c.status === "not" ? "text-down" : "text-warning") : "text-secondary"}`}>{c.purify ? money(c.purify) : "—"}{c.status === "doubtful" && c.purify ? " (recommended)" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="d-flex flex-wrap gap-3 small">
        <span>Must purify: <b className="text-down">{money(p.mustPurify)}</b></span>
        <span>Recommended (syubhah): <b className="text-warning">{money(p.recommendPurify)}</b></span>
        <span>Clean (halal) net result: <b className={p.halalNet >= 0 ? "text-up" : "text-down"}>{money(p.halalNet)}</b></span>
      </div>
      <div className="small text-secondary mt-1">{PURIFY_NOTE}</div>
    </div>
  );
}
