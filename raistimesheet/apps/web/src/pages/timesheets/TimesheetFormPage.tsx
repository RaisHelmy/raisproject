import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ProjectDTO, TimesheetDTO, WorkStatus } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ErrorAlert, PageHeader, Spinner } from "@/components/ui";
import { addDays, formatMinutes, todayIso } from "@/services/format";

interface Detail { timesheet: TimesheetDTO }

export default function TimesheetFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const projects = useApi<ProjectDTO[]>("/projects");
  const existing = useApi<Detail>(id ? `/timesheets/${id}` : null);
  const act = useAction();
  const [f, setF] = useState({ project_id: "", work_date: todayIso(), title: "", description: "", start_time: "", end_time: "", duration_minutes: 60, work_status: "COMPLETED" as WorkStatus, reason: "" });
  const [durationMode, setDurationMode] = useState<"duration" | "times">("duration");

  useEffect(() => {
    if (existing.data) {
      const t = existing.data.timesheet;
      setF({ project_id: t.project_id, work_date: t.work_date, title: t.title, description: t.description, start_time: t.start_time ?? "", end_time: t.end_time ?? "", duration_minutes: t.duration_minutes, work_status: t.work_status, reason: "" });
      if (t.start_time && t.end_time) setDurationMode("times");
    }
  }, [existing.data]);
  useEffect(() => { if (!id && projects.data?.length && !f.project_id) setF((x) => ({ ...x, project_id: projects.data![0]!.id })); }, [projects.data, id, f.project_id]);

  const isApprovedEdit = existing.data?.timesheet.status === "APPROVED";
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { project_id: f.project_id, work_date: f.work_date, title: f.title, description: f.description, work_status: f.work_status };
    if (durationMode === "times") { body.start_time = f.start_time || null; body.end_time = f.end_time || null; body.duration_minutes = undefined; } else { body.duration_minutes = Number(f.duration_minutes); body.start_time = null; body.end_time = null; }
    if (isApprovedEdit) body.reason = f.reason;
    const r = await act.run(() => id ? api<TimesheetDTO>(`/timesheets/${id}`, { method: "PATCH", body }) : api<TimesheetDTO>("/timesheets", { body }));
    if (r) nav(`/timesheets/${r.data.id}`);
  };

  if (id && !existing.data) return existing.error ? <ErrorAlert error={existing.error} /> : <Spinner />;
  const h = Math.floor(f.duration_minutes / 60), m = f.duration_minutes % 60;

  return (
    <div>
      <PageHeader title={id ? "Edit timesheet" : "New timesheet entry"} breadcrumb={[{ label: "My Timesheets", to: "/timesheets" }, { label: id ? existing.data!.timesheet.reference : "New" }]} subtitle={id ? existing.data!.timesheet.reference : "Record work for any date — today, last week or last month."} />
      {isApprovedEdit && <div className="alert alert-warning"><i className="bi bi-shield-exclamation me-2" />This timesheet is <strong>approved</strong> and is an official record. Changes are audited with your reason and, if linked, noted on the Jira issue.</div>}
      <form onSubmit={submit} className="row g-3">
        <div className="col-lg-8">
          <Card title="Work summary" className="mb-3">
            <div className="mb-3"><label htmlFor="title" className="form-label">Task title</label><input id="title" className="form-control" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={3} maxLength={200} placeholder="e.g. Investigate and resolve API database timeout" /></div>
            <div className="mb-3"><label htmlFor="desc" className="form-label">Description <span className="text-secondary">(optional)</span></label><textarea id="desc" className="form-control" rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What was done, for whom, and the outcome." /></div>
            <div className="row g-3">
              <div className="col-md-6"><label htmlFor="project" className="form-label">Project</label><select id="project" className="form-select" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })} required>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.client_name} — {p.name}</option>)}</select></div>
              <div className="col-md-6"><label htmlFor="ws" className="form-label">Work status</label><select id="ws" className="form-select" value={f.work_status} onChange={(e) => setF({ ...f, work_status: e.target.value as WorkStatus })}><option value="COMPLETED">Completed</option><option value="IN_PROGRESS">In progress</option><option value="BLOCKED">Blocked</option></select></div>
            </div>
          </Card>
          <Card title="Time">
            <div className="row g-3 align-items-end">
              <div className="col-md-5"><label htmlFor="date" className="form-label">Work date</label><input id="date" type="date" className="form-control" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} required /></div>
              <div className="col-md-7"><div className="btn-group btn-group-sm" role="group" aria-label="Quick dates">{[["Today", 0], ["Yesterday", -1], ["-2 days", -2], ["Last week", -7]].map(([l, n]) => <button type="button" key={String(l)} className="btn btn-outline-secondary" onClick={() => setF({ ...f, work_date: addDays(todayIso(), Number(n)) })}>{l}</button>)}</div></div>
            </div>
            <div className="mt-3">
              <div className="form-check form-check-inline"><input className="form-check-input" type="radio" id="dm1" checked={durationMode === "duration"} onChange={() => setDurationMode("duration")} /><label className="form-check-label" htmlFor="dm1">Enter duration</label></div>
              <div className="form-check form-check-inline"><input className="form-check-input" type="radio" id="dm2" checked={durationMode === "times"} onChange={() => setDurationMode("times")} /><label className="form-check-label" htmlFor="dm2">Enter start &amp; end time</label></div>
            </div>
            {durationMode === "duration" ? (
              <div className="row g-2 mt-1 align-items-center">
                <div className="col-auto"><label htmlFor="dh" className="form-label small mb-0">Hours</label><input id="dh" type="number" min={0} max={24} className="form-control" style={{ width: 90 }} value={h} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) * 60 + m })} /></div>
                <div className="col-auto"><label htmlFor="dmn" className="form-label small mb-0">Minutes</label><input id="dmn" type="number" min={0} max={59} step={5} className="form-control" style={{ width: 90 }} value={m} onChange={(e) => setF({ ...f, duration_minutes: h * 60 + Number(e.target.value) })} /></div>
                <div className="col-auto pt-4 text-secondary">= {formatMinutes(f.duration_minutes)}</div>
              </div>
            ) : (
              <div className="row g-2 mt-1">
                <div className="col-auto"><label htmlFor="st" className="form-label small mb-0">Start</label><input id="st" type="time" className="form-control" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} required /></div>
                <div className="col-auto"><label htmlFor="et" className="form-label small mb-0">End</label><input id="et" type="time" className="form-control" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} required /></div>
              </div>
            )}
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Save">
            {isApprovedEdit && <div className="mb-3"><label htmlFor="reason" className="form-label">Reason for change</label><textarea id="reason" className="form-control" rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required minLength={5} placeholder="e.g. Corrected after review with PIC" /></div>}
            <ErrorAlert error={act.error} />
            <button className="btn btn-primary w-100 mb-2" disabled={act.busy}>{act.busy && <span className="spinner-border spinner-border-sm me-2" />}{id ? "Save changes" : "Save as draft"}</button>
            <Link to={id ? `/timesheets/${id}` : "/timesheets"} className="btn btn-outline-secondary w-100">Cancel</Link>
            <p className="small text-secondary mt-3 mb-0">Drafts can be edited freely. Submit when you're ready for approval.</p>
          </Card>
        </div>
      </form>
    </div>
  );
}
