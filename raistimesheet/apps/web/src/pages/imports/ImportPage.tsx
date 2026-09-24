import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ImportDTO, ProjectDTO } from "@rais/shared-types";
import { useApi, useAction } from "@/hooks/useApi";
import { api } from "@/services/api";
import { Card, ErrorAlert, PageHeader, Steps, Warnings } from "@/components/ui";
import { useAuth } from "@/services/auth";

export default function ImportPage() {
  const projects = useApi<ProjectDTO[]>("/projects");
  const { demo } = useAuth();
  const nav = useNavigate();
  const act = useAction();
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drag, setDrag] = useState(false);
  const pid = projectId || projects.data?.[0]?.id || "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !pid) return;
    const form = new FormData();
    form.append("file", file);
    form.append("project_id", pid);
    const r = await act.run(() => api<ImportDTO>("/imports", { form }));
    if (r) { setWarnings(r.warnings); nav(`/imports/${r.data.id}`); }
  };

  return (
    <div>
      <PageHeader title="WhatsApp Import" subtitle="Upload an exported chat. The assistant reads it, finds your work and prepares draft timesheets for review." />
      <Card className="mb-3"><Steps steps={["Import work", "Review AI", "Submit", "Approval", "Jira sync", "Report"]} active={0} /></Card>
      <div className="row g-3">
        <div className="col-lg-7">
          <Card title="Upload conversation">
            <Warnings items={warnings} />
            <form onSubmit={submit}>
              <div className="mb-3">
                <label htmlFor="project" className="form-label">Project</label>
                <select id="project" className="form-select" value={pid} onChange={(e) => setProjectId(e.target.value)} required>{projects.data?.map((p) => <option key={p.id} value={p.id}>{p.client_name} — {p.name}</option>)}</select>
                <div className="form-text">Sets the timezone, Jira project and who the work belongs to.</div>
              </div>
              <label htmlFor="file" className="form-label">WhatsApp export (.txt)</label>
              <div className={`border rounded p-4 text-center mb-3 ${drag ? "border-primary bg-light" : "border-dashed"}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}>
                <i className="bi bi-cloud-arrow-up fs-2 text-secondary" />
                <div className="mt-2">{file ? <strong>{file.name}</strong> : "Drag the exported chat here, or choose a file"}</div>
                <div className="small text-secondary">{file ? `${Math.round(file.size / 1024)} KB` : "Text exports only for now (up to 10 MB). PDF, DOCX, HTML, JSON and screenshots are planned."}</div>
                <input id="file" type="file" accept=".txt,text/plain" className="form-control mt-3" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <ErrorAlert error={act.error} />
              <button className="btn btn-primary" disabled={!file || !pid || act.busy}>{act.busy && <span className="spinner-border spinner-border-sm me-2" />}<i className="bi bi-stars me-1" />Upload &amp; analyse conversation</button>
              <Link to="/imports" className="btn btn-link">Import history</Link>
            </form>
          </Card>
        </div>
        <div className="col-lg-5">
          <Card title="How to export a chat from WhatsApp" className="mb-3">
            <ol className="mb-0 ps-3 small">
              <li className="mb-1">Open the group or chat in WhatsApp.</li>
              <li className="mb-1">Tap the chat name → <strong>Export chat</strong>.</li>
              <li className="mb-1">Choose <strong>Without media</strong>.</li>
              <li>Save or send the <code>.txt</code> file to yourself, then upload it here.</li>
            </ol>
          </Card>
          <Card title="What the assistant does">
            <ul className="mb-0 ps-3 small">
              <li>Identifies participants and which messages are yours.</li>
              <li>Separates work from greetings, thanks and chatter.</li>
              <li>Groups related messages into logical tasks.</li>
              <li>Infers dates and effort, and tells you what was inferred.</li>
              <li>Suggests Jira matches. Nothing is created without you.</li>
            </ul>
            {demo.ai && <div className="alert alert-info py-2 small mt-3 mb-0"><i className="bi bi-info-circle me-1" />AI demo mode: the rule-based heuristic provider is active. Configure <code>ANTHROPIC_API_KEY</code> for Claude-based analysis.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
