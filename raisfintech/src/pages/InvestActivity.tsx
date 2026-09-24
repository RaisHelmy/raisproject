import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvestments, scopeQuery } from "../InvestmentContext";
import { PageHeader, EmptyState, StatusBadge } from "../ux/components";
import { AccountSelector } from "../ux/components/AccountSelector";
import { api } from "../lib/api";

type Tab = "transactions" | "dividends" | "orders";

interface Tx {
  id: string; type: string; symbol: string | null; quantity: number | null; price: number | null;
  amount: number; currency: string; occurred_at: string; account_name: string; provider_id: string;
}
interface Div {
  id: string; symbol: string; amount: number; currency: string; pay_date: string;
  account_name: string; provider_id: string;
}
interface Ord {
  id: string; providerId: string; symbol: string; side: string; amount: number; mode: string;
  status: string; fillPrice: number | null; quantity: number | null; placedAt: string;
}

/** Transactions, dividends and robo orders in one activity view, filtered by
 * the same global account scope as the rest of the investment experience. */
export function InvestActivity() {
  const navigate = useNavigate();
  const { connections, loading, scope, providerName } = useInvestments();
  const [tab, setTab] = useState<Tab>("transactions");
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [divs, setDivs] = useState<Div[] | null>(null);
  const [orders, setOrders] = useState<Ord[] | null>(null);

  useEffect(() => {
    if (connections.length === 0) return;
    const q = scopeQuery(scope);
    api.get<{ transactions: Tx[] }>(`/investments/transactions${q}`).then((r) => setTxs(r.transactions)).catch(() => setTxs([]));
    api.get<{ dividends: Div[] }>(`/investments/dividends${q}`).then((r) => setDivs(r.dividends)).catch(() => setDivs([]));
    api.get<{ orders: Ord[] }>("/investments/orders").then((r) => setOrders(r.orders)).catch(() => setOrders([]));
  }, [connections.length, scope]);

  const crumbs = [{ label: "Investments", to: "/invest/portfolio" }, { label: "Activity" }];

  if (!loading && connections.length === 0) {
    return (
      <>
        <PageHeader crumbs={crumbs} eyebrow="Investments" title="Activity" description="Transactions, dividends and orders across your accounts." />
        <EmptyState
          icon="🧾"
          title="No accounts connected"
          body="Your transaction history, dividends and orders appear here once an account is connected."
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
        title="Activity"
        description="Transactions, dividends and robo orders — one history across every connected account."
      />
      <div className="row" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        <AccountSelector />
        <span className="grow" />
        {(["transactions", "dividends", "orders"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "transactions" && (
        <div className="card" style={{ padding: "10px 12px" }}>
          {txs === null ? (
            <p className="muted" style={{ padding: 10 }}>Loading…</p>
          ) : txs.length === 0 ? (
            <p className="muted" style={{ padding: 10 }}>No transactions in this scope yet — run a sync from Portfolio.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Security</th><th>Account</th><th className="num">Qty</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {txs.map((t) => (
                    <tr key={t.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{t.occurred_at.slice(0, 10)}</td>
                      <td><StatusBadge tone={t.type === "buy" ? "green" : t.type === "sell" ? "red" : "gray"}>{t.type}</StatusBadge></td>
                      <td><strong>{t.symbol ?? "—"}</strong></td>
                      <td className="muted">{providerName(t.provider_id)} · {t.account_name}</td>
                      <td className="num">{t.quantity?.toLocaleString() ?? "—"}</td>
                      <td className="num">{t.currency} {t.amount.toLocaleString("en-MY", { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "dividends" && (
        <div className="card" style={{ padding: "10px 12px" }}>
          {divs === null ? (
            <p className="muted" style={{ padding: 10 }}>Loading…</p>
          ) : divs.length === 0 ? (
            <p className="muted" style={{ padding: 10 }}>No dividends recorded in this scope yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Pay date</th><th>Security</th><th>Account</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {divs.map((d) => (
                    <tr key={d.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{d.pay_date}</td>
                      <td><strong>{d.symbol}</strong></td>
                      <td className="muted">{providerName(d.provider_id)} · {d.account_name}</td>
                      <td className="num">{d.currency} {d.amount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="card" style={{ padding: "10px 12px" }}>
          {orders === null ? (
            <p className="muted" style={{ padding: 10 }}>Loading…</p>
          ) : orders.length === 0 ? (
            <p className="muted" style={{ padding: 10 }}>
              No robo orders yet — queue one from <a href="/invest/robo" onClick={(e) => { e.preventDefault(); navigate("/invest/robo"); }}>Robo Trading</a>.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Placed</th><th>Security</th><th>Side</th><th>Mode</th><th className="num">Amount</th><th className="num">Fill</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{o.placedAt.slice(0, 10)}</td>
                      <td><strong>{o.symbol}</strong></td>
                      <td><StatusBadge tone={o.side === "buy" ? "green" : "red"}>{o.side}</StatusBadge></td>
                      <td><StatusBadge tone={o.mode === "live" ? "gold" : "blue"}>{o.mode}</StatusBadge></td>
                      <td className="num">RM {o.amount.toLocaleString()}</td>
                      <td className="num">{o.fillPrice ? `${o.quantity} @ ${o.fillPrice}` : "—"}</td>
                      <td><StatusBadge tone={o.status === "filled" ? "green" : o.status === "failed" ? "red" : "gray"}>{o.status}</StatusBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
