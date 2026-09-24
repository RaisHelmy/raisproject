import { useEffect, useState } from "react";
import type { JiraCandidateDTO, TimesheetDTO } from "@rais/shared-types";
import { api } from "@/services/api";
import { useAction } from "@/hooks/useApi";
import { ConfidenceBadge, ErrorAlert, Modal } from "@/components/ui";
import { fmtDate, formatMinutes } from "@/services/format";

interface Preview { defaults: { project_key: string | null; issue_type: string; summary: string; description: string; assignee_account_id: string | null; assignee_name: string | null }; duplicates: JiraCandidateDTO[]; issue_types: string[]; demo: boolean; timesheet: TimesheetDTO }

/** Confirmation dialog for creating a Jira task from an approved timesheet (duplicate-aware). */
export function CreateJiraModal({ open, timesheetId, onClose, onDone }: { open: boolean; timesheetId: string; onClose: () => void; onDone: (message: string) => void }) {
  const [p, setP] = useState<Preview | null>(null);
  const [f, setF] = useState({ summary: "", description: "", issue_type: "Task", assignee_account_id: "" as string | null });
  const [force, setForce] = useState(false);
  const [users, setUsers] = useState<{ account_id: string; display_name: string }[]>([]);
  const [userQ, setUserQ] = useState("");
  const act = useAction();

  useEffect(() => {
    if (!open) { setP(null); setForce(false); return; }
    act.run(async () => { const r = await api<Preview>(`/jira/timesheets/${timesheetId}/create-preview`); setP(r.data); setF({ summary: r.data.defaults.summary, description: r.data.defaults.description, issue_type: r.data.defaults.issue_type, assignee_account_id: r.data.defaults.assignee_account_id }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, timesheetId]);
  useEffect(() => { if (userQ.length < 2) return; const id = setTimeout(() => api<{ account_id: string; display_name: string }[]>("/jira/users", { query: { q: userQ } }).then((r) => setUsers(r.data)).catch(() => undefined), 300); return () => clearTimeout(id); }, [userQ]);

  const create = async () => {
    const r = await act.run(() => api<{ status: string; issue_key?: string; duplicates?: JiraCandidateDTO[] }>(`/jira/timesheets/${timesheetId}/create`, { body: { summary: f.summary, description: f.description, issue_type: f.issue_type, assignee_account_id: f.assignee_account_id || null, force } }));
    if (!r) return;
    if (r.data.status === "POTENTIAL_DUPLICATE") { setP((x) => x ? { ...x, duplicates: r.data.duplicates ?? [] } : x); return; }
    onDone(r.data.status === "ALREADY_LINKED" ? `Already linked to ${r.data.issue_key}` : "Jira task creation queued");
  };
  const useExisting = async (key: string) => { const r = await act.run(() => api(`/jira/timesheets/${timesheetId}/link`, { body: { issue_key: key, match_type: "AI_SUGGESTED" } })); if (r) onDone(`Linked to ${key}`); };

  const dups = p?.duplicates ?? [];
  return (
    <Modal open={open} title="Create Jira task" onClose={onClose} size="lg" footer={<>
      <button className="btn btn-outline-secondary" onClick={onClose} disabled={act.busy}>Cancel</button>
      <button className="btn btn-primary" onClick={create} disabled={act.busy || !p || !p.defaults.project_key || (dups.length > 0 && !force)}>{act.busy && <span className="spinner-border spinner-border-sm me-2" />}{dups.length && !force ? "Resolve duplicate first" : "Create Jira task"}</button>
    </>}>
      <ErrorAlert error={act.error} />
      {!p ? <div className="text-secondary">Preparing…</div> : (
        <>
          {p.demo && <div className="alert alert-info py-2 small"><i className="bi bi-info-circle me-1" />Jira demo mode: the task will be created in the built-in demo adapter, not a real Jira site.</div>}
          {!p.defaults.project_key && <div className="alert alert-warning py-2 small">This project has no Jira project key. Ask an administrator to configure it under Settings → Projects.</div>}
          {dups.length > 0 && (
            <div className="alert alert-danger">
              <div className="fw-semibold mb-1"><i className="bi bi-exclamation-triangle me-1" />Possible duplicate detected</div>
              {dups.map((d) => (
                <div key={d.issue_key} className="d-flex justify-content-between align-items-center gap-2 border-top pt-2 mt-2">
                  <div><div><strong>{d.issue_key}</strong> {d.summary}</div><div className="small">Similarity <ConfidenceBadge value={d.confidence} /> · {d.reason}</div></div>
                  <button className="btn btn-sm btn-outline-primary text-nowrap" onClick={() => useExisting(d.issue_key)} disabled={act.busy}>Use existing</button>
                </div>
              ))}
              <div className="form-check mt-3"><input className="form-check-input" type="checkbox" id="force" checked={force} onChange={(e) => setForce(e.target.checked)} /><label className="form-check-label" htmlFor="force">Create anyway — I've checked and this is a different task.</label></div>
            </div>
          )}
          <div className="row g-3">
            <div className="col-md-4"><div className="small text-secondary">Project</div><div className="fw-semibold">{p.defaults.project_key ?? "—"}</div></div>
            <div className="col-md-4"><label className="form-label small mb-0" htmlFor="it">Issue type</label><select id="it" className="form-select form-select-sm" value={f.issue_type} onChange={(e) => setF({ ...f, issue_type: e.target.value })}>{(p.issue_types.length ? p.issue_types : ["Task"]).map((t) => <option key={t}>{t}</option>)}</select></div>
            <div className="col-md-4"><div className="small text-secondary">Actual effort</div><div className="fw-semibold">{formatMinutes(p.timesheet.duration_minutes)} on {fmtDate(p.timesheet.work_date)}</div></div>
            <div className="col-12"><label className="form-label small mb-0" htmlFor="sum">Summary</label><input id="sum" className="form-control" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} maxLength={255} /></div>
            <div className="col-12"><label className="form-label small mb-0" htmlFor="desc">Description</label><textarea id="desc" className="form-control" rows={6} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="col-12">
              <label className="form-label small mb-0" htmlFor="asg">Assignee</label>
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <span className="badge text-bg-light border">{f.assignee_account_id ? users.find((u) => u.account_id === f.assignee_account_id)?.display_name ?? p.defaults.assignee_name ?? f.assignee_account_id : "Unassigned"}</span>
                <input id="asg" className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder="Search Jira users to change…" value={userQ} onChange={(e) => setUserQ(e.target.value)} />
                {users.length > 0 && userQ.length >= 2 && <select className="form-select form-select-sm" style={{ maxWidth: 260 }} onChange={(e) => { setF({ ...f, assignee_account_id: e.target.value || null }); setUserQ(""); }} defaultValue=""><option value="">Choose…</option>{users.map((u) => <option key={u.account_id} value={u.account_id}>{u.display_name}</option>)}</select>}
              </div>
            </div>
          </div>
          <p className="small text-secondary mt-3 mb-0">The approved timesheet remains unchanged. Creation is idempotent: clicking twice never creates two issues.</p>
        </>
      )}
    </Modal>
  );
}

/** Link an approved timesheet to an existing Jira issue by key. */
export function LinkJiraModal({ open, timesheet, onClose, onDone }: { open: boolean; timesheet: TimesheetDTO; onClose: () => void; onDone: () => void }) {
  const [key, setKey] = useState("");
  const act = useAction();
  useEffect(() => { if (open) setKey(timesheet.jira_issue_key ?? ""); }, [open, timesheet.jira_issue_key]);
  const link = async () => { const r = await act.run(() => api(`/jira/timesheets/${timesheet.id}/link`, { body: { issue_key: key.trim().toUpperCase(), match_type: "MANUAL" } })); if (r) onDone(); };
  return (
    <Modal open={open} title="Link to an existing Jira task" onClose={onClose} footer={<><button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={link} disabled={act.busy || !/^[A-Z][A-Z0-9]{1,9}-\d{1,6}$/i.test(key.trim())}>{act.busy && <span className="spinner-border spinner-border-sm me-2" />}Link</button></>}>
      <ErrorAlert error={act.error} />
      <p className="mb-2">Timesheet <strong>{timesheet.reference}</strong> — {timesheet.title}</p>
      <label htmlFor="jk" className="form-label">Jira issue key</label>
      <input id="jk" className="form-control" placeholder="e.g. BNM-1524" value={key} onChange={(e) => setKey(e.target.value)} autoFocus />
      <div className="form-text">A traceability comment with the timesheet reference and effort will be added to the issue.</div>
    </Modal>
  );
}
