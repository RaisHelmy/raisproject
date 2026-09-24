import { useState } from "react";
import type { Member, Role, User } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export function Team() {
  const { data: members, loading, refetch } = useApi(() => api.get<Array<Member & { user?: User }>>("/team"), []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("developer");
  const toast = useToast();

  async function invite() {
    await api.post("/team/invite", { email, role });
    toast.push({ title: "Invitation sent", message: email });
    setEmail("");
    refetch();
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Team</h1>
          <div className="rf-page-sub">Organizations, members and roles: Owner, Admin, Developer, Operator, Viewer, AI Agent.</div>
        </div>
      </div>
      <div className="rf-card mb-3">
        <div className="d-flex gap-2">
          <input className="form-control" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className="form-select" style={{ maxWidth: 160 }} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="admin">Admin</option>
            <option value="developer">Developer</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
          <button className="btn-rf btn-rf-primary" disabled={!email} onClick={invite}>Invite</button>
        </div>
      </div>
      {loading && <div className="rf-skeleton" style={{ height: 160 }} />}
      <div className="rf-table-card">
        <table className="rf-table">
          <thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="fw-medium">{m.user?.name ?? m.userId}</div>
                  <div className="rf-faint">{m.user?.email}</div>
                </td>
                <td className="text-capitalize">{m.role.replace("_", " ")}</td>
                <td><StatusBadge status={m.status === "active" ? "healthy" : "unknown"} label={m.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
