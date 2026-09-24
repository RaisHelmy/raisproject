import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { CategoryDTO, ChunkDTO, DocumentDTO } from "@xuanzhi/shared-types";
import { useLoad, PageHeader, StatusBadge } from "./_shared";
import { api } from "@/services/api";
import { useToast } from "@/services/toast";
import { Field, Pager, Skeleton } from "@/components/ui";
import { useT } from "@/i18n";

export default function DocumentPage() {
  const { id } = useParams(); const { t } = useT(); const toast = useToast(); const [page, setPage] = useState(1);
  const { data, reload } = useLoad<{ document: DocumentDTO; preview: string | null; chunks: ChunkDTO[]; total_chunks: number }>(`/admin/knowledge/${id}`, { page, page_size: 20 });
  const cats = useLoad<CategoryDTO[]>("/admin/knowledge/categories").data ?? [];
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => { if (data) setForm({ title: data.document.title, category_id: data.document.category_id ?? "", language: data.document.language, author: data.document.author ?? "", source: data.document.source ?? "", publication_date: data.document.publication_date ?? "", tags: data.document.tags.join(", "), source_type: data.document.source_type, visibility: data.document.visibility }); }, [data]);
  useEffect(() => { if (data && !["ready", "failed", "disabled"].includes(data.document.status)) { const h = setTimeout(reload, 2500); return () => clearTimeout(h); } }, [data, reload]);
  if (!data) return <Skeleton h={200} />;
  const d = data.document;
  const save = async () => { try { await api(`/admin/knowledge/${d.id}`, { method: "PUT", body: { ...form, category_id: form.category_id || null, author: form.author || null, source: form.source || null, publication_date: form.publication_date || null, tags: form.tags!.split(",").map((s) => s.trim()).filter(Boolean) } }); reload(); toast.success(t("profile.saved")); } catch (e) { toast.error((e as Error).message); } };
  return (
    <>
      <Link to="/admin/knowledge" className="fs-14"><i className="bi bi-arrow-left me-1" />{t("admin.knowledge")}</Link>
      <PageHeader title={d.title} subtitle={`${d.filename} · ${d.mime_type}`} actions={<><StatusBadge s={d.status} /><button className="btn btn-outline-secondary btn-sm" onClick={async () => { await api(`/admin/knowledge/${d.id}/reprocess`, { body: {} }); reload(); }}><i className="bi bi-arrow-repeat me-1" />Reprocess</button></>} />
      <div className="row g-3">
        <div className="col-lg-5"><div className="card p-3">
          <Field label="Title"><input className="form-control" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="row"><div className="col-6"><Field label="Category"><select className="form-select" value={form.category_id ?? ""} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><div className="col-6"><Field label="Source type"><select className="form-select" value={form.source_type ?? ""} onChange={(e) => setForm({ ...form, source_type: e.target.value })}>{["primary_classical", "scholarly", "historical", "modern_commentary", "community"].map((x) => <option key={x} value={x}>{x}</option>)}</select></Field></div></div>
          <div className="row"><div className="col-6"><Field label="Language"><select className="form-select" value={form.language ?? "en"} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">en</option><option value="zh-CN">zh-CN</option><option value="zh-TW">zh-TW</option><option value="other">other</option></select></Field></div><div className="col-6"><Field label="Visibility"><select className="form-select" value={form.visibility ?? ""} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>{["public", "premium", "private", "admin"].map((x) => <option key={x} value={x}>{x}</option>)}</select></Field></div></div>
          <div className="row"><div className="col-6"><Field label="Author"><input className="form-control" value={form.author ?? ""} onChange={(e) => setForm({ ...form, author: e.target.value })} /></Field></div><div className="col-6"><Field label="Publication date"><input className="form-control" value={form.publication_date ?? ""} onChange={(e) => setForm({ ...form, publication_date: e.target.value })} /></Field></div></div>
          <Field label="Source"><input className="form-control" value={form.source ?? ""} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field><Field label="Tags"><input className="form-control" value={form.tags ?? ""} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></Field>
          <button className="btn btn-primary" onClick={save}>{t("common.save")}</button>
        </div>
        <div className="card p-3 mt-3"><div className="fw-medium mb-2">Processing log</div><div className="fs-13">{d.processing_log.map((l, i) => <div key={i} className="d-flex gap-2 border-bottom py-1"><span className="text-faint text-nowrap">{new Date(l.at).toLocaleTimeString()}</span><span className="badge badge-soft">{l.step}</span><span>{l.message}</span></div>)}</div>{d.error && <div className="alert alert-danger fs-14 mt-2 mb-0">{d.error}</div>}<div className="text-muted fs-13 mt-2">Chunks {d.chunk_count} · Embedded {d.embedded_count} · Progress {d.progress}% · Weight {d.source_weight}</div></div></div>
        <div className="col-lg-7">
          {data.preview && <div className="card p-3 mb-3"><div className="fw-medium mb-2">Preview (extracted text)</div><div className="pre-wrap fs-13 text-muted" style={{ maxHeight: 220, overflow: "auto" }}>{data.preview}</div></div>}
          <div className="fw-medium mb-2">Chunks ({data.total_chunks})</div>
          {data.chunks.map((c) => <div key={c.id} className="card p-2 mb-2 fs-13"><div className="text-faint">#{c.chunk_index + 1} · {c.token_count} tokens{c.section ? ` · ${c.section}` : ""}{c.page_number ? ` · p.${c.page_number}` : ""}</div><div className="pre-wrap">{c.content}</div></div>)}
          <Pager page={page} pageSize={20} total={data.total_chunks} onPage={setPage} />
        </div>
      </div>
    </>
  );
}
