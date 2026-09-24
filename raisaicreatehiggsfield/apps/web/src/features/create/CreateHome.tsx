import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { studioIcon, type StudioSummary } from "../studio/StudioPage";

const CARDS = [
  { to: "/create/image", icon: "image", title: "Image", text: "Prompt → Model → Generate" },
  { to: "/create/video", icon: "film", title: "Video", text: "Prompt or image → Model → Generate" },
  { to: "/create/audio", icon: "music-note-beamed", title: "Audio", text: "Turn words into speech" },
  { to: "/create/text", icon: "fonts", title: "Text", text: "Scripts, ideas, rewrites" },
  { to: "/movies", icon: "camera-reels", title: "Movie", text: "Idea, story, scenes, then video" },
  { to: "/canvas", icon: "diagram-3", title: "Canvas", text: "Blank canvas. Connect anything." },
];

export function CreateHome() {
  const [studios, setStudios] = useState<StudioSummary[] | null>(null);
  useEffect(() => {
    api<{ items: StudioSummary[] }>("/studios").then((r) => setStudios(r.items)).catch(() => setStudios([]));
  }, []);

  return (
    <section className="create-hub">
      <div className="create-hub-head">
        <div>
          <p className="lp-eyebrow mb-2">Creative workspace</p>
          <h1 className="display-5 fw-bold mb-2">What will you create?</h1>
          <p className="text-secondary mb-0">Turn a brief into production-ready creative, from one calm workspace.</p>
        </div>
        <div className="create-hub-head-actions"><Link to="/projects" className="btn btn-outline-light"><i className="bi bi-folder2-open me-2" />Projects</Link><Link to="/assets" className="btn btn-primary"><i className="bi bi-cloud-arrow-up me-2" />Upload asset</Link></div>
      </div>
      <div className="create-command card border-0 mb-4">
        <div className="card-body p-3 p-lg-4 d-flex flex-column flex-lg-row align-items-lg-center gap-3">
          <div className="create-command-icon"><i className="bi bi-stars" /></div><div className="flex-grow-1"><div className="fw-semibold">Start from a brief</div><div className="small text-secondary">Describe a campaign, scene, product or idea. RaisAI will suggest the best studio.</div></div><Link to="/create/text" className="btn btn-light">Open creative brief <i className="bi bi-arrow-up-right ms-1" /></Link>
        </div>
      </div>
      <div className="row g-3">
        {CARDS.map((c) => (
          <div className="col-6 col-md-4" key={c.to}>
            <Link to={c.to} className="card h-100 text-decoration-none rais-create-card">
              <div className="card-body">
                <i className={`bi bi-${c.icon} fs-2`} aria-hidden="true" />
                <h2 className="h5 mt-2 mb-1">{c.title}</h2>
                <p className="text-secondary small mb-0">{c.text}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>

      <div className="d-flex align-items-center justify-content-between mt-5 mb-3"><div><p className="lp-eyebrow mb-1">Coming next</p><h2 className="h4 mb-0">Batch creation</h2></div><span className="badge rounded-pill text-bg-warning">Coming soon</span></div>
      <div className="row g-3 mb-4">
        {[{icon:"layers",title:"Batch variations",text:"Generate 20 campaign-ready variations from one brief."},{icon:"grid-3x3-gap",title:"Batch resize",text:"Export every channel format in one pass."},{icon:"translate",title:"Batch localisation",text:"Adapt copy and visuals for every market."}].map((item) => <div className="col-md-4" key={item.title}><div className="card batch-card h-100"><div className="card-body"><div className="d-flex justify-content-between"><i className={`bi bi-${item.icon} fs-4 text-warning`} /><span className="small text-secondary">Batch · soon</span></div><h3 className="h6 mt-3 mb-1">{item.title}</h3><p className="small text-secondary mb-0">{item.text}</p></div></div></div>)}
      </div>

      {/* The studios: one form each, no canvas. Greyed rather than hidden when
          no model is enabled for them, so what exists is always visible (§74). */}
      <h2 className="h5 mt-4 mb-2">Studios</h2>
      <div className="row g-2">
        {(studios ?? []).map((s) => (
          <div className="col-6 col-md-4 col-xl-2" key={s.type}>
            <Link to={`/create/studio/${s.type}`} className={`card h-100 text-decoration-none rais-create-card ${s.availableModels === 0 ? "opacity-50" : ""}`} title={s.description}>
              <div className="card-body p-2 d-flex align-items-center gap-2">
                <i className={`bi bi-${studioIcon(s.type)} fs-5`} aria-hidden="true" />
                <div className="small">
                  <div>{s.label}</div>
                  <div className="text-secondary" style={{ fontSize: ".72rem" }}>{s.availableModels === 0 ? "no model yet" : `${s.availableModels} model${s.availableModels === 1 ? "" : "s"}`}</div>
                </div>
              </div>
            </Link>
          </div>
        ))}
        {studios === null && <p className="text-secondary small">Loading studios…</p>}
      </div>

      <p className="text-secondary small mt-3 mb-0">
        Not sure which model to use? <Link to="/create/compare">Compare a few side by side.</Link>
        {" "}Want a one-click canvas? <Link to="/templates?scope=public">Browse community templates.</Link>
      </p>
    </section>
  );
}
