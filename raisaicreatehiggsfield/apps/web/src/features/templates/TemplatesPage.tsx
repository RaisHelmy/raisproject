import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatMYR, AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import { AssetPicker } from "../assets/AssetPicker";

export interface VariableDef {
  name: string;
  type: string;
  required: boolean;
  label?: string;
  default?: unknown;
  enum?: string[];
}

export interface TemplateDTO {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  tags: string[];
  visibility: string;
  version: number;
  usageCount: number;
  estimatedCostSen: number | null;
  previewAssetId: string | null;
  previewUrl: string | null;
  authorName: string | null;
  variables?: VariableDef[];
  createdAt: string;
  updatedAt: string;
}

interface CategoryCount {
  category: string;
  count: number;
}

/**
 * The app-gallery taxonomy people know from the big creative suites. A
 * category only shows as a chip when it actually has templates; the icon
 * and order are ours.
 */
export const TEMPLATE_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: "professional", label: "Professional", icon: "briefcase" },
  { key: "enhance", label: "Enhance & Style", icon: "magic" },
  { key: "characters", label: "Characters", icon: "person-bounding-box" },
  { key: "ads", label: "Ads & Products", icon: "bag" },
  { key: "video", label: "Video Editing", icon: "film" },
  { key: "audio", label: "Voice & Audio", icon: "mic" },
  { key: "trending", label: "Trending", icon: "fire" },
];

export function TemplatesPage() {
  const [items, setItems] = useState<TemplateDTO[] | null>(null);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [active, setActive] = useState<TemplateDTO | null>(null);
  const [params, setParams] = useSearchParams();
  // "Community" in the sidebar is this page with the public scope preselected.
  const scope: "mine" | "public" = params.get("scope") === "public" ? "public" : "mine";
  const category = params.get("category");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const q = new URLSearchParams();
    if (scope === "public") q.set("scope", "public");
    if (category) q.set("category", category);
    if (query.trim()) q.set("q", query.trim());
    q.set("sort", scope === "public" ? "popular" : "recent");

    const timer = setTimeout(() => {
      api<{ items: TemplateDTO[]; categories: CategoryCount[] }>(`/templates?${q}`)
        .then((r) => { setItems(r.items); setCategories(r.categories); })
        .catch(() => setItems([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [scope, category, query]);

  function setScope(next: "mine" | "public") {
    const q = new URLSearchParams(params);
    if (next === "public") q.set("scope", "public"); else q.delete("scope");
    setParams(q, { replace: true });
  }
  function setCategory(next: string | null) {
    const q = new URLSearchParams(params);
    if (next) q.set("category", next); else q.delete("category");
    setParams(q, { replace: true });
  }

  const counts = new Map(categories.map((c) => [c.category, c.count]));
  const chips = [
    ...TEMPLATE_CATEGORIES.filter((c) => counts.has(c.key)),
    // Anything outside the taxonomy still gets a chip, so nothing is unreachable.
    ...categories.filter((c) => !TEMPLATE_CATEGORIES.some((t) => t.key === c.category)).map((c) => ({ key: c.category, label: c.category, icon: "tag" })),
  ];

  async function remix(template: TemplateDTO) {
    const copy = await api<TemplateDTO>(`/templates/${template.id}/duplicate`, { method: "POST" });
    navigate(`/templates/${copy.id}`);
  }

  return (
    <section className="workspace-page">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-1">
        <div>
          <p className="lp-eyebrow mb-2">Creative system</p><h1 className="display-6 fw-bold mb-2">{scope === "public" ? "Community" : "Apps & templates"}</h1>
          <p className="text-secondary mb-0">
            {scope === "public"
              ? "Canvases other people published. Use one as is, or remix it into your own."
              : "One-click canvases with typed inputs. Save any canvas as a template, or start from the community."}
          </p>
        </div>
        <span className="badge rounded-pill text-bg-warning"><i className="bi bi-layers me-1" />Batch runs · coming soon</span>
        <div className="btn-group btn-group-sm" role="group" aria-label="Which templates">
          <button type="button" className={`btn ${scope === "mine" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setScope("mine")} aria-pressed={scope === "mine"}>Mine</button>
          <button type="button" className={`btn ${scope === "public" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setScope("public")} aria-pressed={scope === "public"}>Community</button>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 align-items-center my-3">
        <label className="visually-hidden" htmlFor="template-search">Search templates</label>
        <input id="template-search" type="search" className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder="Search templates" value={query} onChange={(e) => setQuery(e.target.value)} />
        {chips.length > 0 && (
          <div className="d-flex flex-wrap gap-1" role="group" aria-label="Category">
            <button type="button" className={`btn btn-sm rounded-pill ${category === null ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setCategory(null)} aria-pressed={category === null}>All</button>
            {chips.map((c) => (
              <button key={c.key} type="button" className={`btn btn-sm rounded-pill ${category === c.key ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setCategory(c.key)} aria-pressed={category === c.key}>
                <i className={`bi bi-${c.icon} me-1`} aria-hidden="true" />{c.label} <span className="opacity-75">({counts.get(c.key)})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {items === null && <p className="text-secondary">Loading…</p>}
      {items !== null && items.length === 0 && (
        scope === "public"
          ? <EmptyState icon="people" title="Nothing published yet." description="Be the first: open a template of yours and set it to Public." />
          : <EmptyState icon="grid-1x2" title="Create your first reusable AI canvas." description="Save a canvas as a template, then run it again with new inputs."
              action={<button type="button" className="btn btn-primary" onClick={() => setScope("public")}>Browse the community</button>} />
      )}

      <div className="row g-3">
        {items?.map((template) => (
          <div className="col-sm-6 col-xl-3" key={template.id}>
            <article className="card h-100 rais-tpl-card">
              <Link to={`/templates/${template.id}`} className="ratio ratio-4x3 rais-tpl-art rounded-top overflow-hidden" style={{ "--h": hueFor(template.id) } as CSSProperties} aria-label={template.name}>
                {template.previewUrl
                  ? <img src={template.previewUrl} alt="" style={{ objectFit: "cover" }} loading="lazy" />
                  : <span className="rais-tpl-word">{template.name}</span>}
              </Link>
              <div className="card-body d-flex flex-column p-3">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <h2 className="h6 mb-1"><Link to={`/templates/${template.id}`} className="text-reset text-decoration-none">{template.name}</Link></h2>
                  {template.estimatedCostSen !== null && <span className="badge text-bg-secondary">{formatMYR(template.estimatedCostSen)}</span>}
                </div>
                <p className="small text-secondary flex-grow-1 mb-2">{template.description ?? "No description."}</p>
                <p className="small text-secondary mb-2">
                  {template.authorName ? <>by {template.authorName} · </> : null}
                  used {template.usageCount} time{template.usageCount === 1 ? "" : "s"}
                  {template.visibility === "public" && scope === "mine" && <span className="badge text-bg-secondary ms-2">Public</span>}
                </p>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-primary" type="button" onClick={() => setActive(template)}>Use</button>
                  <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => void remix(template)}>Remix</button>
                </div>
              </div>
            </article>
          </div>
        ))}
      </div>

      {active && <UseTemplateDialog template={active} onClose={() => setActive(null)} />}
    </section>
  );
}

/** Stable hue per template so the fallback artwork is consistent between visits. */
function hueFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

/**
 * Builds a typed form from the template's declared inputs (§20, §51). Image,
 * video and audio inputs use the asset picker and are sent as handles, so a
 * template with a product photo input runs from here without a canvas.
 */
export function UseTemplateDialog(props: { template: TemplateDTO; onClose: () => void }) {
  const [variables, setVariables] = useState<VariableDef[] | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ chargedSen: number; status: string; workflowRunId: string } | null>(null);

  useEffect(() => {
    api<TemplateDTO>(`/templates/${props.template.id}`)
      .then((t) => {
        setVariables(t.variables ?? []);
        const initial: Record<string, unknown> = {};
        for (const v of t.variables ?? []) if (v.default !== undefined) initial[v.name] = v.default;
        setValues(initial);
      })
      .catch(() => setVariables([]));
  }, [props.template.id]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await api<{ status: string; chargedSen: number; workflowRunId: string }>(`/templates/${props.template.id}/execute`, {
        method: "POST",
        body: JSON.stringify({ variables: values }),
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const missing = (variables ?? []).filter((v) => v.required && (values[v.name] === undefined || values[v.name] === ""));

  return (
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="use-template-title" style={{ background: "rgba(0,0,0,.5)" }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h2 className="modal-title h6" id="use-template-title">{props.template.name}</h2>
            <button type="button" className="btn-close" aria-label="Close" onClick={props.onClose} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            {result && (
              <div className="alert alert-success" role="status">
                {result.status === "completed" ? "Finished." : `Status: ${result.status}.`} Charged {formatMYR(result.chargedSen)}.{" "}
                <Link to="/library?tab=history" className="alert-link">See the result in History.</Link>
              </div>
            )}
            {variables === null && <p className="text-secondary">Loading inputs…</p>}
            {variables?.length === 0 && <p className="text-secondary">This template needs no inputs.</p>}
            {variables?.map((variable) => (
              <VariableField key={variable.name} variable={variable} value={values[variable.name]} onChange={(v) => setValues((all) => ({ ...all, [variable.name]: v }))} />
            ))}
            {props.template.estimatedCostSen !== null && (
              <p className="small text-secondary mb-0">Estimated cost about {formatMYR(props.template.estimatedCostSen)}; you are charged the actual amount.</p>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" type="button" onClick={props.onClose}>Close</button>
            <button className="btn btn-primary" type="button" onClick={run} disabled={busy || missing.length > 0}>
              {busy ? "Running…" : "Run template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VariableField(props: { variable: VariableDef; value: unknown; onChange: (v: unknown) => void }) {
  const { variable } = props;
  const id = `var-${variable.name}`;
  const label = (
    <label className="form-label" htmlFor={id}>
      {variable.label ?? variable.name}
      {variable.required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
    </label>
  );

  if (variable.type === "image" || variable.type === "video" || variable.type === "audio") {
    const handle = props.value as { assetId: string } | undefined;
    return (
      <AssetPicker
        selected={handle ? [handle.assetId] : []}
        onChange={(ids) => props.onChange(ids[0] ? { assetId: ids[0], mime: variable.type === "image" ? "image/png" : variable.type === "video" ? "video/mp4" : "audio/mpeg" } : undefined)}
        max={1}
        kind={variable.type}
        accept={`${variable.type}/*`}
        label={variable.label ?? variable.name}
      />
    );
  }
  if (variable.type === "image[]") {
    const handles = (props.value as { assetId: string }[] | undefined) ?? [];
    return (
      <AssetPicker
        selected={handles.map((h) => h.assetId)}
        onChange={(ids) => props.onChange(ids.map((assetId) => ({ assetId, mime: "image/png" })))}
        max={4}
        kind="image"
        label={variable.label ?? variable.name}
      />
    );
  }
  if (variable.enum && variable.enum.length > 0) {
    return (
      <div className="mb-3">
        {label}
        <select id={id} className="form-select" value={String(props.value ?? "")} onChange={(e) => props.onChange(e.target.value)} required={variable.required}>
          <option value="">Choose…</option>
          {variable.enum.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }
  if (variable.type === "boolean") {
    return (
      <div className="form-check mb-3">
        <input id={id} className="form-check-input" type="checkbox" checked={Boolean(props.value)} onChange={(e) => props.onChange(e.target.checked)} />
        <label className="form-check-label" htmlFor={id}>{variable.label ?? variable.name}</label>
      </div>
    );
  }
  if (variable.type === "number") {
    return (
      <div className="mb-3">
        {label}
        <input id={id} className="form-control" type="number" required={variable.required} value={props.value === undefined ? "" : String(props.value)} onChange={(e) => props.onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
      </div>
    );
  }
  const long = variable.type === "text" || variable.type === "prompt";
  return (
    <div className="mb-3">
      {label}
      {long
        ? <textarea id={id} className="form-control" rows={3} required={variable.required} value={String(props.value ?? "")} onChange={(e) => props.onChange(e.target.value)} />
        : <input id={id} className="form-control" type="text" required={variable.required} value={String(props.value ?? "")} onChange={(e) => props.onChange(e.target.value)} />}
    </div>
  );
}
