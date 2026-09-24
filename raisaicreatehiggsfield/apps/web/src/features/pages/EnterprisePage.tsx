import { useState } from "react";
import { Link } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { ENTERPRISE, ENT_CLIENTS, ENT_FAQ, ENT_FEATURES, ENT_WORKSPACE } from "./pagesData4";

/**
 * Enterprise landing page: full-bleed hero, client wall, the secure/admin
 * tabs, the suite feature list with its art panel, the workspace columns,
 * Academy, the contact form and the FAQ accordion.
 */
export function EnterprisePage() {
  const [tab, setTab] = useState(0);
  const [feature, setFeature] = useState(0);
  const [open, setOpen] = useState<number | null>(0);
  const active = ENT_FEATURES[feature]!;

  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-ent">
        <section className="pg-ent-hero">
          {ENTERPRISE.heroPoster && <img className="pg-ent-hero-bg" src={ENTERPRISE.heroPoster} alt="" />}
          <p className="pg-ent-crumb"><Link to="/">{ENTERPRISE.crumb}</Link> / <span>{ENTERPRISE.title}</span></p>
          <h1>{ENTERPRISE.heading}</h1>
          <div className="pg-ent-fortune">
            {ENTERPRISE.fortuneLogo && <img src={ENTERPRISE.fortuneLogo} alt="Fortune 500" />}
            <p>{ENTERPRISE.fortune}</p>
          </div>
        </section>

        <div className="pg-container">
          <section className="pg-ent-purpose">
            <h2>{ENTERPRISE.purpose}</h2>
            <p>{ENTERPRISE.purposeBody}</p>
            <a className="pg-btn pg-btn-white" href="#contact">{ENTERPRISE.cta}</a>
          </section>

          <section className="pg-ent-clients">
            <p className="pg-ent-kicker">Enterprise clients</p>
            <h2>{ENTERPRISE.clientsTitle}</h2>
            <div className="pg-ent-client-grid">
              {ENT_CLIENTS.map((c) => (
                <article key={c.title} className="pg-ent-client">
                  {c.bg && <img className="pg-ent-client-bg" src={c.bg} alt="" loading="lazy" decoding="async" />}
                  <div className="pg-ent-client-copy">
                    {c.logo && <img className="pg-ent-client-logo" src={c.logo} alt="" loading="lazy" />}
                    <h3>{c.title}</h3>
                    <p>{c.quote}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="pg-ent-secure">
            <h2>{ENTERPRISE.secureTitle}</h2>
            <div className="pg-ent-tabs" role="tablist">
              {ENTERPRISE.secureTabs.map((t, i) => (
                <button key={t} type="button" role="tab" aria-selected={i === tab} data-active={i === tab || undefined} onClick={() => setTab(i)}>{t}</button>
              ))}
            </div>
            <div className="pg-ent-secure-panel">
              <img className="pg-ent-secure-art" src={ENTERPRISE.secureArt[tab]} alt="" loading="lazy" decoding="async" />
              <p>{ENTERPRISE.secureTabs[tab]}</p>
            </div>
          </section>

          <section className="pg-ent-suite">
            <h2>{ENTERPRISE.suiteTitle}</h2>
            <p className="pg-ent-lead">{ENTERPRISE.suiteBody}</p>
            <div className="pg-ent-suite-body">
              <ul className="pg-ent-suite-list">
                {ENT_FEATURES.map((f, i) => (
                  <li key={f.title}>
                    <button type="button" data-active={i === feature || undefined} onClick={() => setFeature(i)}>
                      <span>{f.title}</span>
                      <small>{f.desc}</small>
                    </button>
                  </li>
                ))}
              </ul>
              <figure className="pg-ent-suite-art">
                {active.vid ? (
                  <video src={active.vid} muted loop autoPlay playsInline poster={active.imgs[0]} />
                ) : (
                  active.imgs.slice(0, 4).map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)
                )}
              </figure>
            </div>
          </section>

          <section className="pg-ent-workspace">
            <h2>{ENTERPRISE.workspaceTitle}</h2>
            <a className="pg-btn pg-btn-white" href="#contact">{ENTERPRISE.cta}</a>
            <div className="pg-ent-ws-grid">
              {ENT_WORKSPACE.map((w, i) => (
                <article key={w.title} className="pg-ent-ws">
                  <img className="pg-ent-ws-art" src={ENTERPRISE.workspaceArt[i]} alt="" loading="lazy" decoding="async" />
                  <h3>{w.title}</h3>
                  <ul>{w.items.map((i) => <li key={i}><CheckIcon />{i}</li>)}</ul>
                </article>
              ))}
            </div>
          </section>

          <section className="pg-ent-academy">
            <h2>{ENTERPRISE.academyTitle}</h2>
            <p>Give your team <Link to="/academy">pro education</Link> on the workflows they ship every day.</p>
            <a className="pg-btn pg-btn-white" href="#contact">{ENTERPRISE.cta}</a>
          </section>

          <section className="pg-ent-contact" id="contact">
            <div className="pg-ent-contact-copy">
              <h2>{ENTERPRISE.contactTitle}</h2>
              <p className="pg-ent-kicker">Features</p>
              <ul>{ENTERPRISE.contactFeatures.map((f) => <li key={f}><CheckIcon />{f}</li>)}</ul>
            </div>
            <form className="pg-ent-form" onSubmit={(e) => e.preventDefault()}>
              <h3>Contact Sales</h3>
              <p>{ENTERPRISE.contactBody}</p>
              <label>Work email<input type="email" placeholder="you@company.com" /></label>
              <label>Company<input type="text" placeholder="Company name" /></label>
              <label>Reason
                <select defaultValue="">
                  <option value="" disabled>Select a reason</option>
                  <option>Evaluating for my team</option>
                  <option>Pricing and plans</option>
                  <option>Security review</option>
                  <option>Something else</option>
                </select>
              </label>
              <div className="pg-ent-form-foot">
                <button type="button" className="pg-btn pg-btn-ghost">Back</button>
                <button type="submit" className="pg-btn pg-btn-white">Continue</button>
              </div>
            </form>
          </section>

          <section className="pg-ent-faq">
            <h2>{ENTERPRISE.faqTitle}</h2>
            <p className="pg-ent-lead">{ENTERPRISE.faqBody}</p>
            <div className="pg-ent-faq-list">
              {ENT_FAQ.map((f, i) => (
                <div key={f.q} className="pg-ent-faq-item" data-open={i === open || undefined}>
                  <button type="button" aria-expanded={i === open} onClick={() => setOpen(i === open ? null : i)}>
                    <span>{f.q}</span><PlusIcon />
                  </button>
                  {i === open && <p>{f.a}</p>}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const CheckIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
