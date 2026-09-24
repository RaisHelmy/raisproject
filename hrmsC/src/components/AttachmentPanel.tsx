import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Attachment } from "../types";

export function AttachmentPanel({
  module,
  recordId,
  canUpload,
}: {
  module: string;
  recordId: string;
  canUpload: boolean;
}) {
  const { auth } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function load() {
    api
      .get<{ attachments: Attachment[] }>(`/attachments?module=${module}&recordId=${recordId}`)
      .then((res) => setAttachments(res.attachments))
      .catch(() => {});
  }

  useEffect(load, [module, recordId]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module", module);
      formData.append("recordId", recordId);
      const res = await fetch("/api/attachments", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as { error?: string } | null)?.error ?? "Upload failed");
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this attachment?")) return;
    await api.delete(`/attachments/${id}`);
    load();
  }

  return (
    <div>
      {error && <div className="alert alert-danger py-1 small">{error}</div>}
      <ul className="list-group list-group-flush mb-2">
        {attachments.map((a) => (
          <li key={a.id} className="list-group-item d-flex justify-content-between align-items-center py-1 px-2">
            <a href={`/api/attachments/${a.id}/download`} target="_blank" rel="noreferrer">
              <i className="bi bi-paperclip me-1" />
              {a.file_name}
            </a>
            <div className="d-flex align-items-center gap-2">
              <span className="text-secondary small">{(a.size_bytes / 1024).toFixed(0)} KB</span>
              {(a.uploaded_by_user_id === auth?.userId || auth?.role === "admin" || auth?.role === "hr") && (
                <button className="btn btn-sm btn-link text-danger p-0" onClick={() => handleDelete(a.id)}>
                  <i className="bi bi-trash" />
                </button>
              )}
            </div>
          </li>
        ))}
        {attachments.length === 0 && (
          <li className="list-group-item text-secondary small py-1 px-2">No attachments</li>
        )}
      </ul>
      {canUpload && (
        <input type="file" className="form-control form-control-sm" onChange={handleUpload} disabled={uploading} />
      )}
    </div>
  );
}
