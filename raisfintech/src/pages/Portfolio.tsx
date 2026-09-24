import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuidance } from "../ux/GuidanceContext";
import { useInvestments, scopeQuery } from "../InvestmentContext";
import { PageHeader, EmptyState, FeatureTour, StatusBadge } from "../ux/components";
import { AccountSelector } from "../ux/components/AccountSelector";
import { OpenAccountCard } from "./Connections";
import { api } from "../lib/api";

interface PortfolioData {
  empty: boolean;
  totalMYR: number;
  byProvider: { providerId: string; valueMYR: number }[];
  byAccount: { accountId: string; name: string; providerId: string; valueMYR: number }[];
  holdings: {
    symbol: string;
    name: string;
    totalQuantity: number;
    valueMYR: number;
    assetClass: string | null;
    shariahStatus: string | null;
    gainPct: number | null;
    accounts: { accountId: string; accountName: string; providerId: string; quantity: number; valueMYR: number }[];
  }[];
}

const rm = (v: number) =>
  `RM ${v.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function ShariahChip({ status }: { status: string | null }) {
  if (status === "compliant") return <StatusBadge tone="green">☪</StatusBadge>;
  if (status === "non-compliant") return <StatusBadge tone="red">Non-compliant</StatusBadge>;
  if (status === "review") return <StatusBadge tone="gold">Review</StatusBadge>;
  return null;
}

/**
 * The consolidated portfolio: every connected broker rolled into one view,
 * identical securities merged across accounts, with drill-down. Reads
 * normalized data from the workspace (D1) — never broker APIs directly.
 */
export function Portfolio() {
  const navigate = useNavigate();
  const { connections, loading, scope, setScope, refresh, providerName } = useInvestments();
  const { state, update } = useGuidance();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<PortfolioData>(`/investments/portfolio${scopeQuery(scope)}`)
      .then((d) => {
        setData(d);
        if (!d.empty && !state.portfolioSynced) update({ portfolioSynced: true });
      })
      .catch(() => setData(null));
  }, [scope, state.portfolioSynced, update]);

  useEffect(() => {
    if (connections.length > 0) load();
  }, [connections.length, load]);

  const syncAll = async () => {
    setSyncing(true);
    try {
      await Promise.all(
        connections.map((c) => api.post(`/investments/connections/${c.id}/sync`).catch(() => null))
      );
      await refresh();
      load();
    } finally {
      setSyncing(false);
    }
  };

  const crumbs = [{ label: "Investments", to: "/invest/portfolio" }, { label: "Portfolio" }];

  if (!loading && connections.length === 0) {
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          eyebrow="Investments"
          title="Your Investments"
          description="Bring your investments together in one place."
        />
        <EmptyState
          icon="📊"
          title="Connect your investment accounts"
          body="Connect an account to see your portfolio, holdings, performance, transactions and dividends — consolidated across every broker."
          steps={[
            "Choose a provider (Moomoo is live today)",
            "Authorize read-only access",
            "Your accounts sync automatically",
          ]}
          action={
            <button className="btn btn-primary" onClick={() => navigate("/connections")}>
              Connect an Account
            </button>
          }
        />
        <OpenAccountCard providerId="moomoo" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Investments"
        title="Your Investments"
        description="Consolidated across every connected account. Identical securities held at different brokers are merged, with drill-down."
        actions={
          <>
            <button className="btn btn-primary" onClick={syncAll} disabled={syncing}>
              {syncing ? "Synchronizing…" : "Sync Now"}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/connections")}>
              Manage Connections
            </button>
          </>
        }
      />

      <div className="row" style={{ marginBottom: 18, flexWrap: "wrap" }}>
        <AccountSelector />
      </div>

      {!data ? (
        <p className="muted">Loading your consolidated portfolio…</p>
      ) : data.empty || data.holdings.length === 0 ? (
        <EmptyState
          icon="🔄"
          title="No holdings in this view yet"
          body="This scope has no synced holdings. Run a sync, or widen the account selector to All Accounts."
          action={
            <button className="btn btn-primary" onClick={syncAll} disabled={syncing}>
              {syncing ? "Synchronizing…" : "Sync Portfolio"}
            </button>
          }
        />
      ) : (
        <>
          {/* Totals & provider breakdown — clicking a provider filters everything. */}
          <div className="card-grid" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="stat-label">Total investments</div>
              <div className="stat-value">{rm(data.totalMYR)}</div>
              <div className="stat-sub">
                {scope.type === "all"
                  ? `Across ${data.byAccount.length} account${data.byAccount.length === 1 ? "" : "s"}`
                  : "Filtered view — clear the selector for everything"}
              </div>
            </div>
            {data.byProvider.map((bp) => (
              <button
                key={bp.providerId}
                className="card"
                style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", marginTop: 0 }}
                onClick={() => setScope({ type: "provider", id: bp.providerId })}
              >
                <div className="stat-label">{providerName(bp.providerId)}</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{rm(bp.valueMYR)}</div>
                <div className="stat-sub">Click to filter</div>
              </button>
            ))}
          </div>

          {/* Consolidated holdings */}
          <div className="card" style={{ padding: "10px 12px" }}>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Security</th>
                    <th>Flags</th>
                    <th className="num">Total shares</th>
                    <th className="num">Value (MYR)</th>
                    <th className="num">Gain</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((h) => (
                    <HoldingRow
                      key={h.symbol}
                      h={h}
                      open={open === h.symbol}
                      onToggle={() => setOpen(open === h.symbol ? null : h.symbol)}
                      providerName={providerName}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Account breakdown */}
          <div className="card">
            <div className="card-title">Account breakdown</div>
            <div className="mt-16">
              {data.byAccount.map((a) => (
                <div className="check-row ok" key={a.accountId}>
                  <span className="cr-state">🏦</span>
                  <span>
                    <strong>{a.name}</strong>
                    <span className="muted"> · {providerName(a.providerId)}</span>
                  </span>
                  <span className="cr-action" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {rm(a.valueMYR)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <FeatureTour
        tourId="portfolio-v2"
        steps={[
          { title: "One consolidated portfolio", body: "Every connected broker rolls into this single view — totals are normalized to MYR." },
          { title: "Merged securities", body: "Hold AAPL at two brokers? You see one AAPL line with the combined total. Expand it to see each account's share." },
          { title: "The account selector", body: "Filter to one provider or one account — the choice follows you across Portfolio, Holdings and Activity." },
          { title: "Background sync", body: "Data refreshes on a schedule in the background. Sync Now forces an immediate refresh." },
        ]}
      />
    </>
  );
}

function HoldingRow({
  h,
  open,
  onToggle,
  providerName,
}: {
  h: PortfolioData["holdings"][number];
  open: boolean;
  onToggle: () => void;
  providerName: (id: string) => string;
}) {
  const multi = h.accounts.length > 1;
  return (
    <>
      <tr>
        <td>
          <strong>{h.symbol}</strong>
          <div className="muted">{h.name}</div>
        </td>
        <td>
          <ShariahChip status={h.shariahStatus} />{" "}
          {h.assetClass && <StatusBadge tone="gray">{h.assetClass.toUpperCase()}</StatusBadge>}
        </td>
        <td className="num">{h.totalQuantity.toLocaleString()}</td>
        <td className="num">{rm(h.valueMYR)}</td>
        <td className="num">
          {h.gainPct !== null && (
            <StatusBadge tone={h.gainPct >= 0 ? "green" : "red"}>
              {h.gainPct >= 0 ? "+" : ""}
              {h.gainPct}%
            </StatusBadge>
          )}
        </td>
        <td style={{ textAlign: "right" }}>
          <button className="btn btn-sm btn-ghost" onClick={onToggle}>
            {multi ? `${h.accounts.length} accounts` : "1 account"} {open ? "▴" : "▾"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ background: "var(--paper-sunken)", padding: "12px 16px" }}>
            {h.accounts.map((a) => (
              <div className="check-row ok" key={a.accountId} style={{ borderTop: "none", padding: "5px 0" }}>
                <span className="cr-state">·</span>
                <span>
                  {providerName(a.providerId)} <span className="muted">— {a.accountName}</span>
                </span>
                <span className="cr-action" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {a.quantity.toLocaleString()} shares · {rm(a.valueMYR)}
                </span>
              </div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}
