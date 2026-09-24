import { money } from "../api";

export function BudgetBar({ label, spent, limit }: { label: string; spent: number; limit: number | null }) {
  const pct = limit && limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const color = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "";
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small">
        <span className="text-secondary">{label}</span>
        <span>{money(spent)} <span className="text-secondary">/ {limit ? money(limit) : "no cap"}</span></span>
      </div>
      <div className="progress"><div className={`progress-bar ${color}`} style={{ width: `${limit ? pct : 0}%` }} /></div>
    </div>
  );
}
