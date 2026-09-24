import { useState } from "react";
import { HfHeader } from "../../app/header/HfHeader";
import { PRESET_CHIPS, PRESET_GALLERY, PRESET_VIDEOS } from "./pagesData";

/**
 * Viral Presets: the big lime wordmark, the preset chip cloud, then a masonry
 * gallery of example generations. Selecting a chip filters nothing yet — the
 * catalogue is UI only.
 */
export function ViralPresetsPage() {
  const [active, setActive] = useState<string | null>(null);
  const media = [...PRESET_VIDEOS.map((v) => ({ video: v, img: null })), ...PRESET_GALLERY.map((g) => ({ img: g, video: null }))];
  return (
    <>
      <HfHeader />
      <main id="main" className="pg pg-viral">
        <h1 className="pg-viral-title">Viral Presets</h1>

        <div className="pg-chips">
          {PRESET_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="pg-chip"
              data-active={active === c.label || undefined}
              onClick={() => setActive(active === c.label ? null : c.label)}
            >
              {c.label}
              {c.isNew && <sup>new</sup>}
            </button>
          ))}
        </div>

        <div className="pg-masonry">
          {media.map((t, i) => (
            <figure key={i} className="pg-tile">
              {t.video
                ? <video src={t.video} autoPlay loop muted playsInline />
                : <img src={t.img!} alt="" loading="lazy" decoding="async" />}
            </figure>
          ))}
        </div>
      </main>
    </>
  );
}
