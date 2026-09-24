import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGuidance } from "../ux/GuidanceContext";
import { useInvestments, type ConnectionInfo, type ProviderInfo } from "../InvestmentContext";
import {
  PageHeader,
  WorkflowStepper,
  SuccessState,
  StatusBadge,
  InfoTip,
  ConfirmationDialog,
  EmptyState,
} from "../ux/components";
import { api } from "../lib/api";
import { SuggestionButton } from "../ux/components/SuggestionButton";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

export function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  return `${Math.round(hrs / 24)} day(s) ago`;
}

export function ConnectionStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return <StatusBadge tone="green">● Connected</StatusBadge>;
    case "syncing":
      return <StatusBadge tone="gold">⟳ Syncing</StatusBadge>;
    case "needs_attention":
      return <StatusBadge tone="red">Needs attention</StatusBadge>;
    case "auth_expired":
      return <StatusBadge tone="red">Authentication expired</StatusBadge>;
    case "disconnected":
      return <StatusBadge tone="gray">Disconnected</StatusBadge>;
    default:
      return <StatusBadge tone="red">Error</StatusBadge>;
  }
}

function IntegrationBadge({ status }: { status: ProviderInfo["integrationStatus"] }) {
  switch (status) {
    case "implemented":
      return <StatusBadge tone="green">Integration live</StatusBadge>;
    case "configured":
      return <StatusBadge tone="blue">Configured</StatusBadge>;
    case "available":
      return <StatusBadge tone="gold">API available</StatusBadge>;
    default:
      return <StatusBadge tone="gray">Coming soon</StatusBadge>;
  }
}

/**
 * "Open an account" with the broker — affiliate URL and disclosure come
 * from the Worker (D1 configuration), never hardcoded here. A clear
 * disclosure is shown before leaving Rais Fintech.
 */
export function OpenAccountCard({ providerId }: { providerId: string }) {
  const { providers } = useInvestments();
  const [disclosing, setDisclosing] = useState(false);
  const p = providers.find((x) => x.id === providerId);
  if (!p || !p.affiliate.available) return null;

  return (
    <>
      <div className="next-action" style={{ marginTop: 16 }}>
        <div className="na-icon" aria-hidden>🎁</div>
        <div>
          <div className="na-kicker">Don't have a {p.name} account yet?</div>
          <div className="na-title">Open an account first — connecting needs one</div>
          <p className="na-body">{p.affiliate.disclosure}</p>
          <div className="na-cta row" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-gold" onClick={() => setDisclosing(true)}>
              Open a {p.name} Account ↗
            </button>
          </div>
        </div>
      </div>
      <ConfirmationDialog
        open={disclosing}
        title={`Continue to ${p.name}?`}
        body={
          <>
            <p>You're leaving Rais Fintech to open an account directly with {p.name}.</p>
            <p style={{ marginTop: 10 }} className="muted">{p.affiliate.disclosure}</p>
          </>
        }
        confirmLabel={`Continue to ${p.name}`}
        onCancel={() => setDisclosing(false)}
        onConfirm={() => {
          setDisclosing(false);
          window.open(p.affiliate.registrationUrl, "_blank", "noopener");
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Connection Center                                                   */
/* ------------------------------------------------------------------ */

function capabilityChips(p: ProviderInfo): string[] {
  const labels: Record<string, string> = {
    portfolio: "Portfolio",
    positions: "Holdings",
    transactions: "Transactions",
    dividends: "Dividends",
    trading: "Trading",
    marketData: "Market data",
  };
  return Object.entries(labels)
    .filter(([k]) => p.capabilities[k])
    .map(([, v]) => v);
}

export function Connections() {
  const navigate = useNavigate();
  const { providers, connections, loading, refresh, providerName } = useInvestments();
  const { update } = useGuidance();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ConnectionInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const act = async (conn: ConnectionInfo, action: "sync" | "reconnect") => {
    setBusyId(conn.id);
    setNotice(null);
    try {
      await api.post(`/investments/connections/${conn.id}/${action}`);
      await refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "The action failed. Your connection is still saved.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (conn: ConnectionInfo) => {
    setRemoving(null);
    try {
      await api.del(`/investments/connections/${conn.id}`);
      await refresh();
      // If that was the last connection, the guided journey reflects it.
      if (connections.length <= 1) {
        update({ brokerageConnected: false, portfolioSynced: false, liveTradingEnabled: false });
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Removing the connection failed.");
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Connections", to: "/connections" }, { label: "Investment Connections" }]}
        eyebrow="Connections"
        title="Investment Connections"
        description="Connect your investment accounts — Rais Fintech consolidates your wealth. Brokers are data sources; the experience stays one platform."
        actions={<SuggestionButton context="providers" label="Suggest a broker" />}
      />

      {notice && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <span aria-hidden>⚠️</span>
          <span>{notice}</span>
        </div>
      )}

      <div className="section-title">Your connected accounts</div>
      {loading ? (
        <p className="muted">Loading connections…</p>
      ) : connections.length === 0 ? (
        <div className="card">
          <p className="muted">
            Nothing connected yet. Pick a provider below — the guided flow takes about two
            minutes.
          </p>
        </div>
      ) : (
        connections.map((conn) => (
          <div className="card" key={conn.id}>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <div className="na-icon" aria-hidden>🏦</div>
              <div className="grow">
                <div className="card-title" style={{ marginBottom: 2 }}>
                  {providerName(conn.provider_id)}
                  {conn.environment === "paper" && (
                    <>
                      {" "}
                      <StatusBadge tone="blue">Paper</StatusBadge>
                    </>
                  )}
                </div>
                <p className="muted">
                  Last synced {relativeTime(conn.last_sync_at)}
                  {conn.label ? ` · ${conn.label}` : ""}
                </p>
              </div>
              <ConnectionStatusBadge status={conn.status} />
              <button
                className="btn btn-sm btn-secondary"
                disabled={busyId === conn.id}
                onClick={() => act(conn, "sync")}
              >
                {busyId === conn.id ? "Syncing…" : "Sync Now"}
              </button>
              {(conn.status === "needs_attention" || conn.status === "auth_expired" || conn.status === "error") && (
                <button className="btn btn-sm btn-primary" disabled={busyId === conn.id} onClick={() => act(conn, "reconnect")}>
                  Reconnect
                </button>
              )}
              <button className="btn btn-sm btn-ghost" onClick={() => setRemoving(conn)}>
                Remove
              </button>
            </div>
          </div>
        ))
      )}

      <div className="section-title">Available providers</div>
      <div className="card-grid">
        {providers.map((p) => {
          const already = connections.some((c) => c.provider_id === p.id);
          return (
            <div className="card" key={p.id} style={{ marginTop: 0, display: "flex", flexDirection: "column" }}>
              <div className="row">
                <div className="card-title" style={{ marginBottom: 0 }}>{p.name}</div>
                <span className="grow" />
                <IntegrationBadge status={p.integrationStatus} />
              </div>
              <p className="muted" style={{ marginTop: 4 }}>
                {p.tagline}
                <br />
                {p.instruments}
              </p>
              <div className="row" style={{ flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
                {capabilityChips(p).map((chip) => (
                  <StatusBadge key={chip} tone="gray">{chip}</StatusBadge>
                ))}
              </div>
              <div style={{ marginTop: "auto" }}>
                <button
                  className={`btn ${p.connectable ? "btn-primary" : "btn-secondary"}`}
                  style={{ width: "100%" }}
                  onClick={() => navigate(`/connections/${p.id}`)}
                >
                  {already && p.connectable
                    ? "Connect Another Account"
                    : p.connectable
                      ? "Connect Existing Account"
                      : "View Integration Status"}
                </button>
                {p.affiliate.available && (
                  <p className="muted" style={{ textAlign: "center", marginTop: 8, fontSize: 12 }}>
                    Don't have an account?{" "}
                    <a
                      href={`/connections/${p.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/connections/${p.id}`);
                      }}
                    >
                      Open an account
                    </a>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmationDialog
        open={removing !== null}
        title={`Remove the ${removing ? providerName(removing.provider_id) : ""} connection?`}
        body="Rais Fintech will stop synchronizing this connection and remove its accounts, holdings and history from your workspace. You can reconnect at any time."
        confirmLabel="Remove Connection"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove(removing)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Provider connection wizard (generalized; /connections/:provider)    */
/* ------------------------------------------------------------------ */

const STEPS = ["About", "Authorize", "Permissions", "Environment", "Sync Options", "Verify"];

export function ProviderWizard() {
  const { provider: providerId = "" } = useParams();
  const navigate = useNavigate();
  const { providers, refresh, loading } = useInvestments();
  const { update } = useGuidance();
  const [step, setStep] = useState(0);
  const [env, setEnv] = useState<"paper" | "live">("live");
  const [interval, setIntervalMin] = useState(15);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const p = providers.find((x) => x.id === providerId);

  if (loading) return <p className="muted">Loading provider…</p>;
  if (!p) {
    return (
      <EmptyState
        icon="🔎"
        title="Unknown provider"
        body="We don't recognize that provider. Pick one from the connection center."
        action={<button className="btn btn-primary" onClick={() => navigate("/connections")}>Back to Connections</button>}
      />
    );
  }

  const crumbs = [
    { label: "Connections", to: "/connections" },
    { label: "Choose Provider", to: "/connections" },
    { label: p.name },
  ];

  /* ----- integration pending: honest state, no fake connect ----- */
  if (!p.connectable) {
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          eyebrow="Connections"
          title={`Connect ${p.name}`}
          description={p.tagline}
        />
        <div className="card">
          <div className="row">
            <div className="card-title" style={{ marginBottom: 0 }}>Integration status</div>
            <span className="grow" />
            <IntegrationBadge status={p.integrationStatus} />
          </div>
          <p className="mt-16">
            {p.integrationStatus === "coming_soon"
              ? `The ${p.name} integration boundary is defined, but the connection is not live yet. We never show simulated data for a broker we're not actually reading from.`
              : p.integrationStatus === "configured"
                ? `${p.name} API credentials are configured on the server, and the adapter is being finalized. Connecting will open here as soon as it's live.`
                : `${p.name} has a public API (${p.capabilities["apiKey"] ? "API key" : "OAuth"} based). The integration will open here once credentials are configured and the adapter is live.`}
          </p>
          <div className="mt-16">
            {capabilityChips(p).map((chip) => (
              <span key={chip} style={{ marginRight: 6 }}>
                <StatusBadge tone="gray">{chip}</StatusBadge>
              </span>
            ))}
          </div>
          <div className="wizard-actions">
            <button className="btn btn-secondary" onClick={() => navigate("/connections")}>
              Back to Connections
            </button>
            <span className="spacer" />
          </div>
        </div>
        {p.affiliate.available && <OpenAccountCard providerId={p.id} />}
      </>
    );
  }

  /* ----- implemented provider: full guided connect ----- */

  const finishConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/investments/connections/${p.id}/connect`, {
        environment: env,
        syncIntervalMin: interval,
      });
      update({ brokerageConnected: true, connectStep: -1 });
      await refresh();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connecting failed. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card">
        <SuccessState
          title={`${p.name} connected`}
          body="Your accounts were discovered and the first synchronization is complete. Holdings, transactions and dividends now flow into your consolidated portfolio."
          nextBody="Review your consolidated portfolio — every connected account in one view."
          actions={
            <>
              <button className="btn btn-primary" onClick={() => navigate("/invest/portfolio")}>
                View Portfolio
              </button>
              <button className="btn btn-secondary" onClick={() => navigate("/connections")}>
                Back to Connections
              </button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Connections"
        title={`Connect ${p.name}`}
        description="A short guided setup. At every step we explain what we're doing, why we need it, and what access is requested."
      />
      <div className="card">
        <WorkflowStepper steps={STEPS} current={step} />

        {error && (
          <div className="alert alert-warn" style={{ marginBottom: 16 }}>
            <span aria-hidden>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {step === 0 && (
          <>
            <p><strong>What are we doing?</strong> Linking your {p.name} account to Rais Fintech.</p>
            <p className="mt-16"><strong>Why?</strong> So your holdings, performance and allocation appear in one consolidated portfolio — no manual entry.</p>
            <p className="mt-16"><strong>What you need:</strong> an existing {p.name} account. If you don't have one, open one first.</p>
            {p.affiliate.available && <OpenAccountCard providerId={p.id} />}
          </>
        )}

        {step === 1 && (
          <>
            <p><strong>What are we doing?</strong> You'll authorize the connection on {p.name}'s side. Rais Fintech never sees your {p.name} password.</p>
            <div className="alert alert-info mt-16">
              <span aria-hidden>🔐</span>
              <span>In this build the authorization is simulated — continuing represents a successful {p.name} sign-in.</span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p><strong>What access are we requesting?</strong></p>
            <div className="mt-16">
              <div className="check-row ok"><span className="cr-state">✓</span> Read accounts, holdings and balances</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Read transaction and dividend history</div>
              <div className="check-row todo"><span className="cr-state">○</span> Place trades — <em>not requested; enable later in Robo Trading</em></div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p>
              <strong>Choose your environment.</strong>{" "}
              <InfoTip>Paper uses simulated funds so you can try things safely. Live reads your real account. You can switch later.</InfoTip>
            </p>
            <div className="mt-16">
              {(
                [
                  { id: "live", icon: "💼", title: "Live account", desc: "Read your real account data. Trading stays off by default." },
                  { id: "paper", icon: "🧪", title: "Paper trading", desc: "Practice with simulated funds. No real money moves." },
                ] as const
              ).map((o) => (
                <button key={o.id} className={`ob-option ${env === o.id ? "selected" : ""}`} onClick={() => setEnv(o.id)}>
                  <span className="obo-icon" aria-hidden>{o.icon}</span>
                  <span>
                    <span className="obo-title">{o.title}</span>
                    <br />
                    <span className="obo-desc">{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <p>
              <strong>How often should we synchronize?</strong>{" "}
              <InfoTip>Synchronization runs in the background on Cloudflare Cron — pages read from your workspace, not from the broker directly.</InfoTip>
            </p>
            <div className="mt-16">
              {[
                { v: 15, t: "Every 15 minutes (recommended)", d: "Fresh enough for daily investing." },
                { v: 60, t: "Hourly", d: "Lighter touch for long-term portfolios." },
                { v: 1440, t: "Daily", d: "Once a day, plus manual refresh whenever you want." },
              ].map((o) => (
                <button key={o.v} className={`ob-option ${interval === o.v ? "selected" : ""}`} onClick={() => setIntervalMin(o.v)}>
                  <span className="obo-icon" aria-hidden>⏱️</span>
                  <span>
                    <span className="obo-title">{o.t}</span>
                    <br />
                    <span className="obo-desc">{o.d}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <p><strong>Almost there.</strong> We'll connect, discover your accounts and run the first synchronization.</p>
            <div className="mt-16">
              <div className="check-row ok"><span className="cr-state">✓</span> Provider: {p.name}</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Access: read-only</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Environment: {env === "paper" ? "Paper trading" : "Live account"}</div>
              <div className="check-row ok"><span className="cr-state">✓</span> Sync: every {interval >= 1440 ? "day" : `${interval} min`}</div>
            </div>
          </>
        )}

        <div className="wizard-actions">
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>Back</button>
          )}
          <span className="spacer" />
          <button className="btn btn-ghost" onClick={() => navigate("/connections")}>Exit</button>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continue</button>
          ) : (
            <button className="btn btn-primary" onClick={finishConnect} disabled={busy}>
              {busy ? "Connecting…" : "Verify & Connect"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
