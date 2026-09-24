import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ChunkDTO, DocumentDTO, SourceDTO } from "@xuanzhi/shared-types";
import { Drawer } from "./BottomSheet";
import { api } from "@/services/api";
import { useT } from "@/i18n";
import { Skeleton } from "./ui";

export function SourceList({ sources, onOpen }: { sources: SourceDTO[]; onOpen: (s: SourceDTO) => void }) {
  const { t } = useT();
  return (
    <div>
      {sources.map((s) => (
        <div key={s.id} className="xz-source" onClick={() => onOpen(s)} role="button">
          <div className="d-flex align-items-start gap-1"><span className="label">{s.label}</span><div className="flex-grow-1"><div className="fw-medium">《{s.document_title}》</div><div className="text-muted fs-13">{[s.section, s.page_number ? `${t("sources.page")} ${s.page_number}` : null].filter(Boolean).join(" · ")}</div></div></div>
          <div className="fs-13 mt-1 text-muted" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.excerpt}</div>
          <div className="mt-1"><span className="badge badge-soft">{s.is_upload ? t("sources.upload") : t(`sources.type.${s.source_type}` as never)}</span></div>
        </div>
      ))}
    </div>
  );
}

function highlight(text: string, excerpt: string) {
  const probe = excerpt.replace(/…$/, "").slice(0, 80).trim();
  const i = probe ? text.indexOf(probe) : -1;
  if (i < 0) return <>{text}</>;
  const end = Math.min(text.length, i + Math.max(probe.length, Math.min(excerpt.length, 480)));
  return <>{text.slice(0, i)}<mark className="xz-hl">{text.slice(i, end)}</mark>{text.slice(end)}</>;
}

/** Source viewer: full passage with neighbours, relevant excerpt highlighted. */
export function SourceViewer({ source, onClose }: { source: SourceDTO | null; onClose: () => void }) {
  const { t, locale } = useT();
  const [data, setData] = useState<{ document: DocumentDTO; chunk: ChunkDTO; context: { id: string; chunk_index: number; content: string; page_number: number | null; section: string | null }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData(null); setError(null);
    if (!source || source.is_upload) return;
    api<typeof data>(`/knowledge/${source.document_id}/chunks/${source.chunk_id}`).then((r) => setData(r.data)).catch((e) => setError((e as Error).message));
  }, [source]);
  if (!source) return null;
  return (
    <Drawer open onClose={onClose} title={<span><i className="bi bi-journal-text me-2 text-faint" />{t("sources.viewer")}</span>}>
      <div className="mb-3">
        <div className="fw-semibold serif fs-5">《{source.document_title}》</div>
        <div className="text-muted fs-13">{[source.section ? `${t("sources.section")}: ${source.section}` : null, source.page_number ? `${t("sources.page")} ${source.page_number}` : null].filter(Boolean).join(" · ")}</div>
        <div className="mt-1"><span className="badge badge-soft">{source.is_upload ? t("sources.upload") : t(`sources.type.${source.source_type}` as never)}</span></div>
      </div>
      {source.is_upload ? (<div className="pre-wrap fs-14"><mark className="xz-hl">{source.excerpt}</mark></div>)
        : error ? (<div className="alert alert-warning fs-14">{error}</div>)
        : !data ? (<><Skeleton h={12} className="mb-2" /><Skeleton h={12} className="mb-2" /><Skeleton h={12} w="70%" /></>)
        : (
          <div className="fs-14 lh-lg">
            {data.context.map((c) => (
              <div key={c.id} className={`pre-wrap mb-3 ${c.id === data.chunk.id ? "" : "text-muted"}`}>
                {c.id === data.chunk.id ? highlight(c.content, source.excerpt) : c.content}
              </div>
            ))}
            <Link to={`/app/knowledge/${data.document.id}`} className="btn btn-outline-primary btn-sm mt-2">{t("sources.open")}</Link>
            {data.document.is_demo && <div className="text-faint fs-13 mt-2">{t("knowledge.demo")}</div>}
            <div className="text-faint fs-13 mt-1">{new Date(data.document.created_at).toLocaleDateString(locale)}</div>
          </div>
        )}
    </Drawer>
  );
}
