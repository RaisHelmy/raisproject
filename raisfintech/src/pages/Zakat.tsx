import { useState } from "react";
import { PageHeader, InfoTip } from "../ux/components";

const NISAB_RM = 29_000; // illustrative figure; confirm with your state zakat authority

export function Zakat() {
  const [savings, setSavings] = useState("");
  const [investments, setInvestments] = useState("");
  const [gold, setGold] = useState("");

  const total = [savings, investments, gold].reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const eligible = total >= NISAB_RM;
  const zakat = eligible ? total * 0.025 : 0;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Islamic Wealth", to: "/islamic/zakat" }, { label: "Zakat" }]}
        eyebrow="Islamic Wealth"
        title="Zakat Calculator"
        description="Estimate the zakat due on your wealth. This is an informational estimate — confirm with your state zakat authority before paying."
      />

      <div className="two-col">
        <div className="card">
          <div className="card-title">
            Zakatable wealth{" "}
            <InfoTip>
              Zakat is generally due on wealth held for a full lunar year (haul) above the
              nisab threshold, at 2.5%.
            </InfoTip>
          </div>
          <div className="mt-16">
            <div className="field">
              <label>Cash & savings (RM)</label>
              <input type="number" min={0} value={savings} onChange={(e) => setSavings(e.target.value)} placeholder="0" />
            </div>
            <div className="field">
              <label>Investments at current value (RM)</label>
              <input type="number" min={0} value={investments} onChange={(e) => setInvestments(e.target.value)} placeholder="0" />
              <div className="hint">Your synced portfolio value can be entered here.</div>
            </div>
            <div className="field">
              <label>Gold & silver (RM)</label>
              <input type="number" min={0} value={gold} onChange={(e) => setGold(e.target.value)} placeholder="0" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="stat-label">Total zakatable wealth</div>
          <div className="stat-value">RM {total.toLocaleString("en-MY", { maximumFractionDigits: 0 })}</div>
          <div className="stat-sub">
            Nisab (illustrative): RM {NISAB_RM.toLocaleString()}{" "}
            <InfoTip>
              The nisab follows the current value of 85g of gold and changes over time. Check
              the current figure with your state zakat authority.
            </InfoTip>
          </div>
          <hr style={{ border: "none", borderTop: "1px solid var(--line-soft)", margin: "18px 0" }} />
          <div className="stat-label">Estimated zakat due (2.5%)</div>
          <div className="stat-value" style={{ color: eligible ? "var(--gold-700)" : undefined }}>
            {eligible ? `RM ${zakat.toLocaleString("en-MY", { maximumFractionDigits: 2 })}` : "—"}
          </div>
          <div className="stat-sub">
            {total === 0
              ? "Enter your wealth to see an estimate."
              : eligible
                ? "Above nisab — zakat is likely due, subject to haul."
                : "Below the nisab threshold — zakat is likely not due."}
          </div>
        </div>
      </div>
    </>
  );
}
