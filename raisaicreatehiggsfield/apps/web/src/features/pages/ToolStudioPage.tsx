import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { MenuPlaceholderPage } from "../../app/header/MenuPlaceholderPage";
import { STUDIOS, type StudioDef } from "./appsData";

/**
 * One component for the tool studios reached from the mega menu (Lipsync,
 * Shorts, Explainer, Mixed Media, Faceless): a left configuration panel with
 * the media slot, setting rows and the lime Generate button, beside the
 * preset gallery with its Presets / History / How it works tabs.
 */
export function ToolStudioPage({ slug }: { slug?: string }) {
  const params = useParams();
  const key = slug ?? params.slug ?? "";
  const def = STUDIOS.find((d) => d.slug === key);
  if (!def) return <MenuPlaceholderPage />;
  return <Studio key={def.slug} def={def} />;
}

function Studio({ def }: { def: StudioDef }) {
  const [tab, setTab] = useState("Presets");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(def.presets[0]?.title ?? "");
  const [prompt, setPrompt] = useState("");
  const [subtitles, setSubtitles] = useState(false);
  const [studioTab, setStudioTab] = useState(def.tabs?.[0] ?? "");

  const shown = useMemo(
    () => def.presets.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())),
    [def.presets, q],
  );
  const hero = def.presets.find((p) => p.title === picked) ?? def.presets[0];

  return (
    <>
      <HfHeader />
      <main id="main" className="tl">
        <aside className="tl-panel">
          {def.tabs ? (
            <div className="tl-panel-tabs">
              {def.tabs.map((t) => (
                <button key={t} type="button" data-active={t === studioTab || undefined} onClick={() => setStudioTab(t)}>{t}</button>
              ))}
            </div>
          ) : (
            <p className="tl-panel-title">{def.name}</p>
          )}

          <div className="tl-preview">
            <span className="tl-ratio tl-ratio-43">
              {hero && (hero.video
                ? <video src={hero.media} muted loop autoPlay playsInline preload="metadata" />
                : <img src={hero.media} alt="" />)}
            </span>
            <button type="button" className="tl-change"><PencilIcon />Change</button>
            {hero && <span className="tl-preview-name">{hero.title}</span>}
          </div>

          <button type="button" className="tl-upload">
            <span className="tl-upload-ico"><MediaIcon /></span>
            Upload an image or video
            <small>Drag and drop or click to browse</small>
          </button>

          <label className="tl-prompt">
            <textarea rows={3} placeholder="Describe the scene you imagine, with details." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>

          <div className="tl-rows">
            {def.rows.map((r) => (
              <button key={r.label} type="button" className="tl-row">
                <span><small>{r.label}</small><b>{r.value}</b></span>
                <ChevronRight />
              </button>
            ))}
          </div>

          <div className="tl-row tl-row-toggle">
            <span>Subtitles</span>
            <button type="button" role="switch" aria-checked={subtitles} className="tl-switch" data-on={subtitles || undefined} onClick={() => setSubtitles((v) => !v)}><i /></button>
          </div>

          <button type="button" className="tl-generate">{def.generate}<SparkIcon /></button>
          <p className="tl-calc">How calculations work? <span aria-hidden="true">?</span></p>
        </aside>

        <section className="tl-gallery">
          <div className="tl-gallery-bar">
            <div className="tl-tabs" role="tablist">
              {["Presets", "History", "How it works"].map((t) => (
                <button key={t} type="button" role="tab" aria-selected={t === tab} data-active={t === tab || undefined} onClick={() => setTab(t)}>
                  <TabIcon name={t} />{t}
                </button>
              ))}
            </div>
            <label className="tl-search">
              <SearchIcon />
              <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search presets" />
            </label>
          </div>

          {tab === "Presets" && def.presets.length === 0 && (
            <div className="tl-hero">
              <span className="tl-hero-badge"><MicIcon />{def.name}</span>
              <h1>{def.heroTitle ?? def.heading}</h1>
              {def.heroSub && <p>{def.heroSub}</p>}
              {def.steps && (
                <ol className="tl-hero-steps">
                  {def.steps.map((st) => (
                    <li key={st.n}><span className="tl-hero-n">{st.n}</span><b>{st.t}</b><small>{st.d}</small></li>
                  ))}
                </ol>
              )}
            </div>
          )}
          {tab === "Presets" && def.presets.length > 0 && (
            <div className="tl-scroll"><div className="tl-grid">
              {shown.map((p) => (
                <div key={p.title} className="tl-tile" data-picked={p.title === picked || undefined}>
                  <span className="tl-ratio">
                    {p.video
                      ? <video src={p.media} muted loop autoPlay playsInline preload="metadata" />
                      : <img src={p.media} alt="" loading="lazy" decoding="async" />}
                  </span>
                  <span className="tl-tile-name">{p.title}</span>
                  {p.title === picked && <span className="tl-tile-check"><CheckIcon /></span>}
                  <button type="button" className="tl-tile-hit" aria-pressed={p.title === picked} onClick={() => setPicked(p.title)}>
                    <span className="visually-hidden">{p.title}</span>
                  </button>
                </div>
              ))}
              {!shown.length && <p className="tl-none">No presets match “{q}”.</p>}
            </div></div>
          )}
          {tab === "History" && <p className="tl-none">Nothing generated yet. Your runs will show up here.</p>}
          {tab === "How it works" && (
            <ol className="tl-steps">
              <li><b>Choose a preset</b>Pick the look you want as the starting point.</li>
              <li><b>Add your media</b>Upload the image, video or audio to work from.</li>
              <li><b>Generate</b>Review the estimated cost, then run it.</li>
            </ol>
          )}
        </section>
      </main>
    </>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const PencilIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 10-10-3-3L5 16l-1 4Z" {...s} /></svg>;
const MediaIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><path d="M6 17l4-4 3 3 2-2 3 3" {...s} /><circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" /></svg>;
const ChevronRight = () => <svg viewBox="0 0 24 24" className="tl-chev" aria-hidden="true"><path d="M9 6l6 6-6 6" {...s} /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
const MicIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" {...s} /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...s} /></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" {...s} /><path d="M16 16l4 4" {...s} /></svg>;
const CheckIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" {...s} strokeWidth={2.2} /></svg>;
const TabIcon = ({ name }: { name: string }) =>
  name === "Presets" ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" {...s} /><path d="M4 15l4-4 4 4 3-3 5 5" {...s} /></svg>
    : name === "History" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4m0 4h4M4 8a8.5 8.5 0 1 1-.5 5" {...s} /><path d="M12 8v4.5l3 1.8" {...s} /></svg>
      : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7v14H4zM13 5h7v14h-7z" {...s} /></svg>;
