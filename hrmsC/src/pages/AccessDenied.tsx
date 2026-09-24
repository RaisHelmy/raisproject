import { Link } from "react-router-dom";

export function AccessDenied() {
  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <div className="card shadow-sm" style={{ width: 420 }}>
        <div className="card-body p-4 text-center">
          <i className="bi bi-shield-lock text-danger" style={{ fontSize: "2.5rem" }} />
          <h1 className="h4 fw-bold mt-3">Access Denied</h1>
          <p className="text-secondary">You don't have permission to view this page.</p>
          <Link to="/" className="btn btn-primary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
