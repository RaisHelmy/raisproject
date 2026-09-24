import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="rf-empty">
      <i className="bi bi-signpost-2" />
      <div>Page not found.</div>
      <Link to="/" className="d-inline-block mt-2">Back to Overview</Link>
    </div>
  );
}
