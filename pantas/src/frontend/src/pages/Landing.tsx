import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="py-5 text-center">
      <h1>Pantas</h1>
      <p className="lead text-muted">
        Anonymous on-demand marketplace for Kuala Lumpur &amp; Selangor — delivery, fetch, rides,
        carpool, corporate catering, and peer-to-peer vehicle rental.
      </p>
      <div className="d-flex justify-content-center gap-2 mt-4">
        <Link className="btn btn-primary" to="/register">
          Get started
        </Link>
        <Link className="btn btn-outline-secondary" to="/login">
          Log in
        </Link>
      </div>
    </div>
  );
}
