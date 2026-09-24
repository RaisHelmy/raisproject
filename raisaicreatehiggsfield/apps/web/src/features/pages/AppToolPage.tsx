import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { MenuPlaceholderPage } from "../../app/header/MenuPlaceholderPage";
import { APPS, type AppDef } from "./appsData";

/**
 * The /apps/* tool pages: breadcrumb, big headline, the upload slots with the
 * output-type switch and the lime action button, a preview panel, and the
 * three-step explainer underneath.
 */
export function AppToolPage() {
  const { slug = "" } = useParams();
  const def = APPS.find((d) => d.slug === slug);
  if (!def) return <MenuPlaceholderPage />;
  return <AppTool key={def.slug} def={def} />;
}

function AppTool({ def }: { def: AppDef }) {
  const [kind, setKind] = useState<"image" | "video">("image");
  return (
    <>
      <HfHeader />
      <main id="main" className="ap">
        <p className="ap-crumb"><Link to="/plugins">Apps</Link> / <span>{def.name}</span></p>

        <section className="ap-hero">
          <div className="ap-form">
            <h1>{def.heading}</h1>
            <p className="ap-sub">{def.sub}</p>

            <div className="ap-slots" data-count={def.slots.length}>
              {def.slots.map((label, i) => (
                <button key={label} type="button" className="ap-slot">
                  <span className="ap-slot-ico"><MediaIcon /></span>
                  <b>{label}</b>
                  <small>{def.slots.length === 1 ? "Drag and drop or click to browse" : i === 0 ? "Upload the photo with the subject to replace" : "Upload the reference you want to insert"}</small>
                </button>
              ))}
            </div>

            <div className="ap-type">
              <span>Generation type</span>
              <span className="ap-type-switch">
                <button type="button" aria-label="Image" data-active={kind === "image" || undefined} onClick={() => setKind("image")}><ImageIcon /></button>
                <button type="button" aria-label="Video" data-active={kind === "video" || undefined} onClick={() => setKind("video")}><VideoIcon /></button>
              </span>
            </div>

            <button type="button" className="ap-action">{def.action}<SparkIcon />{def.cost}</button>
          </div>

          <figure className="ap-art">
            {def.art && <img src={def.art} alt="" loading="lazy" decoding="async" />}
          </figure>
        </section>

        <section className="ap-steps">
          <h2>How to {def.name.toLowerCase()} any photo or video in 3 steps</h2>
          <ol>
            {def.steps.map((step, i) => (
              <li key={step}><span className="ap-step-n">{i + 1}</span>{step}</li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}

const s = { stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
const MediaIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><path d="M6 17l4-4 3 3 2-2 3 3" {...s} /><circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" /></svg>;
const ImageIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><path d="M6 17l4-4 3 3 2-2 3 3" {...s} /></svg>;
const VideoIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="12" height="12" rx="2" {...s} /><path d="M15 10l5-3v10l-5-3Z" {...s} /></svg>;
const SparkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
