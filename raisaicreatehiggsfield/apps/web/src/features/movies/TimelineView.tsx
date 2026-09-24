import { useState } from "react";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import type { Timeline, TimelineItem } from "./types";

const TRACK_COLORS: Record<string, string> = {
  video: "#7c5cff",
  dialogue: "#4dabf7",
  voice: "#4dabf7",
  music: "#2fb344",
  sfx: "#f6c343",
  subtitles: "#adb5bd",
};

/**
 * The timeline (§46). Read first, edit second: seeing the cut laid out is what
 * tells someone whether the film works, so clips are drawn to scale with their
 * real durations before any editing control appears.
 */
export function TimelineView(props: { timeline: Timeline | null; movieId: string; onChanged: (t: Timeline) => void }) {
  const [selected, setSelected] = useState<TimelineItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!props.timeline || props.timeline.tracks.every((t) => t.items.length === 0)) {
    return (
      <EmptyState
        icon="bar-chart-steps"
        title="Nothing on the timeline yet."
        description="Render some shots, then build the timeline from them."
      />
    );
  }

  const { timeline } = props;
  const totalMs = Math.max(timeline.durationMs, 1);

  async function trim(item: TimelineItem, endMs: number) {
    await act(() =>
      api<Timeline>(`/movies/${props.movieId}/timeline/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ trimOutMs: endMs }),
      }),
    );
  }

  /**
   * Every edit returns the whole timeline, so the view is always what the
   * server actually holds rather than a guess applied locally.
   */
  async function act(run: () => Promise<Timeline>, keepSelection = false) {
    setBusy(true);
    setError(null);
    try {
      const updated = await run();
      props.onChanged(updated);
      if (keepSelection) {
        // Re-read the clip from the answer. Keeping the old copy would make a
        // second nudge measure from where the clip used to be.
        const id = selected?.id;
        const fresh = updated.tracks.flatMap((t) => t.items).find((i) => i.id === id) ?? null;
        setSelected(fresh);
      } else {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That edit did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="small text-secondary">
        Total length {(totalMs / 1000).toFixed(1)} seconds.
      </p>

      <div className="card mb-3">
        <div className="card-body p-2">
          {timeline.tracks.map((track) => (
            <div className="d-flex align-items-center gap-2 mb-2" key={track.id}>
              <span className="small text-secondary text-nowrap" style={{ width: 90 }}>{track.name}</span>
              <div className="position-relative flex-grow-1 bg-body-tertiary rounded" style={{ height: 34 }}>
                {track.items.map((item) => {
                  const effective = item.duration_ms - item.trim_in_ms - item.trim_out_ms;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="position-absolute top-0 border-0 rounded text-start px-1"
                      style={{
                        left: `${(item.start_ms / totalMs) * 100}%`,
                        width: `${Math.max(1.5, (effective / totalMs) * 100)}%`,
                        height: "100%",
                        background: TRACK_COLORS[track.kind] ?? "#868e96",
                        opacity: selected?.id === item.id ? 1 : 0.85,
                        color: "#fff",
                        fontSize: ".65rem",
                        overflow: "hidden",
                      }}
                      onClick={() => setSelected(item)}
                      title={`${item.label ?? "Clip"} · ${(effective / 1000).toFixed(1)}s`}
                    >
                      {item.label ?? "Clip"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className="card">
          <div className="card-body">
            <h2 className="h6">{selected.label ?? "Clip"}</h2>
            <p className="small text-secondary">
              Starts at {(selected.start_ms / 1000).toFixed(1)}s, runs{" "}
              {((selected.duration_ms - selected.trim_in_ms - selected.trim_out_ms) / 1000).toFixed(1)}s.
            </p>
            <div className="d-flex flex-wrap gap-2">
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                disabled={busy}
                onClick={() => void trim(selected, selected.trim_out_ms + 500)}
              >
                Shorten by 0.5s
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                disabled={busy || selected.trim_out_ms === 0}
                onClick={() => void trim(selected, Math.max(0, selected.trim_out_ms - 500))}
              >
                Lengthen by 0.5s
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api<Timeline>(`/movies/${props.movieId}/timeline/items/${selected.id}/split`, {
                      method: "POST",
                      // Halfway along, which is what a cut with no playhead means.
                      body: JSON.stringify({
                        atMs: Math.round(
                          selected.start_ms + (selected.duration_ms - selected.trim_in_ms - selected.trim_out_ms) / 2,
                        ),
                      }),
                    }),
                  )
                }
              >
                Split in half
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api<Timeline>(`/movies/${props.movieId}/timeline/items/${selected.id}/duplicate`, { method: "POST" }),
                  )
                }
              >
                Duplicate
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                disabled={busy || selected.start_ms === 0}
                onClick={() =>
                  void act(
                    () =>
                      api<Timeline>(`/movies/${props.movieId}/timeline/items/${selected.id}/move`, {
                        method: "POST",
                        body: JSON.stringify({ startMs: Math.max(0, selected.start_ms - 500) }),
                      }),
                    true,
                  )
                }
              >
                Move earlier
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(
                    () =>
                      api<Timeline>(`/movies/${props.movieId}/timeline/items/${selected.id}/move`, {
                        method: "POST",
                        body: JSON.stringify({ startMs: selected.start_ms + 500 }),
                      }),
                    true,
                  )
                }
              >
                Move later
              </button>
              <button
                className="btn btn-sm btn-outline-danger"
                type="button"
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    api<Timeline>(`/movies/${props.movieId}/timeline/items/${selected.id}`, { method: "DELETE" }),
                  )
                }
              >
                Remove
              </button>
              <button className="btn btn-sm btn-link" type="button" onClick={() => setSelected(null)}>Close</button>
            </div>
            {error && <p className="small text-danger mt-2 mb-0">{error}</p>}
            <p className="small text-secondary mt-2 mb-0">
              Shortening or removing a shot pulls the ones after it up. Splitting keeps the same file, so it costs nothing.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
