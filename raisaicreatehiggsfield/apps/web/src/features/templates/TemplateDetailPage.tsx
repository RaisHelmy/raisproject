import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatMYR, AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { UseTemplateDialog, type TemplateDTO } from "./TemplatesPage";

interface Step {
  label: string;
  type: string;
  modelId: string | null;
}

interface TemplateDetail extends TemplateDTO {
  steps: Step[];
  mine: boolean;
}

/**
 * A template at its own address, so it can be shared (§53).
 *
 * The steps are shown before anyone runs anything: a person deciding whether
 * to spend money on a stranger's template deserves to see the shape of the
 * work first, and what a run will cost.
 */
export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [duplicated, setDuplicated] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<TemplateDetail>(`/templates/${id}`)
      .then(setTemplate)
      .catch((err) =>
        setError(err instanceof AppError ? err.message : "That template could not be opened."),
      );
  }, [id]);

  if (error) {
    return (
      <section style={{ maxWidth: 720 }}>
        <h1 className="h3">Template</h1>
        <div className="alert alert-warning" role="alert">{error}</div>
        <Link className="btn btn-outline-secondary" to="/templates">Back to templates</Link>
      </section>
    );
  }

  if (!template) return <p className="text-secondary">Loading…</p>;

  return (
    <section style={{ maxWidth: 720 }}>
      <p className="small mb-1"><Link to="/templates">Templates</Link></p>
      <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h1 className="h3 mb-1">{template.name}</h1>
          <p className="text-secondary mb-2">{template.description ?? "No description."}</p>
        </div>
        {template.estimatedCostSen !== null && (
          <div className="text-end">
            <div className="small text-secondary">A run costs about</div>
            <div className="fs-4">{formatMYR(template.estimatedCostSen)}</div>
          </div>
        )}
      </div>

      <p className="small text-secondary">
        Version {template.version} · used {template.usageCount} time{template.usageCount === 1 ? "" : "s"}
        {template.category && ` · ${template.category}`}
        {template.visibility === "public" && <span className="badge text-bg-secondary ms-2">Public</span>}
        {template.mine && <span className="badge text-bg-secondary ms-2">Yours</span>}
      </p>

      {template.tags.length > 0 && (
        <p className="mb-3">
          {template.tags.map((tag) => (
            <span className="badge text-bg-light border me-1" key={tag}>{tag}</span>
          ))}
        </p>
      )}

      <div className="d-flex gap-2 mb-4 flex-wrap">
        <button className="btn btn-primary" type="button" onClick={() => setRunning(true)}>
          Use template
        </button>
        {!template.mine && (
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={async () => {
              await api(`/templates/${template.id}/duplicate`, { method: "POST" });
              setDuplicated(true);
            }}
          >
            {duplicated ? "Copied to your templates" : "Duplicate"}
          </button>
        )}
        <button
          className="btn btn-outline-secondary"
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              // Clipboard access can be refused. The address bar still has it.
              setCopied(false);
            }
          }}
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>

      <h2 className="h6">What it does</h2>
      {template.steps.length === 0 ? (
        <p className="text-secondary small">This template has no steps to show.</p>
      ) : (
        <ol className="list-group list-group-numbered mb-4">
          {template.steps.map((step, index) => (
            <li className="list-group-item d-flex justify-content-between align-items-start gap-2" key={`${step.type}-${index}`}>
              <span>{step.label}</span>
              {step.modelId && <span className="badge text-bg-light border font-monospace">{step.modelId.split("/").pop()}</span>}
            </li>
          ))}
        </ol>
      )}

      <h2 className="h6">What it needs from you</h2>
      {!template.variables || template.variables.length === 0 ? (
        <p className="text-secondary small">Nothing. It runs as it is.</p>
      ) : (
        <ul className="list-group">
          {template.variables.map((variable) => (
            <li className="list-group-item d-flex justify-content-between gap-2" key={variable.name}>
              <span>
                {variable.label ?? variable.name}
                {variable.required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
              </span>
              <span className="small text-secondary">{variable.type}</span>
            </li>
          ))}
        </ul>
      )}

      {running && <UseTemplateDialog template={template} onClose={() => setRunning(false)} />}
    </section>
  );
}
