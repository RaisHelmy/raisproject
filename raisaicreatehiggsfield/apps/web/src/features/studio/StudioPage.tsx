import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import type { GenerationDTO, ModelDTO } from "../../lib/types";
import { CostEstimate } from "../../components/CostEstimate";
import { EmptyState } from "../../components/EmptyState";
import { ModelSelector } from "../models/ModelSelector";
import { ParameterControls } from "../models/ParameterControls";
import { GenerationResult } from "../generate/GenerationResult";
import { InsufficientBalance } from "../generate/InsufficientBalance";
import { AssetPicker } from "../assets/AssetPicker";
import { useBalance } from "../billing/useBalance";
import { useAuth } from "../auth/AuthContext";
import { MaskPainter } from "./MaskPainter";
import type { PortDef } from "../canvas/types";

export interface StudioSummary {
  type: string;
  label: string;
  description: string;
  task?: string;
  requiredCapabilities: string[];
  inputs: PortDef[];
  outputs: PortDef[];
  availableModels: number;
}

const ICONS: Record<string, string> = {
  "ai.image": "image", "ai.image.edit": "pencil-square", "ai.inpaint": "brush", "ai.upscale": "arrows-angle-expand",
  "ai.video": "film", "ai.video.from-image": "play-btn", "ai.video.upscale": "badge-hd", "ai.motion": "person-video3",
  "ai.speech": "chat-quote", "ai.transcribe": "badge-cc", "ai.describe": "eye", "ai.music": "music-note-beamed", "ai.text": "pencil",
};

export function studioIcon(type: string): string {
  return ICONS[type] ?? "stars";
}

/**
 * One page per studio preset (§12, §13): the same form for every studio,
 * built from the preset's ports. A prompt port becomes a textarea, an image
 * port a picker, a mask port a painter over the chosen image, a video or
 * audio port a picker of that kind. The model is auto-picked unless the
 * person opens the selector, and the controls follow the chosen model (§9).
 */
export function StudioPage() {
  const { type = "" } = useParams<{ type: string }>();
  const { user } = useAuth();
  const { balance, refresh: refreshBalance } = useBalance(true);

  const [studios, setStudios] = useState<StudioSummary[] | null>(null);
  const studio = useMemo(() => studios?.find((s) => s.type === type) ?? null, [studios, type]);

  const [models, setModels] = useState<ModelDTO[]>([]);
  const [modelId, setModelId] = useState<string>("");
  const [chooseModel, setChooseModel] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [imageAssetIds, setImageAssetIds] = useState<string[]>([]);
  const [maskAssetId, setMaskAssetId] = useState<string | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<string[]>([]);
  const [audioAssetId, setAudioAssetId] = useState<string[]>([]);
  const [advanced, setAdvanced] = useState(false);

  const [estimate, setEstimate] = useState<{ sen: number | null; approximate: boolean; errors: string[] }>({ sen: null, approximate: false, errors: [] });
  const [estimating, setEstimating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ generation: GenerationDTO; balanceAfterSen: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shortfall, setShortfall] = useState<{ estimatedSen: number; availableSen: number } | null>(null);

  useEffect(() => {
    api<{ items: StudioSummary[] }>("/studios").then((r) => setStudios(r.items)).catch(() => setStudios([]));
  }, []);

  // Reset the form when the studio changes: the ports are different.
  useEffect(() => {
    setPrompt(""); setParameters({}); setImageAssetIds([]); setMaskAssetId(null);
    setVideoAssetId([]); setAudioAssetId([]); setModelId(""); setChooseModel(false); setResult(null); setError(null);
  }, [type]);

  useEffect(() => {
    if (!studio) return;
    const params = new URLSearchParams();
    // Capabilities only: the preset picks by capability at run time, so the
    // selector must offer the same models the auto choice would consider.
    for (const c of studio.requiredCapabilities) params.append("capability", c);
    api<{ items: ModelDTO[] }>(`/models/compatible?${params}`).then((r) => setModels(r.items)).catch(() => setModels([]));
  }, [studio]);

  const model = useMemo(() => models.find((m) => m.id === modelId) ?? null, [models, modelId]);
  useEffect(() => {
    if (!model) { setParameters({}); return; }
    const defaults: Record<string, unknown> = {};
    for (const param of model.parameters) if (param.default !== undefined) defaults[param.name] = param.default;
    setParameters(defaults);
  }, [model?.id]);

  const ports = useMemo(() => new Set((studio?.inputs ?? []).map((p) => p.name)), [studio]);
  const promptPort = studio?.inputs.find((p) => p.name === "prompt");
  const imagesPort = studio?.inputs.find((p) => p.name === "images");
  // Start-and-end-frame models take exactly two pictures (first, last); the
  // picker numbers them so the order is visible.
  const maxImages = model?.limits.maxReferenceImages
    ?? (model?.capabilities.includes("start-end-frame") ? 2 : model?.capabilities.includes("multiple-images") ? 4 : imagesPort?.type === "image[]" ? 4 : 1);
  const imagesLabel = model?.capabilities.includes("start-end-frame") ? "Start and end frames (first, last)" : imagesPort?.label;

  const body = useMemo(() => ({
    prompt: prompt || undefined,
    imageAssetIds: imageAssetIds.length > 0 ? imageAssetIds : undefined,
    maskAssetId: maskAssetId ?? undefined,
    videoAssetId: videoAssetId[0],
    audioAssetId: audioAssetId[0],
    modelId: modelId || undefined,
    parameters,
  }), [prompt, imageAssetIds, maskAssetId, videoAssetId, audioAssetId, modelId, parameters]);

  const ready = Boolean(studio) && (!ports.has("prompt") || prompt.trim().length > 0)
    && (!ports.has("images") || imageAssetIds.length > 0 || ports.has("prompt") && !studio?.requiredCapabilities.includes("image-input"))
    && (!ports.has("video") || videoAssetId.length > 0)
    && (!ports.has("audio") || audioAssetId.length > 0);

  const estimateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!studio || !ready) { setEstimate({ sen: null, approximate: false, errors: [] }); return; }
    if (estimateTimer.current) clearTimeout(estimateTimer.current);
    setEstimating(true);
    estimateTimer.current = setTimeout(() => {
      api<{ estimatedSen: number; approximate: boolean; errors: string[] }>(`/studios/${studio.type}/estimate`, { method: "POST", body: JSON.stringify(body) })
        .then((r) => setEstimate({ sen: r.errors.length > 0 ? null : r.estimatedSen, approximate: r.approximate, errors: r.errors }))
        .catch((err) => setEstimate({ sen: null, approximate: false, errors: [err instanceof AppError ? err.message : "Could not estimate."] }))
        .finally(() => setEstimating(false));
    }, 350);
    return () => { if (estimateTimer.current) clearTimeout(estimateTimer.current); };
  }, [studio, body, ready]);

  const generate = useCallback(async () => {
    if (!studio) return;
    setBusy(true); setError(null); setShortfall(null);
    try {
      const response = await api<{ generation: GenerationDTO; balanceAfterSen: number }>(`/studios/${studio.type}/run`, { method: "POST", body: JSON.stringify(body) });
      setResult(response);
      await refreshBalance();
    } catch (err) {
      if (err instanceof AppError && err.code === "insufficient_balance") {
        const details = err.details as { estimatedSen: number; availableSen: number } | undefined;
        setShortfall(details ?? { estimatedSen: estimate.sen ?? 0, availableSen: balance?.availableSen ?? 0 });
      } else {
        setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  }, [studio, body, estimate.sen, balance, refreshBalance]);

  if (studios === null) return <p className="text-secondary">Loading…</p>;
  if (!studio) {
    return (
      <section>
        <h1 className="h3 mb-3">Studio</h1>
        <EmptyState icon="question-circle" title="There is no studio by that name." action={<Link className="btn btn-primary" to="/create">Back to Create</Link>} />
      </section>
    );
  }

  const outputKind = studio.outputs[0]?.type ?? "any";
  const referenceImage = imageAssetIds[0];

  return (
    <section>
      <div className="d-flex align-items-center gap-2 mb-1">
        <i className={`bi bi-${studioIcon(studio.type)} fs-4`} aria-hidden="true" />
        <h1 className="h3 mb-0">{studio.label}</h1>
      </div>
      <p className="text-secondary mb-4">{studio.description}</p>

      {studio.availableModels === 0 && (
        <div className="alert alert-warning" role="alert">
          <strong>No enabled model can do this yet.</strong> The catalog has models with these capabilities
          ({studio.requiredCapabilities.join(", ")}), but none is enabled for customers.
          {user?.isAdmin ? <> Enable one under <Link to="/admin/models" className="alert-link">Admin → Models</Link>.</> : " Check back soon."}
        </div>
      )}

      <div className="row g-4">
        <div className="col-lg-7">
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); void generate(); }} noValidate>
            {promptPort && (
              <div className="mb-3">
                <label htmlFor="studio-prompt" className="form-label">{promptPort.label}</label>
                <textarea id="studio-prompt" className="form-control" rows={promptPort.type === "text" ? 5 : 3} value={prompt}
                  onChange={(e) => setPrompt(e.target.value)} placeholder={placeholderFor(studio.type)} required />
              </div>
            )}

            {imagesPort && (
              <AssetPicker selected={imageAssetIds} onChange={(ids) => { setImageAssetIds(ids); setMaskAssetId(null); }} max={maxImages} kind="image" label={imagesLabel} />
            )}

            {ports.has("mask") && (
              referenceImage
                ? <MaskPainter key={referenceImage} imageUrl={`/api/v1/assets/${referenceImage}/content`} maskAssetId={maskAssetId} onMask={setMaskAssetId} />
                : <p className="small text-secondary">Choose the image first, then paint the area to repaint.</p>
            )}

            {ports.has("video") && (
              <AssetPicker selected={videoAssetId} onChange={setVideoAssetId} max={1} kind="video" accept="video/*"
                label={studio.inputs.find((p) => p.name === "video")?.label ?? "Video"} />
            )}
            {ports.has("audio") && (
              <AssetPicker selected={audioAssetId} onChange={setAudioAssetId} max={1} kind="audio" accept="audio/*"
                label={studio.inputs.find((p) => p.name === "audio")?.label ?? "Audio"} />
            )}

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="form-label mb-0">Model</span>
                <button type="button" className="btn btn-sm btn-link p-0" onClick={() => { setChooseModel((v) => !v); if (chooseModel) setModelId(""); }}>
                  {chooseModel ? "Let the studio choose" : "Choose a model"}
                </button>
              </div>
              {!chooseModel && (
                <p className="small text-secondary mb-0">
                  Auto: the best enabled model for this job{studio.availableModels > 0 ? ` (${studio.availableModels} available)` : ""}.
                </p>
              )}
              {chooseModel && models.length > 0 && (
                <ModelSelector models={models} value={modelId || null} onChange={setModelId} requiredCapabilities={studio.requiredCapabilities} />
              )}
              {chooseModel && models.length === 0 && <p className="small text-secondary mb-0">No enabled model matches.</p>}
            </div>

            {model && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="form-label mb-0">Settings</span>
                  <div className="form-check form-switch">
                    <input id="studio-advanced" className="form-check-input" type="checkbox" role="switch" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
                    <label className="form-check-label small" htmlFor="studio-advanced">Advanced</label>
                  </div>
                </div>
                <ParameterControls model={model} values={parameters} advanced={advanced} onChange={(name, value) => setParameters((p) => ({ ...p, [name]: value }))} />
              </div>
            )}

            <div className="card">
              <div className="card-body">
                <CostEstimate sen={estimate.sen} approximate={estimate.approximate} loading={estimating} />
                {estimate.errors[0] && <p className="small text-warning mt-2 mb-0">{estimate.errors[0]}</p>}
                <button className="btn btn-primary w-100 mt-3" type="submit" disabled={busy || !ready || studio.availableModels === 0}>
                  {busy ? "Generating…" : ctaFor(outputKind)}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="col-lg-5">
          {shortfall && <InsufficientBalance estimatedSen={shortfall.estimatedSen} availableSen={shortfall.availableSen} onDismiss={() => setShortfall(null)} />}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          {busy && (
            <div className="card"><div className="card-body d-flex align-items-center gap-3">
              <output className="spinner-border spinner-border-sm" aria-label="Generating" /><span>Generating…</span>
            </div></div>
          )}
          {!busy && result && (
            <GenerationResult
              generation={result.generation}
              balanceAfterSen={result.balanceAfterSen}
              onRegenerate={generate}
              onUseAsInput={imagesPort ? (asset) => { setImageAssetIds([asset.assetId]); setMaskAssetId(null); setResult(null); } : undefined}
            />
          )}
          {!busy && !result && !shortfall && !error && (
            <div className="card bg-body-tertiary"><div className="card-body text-secondary small">
              <p className="mb-1">Your result will appear here.</p>
              <p className="mb-0">You are only charged for what you generate.</p>
            </div></div>
          )}
        </div>
      </div>
    </section>
  );
}

function placeholderFor(type: string): string {
  switch (type) {
    case "ai.image.edit": return "Make it dusk, keep the subject exactly as is";
    case "ai.inpaint": return "A violet sky with a crescent moon";
    case "ai.video.from-image": return "Slow push-in, rain on the window, neon reflections";
    case "ai.motion": return "Keep the character, follow the reference movement";
    case "ai.speech": return "Welcome to RaisAI Create.";
    case "ai.describe": return "What is in this picture?";
    case "ai.music": return "Slow synth pulse, distant piano, tension that never resolves";
    case "ai.text": return "Write a logline for a cyberpunk detective film set in Kuala Lumpur.";
    default: return "Describe what you want.";
  }
}

function ctaFor(outputKind: string): string {
  switch (outputKind) {
    case "image": return "Generate image";
    case "video": return "Generate video";
    case "audio": return "Generate audio";
    case "text": return "Run";
    default: return "Generate";
  }
}
