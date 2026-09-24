import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, ApiError } from "../../../api/client";
import type { LeaveType, RequestType, UserAccount, WorkflowDefinition } from "../../../types";
import { StepEditor } from "./StepEditor";

const MODULES = [
  { value: "leave_application", label: "Leave Application" },
  { value: "claim", label: "Claims" },
  { value: "employee_request", label: "Employee Requests" },
  { value: "overtime", label: "Overtime" },
  { value: "leave_quota", label: "Leave Quota" },
  { value: "leave_encashment", label: "Leave Encashment" },
];

const CLAIM_TYPES = ["Travel", "Meals", "Accommodation", "Medical", "Office Supplies", "Other"];

export function Workflows() {
  const [module, setModule] = useState(MODULES[0].value);
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ definitions: WorkflowDefinition[] }>(`/workflows/definitions?module=${module}`).then((res) =>
      setDefinitions(res.definitions),
    );
  }

  useEffect(load, [module]);
  useEffect(() => {
    api.get<{ leaveTypes: LeaveType[] }>("/leave/types").then((res) => setLeaveTypes(res.leaveTypes));
    api.get<{ requestTypes: RequestType[] }>("/requests/types").then((res) => setRequestTypes(res.requestTypes));
    api.get<{ users: UserAccount[] }>("/admin/users").then((res) => setUsers(res.users));
  }, []);

  async function createDefinition(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/workflows/definitions", {
        module,
        name,
        category: category || null,
        minAmount: minAmount ? Number(minAmount) : null,
        maxAmount: maxAmount ? Number(maxAmount) : null,
        isDefault: !category,
      });
      setName("");
      setCategory("");
      setMinAmount("");
      setMaxAmount("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(def: WorkflowDefinition) {
    await api.put(`/workflows/definitions/${def.id}`, { isActive: !def.is_active });
    load();
  }

  async function removeDefinition(def: WorkflowDefinition) {
    if (!confirm(`Delete "${def.name}"? This only works if it has never been used.`)) return;
    try {
      await api.delete(`/workflows/definitions/${def.id}`);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  const categoryOptions =
    module === "leave_application" || module === "leave_quota" || module === "leave_encashment"
      ? leaveTypes.map((lt) => ({ value: lt.id, label: lt.name }))
      : module === "employee_request"
        ? requestTypes.map((rt) => ({ value: rt.id, label: rt.name }))
        : module === "claim"
          ? CLAIM_TYPES.map((t) => ({ value: t, label: t }))
          : [];

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Workflow Routing</h1>
        <select className="form-select" style={{ width: 240 }} value={module} onChange={(e) => setModule(e.target.value)}>
          {MODULES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-secondary">
        Every submitted request is routed through the first matching workflow below (an exact category match beats
        the catch-all, and for claims an amount range narrows it further). Each workflow is an ordered list of
        approval steps — add as many as you need.
      </p>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h6 text-secondary mb-3">New workflow for {MODULES.find((m) => m.value === module)?.label}</h2>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form className="row g-2 align-items-end" onSubmit={createDefinition}>
            <div className="col-md-4">
              <label className="form-label small">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Applies to (blank = catch-all)</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— Any / catch-all —</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {module !== "leave_application" && (
              <>
                <div className="col-md-2">
                  <label className="form-label small">{module === "overtime" ? "Min hours" : "Min amount"}</label>
                  <input
                    type="number"
                    className="form-control"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                  />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">{module === "overtime" ? "Max hours" : "Max amount"}</label>
                  <input
                    type="number"
                    className="form-control"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="col-md-1">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                Add
              </button>
            </div>
          </form>
        </div>
      </div>

      {definitions.map((def) => (
        <div className="card shadow-sm mb-3" key={def.id}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div>
                <h2 className="h6 mb-1">
                  {def.name}{" "}
                  {!!def.is_default && <span className="badge text-bg-secondary ms-1">catch-all</span>}
                  {!def.is_active && <span className="badge text-bg-secondary ms-1">inactive</span>}
                </h2>
                <div className="text-secondary small">
                  {def.category
                    ? `Applies to: ${categoryOptions.find((o) => o.value === def.category)?.label ?? def.category}`
                    : "Applies to: any"}
                  {(def.min_amount != null || def.max_amount != null) &&
                    ` · Amount ${def.min_amount ?? "0"} - ${def.max_amount ?? "∞"}`}
                </div>
              </div>
              <div className="btn-group btn-group-sm">
                <button className="btn btn-outline-secondary" onClick={() => toggleActive(def)}>
                  {def.is_active ? "Deactivate" : "Activate"}
                </button>
                <button className="btn btn-outline-danger" onClick={() => removeDefinition(def)}>
                  Delete
                </button>
              </div>
            </div>
            <StepEditor definition={def} users={users} onChanged={load} />
          </div>
        </div>
      ))}

      {definitions.length === 0 && <div className="text-secondary">No workflows configured for this module yet.</div>}
    </div>
  );
}
