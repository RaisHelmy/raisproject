import { Link, useParams } from "react-router-dom";
import type { AnalysisSummaryDTO, ImportDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ErrorAlert, KeyValue, PageHeader, Spinner, StatusBadge, Steps, Warnings, useToast } from "@/components/ui";
import { fmtDateTime } from "@/services/format";

interface Detail { import: ImportDTO; analysis: { id: string; status: string; provider: string; model: string | null; is_demo: boolean; started_at: string; completed_at: string | null; error: string | null; summary: AnalysisSummaryDTO | null } | null }

export default function ImportDetailPage() {
  const { id } = useParams();
  const d = useApi<Detail>(`/imports/${id}`, undefined, { poll: 3000 });
  const act = useAction();
  const toast = useToast();
  if (d.error) return <ErrorAlert error={d.error} onRetry={d.reload} />;
  if (!d.data) return <Spinner />;
  const imp = d.data.import;
  const s = d.data.analysis?.summary;
  const running = ["QUEUED", "PARSING", "ANALYSING"].includes(imp.status);
  const progress = imp.message_count ? Math.round((imp.messages_processed / imp.message_count) * 100) : imp.status === "PARSING" ? 10 : 0;
  const analyse = async () => { const r = await act.run(() => api(`/imports/${imp.id}/analyse`, { body: {} })); if (r) { toast.show("Analysis started"); d.reload(); } };

  return (
    <div>
      <PageHeader title={imp.filename} breadcrumb={[{ label: "Import History", to: "/imports" }, { label: "Import" }]} subtitle={<span className="d-inline-flex gap-2 align-items-center"><StatusBadge value={imp.status} /> {imp.project_code} · uploaded {fmtDateTime(imp.created_at)}</span>}
        actions={<>{imp.status === "READY_FOR_REVIEW" && <Link to={`/imports/${imp.id}/review`} className="btn btn-primary"><i className="bi bi-stars me-1" />Review AI work</Link>}{imp.status === "COMPLETED" && <Link to={`/imports/${imp.id}/review`} className="btn btn-outline-primary">View review</Link>}{!running && <button className="btn btn-outline-secondary" onClick={analyse} disabled={act.busy}>{imp.status === "UPLOADED" ? "Analyse conversation" : "Re-analyse"}</button>}</>} />
      <Card className="mb-3"><Steps steps={["Import work", "Review AI", "Submit", "Approval", "Jira sync", "Report"]} active={imp.status === "READY_FOR_REVIEW" || imp.status === "COMPLETED" ? 1 : 0} /></Card>
      <ErrorAlert error={act.error} />
      {running && (
        <Card className="mb-3">
          <div className="d-flex align-items-center gap-3 mb-2"><span className="spinner-border spinner-border-sm text-primary" /><strong>{imp.status === "PARSING" ? "Reading conversation…" : imp.status === "ANALYSING" ? "Analysing conversation…" : "Queued for analysis…"}</strong></div>
          <div className="progress mb-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${Math.max(5, progress)}%` }} /></div>
          <div className="row small text-secondary"><div className="col-auto">Messages processed: <strong>{imp.messages_processed.toLocaleString()} / {imp.message_count.toLocaleString() || "…"}</strong></div><div className="col-auto">Tasks detected: <strong>{imp.tasks_detected}</strong></div></div>
        </Card>
      )}
      {imp.status === "FAILED" && <div className="alert alert-danger"><div className="fw-semibold">Analysis failed</div>{imp.error_message}<div className="mt-2"><button className="btn btn-sm btn-outline-danger" onClick={analyse}>Try again</button></div></div>}
      {imp.status === "UPLOADED" && <div className="alert alert-info">This conversation has been uploaded but not analysed yet. Click <strong>Analyse conversation</strong> to start.</div>}
      <div className="row g-3">
        <div className="col-lg-6">
          <Card title="Import">
            <KeyValue items={[{ label: "File", value: imp.filename }, { label: "Size", value: `${Math.round(imp.file_size / 1024)} KB` }, { label: "Project", value: imp.project_code }, { label: "Messages", value: imp.message_count || "—" }, { label: "Tasks detected", value: imp.tasks_detected }, { label: "AI provider", value: imp.ai_provider ?? "—" }]} />
          </Card>
        </div>
        <div className="col-lg-6">
          {s && (
            <Card title="Analysis summary">
              {s.is_demo && <div className="alert alert-info py-2 small"><i className="bi bi-info-circle me-1" />Demo analysis by the heuristic provider — review all inferred values.</div>}
              <Warnings items={s.warnings} />
              <KeyValue items={[{ label: "Provider", value: `${s.provider}${s.model ? ` · ${s.model}` : ""}` }, { label: "Work messages", value: `${s.work_message_count} of ${s.message_count} (${s.noise_message_count} noise)` }, { label: "Your tasks", value: s.task_count }, { label: "Participants", value: <ul className="list-unstyled mb-0">{s.participants.map((p) => <li key={p.name}>{p.is_me ? <strong>{p.name} (you)</strong> : p.name} <span className="badge text-bg-light border ms-1">{p.role}</span> <span className="text-secondary small">{p.message_count} msgs</span></li>)}</ul> }]} />
            </Card>
          )}
        </div>
      </div>
      {toast.node}
    </div>
  );
}
