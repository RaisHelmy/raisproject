import { Link } from "react-router-dom";
import { formatMYR } from "@raisai/shared";

/** The exact shape CLAUDE.md §29 asks for: cost, available, and a way forward. */
export function InsufficientBalance(props: { estimatedSen: number; availableSen: number; onDismiss: () => void }) {
  return (
    <div className="alert alert-warning" role="alert">
      <h2 className="h6">Not enough balance</h2>
      <dl className="row mb-2 small">
        <dt className="col-6">Estimated cost</dt>
        <dd className="col-6 text-end mb-0">{formatMYR(props.estimatedSen)}</dd>
        <dt className="col-6">Available</dt>
        <dd className="col-6 text-end mb-0">{formatMYR(props.availableSen)}</dd>
      </dl>
      <div className="d-flex gap-2">
        <Link className="btn btn-sm btn-primary" to="/balance">Add balance</Link>
        <button className="btn btn-sm btn-outline-secondary" type="button" onClick={props.onDismiss}>Close</button>
      </div>
    </div>
  );
}
