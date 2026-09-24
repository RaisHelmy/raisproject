import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { useT } from "@/i18n";

interface Hit { type: "conversation" | "message" | "document" | "topic" | "mode"; id: string; title: string; subtitle?: string; href: string }
const ICONS: Record<Hit["type"], string> = { conversation: "bi-chat-left-text", message: "bi-chat-quote", document: "bi-journal-text", topic: "bi-compass", mode: "bi-stars" };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT(); const nav = useNavigate();
  const [q, setQ] = useState(""); const [hits, setHits] = useState<Hit[]>([]); const [active, setActive] = useState(0); const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setHits([]); setTimeout(() => ref.current?.focus(), 30); } }, [open]);
  useEffect(() => {
    if (!open || !q.trim()) { setHits([]); return; }
    const h = setTimeout(() => { setLoading(true); api<Hit[]>("/account/search", { query: { q } }).then((r) => { setHits(r.data); setActive(0); }).catch(() => setHits([])).finally(() => setLoading(false)); }, 180);
    return () => clearTimeout(h);
  }, [q, open]);
  if (!open) return null;
  const go = (h: Hit) => { onClose(); nav(h.href); };
  return (
    <>
      <div className="xz-overlay" onClick={onClose} />
      <div className="xz-palette" role="dialog" aria-modal="true">
        <input ref={ref} value={q} placeholder={t("palette.placeholder")} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowDown") setActive((a) => Math.min(hits.length - 1, a + 1)); if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1)); if (e.key === "Enter" && hits[active]) go(hits[active]!); }} />
        <div className="results">
          {!q.trim() ? <div className="p-3 text-muted fs-13">{t("palette.hint")} · <kbd>↑</kbd> <kbd>↓</kbd> <kbd>↵</kbd></div>
            : loading && !hits.length ? <div className="p-3 text-muted fs-13">{t("common.loading")}</div>
            : !hits.length ? <div className="p-3 text-muted fs-13">{t("palette.empty")}</div>
            : hits.map((h, i) => (
              <div key={`${h.type}-${h.id}`} className={`item ${i === active ? "active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
                <i className={`bi ${ICONS[h.type]} text-faint`} />
                <div className="flex-grow-1 min-w-0"><div className="text-truncate">{h.title}</div>{h.subtitle && <div className="text-muted fs-13 text-truncate">{h.subtitle}</div>}</div>
                <span className="badge badge-soft">{t(`palette.type.${h.type}` as never)}</span>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
