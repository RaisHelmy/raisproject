import { Link, useNavigate, useParams } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { PLUGINS, PLUGIN_HERO, PLUGIN_STEPS } from "./pagesData3";

/**
 * One page serving every plugin route: the kicker and headline name the host
 * app, the tab row switches between them, and the preview shows the plugin
 * panel docked in that app.
 */
export function PluginsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const plugin = PLUGINS.find((p) => p.slug === slug) ?? PLUGINS[0]!;
  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-plugins">
        <div className="pg-container">
          <p className="pg-pl-kicker">Available now</p>
          <h1 className="pg-pl-title">
            RaisAI is now<br />inside <span>{plugin.tab}</span>
          </h1>
          <Link to="/signup" className="pg-btn pg-btn-lime pg-pl-download"><DownloadIcon />Download</Link>

          <div className="pg-pl-tabs" role="tablist" aria-label="Host application">
            {PLUGINS.map((p) => (
              <button
                key={p.slug}
                type="button"
                role="tab"
                aria-selected={p.slug === plugin.slug}
                data-active={p.slug === plugin.slug || undefined}
                onClick={() => navigate(`/plugins/${p.slug}`)}
              >
                {p.logo ? <img src={p.logo} alt="" /> : <span className="pg-pl-mark">{p.tab.slice(0, 2)}</span>}
                {p.tab}
              </button>
            ))}
          </div>

          <div className="pg-pl-preview">
            {PLUGIN_HERO && <video src={PLUGIN_HERO} autoPlay loop muted playsInline />}
            <aside className="pg-pl-panel">
              <header>
                <span className="pg-pl-panel-brand">RaisAI<span className="pg-pl-panel-tag">Plugins</span></span>
                <span className="pg-pl-panel-ver">v0.4</span>
              </header>
              <div className="pg-pl-panel-promo">
                <p className="pg-pl-panel-promo-title">Mockup Studio</p>
                <p>From flat design to photoreal mockup in seconds</p>
                <span className="pg-pl-panel-btn">Try now</span>
              </div>
              <p className="pg-pl-panel-h">Last generations</p>
              <div className="pg-pl-panel-row">
                <span className="pg-pl-panel-add">+</span>
                <span className="pg-pl-panel-thumb" /><span className="pg-pl-panel-thumb" /><span className="pg-pl-panel-thumb" />
              </div>
              <p className="pg-pl-panel-h">Apps</p>
              <div className="pg-pl-panel-apps">
                <span>Remove background<small>Cut out image subject</small></span>
                <span>Color Grading<small>Apply cinematic preference</small><i className="pg-pl-panel-new">New</i></span>
              </div>
            </aside>
          </div>

          <section className="pg-pl-steps">
            <h2>Three steps to get started</h2>
            <div className="pg-pl-steps-grid">
              {PLUGIN_STEPS.map((s) => (
                <article key={s.n}>
                  <span className="pg-step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true">
    <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);
