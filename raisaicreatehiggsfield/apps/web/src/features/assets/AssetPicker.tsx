import { useCallback, useEffect, useRef, useState } from "react";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { withCsrf } from "../../lib/csrf";

export interface AssetSummary {
  id: string;
  name: string;
  kind: string;
  mime: string;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: string;
}

/**
 * Picks reference images: upload a new one, or reuse something already in the
 * library. Reuse is the point. Nobody should have to upload the same character
 * sheet twice (§48).
 *
 * `max` comes from the selected model's own limit, so the control cannot let
 * someone build a request the model will reject.
 */
export function AssetPicker(props: {
  selected: string[];
  onChange: (assetIds: string[]) => void;
  max: number;
  kind?: string;
  /** File-input filter; defaults to the kind. */
  accept?: string;
  /** Legend text; defaults to "Reference image(s)". */
  label?: string;
}) {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: AssetSummary[] }>(`/assets?kind=${props.kind ?? "image"}&limit=24`);
      setAssets(r.items);
    } catch {
      setAssets([]);
    }
  }, [props.kind]);

  useEffect(() => {
    void load();
  }, [load]);

  // A selection can arrive for something newer than the list, for instance a
  // result handed straight back as a reference. The picker must be able to show
  // what it has been told to select, so it refetches rather than showing nothing.
  useEffect(() => {
    if (assets === null) return;
    const known = new Set(assets.map((a) => a.id));
    if (props.selected.some((id) => !known.has(id))) void load();
  }, [props.selected, assets, load]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // FormData sets its own content type; the shared client would override it.
      const res = await fetch("/api/v1/assets", withCsrf({ method: "POST", body: form, credentials: "same-origin" }));
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new AppError("invalid_input", body?.error?.message ?? "The upload failed.");
      }
      const asset = (await res.json()) as AssetSummary;
      await load();
      if (props.selected.length < props.max) props.onChange([...props.selected, asset.id]);
    } catch (err) {
      setError(err instanceof AppError ? err.message : "The upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function toggle(assetId: string) {
    if (props.selected.includes(assetId)) {
      props.onChange(props.selected.filter((id) => id !== assetId));
      return;
    }
    if (props.selected.length >= props.max) {
      // Replace the oldest rather than refusing: the intent is clear enough.
      props.onChange([...props.selected.slice(1), assetId]);
      return;
    }
    props.onChange([...props.selected, assetId]);
  }

  const full = props.selected.length >= props.max;

  return (
    <fieldset className="mb-3">
      <legend className="form-label fs-6">
        {props.label ?? `Reference ${props.max === 1 ? "image" : "images"}`}
        <span className="text-secondary fw-normal ms-2 small">
          {props.selected.length} of {props.max}
        </span>
      </legend>

      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

      <div className="d-flex flex-wrap gap-2 mb-2">
        {assets?.map((asset) => {
          const index = props.selected.indexOf(asset.id);
          const isSelected = index >= 0;
          return (
            <button
              key={asset.id}
              type="button"
              className={`btn p-0 border rounded position-relative ${isSelected ? "border-primary border-2" : ""}`}
              style={{ width: 72, height: 72, overflow: "hidden" }}
              onClick={() => toggle(asset.id)}
              aria-pressed={isSelected}
              title={asset.name}
            >
              {asset.mime.startsWith("image/") ? (
                <img src={asset.url} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span className="d-flex flex-column align-items-center justify-content-center h-100 small text-secondary px-1">
                  <i className={`bi bi-${asset.kind === "video" ? "film" : asset.kind === "audio" ? "music-note-beamed" : "file-earmark"} fs-4`} aria-hidden="true" />
                  <span className="text-truncate w-100 text-center" style={{ fontSize: ".6rem" }}>{asset.name}</span>
                </span>
              )}
              {isSelected && props.max > 1 && (
                // Order matters for start/end frames, so the position is shown.
                <span className="badge text-bg-primary position-absolute top-0 start-0 m-1">{index + 1}</span>
              )}
            </button>
          );
        })}

        <label
          className={`btn btn-outline-secondary d-flex align-items-center justify-content-center ${uploading ? "disabled" : ""}`}
          style={{ width: 72, height: 72 }}
        >
          <input
            ref={fileInput}
            type="file"
            accept={props.accept ?? `${props.kind ?? "image"}/*`}
            className="visually-hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <span aria-hidden="true">{uploading ? "…" : "+"}</span>
          <span className="visually-hidden">Upload a {props.kind ?? "image"}</span>
        </label>
      </div>

      {assets !== null && assets.length === 0 && (
        <p className="small text-secondary mb-0">Upload {props.kind === "audio" ? "an audio file" : `a ${props.kind ?? "image"}`} to use it here.</p>
      )}
      {full && props.max > 1 && (
        <p className="small text-secondary mb-0">
          That is as many as this model accepts. Choosing another replaces the first.
        </p>
      )}
    </fieldset>
  );
}
