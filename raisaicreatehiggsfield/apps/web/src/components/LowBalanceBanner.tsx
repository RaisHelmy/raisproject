import { Link } from "react-router-dom";
import { formatMYR } from "@raisai/shared";

const DEFAULT_THRESHOLD_SEN = 500;

/**
 * A quiet warning before someone is stopped mid-creation (§122). It appears
 * once the balance drops under the threshold and disappears on its own after a
 * top-up, so there is nothing to dismiss and nothing to remember.
 */
export function LowBalanceBanner(props: { availableSen: number | null; thresholdSen?: number }) {
  const threshold = props.thresholdSen ?? DEFAULT_THRESHOLD_SEN;
  if (props.availableSen === null || props.availableSen >= threshold) return null;

  const empty = props.availableSen <= 0;
  return (
    <div className={`alert ${empty ? "alert-danger" : "alert-warning"} d-flex align-items-center gap-3 py-2`} role="status">
      <i className={`bi bi-${empty ? "exclamation-octagon" : "exclamation-triangle"}`} aria-hidden="true" />
      <span className="flex-grow-1 small">
        {empty
          ? "Your balance is empty. Add balance to keep creating."
          : `Your balance is down to ${formatMYR(props.availableSen)}.`}
      </span>
      <Link className="btn btn-sm btn-primary" to="/balance">Add balance</Link>
    </div>
  );
}
