import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ReconciliationRowDTO, SyncErrorDTO, TimesheetDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ConfidenceBadge, ConfirmModal, Duration, EmptyState, ErrorAlert, PageHeader, Pagination, Spinner, StatusBadge, useToast } from "@/components/ui";
import { fmtDate, fmtDateTime, formatMinutes } from "@/services/format";
import { CreateJiraModal, LinkJiraModal } from "./JiraActions";

const VIEWS: Record<string, { title: string; subtitle: string; empty: string }> = {
  needs_action: { title: "Jira Reconciliation", subtitle: "Approved work compared with Jira. Confirm matches, create missing tasks, ignore what doesn't belong.", empty: "All approved work is reconciled with Jira." },
  suggested: { title: "Suggested Matches", subtitle: "Approved timesheets that look like an existing Jira task.", empty: "No suggested matches to review." },
  ready_to_create: { title: "Ready to Create", subtitle: "Approved work with no Jira task. Create them one by one or in bulk.", empty: "Every approved task has a Jira issue." },
  ready_to_sync: { title: "Ready to Sync", subtitle: "Linked work that is queued or in progress.", empty: "Nothing is waiting to sync." },
  synced: { title: "Synced", subtitle: "Approved work that Jira reflects.", empty: "Nothing has been synced yet." },
  errors: { title: "Sync Errors", subtitle: "Jira synchronisation failures. Retry once the cause is resolved.", empty: "No synchronisation errors. Everything is healthy." },
};

export default function ReconciliationPage({ view: initial }: { view: string }) {
  const [sp, setSp] = useSearchParams();
  const view = initial === "needs_action" ? sp.get("view") ?? "needs_action" : initial;
  const page = Number(sp.get("page") ?? "1");
  const list = useApi<{ items: ReconciliationRowDTO[]; total: number; page: number; page_size: number }>("/jira/reconciliation", { view, page, page_size: 25 }, { poll: view === "ready_to_sync" ? 5000 : undefined });
  const errors = useApi<{ items: SyncErrorDTO[]; total: number }>(view === "errors" ? "/jira/errors" : null, { page_size: 100 });
  const [modal, setModal] = useState<{ type: "create" | "link" | "bulk"; t?: TimesheetDTO } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const act = useAction();
  const toast = useToast();
  const v = VIEWS[view] ?? VIEWS.needs_action!;
  const reload = () => { list.reload(); errors.reload(); };
  const link = async (t: TimesheetDTO, key: string) => { const r = await act.run(() => api(`/jira/timesheets/${t.id}/link`, { body: { issue_key: key, match_type: "AI_SUGGESTED" } })); if (r) { toast.show(`${t.reference} linked to ${key}`); reload(); } };
  const ignore = async (t: TimesheetDTO) => { const r = await act.run(() => api(`/jira/timesheets/${t.id}/ignore`, { body: {} })); if (r) { toast.show("Match dismissed"); reload(); } };
  const retry = async (t: TimesheetDTO) => { const r = await act.run(() => api(`/jira/timesheets/${t.id}/retry`, { body: {} })); if (r) { toast.show("Retry queued"); reload(); } };
  const bulkCreate = async () => { const r = await act.run(() => api<Record<string, { status: string }>>("/jira/create", { body: { timesheet_ids: [...selected] } })); setModal(null); if (r) { const vals = Object.values(r.data); const dup = vals.filter((x) => x.status === "POTENTIAL_DUPLICATE").length; toast.show(`${vals.filter((x) => x.status === "QUEUED").length} Jira task${vals.length === 1 ? "" : "s"} queued${dup ? `, ${dup} skipped as possible duplicates — open them individually` : ""}`, dup ? "info" : "success"); setSelected(new Set()); reload(); } };
  const selRows = (list.data?.items ?? []).filter((r) => selected.has(r.timesheet.id));

  return (
    <div>
      <PageHeader title={v.title} subtitle={v.subtitle} breadcrumb={[{ label: "Jira Sync Center", to: "/jira" }, { label: v.title }]}
        actions={<>{initial === "needs_action" && <select className="form-select form-select-sm" style={{ width: 200 }} value={view} onChange={(e) => { const n = new URLSearchParams(); n.set("view", e.target.value); setSp(n); }} aria-label="View"><option value="needs_action">Needs action</option><option value="suggested">Suggested matches</option><option value="ready_to_create">Ready to create</option><option value="all">All approved</option></select>}{selected.size > 0 && <button className="btn btn-primary" onClick={() => setModal({ type: "bulk" })}><i className="bi bi-plus-lg me-1" />Create {selected.size} Jira task{selected.size === 1 ? "" : "s"}</button>}</>} />
      <ErrorAlert error={list.error} onRetry={list.reload} /><ErrorAlert error={act.error} />
      {!list.data ? <Spinner /> : list.data.items.length === 0 ? <Card><EmptyState icon="cloud-check" title={v.empty} action={<Link to="/jira" className="btn btn-outline-primary">Back to Sync Center</Link>} /></Card> : (
        <>
          {(view === "ready_to_create" || view === "needs_action") && <div className="small text-secondary mb-2"><input type="checkbox" className="form-check-input me-2" aria-label="Select all without Jira" checked={selected.size > 0 && selected.size === list.data.items.filter((r) => r.result === "NO_MATCH" && !r.link).length} onChange={() => { const ids = list.data!.items.filter((r) => r.result === "NO_MATCH" && !r.link).map((r) => r.timesheet.id); setSelected((s) => (s.size === ids.length ? new Set() : new Set(ids))); }} />Select all without a Jira task for bulk creation</div>}
          {list.data.items.map((r) => {
            const t = r.timesheet;
            const top = r.candidates[0];
            return (
              <div key={t.id} className="card mb-3">
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-lg-5">
                      <div className="d-flex gap-2 align-items-start">
                        {r.result === "NO_MATCH" && !r.link && <input type="checkbox" className="form-check-input mt-1" aria-label="Select" checked={selected.has(t.id)} onChange={() => setSelected((s) => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} />}
                        <div>
                          <div className="small text-secondary">Timesheet</div>
                          <Link to={`/timesheets/${t.id}`} className="fw-semibold text-decoration-none">{t.title}</Link>
                          <div className="small text-secondary">{t.reference} · {fmtDate(t.work_date)} · <Duration minutes={t.duration_minutes} /> · {t.project_code} · {t.user_name}</div>
                          <div className="mt-1"><StatusBadge value={t.jira_sync_status} /> {r.link && <span className="small text-secondary ms-1">{r.link.match_type === "CREATED" ? "Created from timesheet" : `Linked (${r.link.match_type.toLowerCase().replace("_", " ")})`} · {fmtDateTime(r.link.last_sync_at ?? r.link.linked_at)}</span>}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-lg-4">
                      {r.link ? (
                        <><div className="small text-secondary">Jira issue</div><Link to={`/jira/tasks/${r.link.jira_issue_key}`} className="fw-semibold">{r.link.jira_issue_key}</Link>{r.sync_error && <div className="small text-danger mt-1">Sync failed · ref <code>{r.sync_error.reference}</code><div>{r.sync_error.error_message}</div></div>}</>
                      ) : top ? (
                        <><div className="small text-secondary">{r.result === "EXACT_MATCH" ? "Exact Jira match" : "Potential Jira match"}</div><Link to={`/jira/tasks/${top.issue_key}`} className="fw-semibold">{top.issue_key}</Link> <span>{top.summary}</span><div className="mt-1"><ConfidenceBadge value={top.confidence} /> <span className="small text-secondary ms-1">{top.reason}</span></div>{r.candidates.length > 1 && <div className="small text-secondary mt-1">Also: {r.candidates.slice(1, 3).map((c) => <span key={c.issue_key} className="me-2"><button className="btn btn-link btn-sm p-0 align-baseline" onClick={() => link(t, c.issue_key)}>{c.issue_key}</button> ({Math.round(c.confidence * 100)}%)</span>)}</div>}</>
                      ) : (
                        <><div className="small text-secondary">Jira</div><div className="text-warning-emphasis"><i className="bi bi-exclamation-triangle me-1" />No Jira task found</div>{r.sync_error && <div className="small text-danger mt-1">Sync failed · ref <code>{r.sync_error.reference}</code><div>{r.sync_error.error_message}</div></div>}</>
                      )}
                    </div>
                    <div className="col-lg-3 d-flex flex-wrap gap-2 align-items-start justify-content-lg-end">
                      {!r.link && top && <button className="btn btn-sm btn-primary" onClick={() => link(t, top.issue_key)} disabled={act.busy}><i className="bi bi-link-45deg me-1" />Link</button>}
                      {!r.link && <button className="btn btn-sm btn-outline-primary" onClick={() => setModal({ type: "create", t })}><i className="bi bi-plus-lg me-1" />Create new</button>}
                      {!r.link && <button className="btn btn-sm btn-outline-secondary" onClick={() => setModal({ type: "link", t })}>Other…</button>}
                      {!r.link && top && <button className="btn btn-sm btn-outline-secondary" onClick={() => ignore(t)} disabled={act.busy}>Ignore</button>}
                      {t.jira_sync_status === "SYNC_FAILED" && <button className="btn btn-sm btn-warning" onClick={() => retry(t)} disabled={act.busy}><i className="bi bi-arrow-clockwise me-1" />Retry</button>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={(p) => { const n = new URLSearchParams(sp); n.set("page", String(p)); setSp(n); }} />
        </>
      )}
      {view === "errors" && errors.data && errors.data.items.length > 0 && (
        <Card title="Error log" className="mt-3">
          <div className="table-responsive"><table className="table table-sm mb-0"><thead><tr><th>Reference</th><th>Timesheet</th><th>Error</th><th>Retries</th><th>When</th></tr></thead><tbody>{errors.data.items.map((e) => <tr key={e.id}><td><code>{e.reference}</code></td><td><Link to={`/timesheets/${e.timesheet_id}`}>{e.timesheet_reference}</Link></td><td><span className="badge text-bg-light border me-1">{e.error_code}</span>{e.error_message}</td><td>{e.retry_count}</td><td>{fmtDateTime(e.created_at)}</td></tr>)}</tbody></table></div>
        </Card>
      )}
      {modal?.type === "create" && modal.t && <CreateJiraModal open timesheetId={modal.t.id} onClose={() => setModal(null)} onDone={(m) => { setModal(null); toast.show(m); reload(); }} />}
      {modal?.type === "link" && modal.t && <LinkJiraModal open timesheet={modal.t} onClose={() => setModal(null)} onDone={() => { setModal(null); toast.show("Linked"); reload(); }} />}
      <ConfirmModal open={modal?.type === "bulk"} title="Create Jira tasks" confirmLabel={`Create ${selected.size} Jira task${selected.size === 1 ? "" : "s"}`} onConfirm={bulkCreate} onClose={() => setModal(null)} busy={act.busy}
        body={<><p>You're about to create:</p><dl className="row mb-2"><dt className="col-4">Tasks</dt><dd className="col-8">{selected.size}</dd><dt className="col-4">Total effort</dt><dd className="col-8">{formatMinutes(selRows.reduce((a, r) => a + r.timesheet.duration_minutes, 0))}</dd><dt className="col-4">Projects</dt><dd className="col-8">{[...new Set(selRows.map((r) => r.timesheet.project_code))].join(", ")}</dd><dt className="col-4">Assignee</dt><dd className="col-8">Each timesheet's author (default)</dd></dl><p className="small text-secondary mb-0">Possible duplicates are skipped and must be reviewed individually. The approved timesheets remain unchanged.</p></>} />
      {toast.node}
    </div>
  );
}
