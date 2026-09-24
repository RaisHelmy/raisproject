import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { JiraConnectionDTO, ProjectDTO } from "@rais/shared-types";
import { useAuth } from "@/services/auth";
import { api } from "@/services/api";
import { useApi, useAction } from "@/hooks/useApi";
import { Card, ErrorAlert, PageHeader, StatusBadge } from "@/components/ui";

export default function OnboardingPage() {
  const { user, refresh, isAdmin } = useAuth();
  const nav = useNavigate();
  const conn = useApi<JiraConnectionDTO>("/jira/connection");
  const projects = useApi<ProjectDTO[]>("/projects");
  const act = useAction();
  const [aliases, setAliases] = useState(user?.whatsapp_aliases.join(", ") ?? "");
  const [jira, setJira] = useState(user?.jira_account_id ?? "");
  const finish = async () => {
    const r = await act.run(() => api("/auth/profile", { method: "PATCH", body: { whatsapp_aliases: aliases.split(",").map((s) => s.trim()).filter(Boolean), jira_account_id: jira || null, onboarding_completed: true } }));
    if (r) { await refresh(); nav("/imports/new"); }
  };
  const steps = [
    { title: "Connect Jira", done: !!conn.data && !conn.data.demo_mode, body: conn.data?.demo_mode ? <>Jira is in <StatusBadge value="DEMO" /> mode. {isAdmin ? <Link to="/settings/jira">Connect your Jira site</Link> : "An administrator can connect the real Jira site"}; you can continue with the demo adapter for now.</> : <>Connected to {conn.data?.site_url}.</> },
    { title: "Select project", done: (projects.data?.length ?? 0) > 0, body: projects.data?.length ? <>You're a member of {projects.data.map((p) => p.code).join(", ")}.</> : <>You're not a member of any project yet. Ask an administrator to add you.</> },
    { title: "Confirm your Jira account & WhatsApp name", done: !!user?.whatsapp_aliases.length, body: (<div className="row g-2"><div className="col-md-6"><label className="form-label small" htmlFor="ob-al">WhatsApp names (comma-separated)</label><input id="ob-al" className="form-control form-control-sm" value={aliases} onChange={(e) => setAliases(e.target.value)} /></div><div className="col-md-6"><label className="form-label small" htmlFor="ob-jira">Jira account id (optional)</label><input id="ob-jira" className="form-control form-control-sm" value={jira} onChange={(e) => setJira(e.target.value)} /></div></div>) },
    { title: "Import your first WhatsApp conversation", done: false, body: "Export a chat from WhatsApp (without media) and upload the .txt file." },
    { title: "Review AI work", done: false, body: "Confirm or adjust each suggested task. Inferred values are clearly marked." },
    { title: "Submit timesheet", done: false, body: "Send drafts to your timesheet owner. After approval, Jira synchronisation and reports follow." },
  ];
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHeader title={`Welcome to Rais Timesheet, ${user?.name.split(" ")[0]}`} subtitle="Six short steps. Most of the work is automated — you only confirm exceptions." />
      {steps.map((s, i) => (
        <Card key={s.title} className="mb-3">
          <div className="d-flex gap-3">
            <div className={`rounded-circle d-grid place-items-center flex-shrink-0 ${s.done ? "bg-success text-white" : "bg-light border"}`} style={{ width: 34, height: 34, display: "grid", placeItems: "center" }}>{s.done ? <i className="bi bi-check-lg" /> : i + 1}</div>
            <div className="flex-grow-1"><div className="fw-semibold mb-1">Step {i + 1} · {s.title}</div><div className="small">{s.body}</div></div>
          </div>
        </Card>
      ))}
      <ErrorAlert error={act.error} />
      <div className="d-flex gap-2"><button className="btn btn-primary" onClick={finish} disabled={act.busy || !aliases.trim()}>{act.busy && <span className="spinner-border spinner-border-sm me-2" />}Save and import my first conversation</button>{user?.onboarding_completed && <Link to="/" className="btn btn-outline-secondary">Back to dashboard</Link>}</div>
    </div>
  );
}
