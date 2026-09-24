import { formatMYR } from "@raisai/shared";

export function BalanceChip(props: { availableSen: number | null }) {
  return (
    <span className="badge text-bg-dark border fs-6 fw-normal" aria-label="Current balance">
      <i className="bi bi-wallet2 me-1" aria-hidden="true" />
      {props.availableSen === null ? "—" : formatMYR(props.availableSen)}
    </span>
  );
}
