import { Link } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { ORIGINALS_HERO, ORIGINAL_ROWS, type OriginalRow } from "./pagesData2";

/**
 * Originals: a full-bleed video hero with the series title and Watch now,
 * a promo banner, then one poster row per collection.
 */
export function OriginalsPage() {
  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-originals">
        <section className="pg-og-hero">
          {ORIGINALS_HERO && <video className="pg-og-bg" src={ORIGINALS_HERO} autoPlay loop muted playsInline />}
          <span className="pg-og-shade" />
          <div className="pg-og-hero-body">
            <p className="pg-og-kicker">RaisAI Originals</p>
            <h1>The Cully Hill Boys</h1>
            <button type="button" className="pg-btn pg-btn-white"><PlayIcon />Watch now</button>
          </div>
          <button type="button" className="pg-og-mute" aria-label="Unmute"><MuteIcon /></button>
        </section>

        <div className="pg-container">
          <Link to="/pricing" className="pg-og-promo">
            <span className="pg-og-promo-badge"><TagIcon />Up to 30% off</span>
            <h2>Start creating with<br /><span>Seedance 2.5</span></h2>
            <span className="pg-btn pg-btn-white">Get the discount</span>
          </Link>

          {ORIGINAL_ROWS.map((r) => <PosterRow key={r.title} row={r} />)}
        </div>
      </main>
    </>
  );
}

function PosterRow({ row }: { row: OriginalRow }) {
  return (
    <section className="pg-og-row">
      <header>
        <h2>{row.title}</h2>
        <Link to="/community/originals" className="pg-og-seeall">See all<ChevronIcon /></Link>
      </header>
      <div className="pg-og-strip">
        {row.posters.map((p, i) => (
          <Link key={p + i} to="/community/originals" className="pg-og-poster">
            <img src={p} alt="" loading="lazy" decoding="async" />
          </Link>
        ))}
      </div>
    </section>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const PlayIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" /></svg>;
const MuteIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M5 9v6h3l4 3.5v-13L8 9H5Z" {...s} /><path d="M16 10l4 4M20 10l-4 4" {...s} /></svg>;
const TagIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M4 11V5a1 1 0 0 1 1-1h6l8 8-7 7-8-8Z" {...s} /><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" /></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M9 5l7 7-7 7" {...s} /></svg>;
