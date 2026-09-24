import type { ApplicationStatus } from "../types";

const CLASS_BY_STATUS: Record<ApplicationStatus, string> = {
  pending: "text-bg-warning",
  approved: "text-bg-success",
  rejected: "text-bg-danger",
  cancelled: "text-bg-secondary",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <span className={`badge ${CLASS_BY_STATUS[status]}`}>{status}</span>;
}
