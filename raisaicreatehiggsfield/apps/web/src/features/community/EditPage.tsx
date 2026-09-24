import { useState } from "react";
import { HfHeader } from "../../app/header/HfHeader";

/**
 * The Edit (Layers) landing page: a carousel of edit-type cards, the product
 * pill, headline and upload button, then the "My projects" empty state.
 */
const CARDS = [
  { label: "Relight", video: "/edit/02cf7e5377a2.mp4" },
  { label: "Inpaint", video: "/edit/43a66c5097f3.mp4" },
  { label: "Layer decomposition", video: "/edit/5fbb830bebde.mp4", poster: "/edit/4298385ac5d6.webp" },
  { label: "Edit text", video: "/edit/85be16f72291.mp4" },
  { label: "Effects", video: "/edit/9b6663945bd9.mp4" },
];

export function EditPage() {
  const [active, setActive] = useState(2);
  const move = (d: number) => setActive((a) => (a + d + CARDS.length) % CARDS.length);
  return (
    <>
      <HfHeader />
      <main id="main" className="ed">
        <section className="ed-hero">
          <div className="ed-carousel">
            {CARDS.map((c, i) => {
              const offset = i - active;
              return (
                <figure
                  key={c.label}
                  className="ed-card"
                  data-active={offset === 0 || undefined}
                  style={{ "--o": offset } as React.CSSProperties}
                  onClick={() => setActive(i)}
                >
                  <video src={c.video} poster={c.poster} autoPlay loop muted playsInline />
                  <figcaption><LayersIcon />{c.label}</figcaption>
                </figure>
              );
            })}
          </div>
          <div className="ed-nav">
            <button type="button" aria-label="Previous" onClick={() => move(-1)}><ChevronIcon dir="left" /></button>
            <button type="button" aria-label="Next" onClick={() => move(1)}><ChevronIcon /></button>
          </div>

          <span className="ed-pill"><LayersIcon />RaisAI Layers</span>
          <h1>Turn flat images<br />into editable layers.</h1>
          <p>Turn flat images into editable layers. Separate, edit, and<br />rebuild any image. Every element, now yours to edit.</p>
          <button type="button" className="ed-upload"><PlusIcon />Upload Media</button>
        </section>

        <section className="ed-projects">
          <h2>My projects<ChevronIcon /></h2>
          <div className="ed-empty">
            <p>Your edit projects will appear here</p>
          </div>
        </section>
      </main>
    </>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const ChevronIcon = ({ dir }: { dir?: "left" }) => (
  <svg viewBox="0 0 24 24" className="ed-i" aria-hidden="true" style={dir === "left" ? { transform: "rotate(180deg)" } : undefined}><path d="M9 5l7 7-7 7" {...s} /></svg>
);
const LayersIcon = () => <svg viewBox="0 0 24 24" className="ed-i" aria-hidden="true"><path d="M12 3l9 5-9 5-9-5 9-5Zm9 9l-9 5-9-5m18 4l-9 5-9-5" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" className="ed-i" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
