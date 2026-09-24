import { useState } from "react";
import type { MessageDTO, SourceDTO } from "@xuanzhi/shared-types";
import { Markdown } from "./Markdown";
import { useT } from "@/i18n";

export interface MessageItemProps {
  m: MessageDTO; streaming?: boolean; status?: "thinking" | "searching" | "generating" | null; isLast: boolean; modelName?: string;
  onCite: (s: SourceDTO) => void; onSources: (s: SourceDTO[]) => void; onCopy: (text: string) => void; onRegenerate: (m: MessageDTO) => void; onEdit: (m: MessageDTO, text: string) => void;
  onFeedback: (m: MessageDTO, v: -1 | 0 | 1) => void; onBookmark: (m: MessageDTO) => void; onSuggest: (q: string) => void; readOnly?: boolean;
}

export function MessageItem(p: MessageItemProps) {
  const { t } = useT(); const m = p.m; const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(m.content); const [copied, setCopied] = useState(false);
  if (m.role === "user") {
    return (
      <div className="xz-msg user">
        <div style={{ maxWidth: "80%" }}>
          {editing ? (
            <div className="card p-2"><textarea className="form-control mb-2" rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus /><div className="d-flex gap-2 justify-content-end"><button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t("chat.cancel")}</button><button className="btn btn-primary btn-sm" onClick={() => { setEditing(false); p.onEdit(m, draft); }}>{t("chat.save")}</button></div></div>
          ) : (<>
            <div className="bubble">{m.content}</div>
            {m.attachments.length > 0 && <div className="d-flex flex-wrap gap-1 mt-1 justify-content-end">{m.attachments.map((a) => <span key={a.id} className="xz-chip"><i className="bi bi-paperclip" />{a.filename}</span>)}</div>}
            {!p.readOnly && <div className="xz-actions justify-content-end"><button className="btn btn-ghost" title={t("chat.edit")} onClick={() => { setDraft(m.content); setEditing(true); }}><i className="bi bi-pencil" /></button><button className="btn btn-ghost" title={t("chat.copy")} onClick={() => p.onCopy(m.content)}><i className="bi bi-clipboard" /></button></div>}
          </>)}
        </div>
      </div>
    );
  }
  const showStatus = p.streaming && !m.content && p.status;
  return (
    <div className="xz-msg assistant">
      <span className="avatar zh" style={{ background: "var(--xz-cinnabar-soft)", color: "var(--xz-cinnabar)" }}>玄</span>
      <div className="body">
        {showStatus ? <div className="xz-status"><span className="dot" />{p.status === "searching" ? t("chat.searching") : t("chat.thinking")}</div>
          : <Markdown text={m.content} sources={m.sources} onCite={p.onCite} streaming={p.streaming} />}
        {m.status === "error" && <div className="alert alert-warning fs-14 py-2 mt-2 d-flex align-items-center gap-2"><i className="bi bi-exclamation-triangle" />{m.error ?? t("chat.error")}{!p.readOnly && <button className="btn btn-link btn-sm p-0 ms-auto" onClick={() => p.onRegenerate(m)}>{t("chat.retry")}</button>}</div>}
        {m.status === "stopped" && <div className="text-faint fs-13 mt-1"><i className="bi bi-stop-circle me-1" />{t("chat.stopped")}</div>}
        {!p.streaming && (m.status === "complete" || m.status === "stopped") && (
          <div className="xz-actions align-items-center">
            {m.sources.length > 0 && <button className="btn btn-outline-primary me-1" onClick={() => p.onSources(m.sources)}><i className="bi bi-journal-text me-1" />{t("chat.sources")} ({m.sources.length})</button>}
            <button className="btn btn-ghost" title={copied ? t("chat.copied") : t("chat.copy")} onClick={() => { p.onCopy(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><i className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`} /></button>
            {!p.readOnly && <>
              <button className="btn btn-ghost" title={t("chat.regenerate")} onClick={() => p.onRegenerate(m)}><i className="bi bi-arrow-repeat" /></button>
              <button className={`btn btn-ghost ${m.is_bookmarked ? "text-warning" : ""}`} title={m.is_bookmarked ? t("chat.unbookmark") : t("chat.bookmark")} onClick={() => p.onBookmark(m)}><i className={`bi ${m.is_bookmarked ? "bi-bookmark-fill" : "bi-bookmark"}`} /></button>
              <button className={`btn btn-ghost ${m.feedback === 1 ? "text-success" : ""}`} title={t("chat.good")} onClick={() => p.onFeedback(m, m.feedback === 1 ? 0 : 1)}><i className={`bi ${m.feedback === 1 ? "bi-hand-thumbs-up-fill" : "bi-hand-thumbs-up"}`} /></button>
              <button className={`btn btn-ghost ${m.feedback === -1 ? "text-danger" : ""}`} title={t("chat.bad")} onClick={() => p.onFeedback(m, m.feedback === -1 ? 0 : -1)}><i className={`bi ${m.feedback === -1 ? "bi-hand-thumbs-down-fill" : "bi-hand-thumbs-down"}`} /></button>
            </>}
            {p.modelName && <span className="text-faint fs-13 ms-2">{p.modelName}</span>}
          </div>
        )}
        {p.isLast && !p.streaming && !p.readOnly && m.suggestions.length > 0 && (
          <div className="mt-3"><div className="text-faint fs-13 mb-1">{t("chat.followups")}</div><div className="d-flex flex-column gap-1 align-items-start">{m.suggestions.map((s) => <button key={s} className="xz-followup" onClick={() => p.onSuggest(s)}><i className="bi bi-arrow-return-right me-2 text-faint" />{s}</button>)}</div></div>
        )}
      </div>
    </div>
  );
}
