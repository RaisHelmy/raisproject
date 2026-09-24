import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AppError, formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { assetUrl, isAssetHandle, type GenerationDTO } from "../../lib/types";

interface Project {
  id: string;
  name: string;
  description: string | null;
  kind: "general" | "movie";
  createdAt: string;
  updatedAt: string;
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await api<{ items: Project[] }>("/projects");
      setProjects(items);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api<Project>("/projects", { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof AppError ? err.message : "The project could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-page-head"><div><p className="lp-eyebrow mb-2">Workspace</p><h1 className="display-6 fw-bold mb-2">Projects</h1><p className="text-secondary mb-0">
        Everything you make belongs to a project: results, assets, canvases and movies.
      </p></div><Link to="/create" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />New creative</Link></div>

      <form className="row g-2 align-items-end mb-4" onSubmit={create}>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="project-name">New project</label>
          <input
            id="project-name"
            className="form-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cyberpunk Movie"
          />
        </div>
        <div className="col-auto">
          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {projects === null && <p className="text-secondary">Loading…</p>}
      {projects !== null && projects.length === 0 && (
        <EmptyState
          icon="folder2"
          title="No projects yet."
          description="Projects keep characters, scenes, assets and canvases together."
        />
      )}

      <div className="row g-3">
        {projects?.map((project) => (
          <div className="col-sm-6 col-xl-4" key={project.id}>
            <Link to={`/projects/${project.id}`} className="card h-100 text-decoration-none rais-create-card">
              <div className="card-body">
                <h2 className="h6 mb-1">
                  {project.name}
                  {project.kind === "movie" && <span className="badge text-bg-secondary ms-2">Movie</span>}
                </h2>
                <p className="small text-secondary mb-0">{project.description ?? "No description."}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

interface AssetSummary {
  id: string;
  name: string;
  kind: string;
  mime: string;
  url: string;
}

interface CanvasSummary {
  id: string;
  name: string;
  version: number;
}

/** Everything made inside one project, in one place (§69). */
export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [generations, setGenerations] = useState<GenerationDTO[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [canvases, setCanvases] = useState<CanvasSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Project>(`/projects/${id}`).then(setProject).catch(() => setError("This project could not be loaded."));
    api<{ items: GenerationDTO[] }>(`/generations?projectId=${id}&limit=12`).then((r) => setGenerations(r.items)).catch(() => undefined);
    api<{ items: AssetSummary[] }>(`/assets?projectId=${id}&limit=12`).then((r) => setAssets(r.items)).catch(() => undefined);
    api<{ items: CanvasSummary[] }>(`/workflows?projectId=${id}`).then((r) => setCanvases(r.items)).catch(() => undefined);
  }, [id]);

  if (error) {
    return (
      <section>
        <h1 className="h3 mb-3">Project</h1>
        <div className="alert alert-danger" role="alert">{error}</div>
      </section>
    );
  }

  const spentSen = generations.reduce((sum, g) => sum + (g.chargedSen ?? 0), 0);

  return (
    <section>
      <p className="mb-1"><Link to="/projects" className="small text-decoration-none">← Projects</Link></p>
      <h1 className="h3 mb-1">{project?.name ?? "Loading…"}</h1>
      <p className="text-secondary mb-4">
        {generations.length} result{generations.length === 1 ? "" : "s"} · {formatMYR(spentSen)} spent here
      </p>

      <h2 className="h6 mb-2">Recent results</h2>
      {generations.length === 0 ? (
        <p className="small text-secondary">Nothing generated in this project yet.</p>
      ) : (
        <div className="row g-2 mb-4">
          {generations.map((generation) => {
            const preview = Object.values(generation.outputs).find(isAssetHandle);
            return (
              <div className="col-4 col-lg-2" key={generation.id}>
                <div className="ratio ratio-1x1 bg-body-tertiary rounded overflow-hidden">
                  {preview?.mime.startsWith("image/") ? (
                    <img src={assetUrl(preview)} alt={generation.prompt} style={{ objectFit: "cover" }} loading="lazy" />
                  ) : (
                    <span className="d-flex align-items-center justify-content-center small text-secondary p-1 text-center">
                      {generation.prompt.slice(0, 30)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="h6 mb-2">Canvases</h2>
      {canvases.length === 0 ? (
        <p className="small text-secondary mb-4">No canvases in this project.</p>
      ) : (
        <ul className="list-unstyled mb-4">
          {canvases.map((canvas) => (
            <li key={canvas.id} className="small">
              <Link to={`/canvas/${canvas.id}`}>{canvas.name}</Link>
              <span className="text-secondary ms-2">version {canvas.version}</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="h6 mb-2">Assets</h2>
      {assets.length === 0 ? (
        <p className="small text-secondary">No files in this project.</p>
      ) : (
        <div className="d-flex flex-wrap gap-2">
          {assets.map((asset) => (
            <a key={asset.id} href={asset.url} className="border rounded overflow-hidden" style={{ width: 64, height: 64 }} title={asset.name}>
              {asset.mime.startsWith("image/") ? (
                <img src={asset.url} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
              ) : (
                <span className="d-flex align-items-center justify-content-center h-100 small text-secondary">
                  {asset.kind}
                </span>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
