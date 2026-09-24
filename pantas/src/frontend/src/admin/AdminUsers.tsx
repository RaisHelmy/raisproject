import { useEffect, useState } from "react";
import { api, ApiError } from "../api";

interface User {
  id: string;
  realName: string;
  phone: string;
  handle: string;
  anonymousMode: boolean;
  verificationTier: string;
  status: string;
}

/**
 * Admin always sees real identity here (CLAUDE.md "Admin panel"). The
 * identity-disclosure lookup below requires a reason and is itself
 * audit-logged — see GET /api/admin/users/:id/identity.
 */
export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [reason, setReason] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [disclosed, setDisclosed] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<User[]>("/admin/users").then(setUsers).catch(console.error);
  }, []);

  async function disclose() {
    setError(null);
    setDisclosed(null);
    if (!reason) {
      setError("A reason is required — this lookup is itself logged.");
      return;
    }
    try {
      const user = await api.get<User>(
        `/admin/users/${lookupId}/identity?reason=${encodeURIComponent(reason)}`,
      );
      setDisclosed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Lookup failed");
    }
  }

  async function setTier(id: string, tier: string) {
    await api.post(`/admin/users/${id}/verification`, { tier });
    setUsers(await api.get<User[]>("/admin/users"));
  }

  return (
    <div className="row g-4">
      <div className="col-md-7">
        <h4>All users</h4>
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Handle</th>
              <th>Real name</th>
              <th>Tier</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.handle}</td>
                <td>{u.realName}</td>
                <td>{u.verificationTier}</td>
                <td>{u.status}</td>
                <td>
                  {u.verificationTier === "unverified" && !u.anonymousMode && (
                    <button className="btn btn-sm btn-outline-success" onClick={() => setTier(u.id, "verified")}>
                      Verify
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="col-md-5">
        <h4>Identity disclosure</h4>
        <p className="text-muted small">
          For a documented request (e.g. law enforcement). Requires a reason; the lookup itself is
          written to the audit log.
        </p>
        <div className="mb-2">
          <input className="form-control mb-2" placeholder="User id" value={lookupId} onChange={(e) => setLookupId(e.target.value)} />
          <input className="form-control mb-2" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn btn-outline-danger" onClick={disclose}>
            Disclose identity
          </button>
        </div>
        {error && <div className="alert alert-danger py-2">{error}</div>}
        {disclosed && (
          <div className="alert alert-secondary">
            <strong>{disclosed.realName}</strong> · {disclosed.phone}
          </div>
        )}
      </div>
    </div>
  );
}
