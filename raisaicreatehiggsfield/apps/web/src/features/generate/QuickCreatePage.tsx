import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import type { GenerationDTO, ModelDTO } from "../../lib/types";
import { CostEstimate } from "../../components/CostEstimate";
import { ModelSelector } from "../models/ModelSelector";
import { ParameterControls } from "../models/ParameterControls";
import { GenerationResult } from "./GenerationResult";
import { InsufficientBalance } from "./InsufficientBalance";
import { AssetPicker } from "../assets/AssetPicker";
import { useBalance } from "../billing/useBalance";

type Category = "image" | "video" | "audio" | "text";

const COPY: Record<Category, { title: string; lead: string; promptLabel: string; placeholder: string; cta: string }> = {
  image: { title: "Create an image", lead: "Describe what you want to see.", promptLabel: "Prompt", placeholder: "A rainy cyberpunk street in Kuala Lumpur, neon reflections", cta: "Generate image" },
  video: { title: "Create a video", lead: "Describe the shot, or start from an image.", promptLabel: "Prompt", placeholder: "A slow tracking shot through a night market", cta: "Generate video" },
  audio: { title: "Create audio", lead: "Type the words you want spoken.", promptLabel: "Text", placeholder: "Welcome to RaisAI Create.", cta: "Generate audio" },
  text: { title: "Write with AI", lead: "Ask for a script, a logline, or an idea.", promptLabel: "Prompt", placeholder: "Write a logline for a cyberpunk detective film set in Kuala Lumpur.", cta: "Generate text" },
};

export function QuickCreatePage(props: { category: Category }) {
  const copy = COPY[props.category];
  const { balance, refresh: refreshBalance } = useBalance(true);

  const [models, setModels] = useState<ModelDTO[] | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [imageAssetIds, setImageAssetIds] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);

  const [estimateSen, setEstimateSen] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ generation: GenerationDTO; balanceAfterSen: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{ estimatedSen: number; availableSen: number } | null>(null);

  const model = useMemo(() => models?.find((m) => m.id === modelId) ?? null, [models, modelId]);

  // Attaching a reference changes which models can serve the request, so the
  // selector filters on that capability rather than on any model id (§9, §91).
  const requiredCapabilities = useMemo(
    () => (imageAssetIds.length > 0 ? ["image-input"] : []),
    [imageAssetIds.length],
  );
  const referenceCapable = useMemo(
    () => (models ?? []).some((m) => m.capabilities.includes("image-input")),
    [models],
  );
  const maxReferences = model?.limits.maxReferenceImages ?? (model?.capabilities.includes("multiple-images") ? 4 : 1);

  useEffect(() => {
    setModels(null);
    setModelId(null);
    api<{ items: ModelDTO[] }>(`/models?category=${props.category}`)
      .then((r) => {
        setModels(r.items);
        setModelId(r.items.find((m) => m.tags.includes("recommended"))?.id ?? r.items[0]?.id ?? null);
      })
      .catch(() => setModels([]));
  }, [props.category]);

  // Parameters reset when the model changes, because they belong to that model.
  useEffect(() => {
    if (!model) return;
    const defaults: Record<string, unknown> = {};
    for (const param of model.parameters) if (param.default !== undefined) defaults[param.name] = param.default;
    setParameters(defaults);
  }, [model?.id]);

  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!modelId) return;
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    setEstimating(true);
    estimateTimer.current = setTimeout(() => {
      api<{ estimatedSen: number }>(`/models/${modelId}/estimate`, {
        method: "POST",
        body: JSON.stringify({ prompt, imageCount: imageAssetIds.length, ...numericParameters(parameters) }),
      })
        .then((r) => setEstimateSen(r.estimatedSen))
        .catch(() => setEstimateSen(null))
        .finally(() => setEstimating(false));
    }, 350);
    return () => {
      if (estimateTimer.current) clearTimeout(estimateTimer.current);
    };
  }, [modelId, prompt, parameters, imageAssetIds]);

  const generate = useCallback(async () => {
    if (!modelId) return;
    setBusy(true);
    setError(null);
    setShortfall(null);
    try {
      const response = await api<{ generation: GenerationDTO; balanceAfterSen: number }>("/generations", {
        method: "POST",
        body: JSON.stringify({ modelId, prompt, parameters, imageAssetIds }),
      });
      setResult(response);
      await refreshBalance();
    } catch (err) {
      if (err instanceof AppError && err.code === "insufficient_balance") {
        const details = err.details as { estimatedSen: number; availableSen: number } | undefined;
        setShortfall(details ?? { estimatedSen: estimateSen ?? 0, availableSen: balance?.availableSen ?? 0 });
      } else {
        setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }, [modelId, prompt, parameters, imageAssetIds, estimateSen, balance, refreshBalance]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await generate();
  }

  const promptTooLong = model?.limits.maxPromptChars !== undefined && prompt.length > model.limits.maxPromptChars;

  return (
    <section className="studio-page">
      <div className="studio-page-head">
        <div><p className="lp-eyebrow mb-2">{props.category} studio</p><h1 className="display-6 fw-bold mb-2">{copy.title}</h1><p className="text-secondary mb-0">{copy.lead} <span className="studio-secure"><i className="bi bi-shield-check me-1" />Private workspace</span></p></div>
        <div className="studio-page-actions"><button className="btn btn-outline-light" type="button" disabled title="Coming soon"><i className="bi bi-layers me-1" />Batch <span className="badge text-bg-warning ms-1">Soon</span></button><a className="btn btn-outline-light" href="#studio-history"><i className="bi bi-clock-history me-1" />History</a></div>
      </div>
      <div className="studio-ribbon mb-4"><i className="bi bi-stars me-2" /><span>Production preset</span><span className="text-secondary">Models, pricing and audit trail are visible before you run.</span><span className="ms-auto d-none d-md-inline">MYR billing · no hidden credits</span></div>

      <div className="row g-4">
        <div className="col-lg-7">
          <form onSubmit={onSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="prompt" className="form-label">{copy.promptLabel}</label>
              <textarea
                id="prompt"
                className={`form-control ${promptTooLong ? "is-invalid" : ""}`}
                rows={4}
                value={prompt}
                placeholder={copy.placeholder}
                onChange={(e) => setPrompt(e.target.value)}
                required
              />
              {model?.limits.maxPromptChars !== undefined && (
                <div className={`form-text ${promptTooLong ? "text-danger" : ""}`}>
                  {prompt.length} / {model.limits.maxPromptChars} characters
                </div>
              )}
            </div>

            {models === null && <p className="text-secondary">Loading models…</p>}
            {models !== null && models.length === 0 && (
              <p className="text-secondary">No models are available for this yet.</p>
            )}
            {/* Shown when a reference is usable, and whenever one is already
                chosen, so a selection can always be seen and removed. */}
            {(referenceCapable || imageAssetIds.length > 0) && (
              <AssetPicker
                selected={imageAssetIds}
                onChange={setImageAssetIds}
                max={model?.capabilities.includes("image-input") ? maxReferences : 1}
              />
            )}

            {models !== null && models.length > 0 && (
              <ModelSelector
                models={models}
                value={modelId}
                onChange={setModelId}
                requiredCapabilities={requiredCapabilities}
              />
            )}

            {model && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="form-label mb-0">Settings</span>
                  <div className="form-check form-switch">
                    <input
                      id="advanced-toggle"
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      checked={advanced}
                      onChange={(e) => setAdvanced(e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="advanced-toggle">Advanced</label>
                  </div>
                </div>
                <ParameterControls
                  model={model}
                  values={parameters}
                  advanced={advanced}
                  onChange={(name, value) => setParameters((p) => ({ ...p, [name]: value }))}
                />
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <CostEstimate sen={estimateSen} loading={estimating} />
                <button
                  className="btn btn-primary w-100 mt-3"
                  type="submit"
                  disabled={busy || !modelId || prompt.trim().length === 0 || promptTooLong}
                >
                  {busy ? "Generating…" : copy.cta}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="col-lg-5" id="studio-history">
          {shortfall && (
            <InsufficientBalance
              estimatedSen={shortfall.estimatedSen}
              availableSen={shortfall.availableSen}
              onDismiss={() => setShortfall(null)}
            />
          )}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {busy && (
            <div className="card">
              <div className="card-body d-flex align-items-center gap-3">
                <output className="spinner-border spinner-border-sm" aria-label="Generating" />
                <span>Generating…</span>
              </div>
            </div>
          )}
          {!busy && result && (
            <GenerationResult
              generation={result.generation}
              balanceAfterSen={result.balanceAfterSen}
              onRegenerate={generate}
              // Offered only when some model here can actually take an image:
              // an action that leads nowhere is worse than no action (§74).
              onUseAsInput={
                referenceCapable
                  ? (asset) => {
                      // Feeding a result back in is the loop the product is built
                      // around: create, review, modify, regenerate (§145).
                      setImageAssetIds([asset.assetId]);
                      setResult(null);
                    }
                  : undefined
              }
            />
          )}
          {!busy && !result && !shortfall && !error && (
            <div className="card bg-body-tertiary">
              <div className="card-body text-secondary small">
                <p className="mb-1">Your result will appear here.</p>
                <p className="mb-0">You are only charged for what you generate.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Sends only the parameters the estimate endpoint understands. */
function numericParameters(parameters: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of ["width", "height", "steps", "maxTokens", "durationSeconds", "resolution", "aspectRatio"]) {
    if (parameters[key] !== undefined) out[key] = parameters[key];
  }
  if (parameters.duration !== undefined) out.durationSeconds = parameters.duration;
  return out;
}
