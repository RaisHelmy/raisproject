import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ProjectDTO, TimesheetDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ConfidenceBadge, ConfirmModal, DataTable, Duration, EmptyState, ErrorAlert, PageHeader, Pagination, Spinner, StatCard, StatusBadge, useToast, type Column } from "@/components/ui";
import { fmtDate, formatMinutes } from "@/services/format";
import { bulkInChunks, fetchAllTimesheetIds } from "@/services/bulk";

interface ListResponse { items: TimesheetDTO[]; total: number; page: number; page_size: number; summary: { count: number; minutes: number; projects: number } }

export default function ApprovalsPage() {
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page") ?? "1");
  const projectId = sp.get("project_id") ?? "";
  const projects = useApi<ProjectDTO[]>("/projects", { all: 1 });
  const list = useApi<ListResponse>("/timesheets", { scope: "all", status: "SUBMITTED", page, page_size: 50, project_id: projectId, sort: "work_date", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [known, setKnown] = useState<Map<string, TimesheetDTO>>(new Map());
  const [progress, setProgress] = useState<string | null>(null);
  const [modal, setModal] = useState<"approve" | "reject" | null>(null);
  const act = useAction();
  const toast = useToast();

  const sel = useMemo(() => {
    const m = new Map(known);
    for (const t of list.data?.items ?? []) m.set(t.id, t);
    return [...selected].map((id) => m.get(id)).filter((t): t is TimesheetDTO => !!t);
  }, [known, list.data, selected]);
  const selMinutes = sel.reduce((a, t) => a + t.duration_minutes, 0);
  const selProjects = [...new Set(sel.map((t) => t.project_code))];
  const selDates = sel.map((t) => t.work_date).sort();
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => {
    const pageIds = list.data?.items.map((x) => x.id) ?? [];
    const n = new Set(s);
    if (pageIds.every((id) => n.has(id))) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id));
    return n;
  });
  const selectAllMatching = async () => {
    const r = await act.run(() => fetchAllTimesheetIds({ scope: "all", status: "SUBMITTED", project_id: projectId }));
    if (r) { setKnown(new Map(r.map((t) => [t.id, t]))); setSelected(new Set(r.map((t) => t.id))); }
  };

  const bulk = async (action: "approve" | "reject", reason?: string) => {
    const ids = [...selected];
    const r = await act.run(async () => ({ data: await bulkInChunks(action, ids, reason, (n) => setProgress(`${n}/${ids.length}`)) }));
    setModal(null); setProgress(null);
    if (r) { toast.show(`${r.data.succeeded.length} ${action === "approve" ? "approved" : "rejected"}${r.data.failed.length ? `, ${r.data.failed.length} failed` : ""}`, r.data.failed.length ? "info" : "success"); setSelected(new Set()); list.reload(); }
  };

  const columns: Column<TimesheetDTO>[] = [
    { key: "date", header: "Date", render: (r) => fmtDate(r.work_date, "month"), priority: 1, width: "80px" },
    { key: "task", header: "Task", render: (r) => <><Link to={`/approvals/${r.id}`} className="fw-medium text-decoration-none text-reset">{r.title}</Link><div className="small text-secondary">{r.reference} · {r.user_name}</div></>, priority: 1 },
    { key: "project", header: "Project", render: (r) => <span className="badge text-bg-light border">{r.project_code}</span>, priority: 2 },
    { key: "duration", header: "Duration", render: (r) => <Duration minutes={r.duration_minutes} />, priority: 1 },
    { key: "work", header: "Status", render: (r) => <StatusBadge value={r.work_status} />, priority: 3 },
    { key: "conf", header: "Confidence", render: (r) => r.ai_generated ? <ConfidenceBadge value={r.confidence} /> : <span className="small text-secondary">Manual</span>, priority: 3 },
    { key: "act", header: "", className: "text-end text-nowrap", render: (r) => <><Link to={`/approvals/${r.id}`} className="btn btn-sm btn-outline-secondary me-1">Review</Link><button className="btn btn-sm btn-success" onClick={async () => { const x = await act.run(() => api(`/timesheets/${r.id}/approve`, { body: {} })); if (x) { toast.show(`${r.reference} approved`); list.reload(); } }}>Approve</button></>, priority: 1 },
  ];

  return (
    <div>
      <PageHeader title="Pending Approval" subtitle="Review submitted work. Approving makes it an official record and starts Jira reconciliation."
        actions={<>{list.data && list.data.total > 0 && selected.size < list.data.total && <button className="btn btn-outline-secondary" onClick={selectAllMatching} disabled={act.busy}><i className="bi bi-check2-all me-1" />Select all {list.data.total}</button>}{selected.size > 0 && <><button className="btn btn-outline-secondary" onClick={() => setSelected(new Set())}>Clear selection</button><button className="btn btn-outline-danger" onClick={() => setModal("reject")}>Reject {selected.size}</button><button className="btn btn-success" onClick={() => setModal("approve")}><i className="bi bi-check2-all me-1" />Approve {selected.size} selected</button></>}</>} />
      {list.data && (
        <div className="row g-3 mb-3">
          <div className="col-4"><StatCard label="Entries" value={list.data.summary.count} tone={list.data.summary.count ? "warning" : "success"} /></div>
          <div className="col-4"><StatCard label="Hours" value={formatMinutes(list.data.summary.minutes)} /></div>
          <div className="col-4"><StatCard label="Projects" value={list.data.summary.projects} /></div>
        </div>
      )}
      <Card className="mb-3"><div className="row g-2 align-items-end"><div className="col-md-4"><label className="form-label small mb-1" htmlFor="ap-project">Project</label><select id="ap-project" className="form-select form-select-sm" value={projectId} onChange={(e) => { const n = new URLSearchParams(sp); e.target.value ? n.set("project_id", e.target.value) : n.delete("project_id"); n.delete("page"); setSp(n); }}><option value="">All projects</option>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></div><div className="col-md-8 small text-secondary">Tip: select rows to approve or reject in bulk. The confirmation shows totals before anything changes.</div></div></Card>
      <ErrorAlert error={list.error} onRetry={list.reload} /><ErrorAlert error={act.error} />
      {!list.data ? <Spinner /> : (
        <Card className="p-0">
          {selected.size > 0 && (
            <div className="alert alert-primary rounded-0 border-0 border-bottom py-2 px-3 mb-0 small d-flex flex-wrap gap-2 align-items-center">
              <span><strong>{selected.size}</strong> of {list.data.total} selected · {formatMinutes(selMinutes)}.</span>
              {selected.size < list.data.total && <button className="btn btn-link btn-sm p-0" onClick={selectAllMatching} disabled={act.busy}>Select all {list.data.total} pending entries</button>}
              <button className="btn btn-link btn-sm p-0 ms-auto" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          <DataTable columns={columns} rows={list.data.items} keyOf={(r) => r.id} selectable selected={selected} onToggle={toggle} onToggleAll={toggleAll} rowLink={(r) => `/approvals/${r.id}`} empty={<EmptyState title="You're all caught up." body="No timesheets are waiting for approval." />} />
          <div className="px-3 pb-3"><Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={(p) => { const n = new URLSearchParams(sp); n.set("page", String(p)); setSp(n); }} /></div>
        </Card>
      )}
      <ConfirmModal open={modal === "approve"} title={`Approve ${selected.size} timesheet${selected.size === 1 ? "" : "s"}?`} tone="success" confirmLabel={progress ? `Approving ${progress}…` : `Approve ${selected.size}`} onConfirm={() => bulk("approve")} onClose={() => setModal(null)} busy={act.busy}
        body={<dl className="row mb-0"><dt className="col-4">Total</dt><dd className="col-8">{formatMinutes(selMinutes)}</dd><dt className="col-4">Projects</dt><dd className="col-8">{selProjects.join(", ")}</dd><dt className="col-4">Date range</dt><dd className="col-8">{selDates.length ? `${fmtDate(selDates[0])} – ${fmtDate(selDates[selDates.length - 1])}` : "—"}</dd><dt className="col-4">People</dt><dd className="col-8">{[...new Set(sel.map((t) => t.user_name))].join(", ")}</dd></dl>} />
      <ConfirmModal open={modal === "reject"} title={`Reject ${selected.size} timesheet${selected.size === 1 ? "" : "s"}`} tone="danger" confirmLabel={progress ? `Rejecting ${progress}…` : `Reject ${selected.size}`} requireReason reasonLabel="Reason (sent to each author)" onConfirm={(reason) => bulk("reject", reason)} onClose={() => setModal(null)} busy={act.busy} body={<p>{formatMinutes(selMinutes)} across {selProjects.join(", ")} will be returned to the authors.</p>} />
      {toast.node}
    </div>
  );
}
