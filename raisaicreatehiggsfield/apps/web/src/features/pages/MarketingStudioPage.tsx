import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { MS_CARDS, MS_EXPLORE_TITLE, MS_HERO_TITLE, MS_HEROES, MS_TABS } from "./pagesData4";

const KIND_FOR_TAB: Record<string, string[]> = {
  "Product shot": ["Product shot"],
  Motion: ["Product motion"],
  UGC: ["UGC video"],
  Ads: ["Ads"],
  Posters: ["Posters"],
  Marketplace: ["Marketplace"],
};

/**
 * Marketing Studio: its own app shell with a collapsible left rail, the hero
 * composer over the rotating banner strip, and the template gallery with its
 * category filter.
 */
export function MarketingStudioPage() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState("All");
  const [mode, setMode] = useState<"Image" | "Video">("Image");
  const [prompt, setPrompt] = useState("");

  const kinds = KIND_FOR_TAB[tab];
  const cards = kinds ? MS_CARDS.filter((c) => kinds.includes(c.kind)) : MS_CARDS;

  return (
    <div className="ms" data-collapsed={collapsed || undefined}>
      <aside className="ms-rail">
        <div className="ms-rail-top">
          <Link to="/" className="ms-logo" aria-label="Home"><LogoGlyph /></Link>
          <button type="button" className="ms-collapse" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((v) => !v)}>
            <PanelIcon />
          </button>
        </div>

        <nav className="ms-nav" aria-label="Marketing Studio">
          <button type="button" data-active><HomeIcon /><span>Home</span></button>
          <button type="button"><SparkIcon /><span>My generations</span></button>
          <button type="button"><HeartIcon /><span>My favorites</span></button>
        </nav>

        <p className="ms-section">Tools</p>
        <nav className="ms-nav" aria-label="Tools">
          <button type="button"><AdIcon /><span>Ad Reference</span></button>
          <button type="button"><LinkIcon /><span>Product Link</span></button>
        </nav>

        <p className="ms-section">Projects</p>
        <button type="button" className="ms-newproject"><PlusIcon /><span>New project</span></button>

        <div className="ms-rail-foot">
          <Link to="/pricing" className="ms-foot-link"><TagIcon /><span>Pricing</span><em>50% OFF</em></Link>
          <Link to={user ? "/account" : "/login"} className="ms-foot-link"><LoginIcon /><span>{user ? "Account" : "Login"}</span></Link>
        </div>
      </aside>

      <main id="main" className="ms-main">
        <section className="ms-hero">
          <div className="ms-hero-strip" aria-hidden="true">
            {MS_HEROES.map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)}
          </div>
          <div className="ms-hero-copy">
            <p className="ms-hero-kicker">Marketing Studio</p>
            <h1>{MS_HERO_TITLE}</h1>
            <form className="ms-composer" onSubmit={(e) => e.preventDefault()}>
              <div className="ms-mode">
                {(["Image", "Video"] as const).map((k) => (
                  <button key={k} type="button" data-active={mode === k || undefined} onClick={() => setMode(k)}>{k}</button>
                ))}
              </div>
              <textarea rows={2} placeholder="Describe what you want to create..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <div className="ms-composer-foot">
                <span className="ms-chips">
                  <span className="ms-chip"><ImageIcon />Marketing Studio {mode}</span>
                  <span className="ms-chip">Closeup</span>
                  <span className="ms-chip">3:4</span>
                  <span className="ms-chip">1/4</span>
                </span>
                <button type="submit" className="ms-generate">Generate<SparkIcon /><em>—</em></button>
              </div>
            </form>
          </div>
        </section>

        <section className="ms-explore">
          <h2>{MS_EXPLORE_TITLE}</h2>
          <div className="ms-tabs" role="tablist">
            {MS_TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={t === tab} data-active={t === tab || undefined} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
          <div className="ms-grid">
            {cards.map((c) => (
              <figure key={c.title} className="ms-card">
                {c.video
                  ? <video src={c.media} muted loop autoPlay playsInline preload="metadata" />
                  : <img src={c.media} alt="" loading="lazy" decoding="async" />}
                <figcaption>
                  <span className="ms-card-title">{c.title}</span>
                  <span className="ms-card-kind">{c.kind}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          {!cards.length && <p className="ms-empty">No templates in this category yet.</p>}
        </section>
      </main>
    </div>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const LogoGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15c3-6 5-6 7 0s4 6 7 0" {...s} strokeWidth={2.4} /></svg>;
const PanelIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><path d="M10 5v14" {...s} /></svg>;
const HomeIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z" {...s} /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
const HeartIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...s} /></svg>;
const AdIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" {...s} /><path d="M8 15l2-6 2 6M8.7 13h2.6M15 15V9h1.5a2 2 0 0 1 0 6H15Z" {...s} /></svg>;
const LinkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7L11 7.3M14 10a4 4 0 0 0-5.7 0L6 12.3a4 4 0 0 0 5.7 5.7l1.3-1.3" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
const TagIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11V5a1 1 0 0 1 1-1h6l8 8-7 7-8-8Z" {...s} /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></svg>;
const LoginIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" {...s} /></svg>;
const ImageIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><path d="M6 17l4-4 3 3 2-2 3 3" {...s} /><circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" /></svg>;
