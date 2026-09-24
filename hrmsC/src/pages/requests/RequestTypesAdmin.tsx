import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../../api/client";
import type { RequestType } from "../../types";

export function RequestTypesAdmin() {
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requiresAmount, setRequiresAmount] = useState(false);
  const [requiresAttachment, setRequiresAttachment] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api.get<{ requestTypes: RequestType[] }>("/requests/types").then((res) => setRequestTypes(res.requestTypes));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/requests/types", { name, description: description || null, requiresAmount, requiresAttachment });
      setName("");
      setDescription("");
      setRequiresAmount(false);
      setRequiresAttachment(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(rt: RequestType) {
    await api.put(`/requests/types/${rt.id}`, { isActive: !rt.is_active });
    load();
  }

  return (
    <div>
      <h1 className="h3 mb-4">Request Types</h1>
      <p className="text-secondary">
        Each request type is a self-service form employees can submit (e.g. Loan, Allowance, Verification Letter,
        Uniform Application) — configure its own approval workflow from Workflow Routing once created.
      </p>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={handleCreate}>
            <div className="col-md-3">
              <label className="form-label">Name</label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="col-md-4">
              <label className="form-label">Description</label>
              <input className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="col-md-2 form-check mt-4">
              <input
                type="checkbox"
                className="form-check-input"
                id="requiresAmount"
                checked={requiresAmount}
                onChange={(e) => setRequiresAmount(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="requiresAmount">
                Needs amount
              </label>
            </div>
            <div className="col-md-2 form-check mt-4">
              <input
                type="checkbox"
                className="form-check-input"
                id="requiresAttachment"
                checked={requiresAttachment}
                onChange={(e) => setRequiresAttachment(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="requiresAttachment">
                Needs attachment
              </label>
            </div>
            <div className="col-md-1">
              <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                Add
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Amount?</th>
                <th>Attachment?</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requestTypes.map((rt) => (
                <tr key={rt.id}>
                  <td>{rt.name}</td>
                  <td>{rt.description ?? "—"}</td>
                  <td>{rt.requires_amount ? "Yes" : "No"}</td>
                  <td>{rt.requires_attachment ? "Yes" : "No"}</td>
                  <td>
                    <span className={`badge ${rt.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {rt.is_active ? "active" : "inactive"}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(rt)}>
                      {rt.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
