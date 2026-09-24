import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ChunkDTO, DocumentDTO } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useT } from "@/i18n";
import { Pager, Skeleton, fmtDate } from "@/components/ui";

export default function KnowledgeDocumentPage() {
  const { id } = useParams(); const { t, locale } = useT(); const [page, setPage] = useState(1);
  const [data, setData] = useState<{ document: DocumentDTO; chunks: ChunkDTO[]; total_chunks: number } | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { api<typeof data>(`/knowledge/${id}`, { query: { page, page_size: 20 } }).then((r) => setData(r.data)).catch((e) => setError((e as Error).message)); }, [id, page]);
  if (error) return <div className="xz-page"><div className="alert alert-warning">{error}</div><Link to="/app/knowledge">{t("common.back")}</Link></div>;
  if (!data) return <div className="xz-page"><Skeleton h={30} w="50%" className="mb-3" /><Skeleton h={14} className="mb-2" /><Skeleton h={14} w="80%" /></div>;
  const d = data.document;
  return (
    <div className="xz-page" style={{ maxWidth: 860 }}>
      <Link to="/app/knowledge" className="fs-14"><i className="bi bi-arrow-left me-1" />{t("nav.knowledge")}</Link>
      <h1 className="h2 mt-2 serif">《{d.title}》</h1>
      <div className="d-flex flex-wrap gap-2 align-items-center text-muted fs-14 mb-3">{d.author && <span>{d.author}</span>}{d.category_name && <span>· {d.category_name}</span>}{d.publication_date && <span>· {d.publication_date}</span>}<span>· {fmtDate(d.created_at, locale)}</span></div>
      <div className="d-flex flex-wrap gap-1 mb-4"><span className="badge badge-soft">{t(`sources.type.${d.source_type}` as never)}</span>{d.is_demo && <span className="badge badge-soft">{t("knowledge.demo")}</span>}{d.tags.map((x) => <span key={x} className="badge badge-soft">#{x}</span>)}<span className="badge badge-soft">{d.chunk_count} {t("knowledge.chunks")}</span></div>
      {d.source && <p className="text-muted fs-14">{d.source}</p>}
      <Link to={`/app/chat?q=${encodeURIComponent(`Tell me about 《${d.title}》`)}`} className="btn btn-outline-primary btn-sm mb-4"><i className="bi bi-chat-left-text me-1" />{t("knowledge.ask")}</Link>
      <h2 className="h5">{t("knowledge.chunks")}</h2>
      {data.chunks.map((c) => <div key={c.id} className="card p-3 mb-2"><div className="text-faint fs-13 mb-1">#{c.chunk_index + 1}{c.section ? ` · ${c.section}` : ""}{c.page_number ? ` · ${t("sources.page")} ${c.page_number}` : ""}</div><div className="pre-wrap fs-14 lh-lg">{c.content}</div></div>)}
      <Pager page={page} pageSize={20} total={data.total_chunks} onPage={setPage} />
    </div>
  );
}
