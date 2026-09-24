import { useState } from "react";
import { HfHeader } from "../../app/header/HfHeader";
import { JUTSU_GRID, JUTSU_SCENES, JUTSU_STEPS } from "./pagesData2";

/**
 * 3D Jutsu: a fanned carousel of blocked-out 3D scenes over a perspective
 * grid, the product pill and headline, a prompt bar, then the three steps.
 */
export function JutsuPage() {
  const [active, setActive] = useState(Math.floor(JUTSU_SCENES.length / 2));
  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-jutsu" style={JUTSU_GRID ? { backgroundImage: `url("${JUTSU_GRID}")` } : undefined}>
        <div className="pg-jutsu-stage">
          {JUTSU_SCENES.map((s, i) => (
            <figure
              key={s.video}
              className="pg-jutsu-card"
              data-active={i === active || undefined}
              style={{ "--o": i - active } as React.CSSProperties}
              onClick={() => setActive(i)}
            >
              <video src={s.video} poster={s.poster ?? undefined} autoPlay loop muted playsInline />
            </figure>
          ))}
        </div>

        <span className="pg-jutsu-pill"><CubeIcon />RaisAI 3D Jutsu</span>
        <h1 className="pg-jutsu-title">Prompt your 3D scene</h1>
        <p className="pg-jutsu-sub">Adjust props and cameras, then turn your scene into a video</p>

        <form className="pg-jutsu-bar" onSubmit={(e) => e.preventDefault()}>
          <textarea rows={1} placeholder="Describe the scene you want to block out..." />
          <div className="pg-jutsu-controls">
            <button type="button" className="pg-jutsu-add" aria-label="Add reference"><PlusIcon /></button>
            <button type="button" className="pg-jutsu-chip">
              <SparkIcon />Auto<span className="pg-jutsu-free">Free</span><ChevronIcon />
            </button>
            <button type="button" className="pg-jutsu-chip"><ClockIcon />15s</button>
            <button type="button" className="pg-jutsu-chip"><RatioIcon />16:9</button>
          </div>
          <button type="submit" className="pg-jutsu-go">Generate<SparkIcon /></button>
        </form>

        <div className="pg-jutsu-steps">
          {JUTSU_STEPS.map((s) => (
            <article key={s.n}>
              <span className="pg-step-n">{s.n}</span>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const CubeIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5" {...s} /></svg>;
const PlusIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M12 5v14M5 12h14" {...s} /></svg>;
const ClockIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...s} /><path d="M12 7.5V12l3 2" {...s} /></svg>;
const RatioIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2" {...s} /></svg>;
const ChevronIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M6 9l6 6 6-6" {...s} /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" className="pg-i" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
