const ICONS: Record<string, string> = { cloudflare: "bi-cloud", github: "bi-github", gitlab: "bi-gitlab", hetzner: "bi-hdd-rack", slack: "bi-slack" };
const INTEGRATIONS = [
  { kind: "cloudflare", name: "Cloudflare (merc999.dev account)", status: "connected" },
  { kind: "github", name: "GitHub App", status: "connected" },
  { kind: "gitlab", name: "GitLab OAuth", status: "connected" },
  { kind: "hetzner", name: "Hetzner Cloud", status: "connected" },
  { kind: "slack", name: "Slack #ops-alerts", status: "disconnected" },
];

export function Integrations() {
  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Integrations</h1>
          <div className="rf-page-sub">Connect cloud providers, Git and notification channels.</div>
        </div>
      </div>
      <div className="row g-3">
        {INTEGRATIONS.map((i) => (
          <div className="col-md-6 col-xl-4" key={i.kind}>
            <div className="rf-card d-flex align-items-center gap-3">
              <i className={`bi ${ICONS[i.kind]}`} style={{ fontSize: 22 }} />
              <div className="flex-grow-1">
                <div className="fw-medium">{i.name}</div>
                <div className={`rf-faint ${i.status === "connected" ? "text-success" : ""}`}>{i.status}</div>
              </div>
              <button className="btn-rf">{i.status === "connected" ? "Manage" : "Connect"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
