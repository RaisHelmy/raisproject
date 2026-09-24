import { formatMYR } from "@raisai/shared";

/**
 * The customer sees an estimate and, later, what was charged. Never credits,
 * never provider economics (CLAUDE.md §93, §99).
 */
export function CostEstimate(props: { sen: number | null; approximate?: boolean; loading?: boolean }) {
  return (
    <div className="d-flex align-items-baseline justify-content-between">
      <span className="text-secondary">Estimated cost</span>
      <span className="fs-5 fw-semibold">
        {props.loading ? <span className="placeholder col-4" /> : props.sen === null ? "—" : formatMYR(props.sen)}
      </span>
      {props.approximate && (
        <span className="visually-hidden">Estimated from current provider pricing.</span>
      )}
    </div>
  );
}

export function FinalCost(props: { chargedSen: number | null; balanceAfterSen?: number | null; estimated?: boolean }) {
  if (props.chargedSen === null) return null;
  return (
    <div className="small">
      <div className="d-flex justify-content-between">
        <span className="text-secondary">Charged</span>
        <span className="fw-semibold">{formatMYR(props.chargedSen)}</span>
      </div>
      {props.balanceAfterSen !== null && props.balanceAfterSen !== undefined && (
        <div className="d-flex justify-content-between">
          <span className="text-secondary">Remaining balance</span>
          <span>{formatMYR(props.balanceAfterSen)}</span>
        </div>
      )}
      {props.estimated && (
        <p className="text-secondary mb-0 mt-1">Estimated from current provider pricing.</p>
      )}
    </div>
  );
}
