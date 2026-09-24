import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ConversationDTO } from "@xuanzhi/shared-types";
import { useAppData } from "@/services/appdata";
import { api } from "@/services/api";
import { useT } from "@/i18n";
import { useToast } from "@/services/toast";
import { Confirm, Modal, Skeleton } from "./ui";

export function Sidebar({ onRefresh }: { onRefresh: () => void }) {
  const { conversations, loadingConversations, upsertConversation, removeConversation, refreshConversations } = useAppData();
  const { t } = useT(); const nav = useNavigate(); const { id } = useParams(); const toast = useToast();
  const [search, setSearch] = useState(""); const [archived, setArchived] = useState(false);
  const [rename, setRename] = useState<ConversationDTO | null>(null); const [title, setTitle] = useState(""); const [del, setDel] = useState<ConversationDTO | null>(null);
  const patch = async (c: ConversationDTO, body: Partial<ConversationDTO>) => { try { const r = await api<ConversationDTO>(`/conversations/${c.id}`, { method: "PATCH", body }); if (body.is_archived !== undefined) removeConversation(c.id); else upsertConversation(r.data); } catch (e) { toast.error((e as Error).message); } };
  const doSearch = (v: string) => { setSearch(v); void refreshConversations(v || undefined, archived); };
  return (
    <>
      <div className="px-2 pb-1 d-flex gap-1"><input className="form-control form-control-sm" placeholder={t("chat.search_chats")} value={search} onChange={(e) => doSearch(e.target.value)} /><button className={`btn btn-sm ${archived ? "btn-outline-primary" : "btn-ghost"}`} title={t("chat.archived")} onClick={() => { const a = !archived; setArchived(a); void refreshConversations(search || undefined, a); }}><i className="bi bi-archive" /></button></div>
      <div className="list">
        {loadingConversations && !conversations.length ? [1, 2, 3, 4].map((i) => <Skeleton key={i} h={30} className="mb-2" />)
          : !conversations.length ? <div className="text-faint fs-13 px-2 py-3">{t("chat.no_chats")}</div>
          : conversations.map((c) => (
            <div key={c.id} className={`xz-conv ${c.id === id ? "active" : ""}`} onClick={() => nav(`/app/chat/${c.id}`)}>
              {c.is_pinned && <i className="bi bi-pin-angle-fill text-faint fs-13" />}
              <span className="title">{c.title}</span>
              <div className="dropdown more" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-ghost btn-sm py-0 px-1" onClick={(e) => e.currentTarget.nextElementSibling?.classList.toggle("show")} onBlur={(e) => { const m = e.currentTarget.nextElementSibling; setTimeout(() => m?.classList.remove("show"), 150); }} aria-label="More"><i className="bi bi-three-dots" /></button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li><button className="dropdown-item" onClick={() => { setRename(c); setTitle(c.title); }}><i className="bi bi-pencil me-2" />{t("chat.rename")}</button></li>
                  <li><button className="dropdown-item" onClick={() => patch(c, { is_pinned: !c.is_pinned })}><i className="bi bi-pin-angle me-2" />{c.is_pinned ? t("chat.unpin") : t("chat.pin")}</button></li>
                  <li><button className="dropdown-item" onClick={() => patch(c, { is_archived: !c.is_archived })}><i className="bi bi-archive me-2" />{c.is_archived ? t("chat.unarchive") : t("chat.archive")}</button></li>
                  <li><button className="dropdown-item text-danger" onClick={() => setDel(c)}><i className="bi bi-trash me-2" />{t("chat.delete")}</button></li>
                </ul>
              </div>
            </div>
          ))}
      </div>
      <Modal open={!!rename} onClose={() => setRename(null)} title={t("chat.rename")} size="sm" footer={<><button className="btn btn-ghost btn-sm" onClick={() => setRename(null)}>{t("common.cancel")}</button><button className="btn btn-primary btn-sm" onClick={async () => { if (rename && title.trim()) { await patch(rename, { title: title.trim() }); setRename(null); onRefresh(); } }}>{t("common.save")}</button></>}>
        <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && rename && title.trim()) { void patch(rename, { title: title.trim() }); setRename(null); } }} autoFocus />
      </Modal>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title={t("chat.delete")} body={t("chat.delete_confirm")} onConfirm={async () => { if (!del) return; try { await api(`/conversations/${del.id}`, { method: "DELETE" }); removeConversation(del.id); if (del.id === id) nav("/app/chat"); } catch (e) { toast.error((e as Error).message); } }} />
    </>
  );
}
