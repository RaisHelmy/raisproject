import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestments, scopeQuery } from "../InvestmentContext";
import { PageHeader, EmptyState, StatusBadge } from "../ux/components";
import { AccountSelector } from "../ux/components/AccountSelector";
import { api } from "../lib/api";

interface HoldingRow {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avg_cost: number | null;
  last_price: number;
  currency: string;
  market_value: number;
  asset_class: string | null;
  shariah_status: string | null;
  account_name: string;
  provider_id: string;
  updated_at: string;
}

/** Per-account holdings (un-merged) — the detailed ledger view. */
export function Holdings() {
  const navigate = useNavigate();
  const { connections, loading, scope, providerName } = useInvestments();
  const [rows, setRows] = useState<HoldingRow[] | null>(null);

  useEffect(() => {
    if (connections.length === 0) return;
    api
      .get<{ holdings: HoldingRow[] }>(`/investments/holdings${scopeQuery(scope)}`)
      .then((r) => setRows(r.holdings))
      .catch(() => setRows([]));
  }, [connections.length, scope]);

  const crumbs = [{ label: "Investments", to: "/invest/portfolio" }, { label: "Holdings" }];

  if (!loading && connections.length === 0) {
    return (
      <>
        <PageHeader crumbs={crumbs} eyebrow="Investments" title="Holdings" description="Every position, account by account." />
        <EmptyState
          icon="📑"
          title="No accounts connected"
          body="Holdings appear here once an investment account is connected and synced."
          action={<button className="btn btn-primary" onClick={() => navigate("/connections")}>Connect an Account</button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Investments"
        title="Holdings"
        description="Every position, account by account — in the security's native currency."
      />
      <div className="row" style={{ marginBottom: 18 }}>
        <AccountSelector />
      </div>
      {rows === null ? (
        <p className="muted">Loading holdings…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon="📭" title="Nothing in this view" body="No holdings match the selected account scope. Try All Accounts, or run a sync from Portfolio." />
      ) : (
        <div className="card" style={{ padding: "10px 12px" }}>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Security</th>
                  <th>Account</th>
                  <th className="num">Qty</th>
                  <th className="num">Avg cost</th>
                  <th className="num">Price</th>
                  <th className="num">Value</th>
                  <th>Shariah</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.symbol}</strong>
                      <div className="muted">{h.name}</div>
                    </td>
                    <td>
                      {providerName(h.provider_id)}
                      <div className="muted">{h.account_name}</div>
                    </td>
                    <td className="num">{h.quantity.toLocaleString()}</td>
                    <td className="num">{h.avg_cost?.toFixed(2) ?? "—"}</td>
                    <td className="num">{h.last_price.toFixed(2)}</td>
                    <td className="num">
                      {h.currency} {h.market_value.toLocaleString("en-MY", { maximumFractionDigits: 0 })}
                    </td>
                    <td>
                      {h.shariah_status === "compliant" ? (
                        <StatusBadge tone="green">☪ Compliant</StatusBadge>
                      ) : h.shariah_status === "non-compliant" ? (
                        <StatusBadge tone="red">Non-compliant</StatusBadge>
                      ) : h.shariah_status === "review" ? (
                        <StatusBadge tone="gold">Review</StatusBadge>
                      ) : (
                        <StatusBadge tone="gray">Unscreened</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
