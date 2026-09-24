import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ProjectDTO, TimesheetDTO } from "@rais/shared-types";
import { useApi, useAction, useDebounced } from "@/hooks/useApi";
import { Card, ConfidenceBadge, ConfirmModal, DataTable, Duration, EmptyState, ErrorAlert, PageHeader, Pagination, Spinner, StatusBadge, useToast, type Column } from "@/components/ui";
import { dateShortcut, fmtDate, formatMinutes } from "@/services/format";
import { useAuth } from "@/services/auth";
import { bulkInChunks, fetchAllTimesheetIds } from "@/services/bulk";

interface ListResponse { items: TimesheetDTO[]; total: number; page: number; page_size: number; summary: { count: number; minutes: number; projects: number } }

const TITLES: Record<string, { title: string; subtitle: string; empty: string }> = {
  all: { title: "My Timesheets", subtitle: "Every work entry you've recorded, whatever its status.", empty: "No timesheets yet. Import a WhatsApp conversation or add an entry manually." },
  DRAFT: { title: "Drafts", subtitle: "Entries you haven't submitted for approval yet.", empty: "No drafts. Everything has been submitted." },
  SUBMITTED: { title: "Submitted", subtitle: "Waiting for the timesheet owner to approve.", empty: "Nothing is waiting for approval." },
  APPROVED: { title: "Approved", subtitle: "Official records. Jira synchronisation happens from here.", empty: "No approved timesheets yet." },
  REJECTED: { title: "Rejected", subtitle: "Returned by the approver. Edit and resubmit.", empty: "No rejected timesheets. Nice." },
};

export default function TimesheetListPage({ view, scope = "mine" }: { view: string; scope?: "mine" | "all" }) {
  const [sp, setSp] = useSearchParams();
  const { isApprover } = useAuth();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const dq = useDebounced(q);
  const page = Number(sp.get("page") ?? "1");
  const projectId = sp.get("project_id") ?? "";
  const range = sp.get("range") ?? "";
  const dates = range ? dateShortcut(range) : { from: sp.get("date_from") ?? "", to: sp.get("date_to") ?? "" };
  const projects = useApi<ProjectDTO[]>("/projects");
  const query = useMemo(() => ({ scope, status: view === "all" ? undefined : view, page, page_size: 25, q: dq, project_id: projectId, date_from: dates.from, date_to: dates.to, sort: sp.get("sort") ?? "work_date", dir: sp.get("dir") ?? "desc" }), [scope, view, page, dq, projectId, dates.from, dates.to, sp]);
  const list = useApi<ListResponse>("/timesheets", query);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const act = useAction();
  const toast = useToast();
  const t = TITLES[view] ?? TITLES.all!;

  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); if (k !== "page") n.delete("page"); setSp(n); };
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => {
    const pageIds = list.data?.items.map((x) => x.id) ?? [];
    const n = new Set(s);
    if (pageIds.every((id) => n.has(id))) pageIds.forEach((id) => n.delete(id)); else pageIds.forEach((id) => n.add(id));
    return n;
  });
  const [progress, setProgress] = useState<string | null>(null);
  const filterQuery = useMemo(() => { const { page: _p, page_size: _s, sort: _o, dir: _d, ...rest } = query; return rest; }, [query]);
  const selectAllMatching = async () => {
    const r = await act.run(async () => ({ data: await fetchAllTimesheetIds(filterQuery), warnings: [] as string[] }));
    if (r) setSelected(new Set(r.data.map((x) => x.id)));
  };
  const submitSelected = async () => {
    const ids = [...selected];
    const r = await act.run(async () => ({ data: await bulkInChunks("submit", ids, undefined, (n) => setProgress(`${n}/${ids.length}`)), warnings: [] as string[] }));
    setConfirm(false); setProgress(null);
    if (r) { toast.show(`${r.data.succeeded.length} submitted${r.data.failed.length ? `, ${r.data.failed.length} could not be submitted` : ""}`, r.data.failed.length ? "info" : "success"); setSelected(new Set()); list.reload(); }
  };

  const columns: Column<TimesheetDTO>[] = [
    { key: "date", header: "Date", render: (r) => <Link to={`/timesheets/${r.id}`} className="fw-semibold text-decoration-none">{fmtDate(r.work_date, "month")}</Link>, priority: 1, width: "90px" },
    { key: "task", header: "Task", render: (r) => <><Link to={`/timesheets/${r.id}`} className="text-decoration-none text-reset fw-medium">{r.title}</Link><div className="small text-secondary">{r.reference}{scope === "all" ? ` · ${r.user_name}` : ""}</div></>, priority: 1 },
    { key: "project", header: "Project", render: (r) => <span className="badge text-bg-light border">{r.project_code}</span>, priority: 2 },
    { key: "duration", header: "Duration", render: (r) => <Duration minutes={r.duration_minutes} />, priority: 1, className: "text-nowrap" },
    { key: "work", header: "Status", render: (r) => <StatusBadge value={r.work_status} />, priority: 3 },
    { key: "approval", header: "Approval", render: (r) => <StatusBadge value={r.status} />, priority: 1 },
    { key: "jira", header: "Jira", render: (r) => r.jira_issue_key ? <Link to={`/jira/tasks/${r.jira_issue_key}`} className="text-decoration-none">{r.jira_issue_key}</Link> : r.status === "APPROVED" ? <StatusBadge value={r.jira_sync_status} /> : <span className="text-secondary">—</span>, priority: 2 },
    { key: "conf", header: "Confidence", render: (r) => r.ai_generated ? <ConfidenceBadge value={r.confidence} /> : <span className="text-secondary small">Manual</span>, priority: 3 },
    { key: "actions", header: "", render: (r) => <Link to={`/timesheets/${r.id}`} className="btn btn-sm btn-outline-secondary">View</Link>, priority: 3, className: "text-end" },
  ];

  const draftSelectable = view === "DRAFT" || view === "REJECTED";
  return (
    <div>
      <PageHeader title={t.title} subtitle={list.data ? <>{list.data.summary.count} entries · {formatMinutes(list.data.summary.minutes)} · {list.data.summary.projects} project{list.data.summary.projects === 1 ? "" : "s"}</> : t.subtitle}
        actions={<>{draftSelectable && list.data && list.data.total > 0 && selected.size < list.data.total && <button className="btn btn-outline-secondary" onClick={selectAllMatching} disabled={act.busy}><i className="bi bi-check2-all me-1" />Select all {list.data.total}</button>}{draftSelectable && selected.size > 0 && <button className="btn btn-outline-secondary" onClick={() => setSelected(new Set())}>Clear selection</button>}{draftSelectable && selected.size > 0 && <button className="btn btn-primary" onClick={() => setConfirm(true)}><i className="bi bi-send me-1" />Submit {selected.size} selected</button>}<Link to="/imports/new" className="btn btn-outline-primary"><i className="bi bi-whatsapp me-1" />Import WhatsApp</Link><Link to="/timesheets/new" className="btn btn-primary"><i className="bi bi-plus-lg me-1" />New entry</Link></>} />

      <Card className="mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-4"><label className="form-label small mb-1" htmlFor="ts-search">Search</label><input id="ts-search" className="form-control form-control-sm" placeholder="Title, description, reference, Jira key" value={q} onChange={(e) => { setQ(e.target.value); set("q", e.target.value); }} /></div>
          <div className="col-md-3"><label className="form-label small mb-1" htmlFor="ts-project">Project</label><select id="ts-project" className="form-select form-select-sm" value={projectId} onChange={(e) => set("project_id", e.target.value)}><option value="">All projects</option>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></div>
          <div className="col-md-3"><label className="form-label small mb-1" htmlFor="ts-range">Period</label><select id="ts-range" className="form-select form-select-sm" value={range} onChange={(e) => set("range", e.target.value)}><option value="">All time</option><option value="today">Today</option><option value="this_week">This week</option><option value="last_week">Last week</option><option value="this_month">This month</option><option value="last_month">Last month</option><option value="quarter">This quarter</option></select></div>
          <div className="col-md-2"><label className="form-label small mb-1" htmlFor="ts-sort">Sort</label><select id="ts-sort" className="form-select form-select-sm" value={`${sp.get("sort") ?? "work_date"}:${sp.get("dir") ?? "desc"}`} onChange={(e) => { const [s, d] = e.target.value.split(":"); const n = new URLSearchParams(sp); n.set("sort", s!); n.set("dir", d!); setSp(n); }}><option value="work_date:desc">Newest first</option><option value="work_date:asc">Oldest first</option><option value="duration_minutes:desc">Longest first</option><option value="updated_at:desc">Recently updated</option></select></div>
        </div>
      </Card>

      <ErrorAlert error={list.error} onRetry={list.reload} />
      {act.error && <ErrorAlert error={act.error} />}
      {list.loading && !list.data ? <Spinner /> : list.data && (
        <Card className="p-0">
          {draftSelectable && selected.size > 0 && (
            <div className="alert alert-primary rounded-0 border-0 border-bottom py-2 px-3 mb-0 small d-flex flex-wrap gap-2 align-items-center">
              <span><strong>{selected.size}</strong> of {list.data.total} selected{selected.size < list.data.total && list.data.items.every((x) => selected.has(x.id)) ? " (this page)" : ""}.</span>
              {selected.size < list.data.total && <button className="btn btn-link btn-sm p-0" onClick={selectAllMatching} disabled={act.busy}>Select all {list.data.total} matching entries</button>}
              <button className="btn btn-link btn-sm p-0 ms-auto" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          <DataTable columns={columns} rows={list.data.items} keyOf={(r) => r.id} selectable={draftSelectable} selected={selected} onToggle={toggle} onToggleAll={toggleAll} rowLink={(r) => `/timesheets/${r.id}`}
            empty={<EmptyState icon={view === "REJECTED" || view === "DRAFT" ? "check2-circle" : "journal-text"} title={t.empty} action={view === "all" ? <Link to="/imports/new" className="btn btn-primary">Import WhatsApp conversation</Link> : undefined} />} />
          <div className="px-3 pb-3"><Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={(p) => set("page", String(p))} /></div>
        </Card>
      )}
      <ConfirmModal open={confirm} title={`Submit ${selected.size} timesheet${selected.size === 1 ? "" : "s"}?`} body={<p>They will be sent to the timesheet owner for approval. You can't edit them while they're under review.</p>} confirmLabel={progress ? `Submitting ${progress}…` : `Submit ${selected.size}`} onConfirm={submitSelected} onClose={() => setConfirm(false)} busy={act.busy} />
      {toast.node}
      {isApprover && scope === "mine" && view === "all" && <p className="small text-secondary mt-3">Looking for your team's work? Use <Link to="/approvals">Approvals</Link> or <Link to="/reports">Reports</Link>.</p>}
    </div>
  );
}
