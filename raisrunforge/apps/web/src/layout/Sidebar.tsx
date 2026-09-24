import { NavLink } from "react-router-dom";

const SECTIONS: Array<{ label: string; items: Array<{ to: string; label: string; icon: string }> }> = [
  { label: "", items: [{ to: "/", label: "Overview", icon: "bi-speedometer2" }] },
  {
    label: "Deploy",
    items: [
      { to: "/projects", label: "Projects", icon: "bi-folder2" },
      { to: "/applications", label: "Applications", icon: "bi-grid-1x2" },
      { to: "/deployments", label: "Deployments", icon: "bi-rocket-takeoff" },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { to: "/servers", label: "Servers", icon: "bi-hdd-rack" },
      { to: "/containers", label: "Containers", icon: "bi-box-seam" },
      { to: "/services", label: "Services", icon: "bi-gear-wide-connected" },
    ],
  },
  {
    label: "Data",
    items: [
      { to: "/databases", label: "Databases", icon: "bi-database" },
      { to: "/storage", label: "Storage", icon: "bi-hdd-stack" },
    ],
  },
  {
    label: "Networking",
    items: [
      { to: "/domains", label: "Domains", icon: "bi-globe2" },
      { to: "/networking", label: "Networking", icon: "bi-diagram-3" },
      { to: "/graph", label: "Infra Graph", icon: "bi-share" },
    ],
  },
  {
    label: "Observability",
    items: [
      { to: "/monitoring", label: "Monitoring", icon: "bi-activity" },
      { to: "/logs", label: "Logs", icon: "bi-terminal" },
      { to: "/events", label: "Events", icon: "bi-clock-history" },
      { to: "/incidents", label: "Incidents", icon: "bi-exclamation-diamond" },
    ],
  },
  { label: "", items: [{ to: "/git", label: "Git", icon: "bi-git" }] },
  {
    label: "Automation",
    items: [
      { to: "/backups", label: "Backups", icon: "bi-archive" },
      { to: "/mcp", label: "MCP", icon: "bi-cpu" },
      { to: "/ai", label: "AI Operations", icon: "bi-stars" },
    ],
  },
  {
    label: "Organization",
    items: [
      { to: "/templates", label: "Templates", icon: "bi-file-earmark-code" },
      { to: "/integrations", label: "Integrations", icon: "bi-plug" },
      { to: "/team", label: "Team", icon: "bi-people" },
      { to: "/settings", label: "Settings", icon: "bi-sliders" },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={`rf-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="rf-brand">
        <span className="rf-brand-mark">RF</span>
        <span className="rf-brand-text">RunForge</span>
        <button className="btn-rf ms-auto p-1 d-none d-md-inline-flex" style={{ lineHeight: 1 }} onClick={onToggle} title="Toggle sidebar">
          <i className="bi bi-layout-sidebar-inset" />
        </button>
      </div>
      <nav className="rf-nav">
        {SECTIONS.map((section, i) => (
          <div key={i}>
            {section.label && <div className="rf-nav-section-label">{section.label}</div>}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => `rf-nav-item ${isActive ? "active" : ""}`}
              >
                <i className={`bi ${item.icon}`} />
                <span className="rf-nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="rf-sidebar-footer rf-nav-label">
        <div className="rf-faint" style={{ fontSize: 11, padding: "4px 10px" }}>
          <i className="bi bi-circle-fill text-warning me-1" style={{ fontSize: 6 }} />
          Demo Provider
        </div>
      </div>
    </aside>
  );
}
