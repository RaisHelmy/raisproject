import { useEffect, useRef, useState } from "react";
import type { FileUploadDTO, ModeDTO, ModelDTO } from "@xuanzhi/shared-types";
import { useT } from "@/i18n";
import { ModelPicker, ModePicker } from "./Pickers";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { ApiError } from "@/services/api";

export interface ComposerProps {
  value: string; onChange: (v: string) => void; onSend: () => void; onStop: () => void; streaming: boolean; disabled?: boolean;
  models: ModelDTO[]; modes: ModeDTO[]; modelId: string | null; modeId: string | null; onModel: (id: string) => void; onMode: (id: string | null) => void;
  useKnowledge: boolean; onKnowledge: (v: boolean) => void; attachments: FileUploadDTO[]; onAttachments: (a: FileUploadDTO[]) => void; canUpload: boolean;
  onLocked: (requiredPlan: string | null, reason?: string) => void; conversationId: string | null; autoFocus?: boolean;
}

export function Composer(p: ComposerProps) {
  const { t } = useT(); const toast = useToast(); const ref = useRef<HTMLTextAreaElement>(null); const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(220, el.scrollHeight)}px`; }, [p.value]);
  useEffect(() => { if (p.autoFocus) ref.current?.focus(); }, [p.autoFocus]);
  // Poll attachments still processing.
  useEffect(() => {
    const pending = p.attachments.filter((a) => !["ready", "failed"].includes(a.status));
    if (!pending.length) return;
    const h = setTimeout(async () => { const updated = await Promise.all(p.attachments.map(async (a) => (["ready", "failed"].includes(a.status) ? a : (await api<FileUploadDTO>(`/files/${a.id}`)).data))); p.onAttachments(updated); }, 1500);
    return () => clearTimeout(h);
  }, [p.attachments, p]);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!p.canUpload) { p.onLocked("plus", t("chat.upload_hint")); return; }
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 3)) {
        const form = new FormData(); form.append("file", f); if (p.conversationId) form.append("conversation_id", p.conversationId);
        const r = await api<FileUploadDTO>("/files/upload", { form });
        p.onAttachments([...p.attachments, r.data]);
      }
    } catch (e) { if (e instanceof ApiError && e.code === "UPGRADE_REQUIRED") p.onLocked((e.details as { required_plan?: string })?.required_plan ?? null, e.message); else toast.error((e as Error).message); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const canSend = p.value.trim().length > 0 && !p.streaming && !p.disabled && p.attachments.every((a) => a.status === "ready" || a.status === "failed");
  return (
    <div className="xz-composer-wrap">
      <div className="xz-composer" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
        {p.attachments.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mb-2">
            {p.attachments.map((a) => <span key={a.id} className="xz-chip"><i className={`bi ${a.status === "ready" ? "bi-file-earmark-check" : a.status === "failed" ? "bi-file-earmark-x" : "bi-hourglass-split"}`} />{a.filename}<span className="text-faint">· {a.status === "ready" ? t("chat.attachment_ready") : a.status === "failed" ? t("chat.attachment_failed") : t("chat.attachment_processing")}</span><button className="btn btn-link p-0 text-reset" aria-label="Remove" onClick={() => p.onAttachments(p.attachments.filter((x) => x.id !== a.id))}><i className="bi bi-x" /></button></span>)}
          </div>
        )}
        <textarea ref={ref} rows={1} value={p.value} placeholder={t("chat.placeholder")} disabled={p.disabled} onChange={(e) => p.onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) p.onSend(); } }} />
        <div className="d-flex align-items-end gap-2 mt-1">
          <div className="tools flex-grow-1">
            <input ref={fileRef} type="file" hidden multiple accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => upload(e.target.files)} />
            <button type="button" className="btn btn-ghost" title={t("chat.upload_hint")} disabled={uploading} onClick={() => fileRef.current?.click()}><i className={`bi ${uploading ? "bi-hourglass-split" : "bi-plus-lg"} me-1`} />{t("chat.attach")}</button>
            <button type="button" className={`btn ${p.useKnowledge ? "btn-outline-primary" : "btn-ghost"}`} title={p.useKnowledge ? t("chat.knowledge_on") : t("chat.knowledge_off")} onClick={() => p.onKnowledge(!p.useKnowledge)}><i className={`bi ${p.useKnowledge ? "bi-journal-bookmark-fill" : "bi-journal-bookmark"} me-1`} />{t("chat.knowledge")}</button>
            <ModelPicker models={p.models} value={p.modelId} onChange={p.onModel} onLocked={(m) => p.onLocked(m.required_plan ?? null)} />
            <ModePicker modes={p.modes} value={p.modeId} onChange={p.onMode} onLocked={() => p.onLocked("pro")} />
            <button type="button" className="btn btn-ghost" title="Voice input (coming soon)" disabled><i className="bi bi-mic" /></button>
          </div>
          {p.streaming ? <button type="button" className="btn btn-outline-primary xz-send" title={t("chat.stop")} onClick={p.onStop}><i className="bi bi-stop-fill" /></button>
            : <button type="button" className="btn btn-primary xz-send" title={t("chat.send")} disabled={!canSend} onClick={p.onSend}><i className="bi bi-arrow-up" /></button>}
        </div>
      </div>
      <div className="text-center text-faint fs-13 mt-1">{t("chat.disclaimer")}</div>
    </div>
  );
}
