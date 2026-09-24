import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AuditLogDTO, ImportMessageDTO, JiraLinkDTO, SyncErrorDTO, TimesheetApprovalDTO, TimesheetDTO, WorkItemDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ConfidenceBadge, ConfirmModal, Duration, ErrorAlert, KeyValue, PageHeader, SourceBadge, Spinner, StatusBadge, useToast } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtTime, humanize, pct } from "@/services/format";
import { useAuth } from "@/services/auth";
import { CreateJiraModal, LinkJiraModal } from "@/pages/jira/JiraActions";

interface Detail {
  timesheet: TimesheetDTO; approvals: TimesheetApprovalDTO[]; audit: AuditLogDTO[];
  jira: { link: JiraLinkDTO | null; issue: { issue_key: string; summary: string; status: string; url: string | null; assignee_name: string | null; due_date: string | null } | null; candidates: { issue_key: string; confidence: number; reason: string; result: string }[]; errors: SyncErrorDTO[] };
  source: { import_id: string; filename: string; work_item: WorkItemDTO | null; messages: ImportMessageDTO[] } | null;
}

export default function TimesheetDetailPage({ approvalMode = false }: { approvalMode?: boolean }) {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, isApprover } = useAuth();
  const d = useApi<Detail>(`/timesheets/${id}`);
  const act = useAction();
  const toast = useToast();
  const [modal, setModal] = useState<"submit" | "approve" | "reject" | "delete" | "link" | "create" | null>(null);

  if (d.error) return <ErrorAlert error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Spinner />;
  const t = d.data.timesheet;
  const mine = t.user_id === user?.id;
  const run = async (fn: () => Promise<unknown>, msg: string) => { const r = await act.run(fn); setModal(null); if (r !== undefined) { toast.show(msg); d.reload(); } };

  const actions: React.ReactNode[] = [];
  if ((t.status === "DRAFT" || t.status === "REJECTED") && (mine || isApprover)) { actions.push(<Link key="edit" to={`/timesheets/${t.id}/edit`} className="btn btn-outline-secondary"><i className="bi bi-pencil me-1" />Edit</Link>, <button key="submit" className="btn btn-primary" onClick={() => setModal("submit")}><i className="bi bi-send me-1" />Submit for approval</button>); }
  if (t.status === "DRAFT" && mine) actions.push(<button key="del" className="btn btn-outline-danger" onClick={() => setModal("delete")}>Delete draft</button>);
  if (t.status === "SUBMITTED" && isApprover) actions.push(<button key="rej" className="btn btn-outline-danger" onClick={() => setModal("reject")}><i className="bi bi-x-lg me-1" />Reject</button>, <button key="app" className="btn btn-success" onClick={() => setModal("approve")}><i className="bi bi-check-lg me-1" />Approve</button>);
  if (t.status === "APPROVED" && isApprover) actions.push(<Link key="edit" to={`/timesheets/${t.id}/edit`} className="btn btn-outline-secondary"><i className="bi bi-pencil me-1" />Correct (audited)</Link>);
  if (t.status === "APPROVED" && ["NOT_LINKED", "MATCH_SUGGESTED", "SYNC_FAILED"].includes(t.jira_sync_status) && (mine || isApprover)) {
    actions.push(<button key="link" className="btn btn-outline-primary" onClick={() => setModal("link")}><i className="bi bi-link-45deg me-1" />Link Jira task</button>);
    if (t.jira_sync_status !== "SYNC_FAILED" || !d.data.jira.link) actions.push(<button key="create" className="btn btn-primary" onClick={() => setModal("create")}><i className="bi bi-plus-lg me-1" />Create Jira task</button>);
    if (t.jira_sync_status === "SYNC_FAILED") actions.push(<button key="retry" className="btn btn-warning" onClick={() => run(() => api(`/jira/timesheets/${t.id}/retry`, { body: {} }), "Retry queued")}><i className="bi bi-arrow-clockwise me-1" />Retry sync</button>);
  }

  const w = d.data.source?.work_item;
  return (
    <div>
      <PageHeader title={t.title} breadcrumb={approvalMode ? [{ label: "Pending Approval", to: "/approvals" }, { label: t.reference }] : [{ label: "My Timesheets", to: "/timesheets" }, { label: t.reference }]}
        subtitle={<span className="d-inline-flex flex-wrap gap-2 align-items-center">{t.reference} <StatusBadge value={t.status} /> <StatusBadge value={t.work_status} /> {t.status === "APPROVED" && <StatusBadge value={t.jira_sync_status} />} {t.ai_generated && <span className="badge text-bg-light border"><i className="bi bi-stars me-1" />AI drafted</span>}</span>}
        actions={actions} />
      <ErrorAlert error={act.error} />
      {t.status === "REJECTED" && t.rejection_reason && <div className="alert alert-danger"><strong>Returned by approver:</strong> {t.rejection_reason}</div>}
      {d.data.jira.errors.length > 0 && <div className="alert alert-danger"><div className="fw-semibold">Sync failed</div>We couldn't synchronise this task with Jira.<div className="small mt-1">Reference: <code>{d.data.jira.errors[0]!.reference}</code> · {d.data.jira.errors[0]!.error_message}</div></div>}

      <div className="row g-3">
        <div className="col-lg-8">
          <Card title="Work summary" className="mb-3">
            <KeyValue items={[
              { label: "Task", value: <strong>{t.title}</strong> },
              { label: "Description", value: t.description ? <div style={{ whiteSpace: "pre-wrap" }}>{t.description}</div> : <span className="text-secondary">—</span> },
              { label: "Project", value: `${t.project_code} — ${t.project_name}` },
              { label: "Performed by", value: t.user_name },
              { label: "Work status", value: <StatusBadge value={t.work_status} /> },
            ]} />
          </Card>
          <Card title="Time" className="mb-3">
            <KeyValue items={[
              { label: "Work date", value: <strong>{fmtDate(t.work_date, "long")}</strong> },
              { label: "Record created", value: <>{fmtDateTime(t.created_at)}{t.created_at.slice(0, 10) !== t.work_date && <span className="badge text-bg-warning-subtle text-warning-emphasis ms-2">Backdated</span>}</> },
              { label: "Activity window", value: t.start_time && t.end_time ? `${t.start_time} – ${t.end_time}` : <span className="text-secondary">Not specified</span> },
              { label: "Duration", value: <strong><Duration minutes={t.duration_minutes} /></strong> },
            ]} />
          </Card>
          {w && (
            <Card title={<><i className="bi bi-stars me-2" />AI analysis</>} className="mb-3">
              <div className="d-flex flex-wrap gap-3 mb-3"><div>Overall confidence: <ConfidenceBadge value={w.confidence} /></div>{w.explicit_jira_key && <div>Jira key mentioned: <strong>{w.explicit_jira_key}</strong></div>}</div>
              {[["Work date", w.work_date], ["Duration", w.duration_minutes], ["Completion", w.work_status]].map(([label, f]) => { const field = f as { value: unknown; source: string; confidence: number; reason: string }; return (
                <div key={String(label)} className="field-block">
                  <div className="d-flex justify-content-between flex-wrap gap-2"><div><div className="field-label">{String(label)}</div><div className="field-value">{String(field.value)}</div></div><div className="text-end"><SourceBadge source={field.source} /><div className="small text-secondary">{pct(field.confidence)} confidence</div></div></div>
                  <details className="mt-1"><summary className="small text-primary" style={{ cursor: "pointer" }}>Why?</summary><div className="small text-secondary mt-1">{field.reason}</div></details>
                </div>
              ); })}
            </Card>
          )}
          {d.data.source && (
            <Card title="Source conversation" className="mb-3" actions={<Link to={`/imports/${d.data.source.import_id}/review`} className="btn btn-sm btn-outline-secondary">View full conversation</Link>}>
              <div className="small text-secondary mb-2">Source: {d.data.source.filename} · Messages used: {d.data.source.messages.map((m) => fmtTime(m.timestamp)).join(", ") || "—"}</div>
              <div className="chat-pane" style={{ maxHeight: 320 }}>
                {d.data.source.messages.map((m) => <div key={m.id} className={`chat-msg highlight${m.sender === t.user_name ? " me" : ""}`}><span className="chat-time">{fmtTime(m.timestamp)}</span><span><span className="chat-sender">{m.sender}</span>{m.message}</span></div>)}
                {!d.data.source.messages.length && <div className="text-secondary small p-2">No message evidence stored for this entry.</div>}
              </div>
            </Card>
          )}
        </div>
        <div className="col-lg-4">
          <Card title="Jira" className="mb-3">
            {d.data.jira.issue ? (
              <KeyValue items={[
                { label: "Issue", value: <Link to={`/jira/tasks/${d.data.jira.issue.issue_key}`}>{d.data.jira.issue.issue_key}</Link> },
                { label: "Summary", value: d.data.jira.issue.summary },
                { label: "Status", value: <StatusBadge value={d.data.jira.issue.status} /> },
                { label: "Assignee", value: d.data.jira.issue.assignee_name ?? "Unassigned" },
                { label: "Link type", value: humanize(d.data.jira.link?.match_type) },
                { label: "Sync", value: <StatusBadge value={t.jira_sync_status} /> },
                { label: "Last sync", value: fmtDateTime(d.data.jira.link?.last_sync_at) },
              ]} />
            ) : t.status !== "APPROVED" ? <div className="text-secondary small">Jira reconciliation starts once the timesheet is approved.</div>
              : d.data.jira.candidates.length ? (
                <div>
                  <div className="small text-secondary mb-2">Potential Jira match</div>
                  {d.data.jira.candidates.slice(0, 3).map((c) => (
                    <div key={c.issue_key} className="border rounded p-2 mb-2">
                      <div className="d-flex justify-content-between"><Link to={`/jira/tasks/${c.issue_key}`} className="fw-semibold">{c.issue_key}</Link><ConfidenceBadge value={c.confidence} /></div>
                      <div className="small text-secondary">{c.reason}</div>
                      {(mine || isApprover) && <button className="btn btn-sm btn-primary mt-2" onClick={() => run(() => api(`/jira/timesheets/${t.id}/link`, { body: { issue_key: c.issue_key, match_type: "AI_SUGGESTED" } }), `Linked to ${c.issue_key}`)}>Link</button>}
                    </div>
                  ))}
                </div>
              ) : <div className="text-secondary small">No Jira task found for this work. Create one or link it manually.</div>}
          </Card>
          <Card title="Approval history" className="mb-3">
            {d.data.approvals.length === 0 ? <div className="text-secondary small">Not submitted yet.</div> : (
              <ul className="list-unstyled mb-0">{d.data.approvals.map((a) => <li key={a.id} className="mb-2"><div><StatusBadge value={a.action === "RETURNED_TO_DRAFT" ? "DRAFT" : a.action} /> <span className="ms-1">{a.actor_name}</span></div><div className="small text-secondary">{fmtDateTime(a.created_at)}{a.reason && <> · {a.reason}</>}</div></li>)}</ul>
            )}
          </Card>
          <Card title="Audit trail">
            <ul className="list-unstyled mb-0 small">
              {d.data.audit.map((a) => (
                <li key={a.id} className="mb-2 pb-2 border-bottom">
                  <div><strong>{humanize(a.action)}</strong> · {a.actor_name ?? "System"} <span className="text-secondary">({a.source})</span></div>
                  <div className="text-secondary">{fmtDateTime(a.created_at)}</div>
                  {a.reason && <div>Reason: {a.reason}</div>}
                  {a.before && a.after && <details><summary className="text-primary" style={{ cursor: "pointer" }}>Changes</summary><Diff before={a.before} after={a.after} /></details>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <ConfirmModal open={modal === "submit"} title="Submit for approval?" body={<p>The timesheet owner will review <strong>{t.title}</strong> ({fmtDate(t.work_date)}, <Duration minutes={t.duration_minutes} />). You can't edit it while it's under review.</p>} confirmLabel="Submit" onConfirm={() => run(() => api(`/timesheets/${t.id}/submit`, { body: {} }), "Submitted for approval")} onClose={() => setModal(null)} busy={act.busy} />
      <ConfirmModal open={modal === "approve"} title="Approve this timesheet?" tone="success" body={<p><strong>{t.title}</strong> — {fmtDate(t.work_date, "long")}, <Duration minutes={t.duration_minutes} />, {t.project_code}. Once approved it becomes an official record and Jira reconciliation starts automatically.</p>} confirmLabel="Approve" onConfirm={() => run(async () => { await api(`/timesheets/${t.id}/approve`, { body: {} }); if (approvalMode) nav("/approvals"); }, "Approved")} onClose={() => setModal(null)} busy={act.busy} />
      <ConfirmModal open={modal === "reject"} title="Reject this timesheet" tone="danger" body={<p>The author will be asked to revise <strong>{t.title}</strong>.</p>} confirmLabel="Reject" requireReason reasonLabel="Reason (shown to the author)" onConfirm={(reason) => run(async () => { await api(`/timesheets/${t.id}/reject`, { body: { reason } }); if (approvalMode) nav("/approvals"); }, "Returned to author")} onClose={() => setModal(null)} busy={act.busy} />
      <ConfirmModal open={modal === "delete"} title="Delete this draft?" tone="danger" body={<p>The draft will be removed from your lists. The action is recorded in the audit trail.</p>} confirmLabel="Delete draft" onConfirm={() => run(async () => { await api(`/timesheets/${t.id}`, { method: "DELETE" }); nav("/timesheets/drafts"); }, "Draft deleted")} onClose={() => setModal(null)} busy={act.busy} />
      <LinkJiraModal open={modal === "link"} timesheet={t} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.show("Linked to Jira"); d.reload(); }} />
      <CreateJiraModal open={modal === "create"} timesheetId={t.id} onClose={() => setModal(null)} onDone={(msg) => { setModal(null); toast.show(msg); d.reload(); }} />
      {toast.node}
    </div>
  );
}

function Diff({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  if (!keys.length) return <div className="text-secondary">No field changes.</div>;
  return <table className="table table-sm mt-1 mb-0"><tbody>{keys.map((k) => <tr key={k}><td className="text-secondary">{humanize(k)}</td><td><del className="text-danger">{String(before[k] ?? "—")}</del></td><td className="text-success">{String(after[k] ?? "—")}</td></tr>)}</tbody></table>;
}
