import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { CategoryDTO, DocumentDTO, KnowledgeBaseDTO, SourceDTO } from "@xuanzhi/shared-types";
import { api, ApiError } from "@/services/api";
import { useT, pickName } from "@/i18n";
import { Empty, Pager, Skeleton } from "@/components/ui";
import { SourceViewer } from "@/components/SourceDrawer";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { useToast } from "@/services/toast";

export default function KnowledgePage() {
  const { t, locale } = useT(); const toast = useToast();
  const [data, setData] = useState<{ items: DocumentDTO[]; total: number; categories: CategoryDTO[]; knowledge_bases: KnowledgeBaseDTO[] } | null>(null);
  const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [page, setPage] = useState(1);
  const [results, setResults] = useState<SourceDTO[] | null>(null); const [searching, setSearching] = useState(false); const [viewer, setViewer] = useState<SourceDTO | null>(null); const [upgrade, setUpgrade] = useState(false);
  useEffect(() => { api<typeof data>("/knowledge", { query: { category_id: cat, page, page_size: 24 } }).then((r) => setData(r.data)).catch(() => setData({ items: [], total: 0, categories: [], knowledge_bases: [] })); }, [cat, page]);
  const search = async () => {
    if (!q.trim()) { setResults(null); return; } setSearching(true);
    try { const catCode = data?.categories.find((c) => c.id === cat)?.code; const r = await api<SourceDTO[]>("/knowledge/search", { body: { query: q, category_codes: catCode ? [catCode] : [] } }); setResults(r.data); }
    catch (e) { if (e instanceof ApiError && e.code === "QUOTA_EXCEEDED") setUpgrade(true); else toast.error((e as Error).message); } finally { setSearching(false); }
  };
  return (
    <div className="xz-page">
      <h1 className="h2 mb-1">{t("knowledge.title")}</h1><p className="text-muted">{t("knowledge.subtitle")}</p>
      <div className="d-flex gap-2 flex-wrap mb-3">
        <div className="input-group" style={{ maxWidth: 520 }}><input className="form-control" placeholder={t("knowledge.search")} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} /><button className="btn btn-primary" onClick={search} disabled={searching}><i className="bi bi-search" /></button></div>
        <select className="form-select w-auto" value={cat} onChange={(e) => { setCat(e.target.value); setPage(1); }}><option value="">{t("knowledge.all")}</option>{data?.categories.map((c) => <option key={c.id} value={c.id}>{pickName(c, locale)}{c.document_count ? ` (${c.document_count})` : ""}</option>)}</select>
      </div>
      {results && (
        <section className="mb-4"><div className="d-flex align-items-center justify-content-between mb-2"><h2 className="h5 mb-0">{t("knowledge.results")} ({results.length})</h2><button className="btn btn-ghost btn-sm" onClick={() => setResults(null)}><i className="bi bi-x" /></button></div>
          {results.length === 0 ? <div className="text-muted">{t("knowledge.empty")}</div> : <div className="row g-2">{results.map((s) => <div key={s.id} className="col-md-6"><div className="card p-3 h-100 card-hover" role="button" onClick={() => setViewer(s)}><div className="fw-medium">《{s.document_title}》 <span className="text-faint fs-13">{s.section ?? ""}{s.page_number ? ` · p.${s.page_number}` : ""}</span></div><div className="fs-14 text-muted mt-1">{s.excerpt}</div><div className="mt-2 d-flex gap-2"><span className="badge badge-soft">{t(`sources.type.${s.source_type}` as never)}</span><Link to={`/app/chat?q=${encodeURIComponent(q)}`} className="btn btn-link btn-sm p-0 ms-auto" onClick={(e) => e.stopPropagation()}>{t("knowledge.ask")}</Link></div></div></div>)}</div>}
        </section>
      )}
      <h2 className="h5 mb-2">{t("knowledge.documents")} {data && <span className="text-faint fs-14">({data.total})</span>}</h2>
      {!data ? <div className="row g-3">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="col-md-6 col-lg-4"><Skeleton h={120} /></div>)}</div>
        : !data.items.length ? <Empty icon="bi-journal-x" title={t("knowledge.empty")} />
        : <div className="row g-3">{data.items.map((d) => (
          <div key={d.id} className="col-md-6 col-lg-4"><Link to={`/app/knowledge/${d.id}`} className="card card-hover h-100 p-3 text-decoration-none"><div className="fw-medium serif">《{d.title}》</div><div className="text-muted fs-13 mt-1">{[d.author, d.category_name].filter(Boolean).join(" · ")}</div><div className="mt-2 d-flex gap-1 flex-wrap"><span className="badge badge-soft">{t(`sources.type.${d.source_type}` as never)}</span>{d.is_demo && <span className="badge badge-soft">{t("knowledge.demo")}</span>}<span className="badge badge-soft">{d.chunk_count} {t("knowledge.chunks")}</span></div></Link></div>
        ))}</div>}
      {data && <Pager page={page} pageSize={24} total={data.total} onPage={setPage} />}
      <SourceViewer source={viewer} onClose={() => setViewer(null)} />
      <UpgradeDialog open={upgrade} onClose={() => setUpgrade(false)} requiredPlan="plus" reason={t("upgrade.quota")} />
    </div>
  );
}
