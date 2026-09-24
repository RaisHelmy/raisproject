import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppError, formatMYR } from "@raisai/shared";
import { api } from "../../lib/api";
import { assetUrl, isAssetHandle, type ModelDTO } from "../../lib/types";
import { EmptyState } from "../../components/EmptyState";

interface Entry {
  modelId: string;
  displayName: string;
  status: "completed" | "failed";
  outputs: Record<string, unknown>;
  chargedSen: number;
  durationMs: number | null;
  error: { code: string; message: string } | null;
}

const MAX = 4;

/**
 * The same prompt through several models, judged side by side (§89). With this
 * many models, comparing is often the only honest way to choose, so the cost
 * and the time sit under each result.
 */
export function ComparePage() {
  const [models, setModels] = useState<ModelDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [estimateSen, setEstimateSen] = useState<number | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: ModelDTO[] }>("/models?category=image")
      .then((r) => {
        setModels(r.items);
        setSelected(r.items.slice(0, 2).map((m) => m.id));
      })
      .catch(() => setModels([]));
  }, []);

  useEffect(() => {
    if (selected.length < 2 || !prompt.trim()) {
      setEstimateSen(null);
      return;
    }
    const timer = setTimeout(() => {
      api<{ totalSen: number }>("/models/compare/estimate", {
        method: "POST",
        body: JSON.stringify({ modelIds: selected, prompt }),
      })
        .then((r) => setEstimateSen(r.totalSen))
        .catch(() => setEstimateSen(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [selected, prompt]);

  const cheapest = useMemo(() => {
    const done = (entries ?? []).filter((e) => e.status === "completed");
    return done.length > 1 ? done.reduce((a, b) => (a.chargedSen <= b.chargedSen ? a : b)).modelId : null;
  }, [entries]);

  function toggle(modelId: string) {
    setSelected((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : current.length >= MAX
          ? current
          : [...current, modelId],
    );
  }

  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ entries: Entry[] }>("/models/compare", {
        method: "POST",
        body: JSON.stringify({ modelIds: selected, prompt }),
      });
      setEntries(result.entries);
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "The comparison failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-page-head"><div><p className="lp-eyebrow mb-2">Model intelligence</p><h1 className="display-6 fw-bold mb-2">Compare models</h1><p className="text-secondary mb-0">Choose the right balance of quality, speed and cost for each production brief.</p></div><span className="badge rounded-pill text-bg-warning"><i className="bi bi-stars me-1" />Auto-pick model · coming soon</span></div>
      <p className="text-secondary mb-4">One prompt, several models, side by side.</p>

      <form onSubmit={run} className="mb-4">
        <div className="mb-3">
          <label className="form-label" htmlFor="compare-prompt">Prompt</label>
          <textarea
            id="compare-prompt"
            className="form-control"
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A rainy cyberpunk street in Kuala Lumpur"
            required
          />
        </div>

        <fieldset className="mb-3">
          <legend className="form-label fs-6">Models <span className="text-secondary fw-normal small">({selected.length} of {MAX})</span></legend>
          <div className="row g-2">
            {models.map((model) => (
              <div className="col-sm-6 col-lg-3" key={model.id}>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`compare-${model.id}`}
                    checked={selected.includes(model.id)}
                    disabled={!selected.includes(model.id) && selected.length >= MAX}
                    onChange={() => toggle(model.id)}
                  />
                  <label className="form-check-label small" htmlFor={`compare-${model.id}`}>
                    {model.displayName}
                    {model.typicalCostSen !== undefined && (
                      <span className="text-secondary ms-1">{formatMYR(model.typicalCostSen)}</span>
                    )}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-primary" type="submit" disabled={busy || selected.length < 2 || !prompt.trim()}>
            {busy ? "Running…" : `Compare ${selected.length} models`}
          </button>
          {estimateSen !== null && (
            <span className="small text-secondary">
              Estimated total <strong>{formatMYR(estimateSen)}</strong>
            </span>
          )}
        </div>
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {busy && <p className="text-secondary">Running each model…</p>}

      {entries === null && !busy && (
        <EmptyState icon="columns-gap" title="Pick two or more models and write a prompt." />
      )}

      {entries && (
        <div className="row g-3">
          {entries.map((entry) => (
            <div className="col-sm-6 col-lg-3" key={entry.modelId}>
              <article className={`card h-100 ${entry.modelId === cheapest ? "border-success" : ""}`}>
                {entry.status === "completed" && renderPreview(entry)}
                <div className="card-body">
                  <h2 className="h6 mb-1">{entry.displayName}</h2>
                  {entry.status === "completed" ? (
                    <p className="small text-secondary mb-0">
                      {formatMYR(entry.chargedSen)}
                      {entry.durationMs !== null && ` · ${(entry.durationMs / 1000).toFixed(1)}s`}
                      {entry.modelId === cheapest && <span className="badge text-bg-success ms-2">Cheapest</span>}
                    </p>
                  ) : (
                    <p className="small text-danger mb-0">{entry.error?.message ?? "Failed."}</p>
                  )}
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function renderPreview(entry: Entry) {
  for (const value of Object.values(entry.outputs)) {
    if (isAssetHandle(value) && value.mime.startsWith("image/")) {
      return <img src={assetUrl(value)} className="card-img-top" alt={`Result from ${entry.displayName}`} loading="lazy" />;
    }
    if (typeof value === "string") {
      return <p className="card-text small p-3 mb-0" style={{ whiteSpace: "pre-wrap" }}>{value.slice(0, 300)}</p>;
    }
  }
  return null;
}
