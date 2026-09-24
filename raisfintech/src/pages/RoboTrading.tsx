import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGuidance } from "../ux/GuidanceContext";
import { api } from "../lib/api";
import { ShariahBadge, RiskBadge, SignalBadge, type Analysis } from "./Markets";
import { OpenAccountCard } from "./Connections";
import {
  PageHeader,
  WorkflowStepper,
  ConfirmationDialog,
  SuccessState,
  StatusBadge,
  InfoTip,
} from "../ux/components";

/**
 * Queue an order. Orders never execute inline — they enter the investment
 * queue and are processed by the worker, which re-checks live-trading
 * consent at execution time.
 */
function OrderCard({ liveEnabled }: { liveEnabled: boolean }) {
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<Analysis[]>([]);
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("500");
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  useEffect(() => {
    api
      .get<{ instruments: Analysis[] }>("/instruments")
      .then((r) => {
        setInstruments(r.instruments);
        if (r.instruments.length) setSymbol(r.instruments[0].symbol);
      })
      .catch(() => {});
  }, []);

  const chosen = instruments.find((i) => i.symbol === symbol);

  const submit = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await api.post("/robo/orders", { symbol, side, amount: Number(amount), mode });
      setNotice({
        tone: "ok",
        text: `${side.toUpperCase()} RM ${amount} of ${symbol} queued (${mode}). The worker will execute it — follow it in the Investment Queue.`,
      });
    } catch (e) {
      setNotice({ tone: "warn", text: e instanceof Error ? e.message : "Could not queue the order." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mt-16">
      <div className="card-title">
        Queue an order{" "}
        <InfoTip>
          Orders go into the investment queue and are executed by the worker — with the
          instrument's flags and the signal at fill recorded on the result.
        </InfoTip>
      </div>
      {notice && (
        <div className={`alert ${notice.tone === "ok" ? "alert-info" : "alert-warn"} mt-16`}>
          <span aria-hidden>{notice.tone === "ok" ? "⏳" : "⚠️"}</span>
          <span>
            {notice.text}{" "}
            {notice.tone === "ok" && (
              <a href="/invest/queue" onClick={(e) => { e.preventDefault(); navigate("/invest/queue"); }}>
                Open Queue
              </a>
            )}
          </span>
        </div>
      )}
      <div className="form-grid mt-16">
        <div className="field">
          <label>Instrument</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {instruments.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol} — {i.name}
              </option>
            ))}
          </select>
          {chosen && (
            <div className="hint" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <ShariahBadge status={chosen.flags.shariah.status} />
              <RiskBadge risk={chosen.flags.risk} />
              <SignalBadge action={chosen.decision.action} confidence={chosen.decision.confidence} />
            </div>
          )}
        </div>
        <div className="field">
          <label>Amount (RM)</label>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Side</label>
          <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </div>
        <div className="field">
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as "paper" | "live")}>
            <option value="paper">Paper (simulated funds)</option>
            <option value="live" disabled={!liveEnabled}>
              Live{liveEnabled ? "" : " — enable live trading first"}
            </option>
          </select>
        </div>
      </div>
      {chosen && chosen.flags.shariah.status !== "compliant" && (
        <div className="alert alert-warn" style={{ marginBottom: 14 }}>
          <span aria-hidden>☪</span>
          <span>
            <strong>{chosen.symbol} is {chosen.flags.shariah.status === "review" ? "pending Shariah review" : "not Shariah-compliant"}.</strong>{" "}
            {chosen.flags.shariah.reason} The choice remains yours.
          </span>
        </div>
      )}
      <div className="row">
        <button className="btn btn-primary" onClick={submit} disabled={busy || !symbol}>
          {busy ? "Queueing…" : `Queue ${side === "buy" ? "Buy" : "Sell"} Order`}
        </button>
        <span className="muted">Executed by the worker via the investment queue.</span>
      </div>
    </div>
  );
}

const SETUP_STEPS = [
  "Choose strategy",
  "Set investment amount",
  "Configure risk",
  "Review strategy",
  "Paper trade",
];

/**
 * First-time users never land on [BUY] [SELL]. A readiness checklist gates
 * the setup wizard, and live trading requires explicit confirmation.
 */
export function RoboTrading() {
  const { state, update } = useGuidance();
  const navigate = useNavigate();
  const [inWizard, setInWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [strategy, setStrategy] = useState("Balanced growth");
  const [amount, setAmount] = useState("1000");
  const [risk, setRisk] = useState("Moderate");
  const [confirmLive, setConfirmLive] = useState(false);

  const crumbs = [
    { label: "Investments", to: "/invest/portfolio" },
    { label: "Robo Trading" },
  ];

  const ready =
    state.brokerageConnected && state.riskProfileDone && state.strategyConfigured && state.paperTraded;

  /* ----- fully set up: control panel ----- */
  if (ready) {
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          eyebrow="Investments"
          title="Robo Trading"
          description="Your automated strategy at a glance. Live trading only ever starts with your explicit confirmation."
          actions={
            !state.liveTradingEnabled ? (
              <button className="btn btn-gold" onClick={() => setConfirmLive(true)}>
                Enable Live Trading
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={() => update({ liveTradingEnabled: false })}
              >
                Pause Live Trading
              </button>
            )
          }
        />
        <div className="card-grid">
          <div className="card">
            <div className="stat-label">Mode</div>
            <div className="stat-value">{state.liveTradingEnabled ? "Live" : "Paper"}</div>
            <div className="stat-sub">
              {state.liveTradingEnabled ? (
                <StatusBadge tone="gold">Real funds active</StatusBadge>
              ) : (
                <StatusBadge tone="blue">Simulated funds</StatusBadge>
              )}
            </div>
          </div>
          <div className="card">
            <div className="stat-label">Strategy</div>
            <div className="stat-value" style={{ fontSize: 20 }}>Balanced growth</div>
            <div className="stat-sub">Moderate risk · RM 1,000/mo</div>
          </div>
          <div className="card">
            <div className="stat-label">Paper performance</div>
            <div className="stat-value">+2.7%</div>
            <div className="stat-sub">Last 30 days, simulated</div>
          </div>
        </div>

        <OrderCard liveEnabled={state.liveTradingEnabled} />

        <ConfirmationDialog
          open={confirmLive}
          title="Enable live trading?"
          body={
            <>
              <p>
                Rais Fintech will place real orders in your Moomoo account following the
                <strong> Balanced growth</strong> strategy, within the limits you set
                (RM 1,000/month, moderate risk).
              </p>
              <p style={{ marginTop: 10 }}>
                You can pause at any time, and every order appears in your activity log.
                Investing involves risk, including possible loss of capital.
              </p>
            </>
          }
          confirmLabel="I Understand — Enable Live Trading"
          onCancel={() => setConfirmLive(false)}
          onConfirm={() => {
            update({ liveTradingEnabled: true });
            setConfirmLive(false);
          }}
        />
      </>
    );
  }

  /* ----- setup wizard ----- */
  if (inWizard) {
    const next = () => {
      if (step === 2) update({ riskProfileDone: true });
      if (step === 3) update({ strategyConfigured: true });
      const n = step + 1;
      if (n >= SETUP_STEPS.length) {
        update({ paperTraded: true });
      } else {
        setStep(n);
      }
    };

    if (state.paperTraded && state.strategyConfigured) {
      return (
        <div className="card">
          <SuccessState
            title="Paper trading is running"
            body="Your strategy is live with simulated funds. Watch it for a while — when you're comfortable, you can enable live trading with one explicit confirmation."
            nextBody="Review paper performance over the coming days before considering live trading."
            actions={
              <button className="btn btn-primary" onClick={() => setInWizard(false)}>
                View Robo Dashboard
              </button>
            }
          />
        </div>
      );
    }

    return (
      <>
        <PageHeader
          crumbs={crumbs}
          eyebrow="Investments"
          title="Set Up Robo Trading"
          description="Six short steps. You'll paper trade before any real money is involved."
        />
        <div className="card">
          <WorkflowStepper steps={SETUP_STEPS} current={step} />

          {step === 0 && (
            <div>
              {[
                { t: "Balanced growth", d: "Diversified equities and funds. Steady long-term growth." },
                { t: "Dividend income", d: "Focus on dividend-paying stocks for regular income." },
                { t: "Shariah-compliant growth", d: "Only Shariah-screened instruments." },
              ].map((o) => (
                <button
                  key={o.t}
                  className={`ob-option ${strategy === o.t ? "selected" : ""}`}
                  onClick={() => setStrategy(o.t)}
                >
                  <span className="obo-icon" aria-hidden>🧭</span>
                  <span>
                    <span className="obo-title">{o.t}</span>
                    <br />
                    <span className="obo-desc">{o.d}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="field" style={{ maxWidth: 320 }}>
              <label>
                Monthly investment amount (RM){" "}
                <InfoTip>
                  The strategy invests up to this amount each month. It never exceeds the limit
                  you set here.
                </InfoTip>
              </label>
              <input type="number" min={100} value={amount} onChange={(e) => setAmount(e.target.value)} />
              <div className="hint">You can change this anytime. Start small — you can always increase it.</div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p>
                How would you feel if your portfolio dropped 15% in a month?{" "}
                <InfoTip>
                  Your answer sets guardrails: how aggressively the strategy allocates and when
                  it de-risks.
                </InfoTip>
              </p>
              <div className="mt-16">
                {[
                  { t: "Conservative", d: "I'd want to reduce risk immediately." },
                  { t: "Moderate", d: "Uncomfortable, but I'd stay the course." },
                  { t: "Aggressive", d: "I'd see it as a buying opportunity." },
                ].map((o) => (
                  <button
                    key={o.t}
                    className={`ob-option ${risk === o.t ? "selected" : ""}`}
                    onClick={() => setRisk(o.t)}
                  >
                    <span className="obo-icon" aria-hidden>🧮</span>
                    <span>
                      <span className="obo-title">{o.t}</span>
                      <br />
                      <span className="obo-desc">{o.d}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <p><strong>Review your strategy before anything runs:</strong></p>
              <div className="mt-16">
                <div className="check-row ok"><span className="cr-state">✓</span> Strategy: {strategy}</div>
                <div className="check-row ok"><span className="cr-state">✓</span> Monthly amount: RM {amount}</div>
                <div className="check-row ok"><span className="cr-state">✓</span> Risk profile: {risk}</div>
                <div className="check-row ok"><span className="cr-state">✓</span> Mode: paper trading first — no real money</div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p>
                <strong>Paper trading</strong>{" "}
                <InfoTip>
                  Paper trading runs your exact strategy with simulated funds, so you can judge
                  it with zero financial risk.
                </InfoTip>{" "}
                starts now. Live trading stays disabled until you explicitly enable it later —
                and we'll ask you to confirm the consequences when you do.
              </p>
            </>
          )}

          <div className="wizard-actions">
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            <span className="spacer" />
            <button className="btn btn-ghost" onClick={() => setInWizard(false)}>
              Exit setup
            </button>
            <button className="btn btn-primary" onClick={next}>
              {step === SETUP_STEPS.length - 1 ? "Start Paper Trading" : "Continue"}
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ----- readiness checklist (default landing) ----- */
  const checks = [
    { ok: state.brokerageConnected, label: "Brokerage connected", action: () => navigate("/connections/moomoo"), cta: "Connect" },
    { ok: state.brokerageConnected, label: "Paper trading available", action: undefined, cta: "" },
    { ok: state.riskProfileDone, label: "Risk profile", action: undefined, cta: "" },
    { ok: state.strategyConfigured, label: "Strategy configured", action: undefined, cta: "" },
    { ok: state.liveTradingEnabled, label: "Live trading (off until you enable it)", action: undefined, cta: "" },
  ];

  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Investments"
        title="Robo Trading"
        description="Automated investing with guardrails. Before you start, let's make sure the foundations are in place."
      />
      <div className="card">
        <div className="card-title">Before you start</div>
        <div className="mt-16">
          {checks.map((c) => (
            <div className={`check-row ${c.ok ? "ok" : "todo"}`} key={c.label}>
              <span className="cr-state">{c.ok ? "✓" : "○"}</span>
              <span>{c.label}</span>
              {!c.ok && c.action && (
                <span className="cr-action">
                  <button className="btn btn-sm btn-secondary" onClick={c.action}>
                    {c.cta}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="wizard-actions">
          <span className="spacer" />
          <button
            className="btn btn-primary"
            disabled={!state.brokerageConnected}
            onClick={() => setInWizard(true)}
          >
            Complete Setup
          </button>
        </div>
        {!state.brokerageConnected && (
          <p className="muted" style={{ marginTop: 10, textAlign: "right" }}>
            Connect a brokerage first — setup takes about two minutes.
          </p>
        )}
      </div>
      {!state.brokerageConnected && <OpenAccountCard providerId="moomoo" />}
    </>
  );
}
