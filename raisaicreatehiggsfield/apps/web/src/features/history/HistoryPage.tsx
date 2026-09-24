import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { GenerationActions } from "../generate/GenerationActions";
import { assetUrl, isAssetHandle, type GenerationDTO } from "../../lib/types";

const TYPES = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Videos" },
  { key: "audio", label: "Audio" },
  { key: "text", label: "Text" },
] as const;

const PERIODS = [
  { key: "all", label: "Any time" },
  { key: "today", label: "Today" },
  { key: "week", label: "Past week" },
  { key: "month", label: "Past month" },
] as const;

interface Project {
  id: string;
  name: string;
}

/** Everything made, with the filters that make a long history usable (§102). */
export function HistoryPage() {
  const [items, setItems] = useState<GenerationDTO[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [type, setType] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [projectId, setProjectId] = useState<string>("");
  const [modelId, setModelId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [selected, setSelected] = useState<GenerationDTO | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "60" });
    if (projectId) params.set("projectId", projectId);
    if (modelId) params.set("modelId", modelId);
    if (status) params.set("status", status);
    try {
      const { items } = await api<{ items: GenerationDTO[] }>(`/generations?${params}`);
      setItems(items);
    } catch {
      setItems([]);
    }
  }, [projectId, modelId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<{ items: Project[] }>("/projects").then((r) => setProjects(r.items)).catch(() => setProjects([]));
  }, []);

  // Type, period and cost narrow what is already loaded; project, model and
  // status are asked of the server, which is where the indexes are.
  const visible = useMemo(() => {
    if (!items) return null;
    const since = periodStart(period);
    return items.filter((g) => {
      if (type !== "all" && outputKind(g) !== type) return false;
      if (since && new Date(g.createdAt) < since) return false;
      return true;
    });
  }, [items, type, period]);

  const models = useMemo(
    () => [...new Set((items ?? []).map((g) => g.modelId))].sort(),
    [items],
  );
  const spentSen = (visible ?? []).reduce((sum, g) => sum + (g.chargedSen ?? 0), 0);

  return (
    <section>
      <h1 className="h3 mb-1">History</h1>
      <p className="text-secondary mb-3">
        {visible?.length ?? 0} result{visible?.length === 1 ? "" : "s"}
        {spentSen > 0 && ` · ${formatMYR(spentSen)}`}
      </p>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <div className="btn-group btn-group-sm" role="group" aria-label="Type">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn ${type === t.key ? "btn-primary" : "btn-outline-secondary"}`}
              onClick={() => setType(t.key)}
              aria-pressed={type === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="visually-hidden" htmlFor="history-period">Period</label>
        <select id="history-period" className="form-select form-select-sm w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        <label className="visually-hidden" htmlFor="history-project">Project</label>
        <select id="history-project" className="form-select form-select-sm w-auto" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">Any project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label className="visually-hidden" htmlFor="history-model">Model</label>
        <select id="history-model" className="form-select form-select-sm w-auto" value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">Any model</option>
          {models.map((m) => <option key={m} value={m}>{m.split("/").pop()}</option>)}
        </select>

        <label className="visually-hidden" htmlFor="history-status">Status</label>
        <select id="history-status" className="form-select form-select-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any outcome</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {visible === null && <p className="text-secondary">Loading…</p>}
      {visible !== null && visible.length === 0 && (
        <EmptyState
          icon="clock-history"
          title={items?.length ? "Nothing matches those filters." : "Nothing generated yet."}
          description="Every image, video, text and canvas run shows up here with its final cost."
          action={<Link className="btn btn-primary" to="/create">Create something</Link>}
        />
      )}

      <div className="row g-3">
        {visible?.map((generation) => (
          <div className="col-sm-6 col-xl-4" key={generation.id}>
            <GenerationCard generation={generation} onOpen={() => setSelected(generation)} />
          </div>
        ))}
      </div>

      {selected && <GenerationDialog generation={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function GenerationCard(props: { generation: GenerationDTO; onOpen: () => void }) {
  const { generation } = props;
  const preview = Object.values(generation.outputs).find(isAssetHandle);

  return (
    <article className="card h-100">
      {preview?.mime.startsWith("image/") && (
        <img src={assetUrl(preview)} className="card-img-top" alt={generation.prompt || "Generated image"} loading="lazy" />
      )}
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
          <StatusBadge status={generation.status} />
          <span className="small text-secondary">
            {generation.chargedSen !== null ? formatMYR(generation.chargedSen) : "—"}
          </span>
        </div>
        <p className="small mb-1 text-truncate" title={generation.prompt}>{generation.prompt || "(no prompt)"}</p>
        <p className="small text-secondary mb-2">
          {generation.modelId.split("/").pop()} · {new Date(generation.createdAt).toLocaleString()}
        </p>
        {generation.error && <p className="small text-danger mb-2">{generation.error.message}</p>}
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={props.onOpen}>Open</button>
      </div>
    </article>
  );
}

function GenerationDialog(props: { generation: GenerationDTO; onClose: () => void }) {
  const { generation } = props;
  const asset = Object.values(generation.outputs).find(isAssetHandle);

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="result-title" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h6" id="result-title">{generation.prompt || "Result"}</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={props.onClose} />
          </div>
          <div className="modal-body">
            {asset?.mime.startsWith("image/") && <img src={assetUrl(asset)} alt={generation.prompt} className="img-fluid rounded mb-3" />}
            {asset?.mime.startsWith("video/") && (
              <video src={assetUrl(asset)} controls className="w-100 rounded mb-3"><track kind="captions" /></video>
            )}
            {asset?.mime.startsWith("audio/") && (
              <audio src={assetUrl(asset)} controls className="w-100 mb-3"><track kind="captions" /></audio>
            )}
            {typeof generation.outputs.text === "string" && (
              <p style={{ whiteSpace: "pre-wrap" }}>{generation.outputs.text}</p>
            )}

            <dl className="row small mb-0">
              <dt className="col-4">Model</dt><dd className="col-8">{generation.modelId}</dd>
              <dt className="col-4">Charged</dt>
              <dd className="col-8">
                {generation.chargedSen !== null ? formatMYR(generation.chargedSen) : "—"}
                {generation.costEstimated && <span className="text-secondary ms-2">estimated from provider pricing</span>}
              </dd>
              {generation.durationMs !== null && (
                <>
                  <dt className="col-4">Took</dt><dd className="col-8">{(generation.durationMs / 1000).toFixed(1)}s</dd>
                </>
              )}
            </dl>

            <GenerationActions generation={generation} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge(props: { status: GenerationDTO["status"] }) {
  const map: Record<GenerationDTO["status"], { cls: string; icon: string; label: string }> = {
    completed: { cls: "text-bg-success", icon: "check-circle", label: "Completed" },
    failed: { cls: "text-bg-danger", icon: "exclamation-circle", label: "Failed" },
    running: { cls: "text-bg-info", icon: "arrow-repeat", label: "Running" },
    queued: { cls: "text-bg-secondary", icon: "hourglass", label: "Queued" },
    cancelled: { cls: "text-bg-secondary", icon: "slash-circle", label: "Cancelled" },
  };
  const meta = map[props.status];
  // Icon plus text, never colour alone (§113).
  return (
    <span className={`badge ${meta.cls}`}>
      <i className={`bi bi-${meta.icon} me-1`} aria-hidden="true" />{meta.label}
    </span>
  );
}

function periodStart(period: string): Date | null {
  const now = Date.now();
  if (period === "today") return new Date(new Date().toISOString().slice(0, 10));
  if (period === "week") return new Date(now - 7 * 86_400_000);
  if (period === "month") return new Date(now - 30 * 86_400_000);
  return null;
}

function outputKind(generation: GenerationDTO): string {
  const asset = Object.values(generation.outputs).find(isAssetHandle);
  if (asset?.mime.startsWith("image/")) return "image";
  if (asset?.mime.startsWith("video/")) return "video";
  if (asset?.mime.startsWith("audio/")) return "audio";
  return "text";
}
