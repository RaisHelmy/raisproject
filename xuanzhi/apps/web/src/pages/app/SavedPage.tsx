import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MessageDTO, SourceDTO } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useT } from "@/i18n";
import { Empty, Pager, Skeleton } from "@/components/ui";
import { Markdown } from "@/components/Markdown";
import { SourceViewer } from "@/components/SourceDrawer";

export default function SavedPage() {
  const { t } = useT(); const [page, setPage] = useState(1); const [viewer, setViewer] = useState<SourceDTO | null>(null);
  const [data, setData] = useState<{ items: (MessageDTO & { conversation_title: string })[]; total: number } | null>(null);
  useEffect(() => { api<typeof data>("/account/saved", { query: { page, page_size: 20 } }).then((r) => setData(r.data)).catch(() => setData({ items: [], total: 0 })); }, [page]);
  const unbookmark = async (m: MessageDTO) => { await api(`/conversations/${m.conversation_id}/messages/${m.id}`, { method: "PATCH", body: { is_bookmarked: false } }); setData((d) => d && { ...d, items: d.items.filter((x) => x.id !== m.id), total: d.total - 1 }); };
  return (
    <div className="xz-page" style={{ maxWidth: 860 }}>
      <h1 className="h2 mb-1">{t("saved.title")}</h1><p className="text-muted">{t("saved.subtitle")}</p>
      {!data ? <><Skeleton h={100} className="mb-3" /><Skeleton h={100} /></> : !data.items.length ? <Empty icon="bi-bookmark" title={t("saved.empty")} /> : data.items.map((m) => (
        <div key={m.id} className="card p-3 mb-3">
          <div className="d-flex align-items-center gap-2 mb-2"><Link to={`/app/chat/${m.conversation_id}`} className="fw-medium text-truncate">{m.conversation_title}</Link><span className="text-faint fs-13 ms-auto">{new Date(m.created_at).toLocaleDateString()}</span><button className="btn btn-ghost btn-sm" title={t("chat.unbookmark")} onClick={() => unbookmark(m)}><i className="bi bi-bookmark-x" /></button></div>
          <Markdown text={m.content} sources={m.sources} onCite={setViewer} />
        </div>
      ))}
      {data && <Pager page={page} pageSize={20} total={data.total} onPage={setPage} />}
      <SourceViewer source={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
