import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { WorkflowInstance, WorkflowStepActionEntry } from "../types";

const STEP_ICON: Record<string, string> = {
  approved: "bi-check-circle-fill text-success",
  rejected: "bi-x-circle-fill text-danger",
  skipped: "bi-dash-circle text-secondary",
  pending: "bi-hourglass-split text-warning",
};

function approverLabel(step: WorkflowStepActionEntry): string {
  if (step.approver_type === "role" && step.resolved_approver_role) {
    return `Any ${step.resolved_approver_role.toUpperCase()}`;
  }
  return step.approver_type === "employee_manager" ? "Manager" : "Assigned approver";
}

export function RoutingTrail({ instanceId }: { instanceId: string }) {
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [steps, setSteps] = useState<WorkflowStepActionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ instance: WorkflowInstance; steps: WorkflowStepActionEntry[] }>(`/workflows/instances/${instanceId}`)
      .then((res) => {
        setInstance(res.instance);
        setSteps(res.steps);
      })
      .catch(() => setError("Unable to load routing trail"));
  }, [instanceId]);

  if (error) return <div className="text-secondary small">{error}</div>;
  if (!instance) return <div className="text-secondary small">Loading routing trail…</div>;

  return (
    <ul className="list-group">
      {steps.map((step) => (
        <li key={step.id} className="list-group-item d-flex align-items-start gap-3">
          <i className={`bi ${STEP_ICON[step.action]} fs-5`} />
          <div className="flex-grow-1">
            <div className="d-flex justify-content-between">
              <strong>
                Step {step.step_order}: {step.step_name}
              </strong>
              <span className="text-secondary small text-capitalize">{step.action}</span>
            </div>
            <div className="text-secondary small">{approverLabel(step)}</div>
            {step.acted_by_name && (
              <div className="small">
                by {step.acted_by_name}
                {step.acted_at && ` · ${new Date(step.acted_at).toLocaleString()}`}
              </div>
            )}
            {step.remarks && <div className="small fst-italic">"{step.remarks}"</div>}
            {step.reassigned_from_name && (
              <div className="small text-warning-emphasis">
                <i className="bi bi-arrow-left-right me-1" />
                Reassigned from {step.reassigned_from_name}
                {step.reassigned_at && ` · ${new Date(step.reassigned_at).toLocaleString()}`}
                {step.reassignment_comment && ` — "${step.reassignment_comment}"`}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
