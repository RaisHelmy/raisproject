import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CINEMA_CARDS, CINEMA_NAV } from "./pagesData3";

/**
 * Cinema Studio: its own app shell rather than the site header — a left rail
 * with the product switcher, navigation, the festival entry and the project
 * list, beside a grid of community projects.
 */
export function CinemaStudioPage() {
  const { user } = useAuth();
  const [active, setActive] = useState("Home");
  const [tip, setTip] = useState(true);
  return (
    <div className="cs">
      <aside className="cs-rail">
        <div className="cs-switch">
          <button type="button" className="cs-product">
            <span className="cs-product-mark">R</span>
            Cinema Studio
            <ChevronIcon />
          </button>
          <button type="button" className="cs-collapse" aria-label="Collapse sidebar"><PanelIcon /></button>
        </div>

        <nav className="cs-nav" aria-label="Cinema Studio">
          {CINEMA_NAV.map((n) => (
            <button key={n.label} type="button" data-active={n.label === active || undefined} onClick={() => setActive(n.label)}>
              <span className="cs-nav-icon" data-icon={n.icon}>{NAV_ICON[n.icon] ?? <DotIcon />}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <p className="cs-section">Film Festival Contest</p>
        <div className="cs-festival">
          <span className="cs-festival-mark" />
          <span className="cs-festival-name">RaisAI Fest…</span>
          <Link to="/contests" className="cs-join">Join</Link>
        </div>

        <div className="cs-projects-head">
          <p className="cs-section">Projects</p>
          <span className="cs-projects-tools"><SearchIcon /><SortIcon /></span>
        </div>
        <button type="button" className="cs-newproject"><PlusIcon />New project</button>

        {tip && (
          <div className="cs-tip">
            <button type="button" className="cs-tip-close" aria-label="Dismiss" onClick={() => setTip(false)}>×</button>
            <p className="cs-tip-kicker">Learn to make movies</p>
            <p className="cs-tip-title">Practical workflows from working AI filmmakers</p>
            <span className="cs-tip-art" />
            <Link to="/academy" className="cs-tip-cta">Learn more</Link>
          </div>
        )}

        <div className="cs-rail-foot">
          <Link to="/pricing" className="cs-foot-link"><TagIcon />Pricing<span className="cs-foot-badge">30% OFF</span></Link>
          <Link to={user ? "/account" : "/login"} className="cs-foot-link"><LoginIcon />{user ? "Account" : "Log in"}</Link>
        </div>
      </aside>

      <main id="main" className="cs-main">
        <div className="cs-grid">
          {CINEMA_CARDS.map((c) => (
            <article key={c.img} className="cs-card">
              <figure><img src={c.img} alt="" loading="lazy" decoding="async" /></figure>
              <div className="cs-card-foot">
                <p className="cs-card-title">{c.title}</p>
                <p className="cs-card-meta">
                  <span className="cs-card-author"><span className="cs-card-avatar" />RaisAI Studio</span>
                  <span className="cs-card-stats"><span><EyeIcon />{c.views}</span><span><HeartIcon />{c.likes}</span></span>
                </p>
              </div>
            </article>
          ))}
        </div>
        <div className="cs-more">
          <Link to="/community/projects" className="cs-more-btn">Explore all projects<ArrowIcon /></Link>
        </div>
      </main>
    </div>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const HomeIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8Z" {...s} /></svg>;
const ElementsIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" {...s} /><circle cx="12" cy="12" r="3" {...s} /></svg>;
const HeartNav = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...s} /></svg>;
const CommunityIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="10" r="3" {...s} /><circle cx="16" cy="11" r="2.4" {...s} /><path d="M4 19c.8-2.6 2.7-4 5-4s4.2 1.4 5 4M15 15c1.9.2 3.3 1.4 4 4" {...s} /></svg>;
const AcademyIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5L12 6l8 3.5-8 3.5-8-3.5Z" {...s} /><path d="M7 12v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4" {...s} /></svg>;
const NAV_ICON: Record<string, JSX.Element> = { home: <HomeIcon />, elements: <ElementsIcon />, heart: <HeartNav />, community: <CommunityIcon />, academy: <AcademyIcon /> };
const DotIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor" /></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" className="cs-chev" aria-hidden="true"><path d="M8 10l4-4 4 4M8 14l4 4 4-4" {...s} /></svg>;
const PanelIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><path d="M14 5v14" {...s} /></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" {...s} /><path d="M16 16l4 4" {...s} /></svg>;
const SortIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h10M5 12h7M5 17h4M17 8v9m0 0l-2.5-2.5M17 17l2.5-2.5" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
const TagIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11V5a1 1 0 0 1 1-1h6l8 8-7 7-8-8Z" {...s} /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></svg>;
const LoginIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" {...s} /></svg>;
const EyeIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...s} /><circle cx="12" cy="12" r="3" {...s} /></svg>;
const HeartIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...s} /></svg>;
const ArrowIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" {...s} /></svg>;
