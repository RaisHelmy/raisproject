import { useEffect, useRef, useState } from "react";
import { PageHeader, EmptyState, ErrorState, StatusBadge, ConfirmationDialog } from "../ux/components";
import { api } from "../lib/api";

interface Doc {
  id: string;
  name: string;
  category: string;
  size: number;
  content_type: string;
  created_at: string;
}

const CATEGORIES = ["Identification", "Ownership", "Insurance & Takaful", "Wasiat", "General"];

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function Documents() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState("General");
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoadError(null);
    api
      .get<{ documents: Doc[] }>("/documents")
      .then((r) => setDocs(r.documents))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load documents."));
  };

  useEffect(load, []);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      await api.post("/documents", form);
      load();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed. Your existing documents are unaffected.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (doc: Doc) => {
    setToDelete(null);
    try {
      await api.del(`/documents/${doc.id}`);
      setDocs((d) => (d ? d.filter((x) => x.id !== doc.id) : d));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const header = (
    <PageHeader
      crumbs={[{ label: "Family", to: "/family" }, { label: "Documents" }]}
      eyebrow="Family"
      title="Important Documents"
      description="Securely store the documents your family would need — identification, ownership papers, insurance and takaful policies, your wasiat. Files are encrypted at rest and private to your account."
      actions={
        <>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", fontFamily: "inherit" }}
            aria-label="Document category"
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload Document"}
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </>
      }
    />
  );

  if (loadError) {
    return (
      <>
        {header}
        <div className="card">
          <ErrorState
            title="Unable to load your documents"
            dataSafety="Your files are safe — this is a loading problem, not a data problem."
            reason={loadError}
            actions={
              <button className="btn btn-primary" onClick={load}>
                Try Again
              </button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      {header}

      {uploadError && (
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <span aria-hidden>⚠️</span>
          <span>{uploadError}</span>
        </div>
      )}

      {docs === null ? (
        <p className="muted">Loading your documents…</p>
      ) : docs.length === 0 ? (
        <EmptyState
          icon="📁"
          title="No documents yet"
          body="This is your family's secure document vault. Start with the ones that matter most."
          steps={[
            "Choose a category — identification, ownership, insurance, wasiat",
            "Upload the file (up to 15 MB)",
            "Reference it from your legacy plan",
          ]}
          action={
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload Your First Document"}
            </button>
          }
        />
      ) : (
        <div className="card">
          <div className="card-title">Vault · {docs.length} file{docs.length === 1 ? "" : "s"}</div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="num">Size</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.name}</strong></td>
                    <td><StatusBadge tone="gray">{d.category}</StatusBadge></td>
                    <td className="num">{fmtSize(d.size)}</td>
                    <td>{d.created_at.slice(0, 10)}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <a className="btn btn-sm btn-secondary" href={`/api/documents/${d.id}`}>
                        Download
                      </a>{" "}
                      <button className="btn btn-sm btn-ghost" onClick={() => setToDelete(d)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={toDelete !== null}
        title={`Delete “${toDelete?.name}”?`}
        body="The file will be permanently removed from your vault. This cannot be undone."
        confirmLabel="Delete File"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </>
  );
}
