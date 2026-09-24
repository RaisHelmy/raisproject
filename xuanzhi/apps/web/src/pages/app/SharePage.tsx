import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { MessageDTO, SourceDTO } from "@xuanzhi/shared-types";
import { api } from "@/services/api";
import { useT } from "@/i18n";
import { MessageItem } from "@/components/MessageItem";
import { Drawer } from "@/components/BottomSheet";
import { SourceList } from "@/components/SourceDrawer";
import { Skeleton } from "@/components/ui";

export default function SharePage() {
  const { token } = useParams(); const { t } = useT();
  const [data, setData] = useState<{ title: string; model_name: string | null; messages: MessageDTO[] } | null>(null); const [error, setError] = useState<string | null>(null); const [sources, setSources] = useState<SourceDTO[] | null>(null);
  useEffect(() => { api<typeof data>(`/share/${token}`).then((r) => setData(r.data)).catch((e) => setError((e as Error).message)); }, [token]);
  const noop = () => undefined;
  return (
    <div className="container py-4" style={{ maxWidth: 860 }}>
      <div className="text-faint fs-13 mb-1">{t("share.title")} · {t("share.by")}</div>
      {error ? <div className="alert alert-warning">{error}</div> : !data ? <Skeleton h={200} /> : (<>
        <h1 className="h3 mb-4">{data.title}</h1>
        {data.messages.map((m) => <MessageItem key={m.id} m={m} isLast={false} readOnly modelName={data.model_name ?? undefined} onCite={(s) => setSources([s])} onSources={setSources} onCopy={(x) => navigator.clipboard.writeText(x)} onRegenerate={noop} onEdit={noop} onFeedback={noop} onBookmark={noop} onSuggest={noop} />)}
        <div className="text-center mt-4"><Link to="/register" className="btn btn-primary">{t("share.try")}</Link></div>
      </>)}
      <Drawer open={!!sources} onClose={() => setSources(null)} title={t("sources.title")}>{sources && <SourceList sources={sources} onOpen={() => undefined} />}</Drawer>
    </div>
  );
}
