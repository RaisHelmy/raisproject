import { useEffect, useRef, useState } from "react";
import { AppError } from "@raisai/shared";
import { withCsrf } from "../../lib/csrf";

/**
 * Paints an inpainting mask over an image. White strokes are the area to
 * repaint, everything else stays. The mask is exported at the image's own
 * pixel size, uploaded as an ordinary asset, and handed back by id — so the
 * inpaint studio sends it through the same port a canvas node would.
 */
export function MaskPainter(props: { imageUrl: string; maskAssetId: string | null; onMask: (assetId: string | null) => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [brush, setBrush] = useState(40);
  const [erasing, setErasing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, size.w, size.h); }
  }, [size]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  }

  function stroke(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !size) return;
    const { x, y } = point(e);
    const scale = size.w / (canvasRef.current?.getBoundingClientRect().width || size.w);
    ctx.fillStyle = erasing ? "#000" : "#fff";
    ctx.beginPath();
    ctx.arc(x, y, (brush / 2) * scale, 0, Math.PI * 2);
    ctx.fill();
    setDirty(true);
    props.onMask(null);
  }

  function clear() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !size) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size.w, size.h);
    setDirty(false);
    props.onMask(null);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new AppError("internal", "Could not export the mask.");
      const form = new FormData();
      form.append("file", new File([blob], "mask.png", { type: "image/png" }));
      const res = await fetch("/api/v1/assets", withCsrf({ method: "POST", body: form, credentials: "same-origin" }));
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new AppError("invalid_input", body?.error?.message ?? "The mask upload failed.");
      }
      const asset = (await res.json()) as { id: string };
      props.onMask(asset.id);
    } catch (err) {
      setError(err instanceof AppError ? err.message : "The mask upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <fieldset className="mb-3">
      <legend className="form-label fs-6">Mask <span className="text-secondary fw-normal small ms-2">paint the part to repaint</span></legend>
      {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}
      <div className="position-relative rounded overflow-hidden border" style={{ maxWidth: 560 }}>
        <img
          ref={imageRef}
          src={props.imageUrl}
          alt="Reference"
          className="d-block w-100"
          onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
        <canvas
          ref={canvasRef}
          className="position-absolute top-0 start-0 w-100 h-100"
          style={{ opacity: 0.55, mixBlendMode: "screen", cursor: "crosshair", touchAction: "none" }}
          aria-label="Mask painting surface"
          onPointerDown={(e) => { drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); stroke(e); }}
          onPointerMove={(e) => { if (drawing.current) stroke(e); }}
          onPointerUp={() => { drawing.current = false; }}
          onPointerLeave={() => { drawing.current = false; }}
        />
      </div>
      <div className="d-flex flex-wrap align-items-center gap-3 mt-2">
        <label className="small d-flex align-items-center gap-2 mb-0">
          Brush
          <input type="range" min={6} max={160} value={brush} onChange={(e) => setBrush(Number(e.target.value))} aria-label="Brush size" />
        </label>
        <div className="btn-group btn-group-sm" role="group" aria-label="Tool">
          <button type="button" className={`btn ${erasing ? "btn-outline-secondary" : "btn-secondary"}`} onClick={() => setErasing(false)} aria-pressed={!erasing}>Paint</button>
          <button type="button" className={`btn ${erasing ? "btn-secondary" : "btn-outline-secondary"}`} onClick={() => setErasing(true)} aria-pressed={erasing}>Erase</button>
        </div>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clear} disabled={!dirty}>Clear</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void save()} disabled={!dirty || uploading || Boolean(props.maskAssetId)}>
          {props.maskAssetId ? "Mask ready" : uploading ? "Saving…" : "Use this mask"}
        </button>
      </div>
      {!props.maskAssetId && dirty && <p className="small text-secondary mt-1 mb-0">Press “Use this mask” before generating.</p>}
    </fieldset>
  );
}
