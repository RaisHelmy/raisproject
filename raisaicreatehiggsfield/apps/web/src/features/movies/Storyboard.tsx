import { useState } from "react";
import { AppError, formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { ShotDialog } from "./ShotDialog";
import type { Movie, Shot } from "./types";

/**
 * The storyboard grid (§39, §40). One card per shot, each showing what it is,
 * what it cost, and what can be done to it next. Generating is per shot so a
 * single take can be redone without repaying for the whole scene.
 */
export function Storyboard(props: { movie: Movie; kind: "image" | "video"; onChanged: () => void }) {
  const [working, setWorking] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Shot | null>(null);
  const scenes = props.movie.scenes ?? [];

  if (scenes.length === 0) {
    return <EmptyState icon="film" title="No scenes yet." description="Write the story first." />;
  }

  async function generate(shot: Shot) {
    setWorking((w) => ({ ...w, [shot.id]: true }));
    setErrors((e) => ({ ...e, [shot.id]: "" }));
    try {
      const result = await api<{ error?: string }>(`/shots/${shot.id}/${props.kind}`, { method: "POST", body: "{}" });
      if (result.error) setErrors((e) => ({ ...e, [shot.id]: result.error! }));
      props.onChanged();
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [shot.id]: err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That shot failed.",
      }));
    } finally {
      setWorking((w) => ({ ...w, [shot.id]: false }));
    }
  }

  async function generateScene(shots: Shot[]) {
    for (const shot of shots) {
      const done = props.kind === "image" ? shot.imageAssetId : shot.videoAssetId;
      if (!done) await generate(shot);
    }
  }

  return (
    <>
      {props.kind === "video" && (
        <p className="small text-secondary">
          Each shot animates its own storyboard image, so the look carries over. Generate the images first.
        </p>
      )}

      {scenes.map((scene) => (
        <section className="mb-4" key={scene.id}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h6 mb-0">
              <span className="text-secondary me-2">Scene {scene.number}</span>
              {scene.title}
            </h2>
            <button
              className="btn btn-sm btn-outline-primary"
              type="button"
              onClick={() => void generateScene(scene.shots)}
            >
              Generate the rest of this scene
            </button>
          </div>

          <div className="row g-3">
            {scene.shots.map((shot) => {
              const assetId = props.kind === "image" ? shot.imageAssetId : shot.videoAssetId;
              const blocked = props.kind === "video" && !shot.imageAssetId;
              return (
                <div className="col-6 col-lg-3" key={shot.id}>
                  <article className="card h-100">
                    <div className="ratio ratio-16x9 bg-body-tertiary">
                      {assetId ? (
                        props.kind === "video" ? (
                          <video src={`/api/v1/assets/${assetId}/content`} controls className="w-100 h-100" style={{ objectFit: "cover" }}>
                            <track kind="captions" />
                          </video>
                        ) : (
                          <img
                            src={`/api/v1/assets/${assetId}/content`}
                            alt={shot.description}
                            className="w-100 h-100"
                            style={{ objectFit: "cover" }}
                          />
                        )
                      ) : (
                        <div className="d-flex align-items-center justify-content-center text-secondary small">
                          {working[shot.id] ? "Generating…" : `Shot ${shot.number}`}
                        </div>
                      )}
                    </div>

                    <div className="card-body p-2">
                      <p className="small mb-1" title={shot.description}>
                        <span className="text-secondary me-1">{shot.number}</span>
                        {shot.description.length > 70 ? `${shot.description.slice(0, 70)}…` : shot.description}
                      </p>
                      <p className="small text-secondary mb-2">
                        {shot.shotType} · {shot.durationSeconds}s
                        {shot.costSen > 0 && ` · ${formatMYR(shot.costSen)}`}
                      </p>

                      {errors[shot.id] && <p className="small text-danger mb-2">{errors[shot.id]}</p>}

                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-sm btn-outline-secondary flex-grow-1"
                          type="button"
                          disabled={working[shot.id] || blocked}
                          onClick={() => void generate(shot)}
                          title={blocked ? "Generate this shot's image first" : undefined}
                        >
                          {working[shot.id] ? "Working…" : assetId ? "Regenerate" : blocked ? "Needs an image" : "Generate"}
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          type="button"
                          onClick={() => setOpen(shot)}
                          aria-label={`Shot ${shot.number} settings and versions`}
                        >
                          <i className="bi bi-sliders" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {open && <ShotDialog shot={open} onClose={() => setOpen(null)} onChanged={props.onChanged} />}
    </>
  );
}
