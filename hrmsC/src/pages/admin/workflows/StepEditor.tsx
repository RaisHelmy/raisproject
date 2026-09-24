import { useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../../api/client";
import type { ApproverType, Role, UserAccount, WorkflowDefinition, WorkflowStep } from "../../../types";

export function StepEditor({
  definition,
  users,
  onChanged,
}: {
  definition: WorkflowDefinition;
  users: UserAccount[];
  onChanged: () => void;
}) {
  const [stepName, setStepName] = useState("");
  const [approverType, setApproverType] = useState<ApproverType>("employee_manager");
  const [managerLevel, setManagerLevel] = useState(1);
  const [approverRole, setApproverRole] = useState<Role>("hr");
  const [approverUserId, setApproverUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function addStep(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/workflows/definitions/${definition.id}/steps`, {
        stepName,
        approverType,
        managerLevel,
        approverRole: approverType === "role" ? approverRole : null,
        approverUserId: approverType === "specific_user" ? approverUserId : null,
      });
      setStepName("");
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function removeStep(stepId: string) {
    if (!confirm("Remove this step?")) return;
    await api.delete(`/workflows/definitions/${definition.id}/steps/${stepId}`);
    onChanged();
  }

  async function move(step: WorkflowStep, direction: -1 | 1) {
    const ordered = [...definition.steps].sort((a, b) => a.step_order - b.step_order);
    const index = ordered.findIndex((s) => s.id === step.id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
    await api.post(`/workflows/definitions/${definition.id}/steps/reorder`, {
      orderedStepIds: ordered.map((s) => s.id),
    });
    onChanged();
  }

  const sortedSteps = [...definition.steps].sort((a, b) => a.step_order - b.step_order);

  return (
    <div>
      {sortedSteps.length > 0 && (
        <ol className="list-group list-group-numbered mb-3">
          {sortedSteps.map((step, i) => (
            <li key={step.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <strong>{step.step_name}</strong>{" "}
                <span className="text-secondary small">
                  (
                  {step.approver_type === "employee_manager"
                    ? `manager, level ${step.manager_level}`
                    : step.approver_type === "role"
                      ? `role: ${step.approver_role}`
                      : `specific user`}
                  )
                </span>
              </div>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={i === 0}
                  onClick={() => move(step, -1)}
                >
                  <i className="bi bi-arrow-up" />
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  disabled={i === sortedSteps.length - 1}
                  onClick={() => move(step, 1)}
                >
                  <i className="bi bi-arrow-down" />
                </button>
                <button type="button" className="btn btn-outline-danger" onClick={() => removeStep(step.id)}>
                  <i className="bi bi-trash" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {error && <div className="alert alert-danger py-2">{error}</div>}
      <form className="row g-2 align-items-end" onSubmit={addStep}>
        <div className="col-md-3">
          <label className="form-label small">Step name</label>
          <input
            className="form-control form-control-sm"
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
            required
          />
        </div>
        <div className="col-md-3">
          <label className="form-label small">Approver type</label>
          <select
            className="form-select form-select-sm"
            value={approverType}
            onChange={(e) => setApproverType(e.target.value as ApproverType)}
          >
            <option value="employee_manager">Employee's manager</option>
            <option value="role">Anyone with role</option>
            <option value="specific_user">Specific person</option>
          </select>
        </div>
        {approverType === "employee_manager" && (
          <div className="col-md-3">
            <label className="form-label small">Manager level (1 = direct)</label>
            <input
              type="number"
              min={1}
              max={10}
              className="form-control form-control-sm"
              value={managerLevel}
              onChange={(e) => setManagerLevel(Number(e.target.value))}
            />
          </div>
        )}
        {approverType === "role" && (
          <div className="col-md-3">
            <label className="form-label small">Role</label>
            <select
              className="form-select form-select-sm"
              value={approverRole}
              onChange={(e) => setApproverRole(e.target.value as Role)}
            >
              <option value="hr">HR</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        )}
        {approverType === "specific_user" && (
          <div className="col-md-3">
            <label className="form-label small">Person</label>
            <select
              className="form-select form-select-sm"
              value={approverUserId}
              onChange={(e) => setApproverUserId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="col-md-3">
          <button type="submit" className="btn btn-outline-primary btn-sm w-100">
            Add step
          </button>
        </div>
      </form>
    </div>
  );
}
