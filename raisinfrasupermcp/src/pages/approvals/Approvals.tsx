import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp, errorMessage } from "@/app/providers";
import { useAsync } from "@/hooks/useAsync";
import { PageHeader, Panel, Loading, ErrorState, EmptyState } from "@/components/Panels";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { timeAgo, fmtDate } from "@/utils/format";

export function ApprovalsList() {
  const { api } = useApp();
  const [params, setParams] = useSearchParams();
  const view = params.get("mine") === "true" ? "mine" : params.get("status") ?? "PENDING";
  const nav = useNavigate();
  const { data, loading, error } = useAsync(() => api.approvals.list(view === "mine" ? { status: "PENDING", mine: true } : view === "ALL" ? {} : { status: view as never }), [view]);
  return <div><PageHeader title="Approvals" subtitle="Approval Engine: routing by user, owner, admin, security, group, role · strategies ANY / ALL / SEQUENTIAL / PARALLEL. Secrets are never shown." />
    <div className="tabs-smcp">{[["mine", "For me"], ["PENDING", "Pending"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"], ["ALL", "All"]].map(([k, l]) => <button key={k} className={view === k ? "active" : ""} onClick={() => setParams(k === "mine" ? { mine: "true" } : { status: k })}>{l}</button>)}</div>
    {loading ? <Loading /> : error ? <ErrorState message={error} /> : <div className="panel"><DataTable rows={data ?? []} rowKey={(a) => a.id} onRowClick={(a) => nav(`/approvals/${a.id}`)} empty={<EmptyState icon="bi-person-check" title="No approvals here" body="Approvals are created automatically by the Policy Engine when a task needs one." />} columns={[
      { key: "k", header: "Request", render: (a) => <div><span className="mono text-secondary me-2">{a.key}</span><span className="fw-semibold">{a.title}</span><div className="small text-secondary">{a.kind.replace("_", " ").toLowerCase()} · requested by {a.requestedByName} · {timeAgo(a.createdAt)}</div></div> },
      { key: "env", header: "Environment", render: (a) => a.environmentName ?? "—" }, { key: "risk", header: "Risk", render: (a) => <StatusBadge status={a.risk} /> },
      { key: "slots", header: "Approvers", render: (a) => <span className="small">{a.slots.map((s) => <span key={s.sequence} className="me-2">{s.status === "APPROVED" ? "✓" : s.status === "REJECTED" ? "✕" : "●"} {s.approver.label}</span>)}</span> },
      { key: "status", header: "Status", render: (a) => <span><StatusBadge status={a.status} />{a.canDecide && a.status === "PENDING" && <span className="status tone-info ms-1">your decision</span>}</span> },
    ]} /></div>}</div>;
}

export function ApprovalDetail() {
  const { id = "" } = useParams();
  const { api, toast, session } = useApp();
  const nav = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.approvals.get(id), [id]);
  const [comment, setComment] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error} action={<Link to="/approvals" className="btn btn-sm btn-outline-secondary">Back</Link>} />;
  const { request: r, change, task, canDecide, requiresTypedConfirmation, confirmationPhrase } = data;
  const decide = async (decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") => {
    setBusy(decision);
    try {
      const res = await api.approvals.decide(r.id, decision, comment || undefined, typed || undefined);
      if (res.request.status === "APPROVED") { toast(`${r.key} approved${res.unlockedTaskId ? " — deployment unlocked" : ""}`, "success"); if (res.unlockedTaskId && change) nav(`/changes/${change.id}`); else reload(); }
      else if (res.request.status === "PENDING") { toast(`Recorded. Waiting for ${res.request.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ")}`, "info"); reload(); }
      else { toast(`${r.key} ${decision.toLowerCase().replace("_", " ")}`, "info"); reload(); }
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(null); }
  };
  return <div>
    <PageHeader title={<span><span className="mono text-secondary fw-normal me-2">{r.key}</span>{r.title}</span>} badge={<><StatusBadge status={r.status} /><StatusBadge status={r.risk} /></>} subtitle={`${r.kind.replace("_", " ")} · requested by ${r.requestedByName} ${timeAgo(r.createdAt)}${r.expiresAt ? ` · expires ${fmtDate(r.expiresAt, false)}` : ""}`} />
    <div className="row g-3"><div className="col-lg-7">
      <Panel title="Request">
        <dl className="kv mb-3"><dt>Risk</dt><dd><StatusBadge status={r.risk} /></dd><dt>Environment</dt><dd>{r.environmentName ?? "—"}</dd><dt>Requested by</dt><dd>{r.requestedByName}</dd>{change && <><dt>Change</dt><dd><Link to={`/changes/${change.id}`}>{change.key} {change.title}</Link></dd></>}{task && <><dt>Task</dt><dd><Link to={`/tasks/${task.id}`}>{task.key} {task.name}</Link> <StatusBadge status={task.status} /></dd></>}</dl>
        <div className="panel-title mb-1">Changes</div><ul className="ps-3 mb-3">{r.summary.map((s) => <li key={s}>{s}</li>)}</ul>
        {r.policyDecision && <><div className="panel-title mb-1">Policy</div><ul className="small ps-3 text-secondary">{r.policyDecision.explanation.map((e, i) => <li key={i}>{e}</li>)}</ul></>}
        <div className="small text-secondary"><i className="bi bi-shield-lock me-1" />Credential references only (e.g. <code>credential: github-production</code>). Secrets are never displayed or sent to AI.</div>
      </Panel>
    </div><div className="col-lg-5">
      <Panel title={`Required approvals: ${r.requiredApprovals} (${r.strategy})`}>
        {r.slots.map((s) => <div key={s.sequence} className="d-flex align-items-center gap-2 py-2 border-bottom"><span style={{ fontSize: 16 }}>{s.status === "APPROVED" ? "✓" : s.status === "REJECTED" ? "✕" : s.status === "CHANGES_REQUESTED" ? "↺" : "●"}</span><div className="flex-grow-1"><div className="fw-semibold">{s.approver.label}</div><div className="small text-secondary">{s.decidedByName ? `${s.decidedByName} · ${timeAgo(s.decidedAt)}${s.comment ? ` · “${s.comment}”` : ""}` : "Pending"}</div></div><StatusBadge status={s.status} /></div>)}
        {r.status === "PENDING" && (canDecide ? <div className="mt-3">
          <label className="form-label">Comment (optional)</label><textarea className="form-control mb-2" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          {requiresTypedConfirmation && <div className="mb-2"><label className="form-label text-danger">{r.risk} risk — type <code>{confirmationPhrase}</code> to approve</label><input className="form-control" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></div>}
          <div className="d-flex gap-2 flex-wrap"><button className="btn btn-success" disabled={busy !== null || (requiresTypedConfirmation && typed !== confirmationPhrase)} onClick={() => decide("APPROVED")}>{busy === "APPROVED" && <i className="bi bi-arrow-repeat spin me-1" />}Approve</button><button className="btn btn-outline-danger" disabled={busy !== null} onClick={() => decide("REJECTED")}>Reject</button><button className="btn btn-outline-secondary" disabled={busy !== null} onClick={() => decide("CHANGES_REQUESTED")}>Request changes</button></div>
        </div> : <div className="alert alert-secondary mt-3 py-2 small"><i className="bi bi-info-circle me-1" />{r.requestedById === session?.user.id ? "You requested this approval; someone else must decide." : `Waiting for ${r.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ")}. Your roles: ${session?.actor.roleKeys.join(", ")}.`}</div>)}
        {r.status === "APPROVED" && task && task.status === "WAITING_APPROVAL" && change && <Link to={`/changes/${change.id}`} className="btn btn-primary mt-3 w-100"><i className="bi bi-rocket-takeoff me-1" />Deployment unlocked — go to change</Link>}
      </Panel>
    </div></div>
  </div>;
}
