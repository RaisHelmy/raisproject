import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { withCsrf } from "../../lib/csrf";
import { EmptyState } from "../../components/EmptyState";
import { useAuth } from "../auth/AuthContext";

interface Asset {
  id: string;
  name: string;
  kind: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  version: number;
  projectId: string;
  generationId: string | null;
  url: string;
  featured?: boolean;
  createdAt: string;
}

const KINDS = [
  { key: "", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "document", label: "Documents" },
] as const;

/** Everything stored, uploaded or generated, in one place (§47, §48, §100). */
export function AssetsPage() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [kind, setKind] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await api<{ items: Asset[] }>(`/assets?limit=60${kind ? `&kind=${kind}` : ""}`);
      setAssets(items);
    } catch {
      setAssets([]);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      // FormData sets its own content type, which the shared client would override.
      const res = await fetch("/api/v1/assets", withCsrf({ method: "POST", body: form, credentials: "same-origin" }));
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new AppError("invalid_input", body?.error?.message ?? "The upload failed.");
      }
      await load();
    } catch (err) {
      setError(err instanceof AppError ? err.message : "The upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(asset: Asset) {
    await api(`/assets/${asset.id}`, { method: "DELETE" });
    setSelected(null);
    await load();
  }

  return (
    <section className="workspace-page">
      <div className="workspace-page-head"><div><p className="lp-eyebrow mb-2">Content library</p><h1 className="display-6 fw-bold mb-2">Assets</h1><p className="text-secondary mb-0">
        Upload once and reuse anywhere: as a reference, on a canvas, or in a movie.
      </p></div><span className="badge rounded-pill text-bg-warning align-self-center"><i className="bi bi-collection me-1" />Batch upload · coming soon</span></div>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <div className="btn-group btn-group-sm" role="group" aria-label="Kind">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              className={`btn ${kind === k.key ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setKind(k.key)}
              aria-pressed={kind === k.key}
            >
              {k.label}
            </button>
          ))}
        </div>

        <label className={`btn btn-sm btn-primary ${uploading ? "disabled" : ""}`}>
          <input
            ref={fileInput}
            type="file"
            className="visually-hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          {uploading ? "Uploading…" : "Upload a file"}
        </label>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {assets === null && <p className="text-secondary">Loading…</p>}
      {assets !== null && assets.length === 0 && (
        <EmptyState
          icon="images"
          title="Nothing stored yet."
          description="Upload an image, or generate your first result."
          action={<Link className="btn btn-primary" to="/create">Create something</Link>}
        />
      )}

      <div className="row g-3">
        {assets?.map((asset) => (
          <div className="col-6 col-md-4 col-xl-3" key={asset.id}>
            <button type="button" className="card h-100 w-100 border-0 p-0 text-start" onClick={() => setSelected(asset)}>
              <div className="ratio ratio-4x3 bg-body-tertiary rounded-top overflow-hidden">
                {asset.mime.startsWith("image/") ? (
                  <img src={asset.url} alt={asset.name} style={{ objectFit: "cover" }} loading="lazy" />
                ) : (
                  <span className="d-flex align-items-center justify-content-center">
                    <i className={`bi bi-${iconFor(asset.kind)} fs-2 text-secondary`} aria-hidden="true" />
                  </span>
                )}
              </div>
              <div className="card-body p-2">
                <p className="small mb-0 text-truncate" title={asset.name}>{asset.name}</p>
                <p className="small text-secondary mb-0">
                  {formatSize(asset.sizeBytes)}
                  {asset.version > 1 && ` · v${asset.version}`}
                </p>
              </div>
            </button>
          </div>
        ))}
      </div>

      {selected && <AssetDialog asset={selected} onClose={() => setSelected(null)} onDelete={() => void remove(selected)} onChanged={load} />}
    </section>
  );
}

function AssetDialog(props: { asset: Asset; onClose: () => void; onDelete: () => void; onChanged: () => Promise<void> }) {
  const { asset } = props;
  const [confirming, setConfirming] = useState(false);
  const { user } = useAuth();
  const [featured, setFeatured] = useState(Boolean(asset.featured));
  const [featurePrompt, setFeaturePrompt] = useState("");
  const [featureStudio, setFeatureStudio] = useState(asset.kind === "video" ? "video" : asset.kind === "audio" ? "audio" : "image");
  const [featureBusy, setFeatureBusy] = useState(false);

  // Admin only: puts this asset on the public landing page. Publishing a
  // customer's output is an operator decision, so it is not offered to
  // everyone as a general flag.
  async function toggleFeature(next: boolean) {
    setFeatureBusy(true);
    try {
      await api(`/assets/${asset.id}/feature`, {
        method: "PUT",
        body: JSON.stringify({ featured: next, prompt: featurePrompt || undefined, studio: featureStudio }),
      });
      setFeatured(next);
      await props.onChanged();
    } finally {
      setFeatureBusy(false);
    }
  }

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="asset-title" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h6 text-truncate" id="asset-title">{asset.name}</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={props.onClose} />
          </div>
          <div className="modal-body">
            {asset.mime.startsWith("image/") && <img src={asset.url} alt={asset.name} className="img-fluid rounded mb-3" />}
            {asset.mime.startsWith("video/") && (
              <video src={asset.url} controls className="w-100 rounded mb-3"><track kind="captions" /></video>
            )}
            {asset.mime.startsWith("audio/") && (
              <audio src={asset.url} controls className="w-100 mb-3"><track kind="captions" /></audio>
            )}

            <dl className="row small mb-0">
              <dt className="col-4">Type</dt><dd className="col-8">{asset.mime}</dd>
              <dt className="col-4">Size</dt><dd className="col-8">{formatSize(asset.sizeBytes)}</dd>
              {asset.width && <><dt className="col-4">Dimensions</dt><dd className="col-8">{asset.width} × {asset.height}</dd></>}
              {asset.durationMs && <><dt className="col-4">Length</dt><dd className="col-8">{(asset.durationMs / 1000).toFixed(1)}s</dd></>}
              <dt className="col-4">Added</dt><dd className="col-8">{new Date(asset.createdAt).toLocaleString()}</dd>
            </dl>

            {user?.isAdmin && (
              <div className="border rounded p-2 mt-3">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small fw-semibold"><i className="bi bi-star me-1" aria-hidden="true" />Landing page showcase</span>
                  <span className={`badge ${featured ? "text-bg-success" : "text-bg-secondary"}`}>{featured ? "Featured" : "Not featured"}</span>
                </div>
                {!featured && (
                  <div className="row g-2 mt-1">
                    <div className="col-8">
                      <input className="form-control form-control-sm" placeholder="Prompt to show under it (optional)" value={featurePrompt} onChange={(e) => setFeaturePrompt(e.target.value)} aria-label="Showcase prompt" />
                    </div>
                    <div className="col-4">
                      <select className="form-select form-select-sm" value={featureStudio} onChange={(e) => setFeatureStudio(e.target.value)} aria-label="Showcase section">
                        <option value="image">Image</option><option value="video">Video</option><option value="audio">Audio</option><option value="movie">Movie</option>
                      </select>
                    </div>
                  </div>
                )}
                <button type="button" className={`btn btn-sm mt-2 ${featured ? "btn-outline-secondary" : "btn-outline-primary"}`} disabled={featureBusy} onClick={() => void toggleFeature(!featured)}>
                  {featureBusy ? "Saving…" : featured ? "Remove from landing page" : "Feature on landing page"}
                </button>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <a className="btn btn-sm btn-outline-secondary" href={asset.url} download>Download</a>
            {confirming ? (
              <>
                <span className="small text-secondary me-2">Delete this file?</span>
                <button className="btn btn-sm btn-danger" type="button" onClick={props.onDelete}>Yes, delete</button>
                <button className="btn btn-sm btn-link" type="button" onClick={() => setConfirming(false)}>Keep it</button>
              </>
            ) : (
              <button className="btn btn-sm btn-outline-danger" type="button" onClick={() => setConfirming(true)}>Delete</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function iconFor(kind: string): string {
  return { image: "image", video: "film", audio: "music-note-beamed", document: "file-earmark-text" }[kind] ?? "file-earmark";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
