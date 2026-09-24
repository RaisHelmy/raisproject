import { useState } from "react";
import { useParams } from "react-router-dom";
import { HfHeader } from "../../app/header/HfHeader";
import { MenuPlaceholderPage } from "../../app/header/MenuPlaceholderPage";
import { INTROS, type IntroDef } from "./appsData";

/**
 * Character and Moodboard: a centred collage hero with the headline and the
 * lime call to action, then the gallery of starting points below.
 */
export function IntroToolPage({ slug }: { slug?: string }) {
  const params = useParams();
  const key = slug ?? params.slug ?? "";
  const def = INTROS.find((d) => d.slug === key);
  if (!def) return <MenuPlaceholderPage />;
  return <Intro key={def.slug} def={def} />;
}

function Intro({ def }: { def: IntroDef }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <>
      <HfHeader />
      <main id="main" className="it">
        <section className="it-hero">
          {def.hero.length > 0 && (
            <div className="it-collage" aria-hidden="true">
              {def.hero.slice(0, 4).map((src, i) => (
                <img key={src} src={src} alt="" data-i={i} loading="lazy" decoding="async" />
              ))}
            </div>
          )}
          <h1>{def.heading}</h1>
          <p>{def.sub}</p>
          <button type="button" className="it-cta">{def.cta}<SparkIcon /></button>
        </section>

        {def.presets.length > 0 && (
          <section className="it-gallery">
            <div className="it-grid">
              {def.presets.map((p) => (
                <div key={p.title} className="it-tile" data-picked={p.title === picked || undefined}>
                  <span className="tl-ratio">
                    {p.video
                      ? <video src={p.media} muted loop autoPlay playsInline preload="metadata" />
                      : <img src={p.media} alt="" loading="lazy" decoding="async" />}
                  </span>
                  <span className="it-tile-name">{p.title}</span>
                  <span className="it-tile-go">Generate<SparkIcon /></span>
                  <button type="button" className="tl-tile-hit" aria-pressed={p.title === picked} onClick={() => setPicked(p.title)}>
                    <span className="visually-hidden">{p.title}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

const SparkIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" fill="currentColor" /></svg>;
