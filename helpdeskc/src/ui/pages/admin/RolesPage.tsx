import { useEffect, useState, type FormEvent } from "react";
import { Table, Button, Modal, Form, Alert, Badge } from "react-bootstrap";
import { api, ApiError, PERMISSIONS, TICKET_SCOPES, type Role } from "../../api";

export function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<{ roles: Role[] }>("/api/roles").then((r) => setRoles(r.roles));

  useEffect(() => {
    void load();
  }, []);

  const onArchive = async (id: string) => {
    if (!confirm("Archive this role? Agents holding it keep it until reassigned.")) return;
    await api.delete(`/api/roles/${id}`);
    await load();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Roles</h4>
        <Button size="sm" onClick={() => setEditing("new")}>New role</Button>
      </div>
      <Table hover>
        <thead><tr><th>Name</th><th>Ticket scope</th><th>Permissions</th><th></th></tr></thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.name} {r.isPreset && <Badge bg="secondary">preset</Badge>}</td>
              <td>{r.ticketScope}</td>
              <td className="small text-muted">{r.permissions.length} permission{r.permissions.length !== 1 ? "s" : ""}</td>
              <td>
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => setEditing(r)}>Edit</Button>
                <Button size="sm" variant="outline-danger" onClick={() => onArchive(r.id)}>Archive</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {editing && (
        <RoleEditor
          role={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
          error={error}
          setError={setError}
        />
      )}
    </div>
  );
}

function RoleEditor({ role, onClose, onSaved, error, setError }: {
  role: Role | null;
  onClose: () => void;
  onSaved: () => void;
  error: string | null;
  setError: (e: string | null) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [ticketScope, setTicketScope] = useState(role?.ticketScope ?? "own");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);

  const togglePermission = (p: string) => {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (role) {
        await api.put(`/api/roles/${role.id}`, { name, ticketScope, permissions });
      } else {
        await api.post("/api/roles", { name, ticketScope, permissions });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save role");
    }
  };

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton><Modal.Title>{role ? "Edit role" : "New role"}</Modal.Title></Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Ticket scope</Form.Label>
            <Form.Select value={ticketScope} onChange={(e) => setTicketScope(e.target.value as typeof ticketScope)}>
              {TICKET_SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Permissions</Form.Label>
            <div className="d-flex flex-wrap gap-2">
              {PERMISSIONS.map((p) => (
                <Form.Check
                  key={p}
                  type="checkbox"
                  id={`perm-${p}`}
                  label={p}
                  checked={permissions.includes(p)}
                  onChange={() => togglePermission(p)}
                />
              ))}
            </div>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
