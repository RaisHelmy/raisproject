import { useEffect, useState } from "react";
import { AppError, formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import type { Shot } from "./types";

interface Take {
  id: string;
  kind: "image" | "video";
  version: number;
  assetId: string | null;
  modelId: string | null;
  costSen: number;
  createdAt: string;
}

interface CinematicField {
  name: string;
  label: string;
  options: string[];
}

/**
 * One shot: its takes, and how it is framed and lit (§38, §40, §41).
 *
 * Every take stays. Going back to an earlier one generates nothing and costs
 * nothing, which is what makes trying a second version worth doing.
 */
export function ShotDialog(props: { shot: Shot; onClose: () => void; onChanged: () => void }) {
  const [takes, setTakes] = useState<Take[] | null>(null);
  const [fields, setFields] = useState<CinematicField[]>([]);
  const [cinematic, setCinematic] = useState<Record<string, string>>({});
  const [description, setDescription] = useState(props.shot.description);
  const [duration, setDuration] = useState(props.shot.durationSeconds);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Take[]; cinematic: Record<string, string>; cinematicFields: CinematicField[] }>(
      `/shots/${props.shot.id}/takes`,
    )
      .then((r) => {
        setTakes(r.items);
        setCinematic(r.cinematic);
        setFields(r.cinematicFields);
      })
      .catch(() => setTakes([]));
  }, [props.shot.id]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/shots/${props.shot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description, durationS: duration, cinematic }),
      });
      props.onChanged();
      props.onClose();
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function useTake(take: Take) {
    await api(`/shots/${props.shot.id}/takes/${take.id}/select`, { method: "POST" });
    props.onChanged();
    const refreshed = await api<{ items: Take[] }>(`/shots/${props.shot.id}/takes`);
    setTakes(refreshed.items);
  }

  const images = takes?.filter((t) => t.kind === "image") ?? [];
  const videos = takes?.filter((t) => t.kind === "video") ?? [];

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="shot-title" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h6" id="shot-title">Shot {props.shot.number}</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={props.onClose} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

            <div className="mb-3">
              <label className="form-label" htmlFor="shot-description">What happens</label>
              <textarea id="shot-description" className="form-control" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="mb-3" style={{ maxWidth: 200 }}>
              <label className="form-label" htmlFor="shot-duration">Length, seconds</label>
              <input id="shot-duration" className="form-control" type="number" min={0.5} max={60} step={0.5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>

            <h3 className="h6">Camera</h3>
            <p className="small text-secondary">These are written into the prompt, so they change the next take, not this one.</p>
            <div className="row g-2 mb-3">
              {fields.map((field) => (
                <div className="col-6 col-md-4" key={field.name}>
                  <label className="form-label small" htmlFor={`cine-${field.name}`}>{field.label}</label>
                  <select
                    id={`cine-${field.name}`}
                    className="form-select form-select-sm"
                    value={cinematic[field.name] ?? ""}
                    onChange={(e) => setCinematic((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  >
                    <option value="">Not set</option>
                    {field.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <h3 className="h6">Versions</h3>
            {takes === null && <p className="small text-secondary">Loading…</p>}
            {takes?.length === 0 && <p className="small text-secondary">Nothing generated yet.</p>}

            {[["Images", images] as const, ["Videos", videos] as const].map(([label, list]) =>
              list.length > 0 ? (
                <div className="mb-3" key={label}>
                  <p className="small text-secondary mb-1">{label}</p>
                  <div className="d-flex gap-2 flex-wrap">
                    {list.map((take) => {
                      const current =
                        take.assetId === (take.kind === "image" ? props.shot.imageAssetId : props.shot.videoAssetId);
                      return (
                        <figure className="m-0 text-center" key={take.id}>
                          {take.assetId ? (
                            take.kind === "video" ? (
                              <video src={`/api/v1/assets/${take.assetId}/content`} className="rounded" style={{ width: 110, height: 62, objectFit: "cover" }} muted>
                                <track kind="captions" />
                              </video>
                            ) : (
                              <img src={`/api/v1/assets/${take.assetId}/content`} alt={`Version ${take.version}`} className="rounded" style={{ width: 110, height: 62, objectFit: "cover" }} />
                            )
                          ) : (
                            <div className="bg-body-tertiary rounded d-flex align-items-center justify-content-center" style={{ width: 110, height: 62 }}>
                              <span className="small text-secondary">No file</span>
                            </div>
                          )}
                          <figcaption className="small mt-1">
                            <div className="text-secondary">v{take.version} · {formatMYR(take.costSen)}</div>
                            {current ? (
                              <span className="badge text-bg-success">In use</span>
                            ) : (
                              <button className="btn btn-sm btn-outline-secondary py-0" type="button" onClick={() => void useTake(take)}>
                                Use this
                              </button>
                            )}
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </div>
              ) : null,
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" type="button" onClick={props.onClose}>Cancel</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
