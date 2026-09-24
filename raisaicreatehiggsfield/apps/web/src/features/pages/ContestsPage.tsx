import { useState } from "react";
import { Link } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { CONTEST, FILMS } from "./pagesData3";

/**
 * Contest page: breadcrumb and sub-tabs, the "Create in public" panel with
 * its floating viewer thumbnails, then the grid of entered films.
 */
export function ContestsPage() {
  const [tab, setTab] = useState(CONTEST.tabs[0]!);
  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-contest">
        <div className="pg-ct-bar">
          <p className="pg-ct-crumb"><Link to="/contests">{CONTEST.breadcrumb}</Link> / <span>{CONTEST.name}</span></p>
          <nav className="pg-ct-tabs" aria-label="Contest sections">
            {CONTEST.tabs.map((t) => (
              <button key={t} type="button" data-active={t === tab || undefined} data-accent={t === "Create in public" || undefined} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
        </div>

        <div className="pg-container">
          <section className="pg-ct-panel">
            <div className="pg-ct-copy">
              <div className="pg-ct-badges">
                {CONTEST.badges.map((b) => <span key={b}>{b}</span>)}
              </div>
              <h1>{CONTEST.title}</h1>
              <p>{CONTEST.body}</p>
              <button type="button" className="pg-btn pg-btn-white">{CONTEST.cta}</button>
            </div>
            <div className="pg-ct-art" aria-hidden="true">
              {FILMS.slice(0, 3).map((f, i) => (
                <span key={f.img} className="pg-ct-frame" data-i={i}><img src={f.img} alt="" loading="lazy" /></span>
              ))}
              <span className="pg-ct-viewer" data-i="0">Viewer</span>
              <span className="pg-ct-viewer" data-i="1">Viewer</span>
              <span className="pg-ct-viewer" data-i="2">Viewer</span>
            </div>
          </section>

          <div className="pg-ct-grid">
            {FILMS.map((f) => (
              <article key={f.img} className="pg-ct-film">
                <figure><img src={f.img} alt="" loading="lazy" decoding="async" /></figure>
                <p><strong>{f.title}</strong> <span>by {f.author}</span></p>
              </article>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
