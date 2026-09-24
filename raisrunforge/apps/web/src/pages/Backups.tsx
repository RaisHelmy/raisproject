export function Backups() {
  const backups = Array.from({ length: 6 }).map((_, i) => ({
    id: i, size: (4.8 - i * 0.05).toFixed(1), status: i === 0 ? "Verified" : "Completed", ago: i === 0 ? "2 hours ago" : `${i} day${i > 1 ? "s" : ""} ago`,
  }));
  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Backups</h1>
          <div className="rf-page-sub">Application, database and configuration backups.</div>
        </div>
        <button className="btn-rf btn-rf-primary"><i className="bi bi-play-fill me-1" />Run Backup Now</button>
      </div>
      <div className="row g-2 mb-3">
        <div className="col-md-4"><div className="rf-stat-card"><div className="rf-stat-label">Last backup</div><div className="rf-stat-value" style={{ fontSize: 18 }}>2 hours ago</div></div></div>
        <div className="col-md-4"><div className="rf-stat-card"><div className="rf-stat-label">Status</div><div className="rf-stat-value" style={{ fontSize: 18 }}>Verified</div></div></div>
        <div className="col-md-4"><div className="rf-stat-card"><div className="rf-stat-label">Size</div><div className="rf-stat-value" style={{ fontSize: 18 }}>4.8 GB</div></div></div>
      </div>
      <div className="rf-table-card">
        <table className="rf-table">
          <thead><tr><th>Resource</th><th>Destination</th><th>Size</th><th>Status</th><th>Time</th></tr></thead>
          <tbody>
            {backups.map((b) => (
              <tr key={b.id}>
                <td className="fw-medium">merc-postgres</td>
                <td className="rf-faint">R2</td>
                <td className="rf-faint">{b.size} GB</td>
                <td>{b.status}</td>
                <td className="rf-faint">{b.ago}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
