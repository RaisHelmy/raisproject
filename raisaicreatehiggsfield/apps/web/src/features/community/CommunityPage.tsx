import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { PROJECTS as EXPLORE_ORIGINALS } from "../explore/exploreData";
import { HERO, PROJECTS, SHOTS, TABS, type ProjectCard, type ShotCard } from "./communityData";

/**
 * Community page: the sub-nav, the contest hero, then the Originals, Projects
 * and Shots rows, each with a "See all" link and an overlay button that fades
 * the bottom of the row. UI only.
 */
export function CommunityPage() {
  const { pathname } = useLocation();
  return (
    <>
      <HfHeader />
      <main id="main" className="cm">
        <nav className="cm-tabs" aria-label="Community sections">
          {TABS.map((t) => (
            <Link key={t.href} to={t.href} data-active={pathname === t.href || undefined}>{t.label}</Link>
          ))}
        </nav>

        <ContestHero />

        <div className="cm-container">
          <Row title="Originals by RaisAI" seeAll="/original-series" overlay="Explore all originals" overlayHref="/original-series">
            <div className="cm-grid cm-grid-4">
              {EXPLORE_ORIGINALS.items.slice(0, 8).map((o) => (
                <Link key={o.href} to={o.href} className="cm-poster">
                  {o.img && <img src={o.img} alt="" loading="lazy" />}
                  <span className="cm-poster-name">{o.name}</span>
                </Link>
              ))}
            </div>
          </Row>

          <Row title="Projects by Community" seeAll="/community/projects" overlay="Explore all projects" overlayHref="/community/projects">
            <div className="cm-grid cm-grid-4">
              {PROJECTS.map((p) => <ProjectTile key={p.title + p.img} project={p} />)}
            </div>
          </Row>

          <Row title="Shots" seeAll="/community/generations" overlay="Explore all shots" overlayHref="/community/generations">
            <div className="cm-masonry">
              {SHOTS.map((s) => <ShotTile key={s.img} shot={s} />)}
            </div>
          </Row>
        </div>
      </main>
    </>
  );
}

function ContestHero() {
  const [slide, setSlide] = useState(0);
  const slides = 7;
  return (
    <section className="cm-hero">
      {HERO.video && <video className="cm-hero-bg" src={HERO.video} autoPlay loop muted playsInline />}
      <span className="cm-hero-shade" />
      <div className="cm-hero-body">
        <span className="cm-hero-pill"><LiveIcon />{HERO.pill}</span>
        <h1>
          <span className="cm-hero-amount"><LaurelIcon />{HERO.amount}<LaurelIcon flip /></span>
          <span className="cm-hero-title">{HERO.title}</span>
        </h1>
        <p className="cm-hero-sub">{HERO.sub}</p>
        <p className="cm-hero-dates"><CalendarIcon />{HERO.dates}</p>
        <Link to={HERO.href} className="cm-btn cm-btn-lime">{HERO.cta}</Link>
      </div>
      <div className="cm-hero-thumbs" aria-hidden="true">
        {EXPLORE_ORIGINALS.items.slice(0, 3).map((o) => (
          <span key={o.href} className="cm-hero-thumb">{o.img && <img src={o.img} alt="" loading="lazy" />}</span>
        ))}
      </div>
      <div className="cm-hero-nav">
        <button type="button" aria-label="Previous" onClick={() => setSlide((s) => (s - 1 + slides) % slides)}><ChevronIcon dir="left" /></button>
        <button type="button" aria-label="Next" onClick={() => setSlide((s) => (s + 1) % slides)}><ChevronIcon /></button>
      </div>
      <div className="cm-hero-progress">
        {Array.from({ length: slides }, (_, i) => (
          <span key={i} data-active={i === slide || undefined} />
        ))}
      </div>
    </section>
  );
}

function Row(props: { title: string; seeAll: string; overlay: string; overlayHref: string; children: React.ReactNode }) {
  return (
    <section className="cm-row">
      <header className="cm-row-head">
        <h2>{props.title}</h2>
        <Link to={props.seeAll} className="cm-seeall">See all<ChevronIcon /></Link>
      </header>
      <div className="cm-row-body">
        {props.children}
        <div className="cm-row-fade">
          <Link to={props.overlayHref} className="cm-btn cm-btn-glass">{props.overlay}<ChevronIcon /></Link>
        </div>
      </div>
    </section>
  );
}

function ProjectTile({ project }: { project: ProjectCard }) {
  return (
    <Link to={project.authorHref} className="cm-card">
      <img src={project.img} alt="" loading="lazy" decoding="async" />
      <span className="cm-card-shade" />
      <span className="cm-card-info">
        <span className="cm-card-title">{project.title}</span>
        <span className="cm-card-meta">
          <span className="cm-card-author">{project.author}</span>
          <span className="cm-card-stats">
            <span><HeartIcon />{project.likes}</span>
            <span><EyeIcon />{project.views}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}

function ShotTile({ shot }: { shot: ShotCard }) {
  return (
    <figure className="cm-shot">
      <img src={shot.img} alt={shot.alt} loading="lazy" decoding="async" />
      <figcaption>
        <span className="cm-shot-author">{shot.author}</span>
      </figcaption>
    </figure>
  );
}

/* ---- icons ---- */
const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const ChevronIcon = ({ dir }: { dir?: "left" }) => (
  <svg viewBox="0 0 24 24" className="cm-i" aria-hidden="true" style={dir === "left" ? { transform: "rotate(180deg)" } : undefined}><path d="M9 5l7 7-7 7" {...s} /></svg>
);
const LiveIcon = () => <svg viewBox="0 0 24 24" className="cm-i" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10" {...s} /></svg>;
const CalendarIcon = () => <svg viewBox="0 0 24 24" className="cm-i" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2" {...s} /><path d="M4 10h16M9 3.5v4M15 3.5v4" {...s} /></svg>;
const HeartIcon = () => <svg viewBox="0 0 24 24" className="cm-i" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" {...s} /></svg>;
const EyeIcon = () => <svg viewBox="0 0 24 24" className="cm-i" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" {...s} /><circle cx="12" cy="12" r="3" {...s} /></svg>;
const LaurelIcon = ({ flip }: { flip?: boolean }) => (
  <svg viewBox="0 0 24 24" className="cm-i cm-laurel" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M14 3c-4 1.5-7 5-7 9s3 7.5 7 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9Z" fill="currentColor" />
  </svg>
);
