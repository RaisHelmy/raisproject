export function Settings() {
  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Settings</h1>
          <div className="rf-page-sub">Organization preferences.</div>
        </div>
      </div>
      <div className="rf-card mb-3">
        <div className="fw-semibold mb-2">Organization</div>
        <div className="rf-faint mb-1">Name</div>
        <input className="form-control mb-3" defaultValue="MERC999 Labs" />
        <div className="rf-faint mb-1">Plan</div>
        <div>Pro</div>
      </div>
      <div className="rf-card">
        <div className="fw-semibold mb-2">API Tokens</div>
        <div className="rf-faint">Manage API and MCP tokens from the MCP page.</div>
      </div>
    </div>
  );
}
