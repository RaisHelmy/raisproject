export function Storage() {
  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Storage</h1>
          <div className="rf-page-sub">R2 / S3-compatible object storage buckets.</div>
        </div>
      </div>
      <div className="row g-3">
        <div className="col-md-6">
          <div className="rf-card">
            <div className="fw-semibold">merc-uploads</div>
            <div className="rf-faint mb-2">R2 · APAC</div>
            <div className="d-flex justify-content-between rf-faint"><span>142 GB</span><span>48,210 objects</span></div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="rf-card">
            <div className="fw-semibold">merc-backups</div>
            <div className="rf-faint mb-2">R2 · APAC</div>
            <div className="d-flex justify-content-between rf-faint"><span>61 GB</span><span>412 objects</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
