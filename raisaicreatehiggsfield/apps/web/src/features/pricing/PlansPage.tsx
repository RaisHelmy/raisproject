import { useState } from "react";
import { Link } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import {
  COMPARE, FAQ, FINE_PRINT, PLANS, PLAN_LINKS, PRICE_PREFIX, PROMO, QUIZ,
  type CompareGroup, type Plan, type PlanRow,
} from "./pricingData";

/**
 * The plans page, laid out like the reference pricing page: promo banner,
 * plan cards with their allowance and access boxes, a plan finder, a compare
 * table and an FAQ. Prices come from pricingData.ts and are placeholders.
 */
export function PlansPage() {
  const [annual, setAnnual] = useState(true);
  const [audience, setAudience] = useState<"Individual plans" | "Business plans">("Individual plans");
  return (
    <>
      <HfHeader />
      <main id="main" className="pr">
        <div className="pr-container">
          <PromoBanner />

          <header className="pr-head">
            <h1>Upgrade your plan</h1>
            <p>Lock better prices with upgrade or scale your creativity maximizing your current plan</p>
          </header>

          <div className="pr-controls">
            <div className="pr-audience" role="tablist" aria-label="Plan audience">
              {(["Individual plans", "Business plans"] as const).map((a) => (
                <button key={a} type="button" role="tab" aria-selected={a === audience} data-active={a === audience || undefined} onClick={() => setAudience(a)}>{a}</button>
              ))}
            </div>
            <div className="pr-controls-right">
              <button type="button" className="pr-hint">
                <CompassIcon />
                Not sure which plan?
                <span className="pr-badge pr-badge-lime">NEW</span>
              </button>
              <BillingToggle annual={annual} onChange={setAnnual} />
            </div>
          </div>

          <div className="pr-plans">
            {PLANS.map((p) => <PlanCard key={p.id} plan={p} annual={annual} />)}
          </div>

          <div className="pr-links">
            {PLAN_LINKS.map((l) => (
              <Link key={l.label} to={l.href}>{l.label}<ExternalIcon /></Link>
            ))}
          </div>
          <div className="pr-fine">
            {FINE_PRINT.map((line) => <p key={line}>{line}</p>)}
          </div>

          <PlanFinder />
          <CompareTable annual={annual} onToggle={setAnnual} />
          <FaqSection />

          <div className="pr-ready">
            <span>Are you ready?</span>
            <a href="#top" className="pr-btn pr-btn-lime pr-btn-sm">Choose your plan</a>
          </div>
        </div>
      </main>
    </>
  );
}

function PromoBanner() {
  return (
    <section className="pr-promo">
      <span className="pr-promo-badge"><TagIcon />{PROMO.badge}</span>
      <h2>
        <span className="pr-promo-accent">{PROMO.titleAccent}</span>
        <span>{PROMO.title}</span>
      </h2>
      <p>{PROMO.sub}</p>
      <Link to="/signup" className="pr-btn pr-btn-white">{PROMO.cta}</Link>
    </section>
  );
}

function BillingToggle({ annual, onChange, discount }: { annual: boolean; onChange: (v: boolean) => void; discount?: string }) {
  return (
    <div className="pr-billing">
      <span data-active={!annual || undefined}>Monthly</span>
      <button
        type="button"
        role="switch"
        aria-checked={annual}
        aria-label="Bill annually"
        className="pr-switch"
        data-on={annual || undefined}
        onClick={() => onChange(!annual)}
      >
        <span />
      </button>
      <span data-active={annual || undefined}>Annual</span>
      {discount && <span className="pr-badge pr-badge-pink">{discount}</span>}
    </div>
  );
}

function PlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const [step, setStep] = useState(0);
  const monthly = plan.price.now;
  const shown = annual ? monthly : Math.round(monthly * 1.3);
  const was = annual ? plan.price.was : undefined;
  return (
    <article className={`pr-plan pr-plan-${plan.tone}`}>
      <header className="pr-plan-head">
        <h2>
          {plan.name}
          {plan.badges.map((b) => <span key={b.label} className={`pr-badge pr-badge-${b.tone}`}>{b.label}</span>)}
        </h2>
        <p>{plan.tagline}</p>
      </header>

      <div className="pr-credits">
        <p className="pr-credits-main"><SparkIcon />{plan.credits}</p>
        <ul className="pr-credits-list">
          {plan.equivalents.map((e) => <li key={e}>{e}</li>)}
        </ul>
        {plan.fixedNote && (
          <p className="pr-credits-fixed"><CheckIcon />{plan.fixedNote}</p>
        )}
        {plan.creditSteps && (
          <div className="pr-slider">
            <input
              type="range" min={0} max={plan.creditSteps.length - 1} step={1} value={step}
              aria-label="Monthly credits" onChange={(e) => setStep(Number(e.target.value))}
            />
            <div className="pr-slider-ticks">
              {plan.creditSteps.map((c, i) => (
                <span key={c} data-active={i === step || undefined}><SparkIcon />{c}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="pr-price">
        {was !== undefined && <span className="pr-price-was">{PRICE_PREFIX}{was}</span>}
        <span className="pr-price-now">{PRICE_PREFIX}{shown}</span>
        <span className="pr-price-per">per month, billed {annual ? "annually" : "monthly"}</span>
      </div>

      <button type="button" className={`pr-btn pr-plan-cta pr-btn-${plan.tone === "plain" ? "white" : plan.tone}`}>{plan.cta}</button>
      <p className="pr-plan-save">{annual ? plan.saveNote : "Billed every month"}</p>

      <section className="pr-box">
        <header className="pr-box-head"><LockIcon />{plan.unlimited.title}<InfoIcon /></header>
        <ul>
          {plan.unlimited.rows.map((r) => <BoxRow key={r.label} row={r} />)}
        </ul>
        <button type="button" className="pr-box-more"><PlusIcon /><span>{plan.unlimited.more}</span><ChevronIcon /></button>
      </section>

      <section className={`pr-box${plan.seedance.available ? " pr-box-blue" : ""}`}>
        <header className="pr-box-head">
          <span className="pr-box-title">
            {plan.seedance.available ? <>Access to <em>Seedance models</em></> : plan.seedance.title}
            <small>{plan.seedance.sub}</small>
          </span>
          <ChartIcon />
        </header>
        <ul>
          {plan.seedance.rows.map((r) => <BoxRow key={r.label} row={r} model />)}
        </ul>
      </section>

      <ul className="pr-features">
        {plan.features.map((f) => (
          <li key={f.label} data-off={!f.included || undefined}>
            <CheckIcon />
            <span className={f.accent ? "pr-feature-accent" : undefined}>{f.label}</span>
            {f.badge && <span className={`pr-badge pr-badge-${f.badgeTone ?? "pink"}`}>{f.badge}</span>}
          </li>
        ))}
      </ul>
    </article>
  );
}

function BoxRow({ row, model }: { row: PlanRow; model?: boolean }) {
  const off = row.value === null;
  return (
    <li data-off={off || undefined}>
      {model ? <ChartIcon /> : off ? <CrossIcon /> : <CheckIcon />}
      <span className="pr-row-label">{row.label}</span>
      {row.badge && <span className={`pr-badge pr-badge-${row.badgeTone ?? "grey"}`}>{row.badge}</span>}
      <span className="pr-row-value">{row.value ?? (model ? "No access" : "No unlimited")}</span>
    </li>
  );
}

function PlanFinder() {
  const [picked, setPicked] = useState<string[]>(["Social media videos"]);
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]));
  return (
    <section className="pr-finder">
      <header className="pr-section-head">
        <h2>{QUIZ.title}</h2>
        <p>{QUIZ.sub}</p>
      </header>
      <div className="pr-finder-body">
        <div className="pr-finder-steps">
          {QUIZ.steps.map((s) => (
            <div key={s.n} className="pr-step">
              <span className="pr-step-n">{s.n}</span>
              <div className="pr-step-body">
                <h3>{s.title}</h3>
                {s.hint && <p>{s.hint}</p>}
                {s.options.length > 0 && (
                  <div className="pr-step-options">
                    {s.options.map((o) => (
                      <button key={o} type="button" className="pr-option" data-on={picked.includes(o) || undefined} onClick={() => toggle(o)}>
                        <span>{o}</span>
                        <span className="pr-option-box">{picked.includes(o) && <CheckIcon />}</span>
                      </button>
                    ))}
                  </div>
                )}
                {s.n === 2 && (
                  <div className="pr-step-sliders">
                    <SliderRow label="~50 Kling 3.0 videos" note="700 credits" cap="200+" />
                    <SliderRow label="~60 Nano Banana Pro images" note="120 credits" cap="500+" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <aside className="pr-finder-result">
          <p className="pr-finder-result-lead">{QUIZ.recommend}</p>
          <button type="button" className="pr-seewhy">See why <InfoIcon /></button>
          <div className="pr-finder-card">
            <h3>Plus <span className="pr-badge pr-badge-pink">20% OFF</span></h3>
            <p>For consistent and easy AI content creation</p>
            <p className="pr-credits-main"><SparkIcon />1,000 credits/mo</p>
            <p className="pr-credits-fixed"><CheckIcon />Fixed amount of 1,000 credits/mo</p>
            <p className="pr-finder-usage">Expected monthly usage <b>820/1,000 credits</b></p>
            <ul className="pr-features">
              <li><CheckIcon /><span>Unlimited Kling 3.0 &amp; Nano Banana 2 for 7 days</span></li>
              <li><CheckIcon /><span>5,000 FREE Soul 2.0 generations</span></li>
              <li><CheckIcon /><span>Access to every model, all features and 4K quality</span></li>
            </ul>
            <div className="pr-price">
              <span className="pr-price-was">{PRICE_PREFIX}229</span>
              <span className="pr-price-now">{PRICE_PREFIX}179</span>
              <span className="pr-price-per">/month, billed annually</span>
            </div>
            <button type="button" className="pr-btn pr-btn-lime pr-plan-cta">Get Plus</button>
            <p className="pr-plan-save">Save {PRICE_PREFIX}600 compared to monthly</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SliderRow({ label, note, cap }: { label: string; note: string; cap: string }) {
  const [v, setV] = useState(35);
  return (
    <div className="pr-usage">
      <input type="range" min={0} max={100} value={v} aria-label={label} onChange={(e) => setV(Number(e.target.value))} />
      <div className="pr-usage-foot">
        <span>{label} <b>{note}</b></span>
        <span className="pr-usage-cap"><SparkIcon />{cap}</span>
      </div>
    </div>
  );
}

function CompareTable({ annual, onToggle }: { annual: boolean; onToggle: (v: boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pr-compare">
      <header className="pr-section-head">
        <h2>Compare features</h2>
        <p>See in details what plan suits you best</p>
      </header>
      <div className={`pr-table-wrap${open ? " pr-table-open" : ""}`}>
        <table className="pr-table">
          <thead>
            <tr>
              <th scope="col">
                <div className="pr-table-toggle">
                  <span>Annual <b>30% OFF</b></span>
                  <BillingToggle annual={annual} onChange={onToggle} />
                </div>
              </th>
              {PLANS.map((p) => (
                <th key={p.id} scope="col">
                  <span className="pr-table-plan">
                    {p.name}
                    {p.badges.filter((b) => b.tone === "blue").map((b) => <span key={b.label} className="pr-badge pr-badge-blue">{b.label}</span>)}
                  </span>
                  <span className="pr-table-price">{PRICE_PREFIX}{p.price.now}/month</span>
                  <span className="pr-table-billed">Billed {annual ? "annually" : "monthly"}</span>
                  <button type="button" className={`pr-btn pr-btn-sm ${p.tone === "pink" ? "pr-btn-lime" : "pr-btn-grey"}`}>Get Plan</button>
                </th>
              ))}
            </tr>
          </thead>
          {COMPARE.map((g: CompareGroup) => (
            <tbody key={g.title}>
              <tr className="pr-table-group"><th colSpan={4} scope="colgroup">{g.title}</th></tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">
                    {r.label}
                    {r.note && <small>{r.note}</small>}
                  </th>
                  {r.values.map((v, i) => <td key={i}>{v ?? <CrossIcon />}</td>)}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        {!open && <div className="pr-table-fade" />}
      </div>
      <div className="pr-compare-more">
        <button type="button" className="pr-btn pr-btn-grey pr-btn-sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide features" : "Compare Features"}
        </button>
      </div>
    </section>
  );
}

function FaqSection() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="pr-faq">
      <h2>Frequently Asked Questions</h2>
      <div className="pr-faq-list">
        {FAQ.map((f) => {
          const isOpen = open === f.q;
          return (
            <div key={f.q} className="pr-faq-item" data-open={isOpen || undefined}>
              <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.q)}>
                <span>{f.q}</span>
                <ChevronIcon />
              </button>
              {isOpen && <p>{f.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---- icons ------------------------------------------------------------- */

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const CheckIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" {...s} /></svg>;
const CrossIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" {...s} /></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" className="pr-i pr-chev" aria-hidden="true"><path d="M6 9l6 6 6-6" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
const InfoIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 11v5M12 8h.01" {...s} /></svg>;
const LockIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9" rx="2" {...s} /><path d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5" {...s} /></svg>;
const ChartIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-6" {...s} /></svg>;
const TagIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><path d="M4 11V5a1 1 0 0 1 1-1h6l8 8-7 7-8-8Z" {...s} /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
const CompassIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M15 9l-2 4-4 2 2-4 4-2Z" {...s} /></svg>;
const ExternalIcon = () => <svg viewBox="0 0 24 24" className="pr-i" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" {...s} /></svg>;
