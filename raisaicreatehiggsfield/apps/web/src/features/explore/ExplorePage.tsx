import { useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  EXPLORE_MORE, FOOTER_COLUMNS, GENJUTSU, GRIDS, HERO, PROJECTS, PROMO, STATIC, TILES,
  type GridCard, type GridSection, type HeroItem, type LinkItem, type PresetCard, type ProjectItem, type Tile,
} from "./exploreData";

/**
 * The Explore home page: the same section stack as the reference Explore
 * page, driven by exploreData.ts. Every link resolves to a route in this app
 * (real screen or the menu placeholder). UI only.
 */
export function ExplorePage() {
  return (
    <div className="xp">
      <HeroCarousel items={HERO} />
      <div className="xp-container">
        <PromoRow />
        <McpBanner />
      </div>
      <div className="xp-container">
        <GenjutsuWall />
      </div>
      <MediaGrid section={GRIDS[0]!} first />
      <div className="xp-container">
        <ProjectsRow />
      </div>
      <div className="xp-container">
        <SupercomputerBanner />
      </div>
      <MediaGrid section={GRIDS[1]!} />
      <div className="xp-container">
        <CanvasBanner />
      </div>
      <MediaGrid section={GRIDS[2]!} />
      <MediaGrid section={GRIDS[3]!} />
      <div className="xp-container">
        <PhotodumpBanner />
      </div>
      <MediaGrid section={GRIDS[4]!} />
      <MediaGrid section={GRIDS[5]!} />
      <ExploreMore />
      <LandingFooter />
      <AppFooter />
    </div>
  );
}

/** Internal links go through the router; anything external opens in a new tab. */
function A(props: { href: string; className?: string; children: React.ReactNode; "aria-label"?: string }) {
  const { href, ...rest } = props;
  if (/^https?:/.test(href)) return <a href={href} target="_blank" rel="noopener noreferrer" {...rest} />;
  return <Link to={href} {...rest} />;
}

/** Poster image with a video that plays while hovered (or always, when `autoPlay`). */
function HoverVideo(props: { img: string | null; video: string | null; alt: string; autoPlay?: boolean; className?: string; style?: CSSProperties; wm?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const cls = `xp-media${props.wm ? " xp-media-wm" : ""}${props.className ? ` ${props.className}` : ""}`;
  return (
    <figure
      className={cls}
      style={props.style}
      onMouseEnter={() => { const v = ref.current; if (v && !props.autoPlay) { v.play().then(() => setPlaying(true)).catch(() => {}); } }}
      onMouseLeave={() => { const v = ref.current; if (v && !props.autoPlay) { v.pause(); v.currentTime = 0; setPlaying(false); } }}
    >
      {props.img && <img src={props.img} alt={props.alt} loading="lazy" decoding="async" />}
      {props.video && (
        <video ref={ref} src={props.video} loop muted playsInline preload={props.autoPlay ? "auto" : "none"} autoPlay={props.autoPlay || undefined} data-playing={playing || undefined} aria-label={props.alt} />
      )}
    </figure>
  );
}

/* ---- hero ------------------------------------------------------------------ */

function HeroCarousel({ items }: { items: HeroItem[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <section className="xp-hero xp-container xp-container-flush">
      <div ref={scroller} className="xp-hero-scroll hide-scrollbar">
        <ul className="xp-hero-list">
          {items.map((h) => (
            <li key={h.href + h.title}>
              <div className="xp-hero-card">
                <A href={h.href} aria-label={`Open ${h.title}`}><span className="visually-hidden">Open {h.title}</span></A>
                <HoverVideo img={h.img} video={h.video} alt={`${h.title} - ${h.desc}`} autoPlay />
                <div className="xp-hero-text">
                  <h3>{h.title}</h3>
                  <p>{h.desc}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="xp-hero-fade" aria-hidden="true" />
      <button type="button" className="xp-hero-next" aria-label="Scroll right" onClick={() => scroller.current?.scrollBy({ left: 560, behavior: "smooth" })}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </section>
  );
}

/* ---- promo + tiles --------------------------------------------------------- */

function PromoRow() {
  return (
    <section className="xp-promo-row">
      <div className="xp-promo">
        <Link to="/signup" className="xp-promo-card">
          {PROMO.poster && <img src={PROMO.poster} alt="" />}
          {PROMO.video && <video src={PROMO.video} autoPlay loop muted playsInline />}
          <span className="xp-promo-shade" />
          <div className="xp-promo-body">
            <h3 className="xp-promo-title"><span>Sign up and get your</span><span className="lime">extra discount</span></h3>
            <ul className="xp-promo-list">
              {["Get unlimited Nano Banana Pro", "Unlock your extra discount", "Access to Seedance 2.5"].map((t) => (
                <li key={t}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><span>{t}</span></li>
              ))}
            </ul>
            <div className="xp-promo-cta"><span>Sign up and get your discount</span></div>
          </div>
        </Link>
      </div>
      <div className="xp-tiles">
        {TILES.map((t) => <QuickTile key={t.title} tile={t} />)}
      </div>
    </section>
  );
}

function QuickTile({ tile }: { tile: Tile }) {
  return (
    <A href={tile.href} className="xp-tile">
      <div className="xp-tile-inner">
        <div className="xp-tile-logo">
          {tile.logo ? <img src={tile.logo} alt="" width={20} height={20} /> : tile.icon === "banana" ? <BananaIcon /> : <BookIcon />}
        </div>
        <div className="xp-tile-text">
          <div className="xp-tile-title"><span>{tile.title}</span>{tile.badge && <span className="xp-badge-skew">{tile.badge}</span>}</div>
          <p className="xp-tile-desc">{tile.desc}</p>
        </div>
      </div>
      {tile.kind && (
        <span className="xp-tile-kind">
          {tile.kind === "Video" ? <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M16 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            : <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><circle cx="16" cy="9" r="1.5" fill="currentColor" /></svg>}
          {tile.kind}
        </span>
      )}
    </A>
  );
}

function BananaIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 14c3 4 8 5.5 12.5 3.5C19.5 16 21 13 20.5 10c-.4 2.4-2 4.4-4.3 5.3C12.3 16.8 8.4 15.5 6 12.6c-.4 1-.9 1.4-2 1.4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><path d="M20.5 10c.4-1.2.3-2.4-.4-3.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function BookIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 6.5C10.5 5.3 8.4 4.75 4 4.75v13.5c4.4 0 6.5.55 8 1.75 1.5-1.2 3.6-1.75 8-1.75V4.75c-4.4 0-6.5.55-8 1.75Zm0 0V20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>;
}

/* ---- MCP banner ------------------------------------------------------------ */

function McpBanner() {
  return (
    <section className="xp-mcp">
      <div className="xp-astra">
        <Link to="/developer/mcp" className="xp-astra-link">
          <div className="xp-astra-scene" aria-hidden="true">
            <svg className="xp-astra-grid" viewBox="0 0 1400 400" preserveAspectRatio="none" fill="none">
              {Array.from({ length: 21 }, (_, i) => <line key={`v${i}`} x1={700 + (i - 10) * 70} y1="0" x2={700 + (i - 10) * 260} y2="400" />)}
              {Array.from({ length: 9 }, (_, i) => { const y = 200 + Math.pow(i / 8, 1.6) * 200; return <line key={`h${i}`} x1="0" y1={y} x2="1400" y2={y} />; })}
              {Array.from({ length: 9 }, (_, i) => { const y = 200 - Math.pow(i / 8, 1.6) * 200; return <line key={`t${i}`} x1="0" y1={y} x2="1400" y2={y} />; })}
            </svg>
            <div className="xp-astra-top" />
            <div className="xp-astra-floor" />
          </div>
          <div className="xp-astra-content">
            <div className="xp-astra-copy">
              <h2 className="xp-astra-heading" aria-label="RaisAI MCP with GPT-6 Astra">
                <span className="xp-astra-kicker">RaisAI MCP with</span>
                <span className="xp-astra-title">
                  <span className="xp-astra-word">GPT-6</span>
                  <svg className="xp-astra-logo" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 3c-3 3-3 15 0 18M12 3c3 3 3 15 0 18M3 12h18" stroke="currentColor" strokeWidth="1.6" /></svg>
                  <span className="xp-astra-word">ASTRA</span>
                </span>
              </h2>
              <p className="xp-astra-desc">Build games, motion graphics, and interactive 3D experiences with RaisAI MCP</p>
            </div>
            <span className="xp-btn xp-btn-lime xp-btn-q xp-astra-cta">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7l8-4 8 4-8 4-8-4Zm0 5l8 4 8-4M4 17l8 4 8-4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
              Explore use cases
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}

/* ---- Genjutsu presets wall ------------------------------------------------- */

function GenjutsuWall() {
  const cols = GENJUTSU.columns as PresetCard[][];
  return (
    <div className="xp-genjutsu-wrap">
      <section aria-label={GENJUTSU.title} className="xp-genjutsu">
        <div className="xp-genjutsu-head">
          <div className="xp-genjutsu-lead">
            <span className="xp-pill-new">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4L12 3Z" fill="currentColor" /></svg>
              <span>New model</span>
            </span>
            <h2 className="xp-genjutsu-title">{GENJUTSU.title}</h2>
            <p className="xp-genjutsu-sub">{GENJUTSU.subtitle}</p>
          </div>
          <div className="xp-genjutsu-actions">
            {GENJUTSU.buttons.map((b, i) => (
              <A key={b.label} href={b.href} className={`xp-btn xp-btn-q ${i === 0 ? "xp-btn-lime" : "xp-btn-secondary-white"}`}>{b.label}</A>
            ))}
          </div>
        </div>
        <div className="xp-masonry-wrap">
          <div className="xp-masonry">
            {cols.map((col, ci) => (
              <div key={ci} className="xp-masonry-col">
                {col.slice(0, 5).map((p, pi) => <PresetTile key={pi} preset={p} />)}
              </div>
            ))}
          </div>
          {GENJUTSU.viewAll && (
            <div className="xp-fade-bottom xp-fade-black">
              <A href={GENJUTSU.viewAll.href} className="xp-btn xp-btn-brand-alpha">{GENJUTSU.viewAll.label}<ArrowIcon /></A>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PresetTile({ preset }: { preset: PresetCard }) {
  return (
    <article className="xp-preset">
      {preset.img && <img src={preset.img} alt="" loading="lazy" decoding="async" />}
      <div className="xp-preset-dim" aria-hidden="true" />
      {preset.label && (
        <div className="xp-preset-label">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h16M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {preset.label}
        </div>
      )}
      <Link to="/create/video?model=genjutsu" aria-label="Open preset" style={{ position: "absolute", inset: 0, zIndex: 16 }} />
      <button type="button" className="xp-preset-expand" aria-label="Expand example">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div className="xp-preset-foot">
        <div className="xp-preset-thumbs">
          {preset.thumbs.slice(0, 3).map((t, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i === 1 && <span className="sep" aria-hidden="true" />}
              <img src={t} alt="" />
            </span>
          ))}
        </div>
        <span className="xp-btn xp-btn-lime xp-btn-xs">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6M17.7 3v3.4h-3.4M6.3 21v-3.4h3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Recreate
        </span>
      </div>
    </article>
  );
}

/* ---- community grids --------------------------------------------------------- */

function MediaGrid({ section, first }: { section: GridSection; first?: boolean }) {
  return (
    <section id={section.id} className={`xp-grid-sec xp-container xp-container-flush${first ? " first" : ""}`}>
      <header className="xp-sec-head">
        <Link to={section.href} className="xp-sec-title">{section.title}</Link>
        <p className="xp-sec-sub">{section.subtitle}</p>
      </header>
      <div className="xp-grid-body">
        <div className="xp-grid">
          {section.columns.map((col, ci) => (
            <div key={ci} className="xp-grid-col">
              {col.map((c, i) => <GridCardView key={i} card={c} />)}
            </div>
          ))}
        </div>
        {section.viewAll && (
          <div className="xp-fade-bottom">
            <Link to={section.viewAll.href} className="xp-btn xp-btn-brand-alpha">{section.viewAll.label}<ArrowIcon /></Link>
          </div>
        )}
      </div>
    </section>
  );
}

function GridCardView({ card }: { card: GridCard }) {
  return (
    <aside className="xp-card">
      <HoverVideo img={card.img} video={card.video} alt={card.prompt} style={{ aspectRatio: `${card.aspect} / 1` }} wm={Boolean(card.video)} />
      <button type="button" className="xp-card-shade" aria-label="Open" />
      <header className="xp-card-head">
        <Link to={`/@${card.author}`} className="xp-card-author">
          <figure>{card.avatar && <img src={card.avatar} alt="" loading="lazy" />}</figure>
          <p>{card.author}</p>
        </Link>
        {card.likes && (
          <button type="button" className="xp-likes">
            {card.likes}
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
          </button>
        )}
      </header>
    </aside>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ---- projects ------------------------------------------------------------------ */

function ProjectsRow() {
  const items = PROJECTS.items as ProjectItem[];
  return (
    <section className="xp-projects">
      <div className="xp-projects-head">
        <h2 className="xp-accent-md">{PROJECTS.title}</h2>
        <p className="xp-body-sm">{PROJECTS.subtitle}</p>
      </div>
      <div className="xp-projects-body">
        <div className="xp-projects-grid">
          {items.map((p) => (
            <Link key={p.href} to={p.href} className="xp-project">
              <figure>{p.img && <img src={p.img} alt="" loading="lazy" decoding="async" />}</figure>
              <div className="xp-project-foot">
                <div className="xp-project-name">
                  <span className="xp-project-mark" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M5 3h5.5c2.8 0 4.7 1.7 4.7 4.3 0 1.9-1 3.3-2.7 3.9L15.7 16h-3.1l-2.8-4.5H7.8V16H5V3Zm2.8 2.4v4.1h2.5c1.4 0 2.2-.8 2.2-2s-.8-2.1-2.2-2.1H7.8Z" fill="currentColor" /></svg></span>
                  <strong>{p.name}</strong>
                  <span>by {p.author}</span>
                </div>
                <span className="xp-project-public">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" /><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" stroke="currentColor" strokeWidth="1.6" /></svg>
                  Public
                </span>
              </div>
            </Link>
          ))}
        </div>
        {PROJECTS.viewAll && (
          <div className="xp-fade-bottom" style={{ height: "8rem", paddingBottom: "0.5rem" }}>
            <Link to={PROJECTS.viewAll.href} className="xp-btn xp-btn-brand-alpha">{PROJECTS.viewAll.label}<ArrowIcon /></Link>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---- banners --------------------------------------------------------------------- */

function SupercomputerBanner() {
  return (
    <Link to="/canvas" className="xp-spc">
      <div className="xp-spc-box">
        <div className="xp-spc-tint" />
        {STATIC.spcBg && <img src={STATIC.spcBg} alt="" className="xp-spc-bg" width={4224} height={1287} />}
        {STATIC.spcCreative && <img src={STATIC.spcCreative} alt="" className="xp-spc-float" style={{ left: "7.24%", top: "19.1%", width: "18.47%" }} />}
        {STATIC.spcVisualizing && <img src={STATIC.spcVisualizing} alt="" className="xp-spc-float" style={{ left: "67.9%", top: "15.85%", width: "8.17%" }} />}
        {STATIC.spcMarketing && <img src={STATIC.spcMarketing} alt="" className="xp-spc-float" style={{ left: "78.48%", top: "13.75%", width: "15.55%" }} />}
        {STATIC.spcProduction && <img src={STATIC.spcProduction} alt="" className="xp-spc-float" style={{ left: "68.96%", bottom: 0, width: "15.84%" }} />}
        <div className="xp-spc-content">
          <div className="xp-spc-copy">
            {STATIC.spcLogo && <img src={STATIC.spcLogo} alt="" className="xp-spc-logo" />}
            <div className="xp-spc-copy" style={{ gap: "0.5rem" }}>
              <h2 className="xp-spc-title">Supercomputer</h2>
              <p className="xp-spc-sub">One superagent for your entire creative stack</p>
            </div>
          </div>
          <span className="xp-spc-btn">Try Supercomputer</span>
        </div>
      </div>
    </Link>
  );
}

function CanvasBanner() {
  return (
    <div className="xp-canvas-wrap">
      <Link to="/canvas" aria-label="Try Canvas" className="xp-canvas" style={STATIC.canvasBg ? { backgroundImage: `url("${STATIC.canvasBg}")` } : undefined}>
        <div className="xp-canvas-copy">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <div className="xp-kicker">New feature</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <h2 className="xp-canvas-title">One canvas.<br />Every workflow.</h2>
              <p className="xp-canvas-sub">Moodboard, chain workflows, and share<br />with your team - all on one canvas</p>
            </div>
          </div>
          <span className="xp-btn xp-btn-white xp-btn-md">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" fill="currentColor" /></svg>
            Try Canvas
          </span>
        </div>
        {STATIC.canvasArt && <img src={STATIC.canvasArt} alt="" className="xp-canvas-art" />}
      </Link>
    </div>
  );
}

function PhotodumpBanner() {
  return (
    <div className="xp-photodump-wrap">
      <div className="xp-photodump">
        <Link to="/create/image?model=soul-v2&photodump=true" aria-label="Try Photodump" className="cover"><span className="visually-hidden">Try Photodump</span></Link>
        <div className="xp-photodump-art">{STATIC.photodumpDesktop && <img src={STATIC.photodumpDesktop} alt="" width={2268} height={408} />}</div>
        <div className="xp-photodump-copy">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div><span className="xp-photodump-badge">photodump</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.25rem" }}>
              <h2 className="xp-photodump-title">Different Scenes<br />Same Star</h2>
              <p className="xp-photodump-sub">Build your character. One click does the rest</p>
            </div>
          </div>
          <span className="xp-btn xp-btn-white" style={{ alignSelf: "flex-start", paddingInline: "1.25rem" }}>Try Photodump</span>
        </div>
      </div>
    </div>
  );
}

/* ---- explore more + footers ----------------------------------------------------- */

function ExploreMore() {
  return (
    <section className="xp-more">
      <div className="xp-container xp-more-inner">
        <h2>Explore more AI features</h2>
        <div className="xp-more-list">
          {EXPLORE_MORE.map((l: LinkItem, i) => <A key={`${l.href}-${i}`} href={l.href}>{l.label}</A>)}
        </div>
      </div>
    </section>
  );
}

/** Nine footer sections laid out in five columns, the way the reference groups them on wide screens. */
const FOOTER_GROUPS = [["Create"], ["Video Models", "Image Models"], ["Studios", "Soul"], ["Platform", "Resources"], ["Company", "Community"]];

function LandingFooter() {
  const byHeading = new Map(FOOTER_COLUMNS.map((c) => [c.heading, c]));
  return (
    <footer id="footer-landing" className="xp-lfooter">
      <div className="xp-container xp-lfooter-inner">
        <div className="xp-lfooter-top">
          <h2 className="xp-lfooter-title">AI-native creative suite</h2>
          <div className="xp-lfooter-cols">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.join("+")} className="xp-lfooter-col">
                {group.map((h) => {
                  const sec = byHeading.get(h);
                  if (!sec) return null;
                  return (
                    <section key={h} className="xp-lfooter-sec">
                      <h3>{sec.heading}</h3>
                      <ul>{sec.links.map((l, i) => <li key={`${l.href}-${i}`}><A href={l.href}>{l.label}</A></li>)}</ul>
                    </section>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="xp-lfooter-bottom">
          <div><p>Kuala Lumpur, Malaysia</p></div>
          <ul className="xp-lfooter-social">
            <li><a href="https://x.com" target="_blank" rel="noopener noreferrer">X / Twitter</a></li>
            <li><a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer">Youtube</a></li>
            <li><a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
            <li><a href="https://www.tiktok.com" target="_blank" rel="noopener noreferrer">Tiktok</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function AppFooter() {
  return (
    <footer id="footer" className="xp-afooter">
      <nav>
        <p><span style={{ whiteSpace: "nowrap" }}>© {new Date().getFullYear()} RaisAI Create.</span> All rights reserved.</p>
        <ul>
          <li>
            <span className="xp-afooter-lang">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /><path d="M3 12h18M12 3c2.6 2.7 3.9 5.8 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.8-3.9-9S9.4 5.7 12 3Z" stroke="currentColor" strokeWidth="1.5" /></svg>
              English
            </span>
          </li>
          <li><Link to="/creator-hub/help-center">Help center</Link></li>
          <li><Link to="/cookie-notice">Cookie Notice</Link></li>
          <li><Link to="/terms-of-use-agreement">Terms</Link></li>
          <li><Link to="/privacy-policy">Privacy</Link></li>
        </ul>
      </nav>
    </footer>
  );
}
