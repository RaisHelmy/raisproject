import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AnalysisSummaryDTO, ImportDTO, ImportMessageDTO, WorkItemDTO, WorkStatus } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ConfidenceBadge, ConfirmModal, ErrorAlert, Modal, PageHeader, SourceBadge, Spinner, StatusBadge, Steps, Warnings, useToast } from "@/components/ui";
import { fmtDate, fmtTime, formatMinutes, pct } from "@/services/format";

interface Detail { import: ImportDTO; analysis: { summary: AnalysisSummaryDTO | null; is_demo: boolean } | null }

export default function AIReviewPage() {
  const { id } = useParams();
  const d = useApi<Detail>(`/imports/${id}`);
  const msgs = useApi<ImportMessageDTO[]>(`/imports/${id}/messages`);
  const items = useApi<WorkItemDTO[]>(`/imports/${id}/tasks`);
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [editing, setEditing] = useState<WorkItemDTO | null>(null);
  const [splitting, setSplitting] = useState<WorkItemDTO | null>(null);
  const [mergeSel, setMergeSel] = useState<Set<string>>(new Set());
  const [confirmAll, setConfirmAll] = useState(false);
  const act = useAction();
  const toast = useToast();
  const chatRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => (items.data ?? []).filter((w) => filter === "all" || (w.review_status === "PENDING" && w.is_mine)), [items.data, filter]);
  const activeItem = items.data?.find((w) => w.id === active) ?? list[0] ?? null;
  const evidence = useMemo(() => new Set(activeItem?.evidence.map((e) => e.message_id) ?? []), [activeItem]);
  const meName = d.data?.analysis?.summary?.participants.find((p) => p.is_me)?.name;
  useEffect(() => { if (!active && list[0]) setActive(list[0].id); }, [list, active]);
  useEffect(() => { const first = chatRef.current?.querySelector(".chat-msg.highlight"); first?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [activeItem?.id]);

  const refresh = () => { items.reload(); d.reload(); };
  const accept = async (w: WorkItemDTO, overrides?: Record<string, unknown>) => { const r = await act.run(() => api<{ reference: string }>(`/imports/work-items/${w.id}/accept`, { body: overrides ?? {} })); if (r) { toast.show(`Draft ${r.data.reference} created`); setEditing(null); refresh(); } };
  const ignore = async (w: WorkItemDTO) => { const r = await act.run(() => api(`/imports/work-items/${w.id}/ignore`, { body: {} })); if (r) { toast.show("Ignored"); refresh(); } };
  const restore = async (w: WorkItemDTO) => { const r = await act.run(() => api(`/imports/work-items/${w.id}/restore`, { body: {} })); if (r) refresh(); };
  const merge = async () => { const r = await act.run(() => api(`/imports/work-items/merge`, { body: { ids: [...mergeSel] } })); if (r) { toast.show("Items merged"); setMergeSel(new Set()); refresh(); } };
  const acceptAll = async () => { const r = await act.run(() => api<{ created: number }>(`/imports/${id}/accept-all`, { body: {} })); setConfirmAll(false); if (r) { toast.show(`${r.data.created} draft timesheets created`); refresh(); } };

  if (d.error) return <ErrorAlert error={d.error} onRetry={d.reload} />;
  if (!d.data || !msgs.data || !items.data) return <Spinner label="Loading conversation…" />;
  const pending = items.data.filter((w) => w.review_status === "PENDING" && w.is_mine).length;
  const accepted = items.data.filter((w) => w.review_status === "ACCEPTED").length;
  const summary = d.data.analysis?.summary;

  return (
    <div>
      <PageHeader title="Review AI work" breadcrumb={[{ label: "Import History", to: "/imports" }, { label: d.data.import.filename, to: `/imports/${id}` }, { label: "Review" }]}
        subtitle={<>{pending} to review · {accepted} accepted · {items.data.filter((w) => w.review_status === "IGNORED").length} ignored{summary?.is_demo && <span className="badge text-bg-info-subtle text-info-emphasis border ms-2">DEMO analysis</span>}</>}
        actions={<>{mergeSel.size >= 2 && <button className="btn btn-outline-primary" onClick={merge} disabled={act.busy}><i className="bi bi-union me-1" />Merge {mergeSel.size}</button>}{pending > 0 && <button className="btn btn-primary" onClick={() => setConfirmAll(true)}><i className="bi bi-check2-all me-1" />Accept all {pending} as drafts</button>}{pending === 0 && accepted > 0 && <Link to="/timesheets/drafts" className="btn btn-primary">Go to drafts <i className="bi bi-arrow-right ms-1" /></Link>}</>} />
      <Card className="mb-3"><Steps steps={["Import work", "Review AI", "Submit", "Approval", "Jira sync", "Report"]} active={1} /></Card>
      {summary && <Warnings items={summary.warnings} />}
      <ErrorAlert error={act.error} />
      {pending === 0 && <div className="alert alert-success"><i className="bi bi-check2-circle me-2" />Every suggestion has been reviewed. {accepted > 0 && <>Your {accepted} draft{accepted === 1 ? "" : "s"} are ready to <Link to="/timesheets/drafts">submit for approval</Link>.</>}</div>}

      <div className="review-layout">
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2"><h2 className="h6 mb-0"><i className="bi bi-whatsapp me-1 text-success" />WhatsApp conversation</h2><span className="small text-secondary">{msgs.data.length} messages · highlighted = evidence for the selected task</span></div>
          <div className="chat-pane" ref={chatRef}>
            {msgs.data.map((m, i) => {
              const day = m.timestamp.slice(0, 10);
              const showDay = i === 0 || msgs.data![i - 1]!.timestamp.slice(0, 10) !== day;
              const hl = evidence.has(m.id);
              return (
                <div key={m.id}>
                  {showDay && <div className="chat-day">{fmtDate(day, "long")}</div>}
                  <div className={`chat-msg${hl ? " highlight" : activeItem ? " dim" : ""}${m.sender === meName ? " me" : ""}${m.is_system ? " system" : ""}`} id={`msg-${m.id}`}>
                    <span className="chat-time">{fmtTime(m.timestamp)}</span>
                    <span><span className="chat-sender">{m.sender}</span>{m.is_deleted ? <em className="text-secondary">message deleted</em> : m.message}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h6 mb-0"><i className="bi bi-stars me-1 text-primary" />AI work summary</h2>
            <div className="btn-group btn-group-sm" role="group"><button className={`btn btn-outline-secondary${filter === "pending" ? " active" : ""}`} onClick={() => setFilter("pending")}>To review ({pending})</button><button className={`btn btn-outline-secondary${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>All ({items.data.length})</button></div>
          </div>
          {list.length === 0 && <Card><div className="text-center text-secondary py-3">{filter === "pending" ? "Nothing left to review." : "No work items were extracted."}</div></Card>}
          {list.map((w) => (
            <div key={w.id} className={`work-item${activeItem?.id === w.id ? " active" : ""}${w.review_status !== "PENDING" ? " done" : ""}`} onClick={() => setActive(w.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setActive(w.id); }}>
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="d-flex gap-2 align-items-start">
                  {w.review_status === "PENDING" && w.is_mine && <input type="checkbox" className="form-check-input mt-1" aria-label="Select for merge" checked={mergeSel.has(w.id)} onClick={(e) => e.stopPropagation()} onChange={() => setMergeSel((s) => { const n = new Set(s); n.has(w.id) ? n.delete(w.id) : n.add(w.id); return n; })} />}
                  <div><div className="fw-semibold">{w.title}</div><div className="small text-secondary">{w.executor}{!w.is_mine && <span className="badge text-bg-secondary ms-2">Not your work</span>}{w.explicit_jira_key && <span className="badge text-bg-light border ms-2">{w.explicit_jira_key}</span>}</div></div>
                </div>
                <div className="text-end"><ConfidenceBadge value={w.confidence} /><div className="mt-1"><StatusBadge value={w.review_status} /></div></div>
              </div>
              {activeItem?.id === w.id && (
                <div className="mt-3">
                  <div className="row g-2">
                    <Field label="Work date" value={fmtDate(w.work_date.value, "long")} f={w.work_date} />
                    <Field label="Duration" value={formatMinutes(w.duration_minutes.value)} f={w.duration_minutes} />
                    <Field label="Activity" value={w.start_time.value && w.end_time.value ? `${w.start_time.value} – ${w.end_time.value}` : "—"} f={w.start_time} />
                    <Field label="Completion" value={<StatusBadge value={w.work_status.value} />} f={w.work_status} />
                  </div>
                  {w.jira_candidates.length > 0 && <div className="mt-2 small"><span className="text-secondary">Jira suggestion:</span> {w.jira_candidates.slice(0, 2).map((c) => <span key={c.issue_key} className="me-2"><Link to={`/jira/tasks/${c.issue_key}`}>{c.issue_key}</Link> <span className="text-secondary">({pct(c.confidence)})</span></span>)}</div>}
                  <div className="mt-3">
                    <div className="small fw-semibold mb-1">AI assumptions</div>
                    {w.assumptions.map((a) => (
                      <div key={a.key} className="assumption">
                        <i className={`bi ${a.state === "confirmed" ? "bi-check-circle-fill" : a.state === "inferred" ? "bi-exclamation-triangle-fill" : "bi-question-circle-fill"}`} aria-hidden="true" />
                        <div className="flex-grow-1"><div><strong>{a.label}</strong> · {a.summary} <span className="text-secondary">({a.state})</span></div><details><summary>Why?</summary><div className="text-secondary mt-1">{a.reasoning}</div></details></div>
                      </div>
                    ))}
                  </div>
                  <details className="mt-2"><summary className="small text-primary" style={{ cursor: "pointer" }}>Description</summary><pre className="small text-secondary mt-1 mb-0" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{w.description}</pre></details>
                  {w.review_status === "PENDING" ? (
                    <div className="d-flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-sm btn-success" onClick={() => accept(w)} disabled={act.busy}><i className="bi bi-check-lg me-1" />Accept</button>
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setEditing(w)}><i className="bi bi-pencil me-1" />Edit &amp; accept</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setSplitting(w)} disabled={w.evidence.length < 2}><i className="bi bi-scissors me-1" />Split</button>
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => ignore(w)} disabled={act.busy}><i className="bi bi-eye-slash me-1" />Ignore</button>
                    </div>
                  ) : w.review_status === "ACCEPTED" && w.timesheet_id ? <div className="mt-3"><Link to={`/timesheets/${w.timesheet_id}`} className="btn btn-sm btn-outline-primary">Open draft timesheet</Link></div>
                    : w.review_status === "IGNORED" ? <div className="mt-3"><button className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.stopPropagation(); restore(w); }}>Restore</button></div> : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {editing && <EditModal item={editing} onClose={() => setEditing(null)} onSave={(o) => accept(editing, o)} busy={act.busy} />}
      {splitting && <SplitModal item={splitting} messages={msgs.data} onClose={() => setSplitting(null)} onDone={() => { setSplitting(null); toast.show("Item split"); refresh(); }} />}
      <ConfirmModal open={confirmAll} title={`Create ${pending} draft timesheets?`} body={<p>Each pending suggestion becomes a draft timesheet exactly as shown. You can still edit drafts before submitting.</p>} confirmLabel={`Create ${pending} drafts`} onConfirm={acceptAll} onClose={() => setConfirmAll(false)} busy={act.busy} />
      {toast.node}
    </div>
  );
}

function Field({ label, value, f }: { label: string; value: React.ReactNode; f: { source: string; confidence: number; reason: string } }) {
  return (
    <div className="col-sm-6"><div className="field-block border rounded px-2">
      <div className="d-flex justify-content-between align-items-start"><div><div className="field-label">{label}</div><div className="field-value">{value}</div></div><SourceBadge source={f.source} /></div>
      <div className="small text-secondary">{pct(f.confidence)} confidence</div>
      <details><summary className="small text-primary" style={{ cursor: "pointer" }}>Why?</summary><div className="small text-secondary">{f.reason}</div></details>
    </div></div>
  );
}

function EditModal({ item, onClose, onSave, busy }: { item: WorkItemDTO; onClose: () => void; onSave: (o: Record<string, unknown>) => void; busy: boolean }) {
  const [f, setF] = useState({ title: item.title, description: item.description, work_date: item.work_date.value, duration_minutes: item.duration_minutes.value, work_status: (item.work_status.value === "UNKNOWN" ? "COMPLETED" : item.work_status.value) as WorkStatus });
  return (
    <Modal open title="Edit and accept" onClose={onClose} footer={<><button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-success" disabled={busy} onClick={() => onSave({ ...f, duration_minutes: Number(f.duration_minutes) })}>{busy && <span className="spinner-border spinner-border-sm me-2" />}Accept as draft</button></>}>
      <div className="mb-2"><label className="form-label small" htmlFor="e-title">Title</label><input id="e-title" className="form-control" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="row g-2 mb-2">
        <div className="col-6"><label className="form-label small" htmlFor="e-date">Work date</label><input id="e-date" type="date" className="form-control" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} /></div>
        <div className="col-3"><label className="form-label small" htmlFor="e-dur">Minutes</label><input id="e-dur" type="number" min={0} step={15} className="form-control" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) })} /></div>
        <div className="col-3"><label className="form-label small" htmlFor="e-ws">Status</label><select id="e-ws" className="form-select" value={f.work_status} onChange={(e) => setF({ ...f, work_status: e.target.value as WorkStatus })}><option value="COMPLETED">Completed</option><option value="IN_PROGRESS">In progress</option><option value="BLOCKED">Blocked</option></select></div>
      </div>
      <div><label className="form-label small" htmlFor="e-desc">Description</label><textarea id="e-desc" className="form-control" rows={5} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="form-text">= {formatMinutes(f.duration_minutes)}. Your edits are recorded in the audit trail alongside the AI's original values.</div>
    </Modal>
  );
}

function SplitModal({ item, messages, onClose, onDone }: { item: WorkItemDTO; messages: ImportMessageDTO[]; onClose: () => void; onDone: () => void }) {
  const ev = messages.filter((m) => item.evidence.some((e) => e.message_id === m.id));
  const [groups, setGroups] = useState<Record<string, number>>(Object.fromEntries(ev.map((m, i) => [m.id, i < ev.length / 2 ? 0 : 1])));
  const [titles, setTitles] = useState<string[]>([item.title, `${item.title} (part 2)`]);
  const act = useAction();
  const n = titles.length;
  const save = async () => {
    const parts = titles.map((title, g) => ({ title, message_ids: ev.filter((m) => groups[m.id] === g).map((m) => m.id) })).filter((p) => p.message_ids.length);
    const r = await act.run(() => api(`/imports/work-items/${item.id}/split`, { body: { parts } }));
    if (r) onDone();
  };
  return (
    <Modal open title="Split into separate tasks" onClose={onClose} size="lg" footer={<><button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={act.busy}>{act.busy && <span className="spinner-border spinner-border-sm me-2" />}Split into {n}</button></>}>
      <ErrorAlert error={act.error} />
      <div className="row g-2 mb-3">{titles.map((t, i) => <div key={i} className="col-md-6"><label className="form-label small" htmlFor={`t${i}`}>Task {i + 1} title</label><input id={`t${i}`} className="form-control form-control-sm" value={t} onChange={(e) => setTitles(titles.map((x, j) => (j === i ? e.target.value : x)))} /></div>)}</div>
      {n < 4 && <button className="btn btn-sm btn-link px-0 mb-2" onClick={() => setTitles([...titles, `${item.title} (part ${n + 1})`])}>+ Add another task</button>}
      <div className="small text-secondary mb-1">Assign each message to a task:</div>
      <div className="chat-pane" style={{ maxHeight: 320 }}>
        {ev.map((m) => (
          <div key={m.id} className="chat-msg align-items-center" style={{ gridTemplateColumns: "110px 1fr" }}>
            <select className="form-select form-select-sm" value={groups[m.id]} onChange={(e) => setGroups({ ...groups, [m.id]: Number(e.target.value) })} aria-label="Task">{titles.map((_, i) => <option key={i} value={i}>Task {i + 1}</option>)}</select>
            <span><span className="chat-time me-2">{fmtTime(m.timestamp)}</span><span className="chat-sender">{m.sender}</span>{m.message}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
