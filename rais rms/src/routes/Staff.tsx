import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutlet } from "../lib/outlet";
import { api, ApiClientError } from "../lib/api";
import type { Role } from "../../shared/types";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  roles: Record<string, Role>;
}

const ROLES: Role[] = ["owner", "group_admin", "outlet_manager", "host", "server", "marketing", "read_only"];

export function Staff() {
  const { outlets, outletId } = useOutlet();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{ email: string; tempPassword?: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "server" as Role });

  const staffQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<StaffUser[]>("/api/users"),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post<{ email: string; tempPassword?: string }>("/api/users/invite", { ...form, outletId }),
    onSuccess: (data) => {
      setLastInvite(data);
      setForm((f) => ({ ...f, name: "", email: "" }));
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed to invite"),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; status: "active" | "disabled" }) =>
      api.patch(`/api/users/${input.userId}/status`, { status: input.status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed to update"),
  });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: Role }) =>
      api.patch(`/api/users/${input.userId}/roles`, { outletId, role: input.role }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Failed to update role"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLastInvite(null);
    if (form.name.trim() && form.email.trim() && outletId) inviteMutation.mutate();
  }

  if (!outletId) return <p className="text-muted">Select an outlet first.</p>;

  return (
    <div>
      <h1 className="h3 mb-4">Staff &amp; Roles</h1>
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card rais-card p-3">
            <h2 className="h6">Invite staff</h2>
            {error && <div className="alert alert-danger py-2">{error}</div>}
            {lastInvite?.tempPassword && (
              <div className="alert alert-success py-2 small">
                Invited <strong>{lastInvite.email}</strong>. Share this temporary password with them:
                <br />
                <code>{lastInvite.tempPassword}</code>
              </div>
            )}
            {lastInvite && !lastInvite.tempPassword && (
              <div className="alert alert-info py-2 small">
                {lastInvite.email} already had an account — role assigned to this outlet.
              </div>
            )}
            <form onSubmit={onSubmit}>
              <div className="mb-2">
                <label className="form-label small">Name</label>
                <input
                  className="form-control form-control-sm"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label small">Email</label>
                <input
                  type="email"
                  className="form-control form-control-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label small">Role for {outlets.find((o) => o.id === outletId)?.name}</label>
                <select
                  className="form-select form-select-sm"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary btn-sm w-100" type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Inviting…" : "Invite"}
              </button>
            </form>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card rais-card p-3">
            <h2 className="h6">Team</h2>
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role (this outlet)</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(staffQuery.data ?? []).map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 160 }}
                        value={u.roles[outletId] ?? ""}
                        onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value as Role })}
                      >
                        <option value="" disabled>
                          No access
                        </option>
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.replace("_", " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.status === "active" ? "text-bg-success" : "text-bg-secondary"}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          statusMutation.mutate({ userId: u.id, status: u.status === "active" ? "disabled" : "active" })
                        }
                      >
                        {u.status === "active" ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))}
                {staffQuery.data?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted text-center py-3">
                      No staff yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
