import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { assetUrl, isAssetHandle, type AssetHandleDTO, type GenerationDTO } from "../../lib/types";

export interface GenerationActionsProps {
  generation: GenerationDTO;
  onRegenerate?: () => void;
  /** Present when the caller can accept an image back as its own input. */
  onUseAsInput?: (asset: AssetHandleDTO) => void;
}

/**
 * What someone can do with a result (§101).
 *
 * Every one of these is about not starting over: run it again, carry it into
 * the next thing, keep it as a template, or open the graph that made it.
 */
export function GenerationActions(props: GenerationActionsProps) {
  const { generation } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const asset = Object.values(generation.outputs).find(isAssetHandle) ?? null;
  const isImage = asset?.mime.startsWith("image/") ?? false;

  async function openInCanvas() {
    setBusy("canvas");
    setError(null);
    try {
      // The exported graph is imported as a new canvas, so editing it cannot
      // change what history says already happened (§118).
      const file = await api<{ name: string; document: unknown }>(`/generations/${generation.id}/workflow`);
      const created = await api<{ id: string }>("/workflows/import", {
        method: "POST",
        body: JSON.stringify({ ...file, name: `${file.name} (from a result)` }),
      });
      navigate(`/canvas/${created.id}`);
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That could not be opened.");
    } finally {
      setBusy(null);
    }
  }

  async function saveAsTemplate() {
    setBusy("template");
    setError(null);
    try {
      const file = await api<{ document: unknown }>(`/generations/${generation.id}/workflow`);
      await api("/templates", {
        method: "POST",
        body: JSON.stringify({
          name: generation.prompt.slice(0, 60) || "Saved from a result",
          description: `Saved from a result made with ${generation.modelId.split("/").pop()}.`,
          doc: file.document,
        }),
      });
      setNotice("Saved to your templates.");
    } catch (err) {
      setError(err instanceof AppError ? [err.message, err.action].filter(Boolean).join(" ") : "That could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {error && <div className="alert alert-danger py-2 small mt-2" role="alert">{error}</div>}
      {notice && <div className="alert alert-success py-2 small mt-2" role="status">{notice}</div>}

      <div className="d-flex flex-wrap gap-2 mt-3">
        {props.onRegenerate && (
          <button className="btn btn-sm btn-outline-primary" type="button" onClick={props.onRegenerate}>
            Regenerate
          </button>
        )}

        {isImage && props.onUseAsInput && asset && (
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => props.onUseAsInput!(asset)}>
            Use as input
          </button>
        )}

        {generation.workflowRunId && (
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={openInCanvas} disabled={busy !== null}>
            {busy === "canvas" ? "Opening…" : "Open in Canvas"}
          </button>
        )}

        {generation.workflowRunId && (
          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={saveAsTemplate} disabled={busy !== null}>
            {busy === "template" ? "Saving…" : "Save as template"}
          </button>
        )}

        {asset && (
          <a className="btn btn-sm btn-outline-secondary" href={assetUrl(asset)} download>
            Download
          </a>
        )}
      </div>
    </>
  );
}
