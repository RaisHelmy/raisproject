import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatMYR } from "@raisai/shared";

interface Pricing {
  currency: string;
  studios: { type: string; label: string; description: string; available: boolean; model?: string; typicalSen?: number; approximate?: boolean }[];
  models: { id: string; displayName: string; category: string; task: string; typicalSen: number; approximate: boolean }[];
}

const TOPUPS = [10, 25, 50, 100];

/**
 * Public pricing page. Every number comes from the same estimate the app
 * shows before a run, for the model each studio would pick right now — so
 * the page can never quote a price the product would not.
 */
export function PricingPage() {
  const [pricing, setPricing] = useState<Pricing | null | "error">(null);

  useEffect(() => {
    fetch("/api/v1/public/pricing")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Pricing) => setPricing(d))
      .catch(() => setPricing("error"));
  }, []);

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-container d-flex align-items-center gap-3">
          <Link to="/" className="lp-brand" aria-label="RaisAI Create home"><i className="bi bi-stars" aria-hidden="true" /><span>RaisAI Create</span></Link>
          <div className="d-flex gap-2 ms-auto">
            <Link to="/login" className="btn btn-sm btn-outline-light">Log in</Link>
            <Link to="/signup" className="btn btn-sm lp-btn-lime">Start creating</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-banner lp-banner-mcp" style={{ marginTop: 0 }}>
          <div className="lp-container">
            <p className="lp-eyebrow">Pricing</p>
            <h1 className="lp-banner-title">Real money.<br /><span>Real prices.</span></h1>
            <p className="lp-banner-sub">
              Top up a balance in ringgit and spend it per generation. You see the estimate before you generate and the
              exact charge after. No credits, no subscriptions, nothing expires.
            </p>
            <div className="d-flex flex-wrap gap-2">
              {TOPUPS.map((amount) => (
                <Link key={amount} to="/signup" className="btn btn-outline-light">Add RM {amount}</Link>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section">
          <div className="lp-container">
            <div className="lp-row-head">
              <div>
                <p className="lp-eyebrow">Per studio</p>
                <h2 className="lp-h2">What a typical generation costs today.</h2>
              </div>
            </div>
            <p className="lp-sub">The price of the model each studio would pick for you right now, at that model's default settings. Choosing another model or larger settings changes it — the estimate on the button always tells you before you commit.</p>

            {pricing === null && <p className="text-secondary">Loading prices…</p>}
            {pricing === "error" && <p className="text-secondary">Prices are not available right now. Sign in to see live estimates.</p>}
            {pricing !== null && pricing !== "error" && (
              <div className="lp-price-grid">
                {pricing.studios.map((s) => (
                  <div className="lp-price-card" key={s.type}>
                    <div className="lp-price-label">{s.label}</div>
                    <div className="lp-price-amount">
                      {s.available && s.typicalSen !== undefined ? `${s.approximate ? "~" : ""}${formatMYR(s.typicalSen)}` : "Coming soon"}
                    </div>
                    <div className="lp-price-note">{s.available ? `via ${s.model}` : "no model enabled yet"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {pricing !== null && pricing !== "error" && pricing.models.length > 0 && (
          <section className="lp-section lp-section-tags">
            <div className="lp-container">
              <p className="lp-eyebrow">Per model</p>
              <h2 className="lp-h2">Every enabled model, priced.</h2>
              <div className="table-responsive mt-3">
                <table className="table table-dark table-sm align-middle lp-table">
                  <thead><tr><th>Model</th><th>Task</th><th className="text-end">Typical request</th></tr></thead>
                  <tbody>
                    {pricing.models.map((m) => (
                      <tr key={m.id}>
                        <td>{m.displayName}<div className="small text-secondary">{m.id}</div></td>
                        <td className="text-secondary">{m.task}</td>
                        <td className="text-end">{m.approximate ? "~" : ""}{formatMYR(m.typicalSen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="lp-fine">Text models are priced per token; the figure above is for a short prompt and reply. Image and video models are priced per output at their default size.</p>
            </div>
          </section>
        )}

        <section className="lp-banner lp-banner-lime">
          <div className="lp-container">
            <p className="lp-eyebrow">How billing works</p>
            <h2 className="lp-banner-title">Estimate. Reserve. Charge the real amount.</h2>
            <p className="lp-banner-sub">
              Before a run, the estimate is held from your balance. When the provider reports what it actually used,
              you are charged that amount and the rest of the hold is returned. Failed generations that produced
              nothing are not charged.
            </p>
            <Link to="/signup" className="btn btn-dark">Start with RM 10</Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-bottom d-flex flex-wrap justify-content-between gap-2" style={{ marginTop: 0, borderTop: 0 }}>
          <span>© {new Date().getFullYear()} RaisAI Create · Built on Cloudflare Workers AI</span>
          <Link to="/">Back to home</Link>
        </div>
      </footer>
    </div>
  );
}
