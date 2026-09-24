import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SC_CARDS, SC_HEADING, SC_TABS } from "./pagesData4";

const TAB_KINDS: Record<string, string[]> = {
  Marketing: ["Feature"],
  "Explainer videos": ["Skill"],
  Apps: ["App"],
  Games: ["Game"],
};

/**
 * Supercomputer: the agent shell — a left rail with chats, products and
 * customisation, a skill gallery in the middle, and the floating ask
 * composer pinned to the bottom.
 */
export function SupercomputerPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("All");
  const [ask, setAsk] = useState("");
  const [tip, setTip] = useState(true);
  const [products, setProducts] = useState(true);
  const [customize, setCustomize] = useState(true);

  const kinds = TAB_KINDS[tab];
  const cards = kinds ? SC_CARDS.filter((c) => kinds.includes(c.kind)) : SC_CARDS;

  return (
    <div className="sp">
      <aside className="sp-rail">
        <div className="sp-switch">
          <button type="button" className="sp-product">
            <span className="sp-product-mark"><LogoGlyph /></span>
            Supercomputer
            <ChevronUpDown />
          </button>
          <button type="button" className="sp-collapse" aria-label="Collapse sidebar"><PanelIcon /></button>
        </div>

        <button type="button" className="sp-newchat"><PlusIcon />New chat<kbd>⌘ ↵</kbd></button>
        <button type="button" className="sp-navbtn"><SearchIcon />Search<kbd>⌘ K</kbd></button>
        <button type="button" className="sp-navbtn"><FolderIcon />Projects</button>

        <button type="button" className="sp-section" aria-expanded={products} onClick={() => setProducts((v) => !v)}>Products<ChevronDown flip={!products} /></button>
        {products && (
          <nav className="sp-nav" aria-label="Products">
            <button type="button"><FilmIcon />Faceless channel</button>
            <button type="button"><GridIcon />Apps</button>
            <button type="button"><GamepadIcon />Games</button>
          </nav>
        )}

        <button type="button" className="sp-section" aria-expanded={customize} onClick={() => setCustomize((v) => !v)}>Customize<ChevronDown flip={!customize} /></button>
        {customize && (
          <nav className="sp-nav" aria-label="Customize">
            <button type="button"><BoltIcon />Skills</button>
            <button type="button"><PlugIcon />Connectors</button>
            <button type="button"><MemoryIcon />Memory</button>
          </nav>
        )}

        <p className="sp-section sp-section-static">Chats</p>
        <div className="sp-empty">
          <p>No chats yet</p>
          <p>Create one to get started</p>
        </div>

        {tip && (
          <div className="sp-tip">
            <button type="button" className="sp-tip-close" aria-label="Dismiss" onClick={() => setTip(false)}>×</button>
            <p className="sp-tip-kicker">Learn to make movies</p>
            <p className="sp-tip-title">Practical workflows from working AI filmmakers</p>
            <span className="sp-tip-art" aria-hidden="true" />
            <Link to="/academy" className="sp-tip-cta">Learn more</Link>
          </div>
        )}

        <div className="sp-rail-foot">
          <Link to="/pricing" className="sp-foot-link"><TagIcon />Pricing<em>30% OFF</em></Link>
          <Link to={user ? "/account" : "/login"} className="sp-foot-link"><LoginIcon />{user ? "Account" : "Log in"}</Link>
        </div>
      </aside>

      <main id="main" className="sp-main">
        <h1 className="sp-heading">{SC_HEADING}</h1>

        <div className="sp-tabs" role="tablist">
          {SC_TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={t === tab} data-active={t === tab || undefined} onClick={() => setTab(t)}>
              <TabIcon name={t} />{t}
            </button>
          ))}
        </div>

        <div className="sp-grid">
          {cards.map((c) => (
            <figure key={c.title} className="sp-card">
              <div className="sp-card-media">
                {c.video
                  ? <video src={c.media} muted loop autoPlay playsInline preload="metadata" />
                  : <img src={c.media} alt="" loading="lazy" decoding="async" />}
              </div>
              <figcaption>
                <span className="sp-card-title"><span className="sp-card-ico"><BoltIcon /></span>{c.title}</span>
                <span className="sp-card-kind">{c.kind === "Feature" ? <SparkIcon /> : <BoltIcon />}{c.kind}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        {!cards.length && <p className="sp-none">Nothing in this category yet.</p>}

        <form className="sp-ask" onSubmit={(e) => e.preventDefault()}>
          <button type="button" className="sp-ask-plus" aria-label="Attach"><PlusIcon /></button>
          <button type="button" className="sp-ask-mode"><AutoIcon />Auto<em>Free</em><ChevronDown /></button>
          <input placeholder="What are we creating today?" value={ask} onChange={(e) => setAsk(e.target.value)} aria-label="Ask Supercomputer" />
          <button type="button" className="sp-ask-mode sp-ask-mode-alt">Ask mode<ChevronDown /></button>
          <button type="submit" className="sp-ask-send" aria-label="Send"><ArrowUpIcon /></button>
        </form>
      </main>
    </div>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const LogoGlyph = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15c3-6 5-6 7 0s4 6 7 0" {...s} strokeWidth={2.4} /></svg>;
const ChevronUpDown = () => <svg viewBox="0 0 24 24" className="sp-chev" aria-hidden="true"><path d="M8 10l4-4 4 4M8 14l4 4 4-4" {...s} /></svg>;
const ChevronDown = ({ flip }: { flip?: boolean }) => <svg viewBox="0 0 24 24" className="sp-chev" aria-hidden="true" style={flip ? { transform: "rotate(-90deg)" } : undefined}><path d="M6 9l6 6 6-6" {...s} /></svg>;
const PanelIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><path d="M14 5v14" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" {...s} /><path d="M16 16l4 4" {...s} /></svg>;
const FolderIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h6l2 2h10v10H3V7Z" {...s} /></svg>;
const FilmIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" {...s} /><path d="M8 5v14M16 5v14" {...s} /></svg>;
const GridIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1.5" {...s} /><rect x="13" y="4" width="7" height="7" rx="1.5" {...s} /><rect x="4" y="13" width="7" height="7" rx="1.5" {...s} /><rect x="13" y="13" width="7" height="7" rx="1.5" {...s} /></svg>;
const GamepadIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L14 14h-4l-1.6 1.8A3 3 0 0 1 3 14v-1a4 4 0 0 1 4-4Z" {...s} /><path d="M8 11.5v2M7 12.5h2" {...s} /></svg>;
const BoltIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3L5 14h6l-1 7 8-11h-6l1-7Z" fill="currentColor" /></svg>;
const PlugIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" {...s} /></svg>;
const MemoryIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" {...s} /><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" {...s} /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
const TagIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11V5a1 1 0 0 1 1-1h6l8 8-7 7-8-8Z" {...s} /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></svg>;
const LoginIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" {...s} /></svg>;
const AutoIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4" {...s} /><circle cx="16" cy="12" r="4" {...s} /></svg>;
const ArrowUpIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 12l6-6 6 6" {...s} strokeWidth={2} /></svg>;
const TabIcon = ({ name }: { name: string }) =>
  name === "All" ? <GridIcon />
    : name === "Marketing" ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" {...s} /><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" {...s} /></svg>
      : name === "Explainer videos" ? <FilmIcon />
        : name === "Apps" ? <GridIcon /> : <GamepadIcon />;
