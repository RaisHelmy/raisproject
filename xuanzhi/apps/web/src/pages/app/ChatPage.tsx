import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ConversationDTO, FileUploadDTO, MessageDTO, SourceDTO } from "@xuanzhi/shared-types";
import { api, ApiError } from "@/services/api";
import { streamChat } from "@/services/sse";
import { useAuth } from "@/services/auth";
import { useAppData } from "@/services/appdata";
import { useToast } from "@/services/toast";
import { useT, pickName } from "@/i18n";
import { Composer } from "@/components/Composer";
import { MessageItem } from "@/components/MessageItem";
import { Drawer } from "@/components/BottomSheet";
import { SourceList, SourceViewer } from "@/components/SourceDrawer";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { Skeleton } from "@/components/ui";
import { TOPICS } from "@/pages/marketing/LandingPage";

export default function ChatPage() {
  const { id } = useParams(); const nav = useNavigate(); const [sp, setSp] = useSearchParams();
  const { user, me, refresh: refreshMe } = useAuth(); const { models, modes, upsertConversation } = useAppData(); const toast = useToast(); const { t, locale } = useT();
  const [conversation, setConversation] = useState<ConversationDTO | null>(null);
  const [messages, setMessages] = useState<MessageDTO[]>([]); const [loading, setLoading] = useState(!!id);
  const [input, setInput] = useState(""); const [streaming, setStreaming] = useState(false); const [status, setStatus] = useState<"thinking" | "searching" | "generating" | null>(null);
  const [modelId, setModelId] = useState<string | null>(null); const [modeId, setModeId] = useState<string | null>(null); const [useKnowledge, setUseKnowledge] = useState(true);
  const [attachments, setAttachments] = useState<FileUploadDTO[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState<SourceDTO[] | null>(null); const [viewer, setViewer] = useState<SourceDTO | null>(null);
  const [upgrade, setUpgrade] = useState<{ plan: string | null; reason?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null); const bottomRef = useRef<HTMLDivElement>(null); const autoScroll = useRef(true);

  // Defaults from profile / query params.
  useEffect(() => { if (!id) { setModelId(user?.default_model_id ?? null); const mc = sp.get("mode_code"); const byCode = mc ? modes.find((m) => m.code === mc) : null; setModeId(sp.get("mode") ?? byCode?.id ?? user?.default_mode_id ?? null); } }, [id, user, modes, sp]);
  useEffect(() => { const q = sp.get("q"); if (q && !id) { setInput(q); const next = new URLSearchParams(sp); next.delete("q"); setSp(next, { replace: true }); } }, [sp, id, setSp]);

  // Load conversation.
  useEffect(() => {
    if (!id) { setConversation(null); setMessages([]); setAttachments([]); setLoading(false); return; }
    let live = true; setLoading(true);
    api<{ conversation: ConversationDTO; messages: MessageDTO[] }>(`/conversations/${id}`).then((r) => { if (!live) return; setConversation(r.data.conversation); setMessages(r.data.messages); setModelId(r.data.conversation.model_id); setModeId(r.data.conversation.mode_id); setUseKnowledge(r.data.conversation.use_knowledge); })
      .catch(() => { toast.error(t("common.error")); nav("/app/chat"); }).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [id, nav, toast, t]);

  useEffect(() => { if (autoScroll.current) bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages, status]);

  const send = useCallback(async (text: string, opts: { regenerate?: MessageDTO; edit?: MessageDTO } = {}) => {
    if (streaming) return;
    const content = text.trim(); if (!content && !opts.regenerate) return;
    const ctrl = new AbortController(); abortRef.current = ctrl; setStreaming(true); setStatus("thinking"); autoScroll.current = true;
    const ready = attachments.filter((a) => a.status === "ready");
    // Optimistic local state
    setMessages((prev) => {
      let list = prev;
      if (opts.regenerate) list = prev.filter((m) => m.sequence < opts.regenerate!.sequence);
      else if (opts.edit) list = prev.filter((m) => m.sequence <= opts.edit!.sequence).map((m) => (m.id === opts.edit!.id ? { ...m, content } : m));
      else list = [...prev, { id: "tmp-user", conversation_id: id ?? "", role: "user", content, status: "complete", model_id: null, mode_id: null, request_tokens: 0, response_tokens: 0, feedback: 0, is_bookmarked: false, parent_message_id: null, sequence: (prev[prev.length - 1]?.sequence ?? 0) + 1, suggestions: [], sources: [], attachments: ready.map((a) => ({ id: a.id, filename: a.filename })), error: null, created_at: new Date().toISOString() }];
      return [...list, { id: "tmp-assistant", conversation_id: id ?? "", role: "assistant", content: "", status: "streaming", model_id: modelId, mode_id: modeId, request_tokens: 0, response_tokens: 0, feedback: 0, is_bookmarked: false, parent_message_id: null, sequence: (list[list.length - 1]?.sequence ?? 0) + 1, suggestions: [], sources: [], attachments: [], error: null, created_at: new Date().toISOString() }];
    });
    setInput(""); setAttachments([]);
    let assistantId = "tmp-assistant"; let convId = id ?? null;
    try {
      await streamChat({ conversation_id: convId, content: opts.regenerate ? "regenerate" : content, model_id: modelId, mode_id: modeId, use_knowledge: useKnowledge, upload_ids: ready.map((a) => a.id), regenerate_message_id: opts.regenerate?.id ?? null, edit_message_id: opts.edit?.id ?? null }, (e) => {
        if (e.type === "meta") {
          convId = e.conversation_id; assistantId = e.assistant_message_id;
          setMessages((prev) => prev.map((m) => (m.id === "tmp-user" ? { ...m, id: e.user_message_id, conversation_id: e.conversation_id } : m.id === "tmp-assistant" ? { ...m, id: e.assistant_message_id, conversation_id: e.conversation_id, model_id: e.model_id } : m)));
          if (!id) { window.history.replaceState(null, "", `/app/chat/${e.conversation_id}`); }
          if (e.title) { const c: ConversationDTO = { id: e.conversation_id, title: e.title, model_id: e.model_id, mode_id: modeId, use_knowledge: useKnowledge, message_count: 1, last_message_at: new Date().toISOString(), is_archived: false, is_pinned: false, share_token: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; setConversation(c); upsertConversation(c); }
        } else if (e.type === "status") setStatus(e.status);
        else if (e.type === "sources") setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, sources: e.sources } : m)));
        else if (e.type === "token") { setStatus("generating"); setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + e.text } : m))); }
        else if (e.type === "done") { setMessages((prev) => prev.map((m) => (m.id === assistantId ? e.message : m))); if (convId) api<{ conversation: ConversationDTO }>(`/conversations/${convId}`).then((r) => { setConversation(r.data.conversation); upsertConversation(r.data.conversation); }).catch(() => undefined); void refreshMe(); }
        else if (e.type === "error") {
          const details = (e as { details?: { required_plan?: string | null } }).details;
          if (e.code === "UPGRADE_REQUIRED" || e.code === "QUOTA_EXCEEDED") setUpgrade({ plan: details?.required_plan ?? null, reason: e.message });
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: "error", error: e.message } : m)));
        }
      }, ctrl.signal);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "UPGRADE_REQUIRED" || e.code === "QUOTA_EXCEEDED")) setUpgrade({ plan: (e.details as { required_plan?: string })?.required_plan ?? null, reason: e.message });
      else toast.error((e as Error).message);
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, status: "error", error: (e as Error).message } : m)));
    } finally {
      setStreaming(false); setStatus(null); abortRef.current = null;
      if (!id && convId) nav(`/app/chat/${convId}`, { replace: true });
      setMessages((prev) => prev.map((m) => (m.id === assistantId && m.status === "streaming" ? { ...m, status: "stopped" } : m)));
    }
  }, [streaming, attachments, id, modelId, modeId, useKnowledge, upsertConversation, nav, toast, refreshMe]);

  const stop = () => abortRef.current?.abort();
  const patchMessage = async (m: MessageDTO, body: Record<string, unknown>) => { try { const r = await api<MessageDTO>(`/conversations/${m.conversation_id}/messages/${m.id}`, { method: "PATCH", body }); setMessages((prev) => prev.map((x) => (x.id === m.id ? r.data : x))); } catch (e) { toast.error((e as Error).message); } };
  const share = async () => { if (!conversation) return; try { const r = await api<{ url: string; conversation: ConversationDTO }>(`/conversations/${conversation.id}/share`, { body: {} }); await navigator.clipboard.writeText(r.data.url); setConversation(r.data.conversation); toast.success(t("chat.share_copied")); } catch (e) { toast.error((e as Error).message); } };
  const unshare = async () => { if (!conversation) return; await api(`/conversations/${conversation.id}/share`, { method: "DELETE" }); setConversation({ ...conversation, share_token: null }); };
  const modelName = (mid: string | null) => models.find((m) => m.id === mid)?.name;
  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const mode = modes.find((m) => m.id === modeId);

  return (
    <div className="d-flex flex-column h-100">
      <div className="xz-topbar d-none d-lg-flex">
        <div className="flex-grow-1 min-w-0 d-flex align-items-center gap-2">
          <span className="fw-medium text-truncate">{conversation?.title ?? t("chat.new")}</span>
          {mode && <span className="badge badge-soft"><i className={`bi ${mode.icon} me-1`} />{pickName(mode, locale)}</span>}
        </div>
        {conversation && <>
          {conversation.share_token ? <button className="btn btn-ghost btn-sm" onClick={unshare}><i className="bi bi-link-45deg me-1" />{t("chat.unshare")}</button> : <button className="btn btn-ghost btn-sm" onClick={share}><i className="bi bi-share me-1" />{t("chat.share")}</button>}
        </>}
        <span className="text-faint fs-13 ms-2">{me?.entitlements.plan.name}{me?.entitlements.messages_remaining_today !== null && me ? ` · ${me.entitlements.messages_remaining_today}` : ""}</span>
      </div>
      <div className="xz-content" onScroll={(e) => { const el = e.currentTarget; autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; }}>
        <div className="xz-thread">
          {loading ? <><Skeleton h={40} w="60%" className="mb-3 ms-auto" /><Skeleton h={16} className="mb-2" /><Skeleton h={16} w="90%" className="mb-2" /><Skeleton h={16} w="70%" /></>
            : !messages.length ? (
              <div className="xz-empty">
                <span className="xz-seal lg mb-3">玄</span>
                <h2 className="h3 mb-1">{t("chat.empty_title")}</h2><p className="text-muted">{t("chat.empty_body")}</p>
                <div className="row g-2 mt-3 text-start">{TOPICS.slice(0, 4).map((tp) => <div key={tp.key} className="col-6 col-md-3"><button className="xz-topic w-100 h-100" onClick={() => { const m = modes.find((x) => x.code === tp.mode); if (m && m.available !== false) setModeId(m.id); setInput(tp.q); }}><span className="zh">{tp.zh}</span><span className="fs-14 fw-medium">{t(tp.key)}</span><span className="text-faint fs-13">{tp.q}</span></button></div>)}</div>
              </div>
            ) : messages.map((m, i) => (
              <MessageItem key={m.id} m={m} isLast={m.id === lastAssistant?.id && i === messages.length - 1} streaming={streaming && m.role === "assistant" && i === messages.length - 1} status={status} modelName={modelName(m.model_id)}
                onCite={(s) => setViewer(s)} onSources={(s) => setSourcesOpen(s)} onCopy={(txt) => navigator.clipboard.writeText(txt).then(() => toast.success(t("chat.copied")))}
                onRegenerate={(msg) => send("", { regenerate: msg })} onEdit={(msg, txt) => send(txt, { edit: msg })} onFeedback={(msg, v) => patchMessage(msg, { feedback: v })} onBookmark={(msg) => patchMessage(msg, { is_bookmarked: !msg.is_bookmarked })} onSuggest={(q) => send(q)} />
            ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <Composer value={input} onChange={setInput} onSend={() => send(input)} onStop={stop} streaming={streaming} models={models} modes={modes} modelId={modelId} modeId={modeId} onModel={setModelId} onMode={setModeId}
        useKnowledge={useKnowledge} onKnowledge={setUseKnowledge} attachments={attachments} onAttachments={setAttachments} canUpload={!!me?.entitlements.can_upload_files} onLocked={(plan, reason) => setUpgrade({ plan, reason })} conversationId={id ?? null} autoFocus={!id} />
      <Drawer open={!!sourcesOpen} onClose={() => setSourcesOpen(null)} title={<span><i className="bi bi-journal-text me-2 text-faint" />{t("sources.title")} ({sourcesOpen?.length ?? 0})</span>}>{sourcesOpen && <SourceList sources={sourcesOpen} onOpen={(s) => { setSourcesOpen(null); setViewer(s); }} />}</Drawer>
      <SourceViewer source={viewer} onClose={() => setViewer(null)} />
      <UpgradeDialog open={!!upgrade} onClose={() => setUpgrade(null)} requiredPlan={upgrade?.plan ?? null} reason={upgrade?.reason} />
    </div>
  );
}
