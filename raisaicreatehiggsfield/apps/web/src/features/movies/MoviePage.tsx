import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppError, formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import { STEPS, type Movie, type Scene, type Shot, type StepKey, type Timeline } from "./types";
import { Storyboard } from "./Storyboard";
import { CastStep } from "./CastStep";
import { TimelineView } from "./TimelineView";

/**
 * Movie mode (§86). The stepper is the whole point: a creator moves from idea
 * to export without ever seeing a node graph, while the same engine runs
 * underneath.
 */
export function MoviePage() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Movie | null>(null);
  const [step, setStep] = useState<StepKey>("story");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const next = await api<Movie>(`/movies/${id}`);
      setMovie(next);
      if ((next.scenes?.length ?? 0) > 0 && step === "story") setStep("storyboard");
    } catch {
      setError("This movie could not be loaded.");
    }
  }, [id, step]);

  useEffect(() => {
    void load();
    // Only on mount: reloading on every step change would fight the user.
  }, [id]);

  async function act<T>(label: string, run: () => Promise<T>): Promise<T | null> {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      return await run();
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "Something went wrong.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function writeStory() {
    const result = await act("story", () => api<{ chargedSen: number }>(`/movies/${id}/story`, { method: "POST", body: "{}" }));
    if (result) {
      setNotice(`Story written for ${formatMYR(result.chargedSen)}.`);
      await load();
      setStep("storyboard");
    }
  }

  async function buildTimeline() {
    const result = await act("timeline", () => api<Timeline>(`/movies/${id}/timeline`, { method: "POST", body: "{}" }));
    if (result) setTimeline(result);
  }

  async function voiceDialogue() {
    const result = await act("audio", () =>
      api<{ totalChargedSen: number; lines: unknown[] }>(`/movies/${id}/dialogue`, { method: "POST", body: "{}" }),
    );
    if (result) setNotice(`Voiced ${result.lines.length} lines for ${formatMYR(result.totalChargedSen)}.`);
  }

  async function exportMovie() {
    const result = await act("export", () =>
      api<{ manifestAssetId: string; scriptAssetId: string; subtitlesAssetId: string | null; renderNote: string }>(
        `/movies/${id}/export`,
        { method: "POST", body: "{}" },
      ),
    );
    if (result) setNotice(result.renderNote);
    return result;
  }

  useEffect(() => {
    if (step !== "timeline" || !id || timeline) return;
    api<Timeline>(`/movies/${id}/timeline`).then(setTimeline).catch(() => setTimeline(null));
  }, [step, id, timeline]);

  if (!movie) {
    return (
      <section>
        <h1 className="h3 mb-3">Movie</h1>
        {error ? <div className="alert alert-danger" role="alert">{error}</div> : <p className="text-secondary">Loading…</p>}
      </section>
    );
  }

  const hasStory = (movie.scenes?.length ?? 0) > 0;
  const shots = (movie.scenes ?? []).flatMap((s) => s.shots);
  const rendered = shots.filter((s) => s.imageAssetId).length;

  return (
    <section>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
        <h1 className="h3 mb-0">{movie.title}</h1>
        <span className="badge text-bg-secondary align-self-center">{movie.status}</span>
      </div>
      {movie.logline && <p className="text-secondary mb-3">{movie.logline}</p>}

      <nav className="mb-4" aria-label="Movie steps">
        <ol className="nav nav-pills gap-1 flex-wrap ps-0">
          {STEPS.map((s, index) => (
            <li className="nav-item" key={s.key}>
              <button
                type="button"
                className={`nav-link ${step === s.key ? "active" : ""}`}
                onClick={() => setStep(s.key)}
                aria-current={step === s.key ? "step" : undefined}
              >
                <span className="text-secondary me-1">{index + 1}</span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-info" role="status">{notice}</div>}

      {step === "story" && (
        <StoryStep movie={movie} hasStory={hasStory} busy={busy === "story"} onWrite={writeStory} />
      )}

      {step === "cast" && <CastStep projectId={movie.projectId} />}

      {step === "storyboard" && (
        <Storyboard movie={movie} kind="image" onChanged={load} />
      )}

      {step === "shots" && (
        <Storyboard movie={movie} kind="video" onChanged={load} />
      )}

      {step === "audio" && (
        <div className="card">
          <div className="card-body">
            <h2 className="h6">Dialogue</h2>
            <p className="small text-secondary">
              Every line of dialogue becomes spoken audio, using each character's voice.
            </p>
            <button className="btn btn-primary" type="button" onClick={voiceDialogue} disabled={busy === "audio" || !hasStory}>
              {busy === "audio" ? "Voicing…" : "Voice the dialogue"}
            </button>
          </div>
        </div>
      )}

      {step === "timeline" && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <p className="small text-secondary mb-0">
              {rendered} of {shots.length} shots rendered.
            </p>
            <button className="btn btn-sm btn-outline-primary" type="button" onClick={buildTimeline} disabled={busy === "timeline"}>
              {busy === "timeline" ? "Building…" : "Rebuild from shots"}
            </button>
          </div>
          <TimelineView timeline={timeline} movieId={movie.id} onChanged={setTimeline} />
        </>
      )}

      {step === "export" && <ExportStep busy={busy === "export"} onExport={exportMovie} />}
    </section>
  );
}

function StoryStep(props: { movie: Movie; hasStory: boolean; busy: boolean; onWrite: () => void }) {
  const { movie } = props;
  return (
    <div className="row g-3">
      <div className="col-lg-7">
        <div className="card">
          <div className="card-body">
            <h2 className="h6">The idea</h2>
            <p className="small">{movie.idea ?? "No idea written yet."}</p>
            {movie.synopsis && (
              <>
                <h2 className="h6 mt-3">Synopsis</h2>
                <p className="small mb-0">{movie.synopsis}</p>
              </>
            )}
            <button className="btn btn-primary mt-3" type="button" onClick={props.onWrite} disabled={props.busy || !movie.idea}>
              {props.busy ? "Writing…" : props.hasStory ? "Rewrite the story" : "Write the story"}
            </button>
            {props.hasStory && (
              <p className="small text-secondary mt-2 mb-0">Rewriting adds a fresh set of scenes alongside the current ones.</p>
            )}
          </div>
        </div>
      </div>

      <div className="col-lg-5">
        {(movie.scenes ?? []).map((scene) => <SceneCard key={scene.id} scene={scene} />)}
      </div>
    </div>
  );
}

function SceneCard(props: { scene: Scene }) {
  const { scene } = props;
  return (
    <article className="card mb-2">
      <div className="card-body py-2">
        <h3 className="h6 mb-1">
          <span className="text-secondary me-2">{scene.number}</span>
          {scene.title}
        </h3>
        <p className="small text-secondary mb-1">
          {scene.characters.join(", ")}
          {scene.timeOfDay && ` · ${scene.timeOfDay}`}
          {` · ${scene.shots.length} shots`}
        </p>
        {scene.action && <p className="small mb-0">{scene.action}</p>}
      </div>
    </article>
  );
}

function ExportStep(props: {
  busy: boolean;
  onExport: () => Promise<{ manifestAssetId: string; scriptAssetId: string; subtitlesAssetId: string | null } | null>;
}) {
  const [files, setFiles] = useState<{ manifestAssetId: string; scriptAssetId: string; subtitlesAssetId: string | null } | null>(null);

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h6">Export</h2>
        <p className="small text-secondary">
          You get the finished cut as an edit list, the subtitles, and a script that assembles them into one
          video file with ffmpeg.
        </p>
        <button
          className="btn btn-primary"
          type="button"
          disabled={props.busy}
          onClick={() => void props.onExport().then((r) => r && setFiles(r))}
        >
          {props.busy ? "Exporting…" : "Export the movie"}
        </button>

        {files && (
          <ul className="list-unstyled mt-3 mb-0 small">
            <li><a href={`/api/v1/assets/${files.manifestAssetId}/content`} download>Edit list (JSON)</a></li>
            <li><a href={`/api/v1/assets/${files.scriptAssetId}/content`} download>Render script (ffmpeg)</a></li>
            {files.subtitlesAssetId && (
              <li><a href={`/api/v1/assets/${files.subtitlesAssetId}/content`} download>Subtitles (SRT)</a></li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
