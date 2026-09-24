import { useEffect, useState, type FormEvent } from "react";
import { Table, Button, Modal, Form, Alert, Badge } from "react-bootstrap";
import { api, ApiError, type AgentSummary, type Role } from "../../api";

export function AgentsPage() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [a, r] = await Promise.all([
      api.get<{ agents: AgentSummary[] }>("/api/agents"),
      api.get<{ roles: Role[] }>("/api/roles"),
    ]);
    setAgents(a.agents);
    setRoles(r.roles);
  };

  useEffect(() => {
    void load();
  }, []);

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/agents", { email, name });
      setShowInvite(false);
      setEmail("");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to invite agent");
    }
  };

  const addRole = async (agentId: string, roleId: string) => {
    if (!roleId) return;
    await api.post(`/api/agents/${agentId}/roles`, { roleId });
    await load();
  };

  const removeRole = async (agentId: string, roleId: string) => {
    await api.delete(`/api/agents/${agentId}/roles/${roleId}`);
    await load();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Agents</h4>
        <Button size="sm" onClick={() => setShowInvite(true)}>Invite agent</Button>
      </div>
      <Table hover>
        <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Roles</th></tr></thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.email}</td>
              <td>{a.accepted ? <Badge bg="success">Active</Badge> : <Badge bg="secondary">Invited</Badge>}</td>
              <td>
                {a.roles.map((r) => (
                  <Badge key={r.id} bg="info" className="me-1">
                    {r.name}{" "}
                    <span role="button" onClick={() => removeRole(a.id, r.id)}>&times;</span>
                  </Badge>
                ))}
                <Form.Select
                  size="sm"
                  className="d-inline-block mt-1"
                  style={{ width: "auto" }}
                  value=""
                  onChange={(e) => addRole(a.id, e.target.value)}
                >
                  <option value="">+ Add role</option>
                  {roles.filter((r) => !a.roles.some((ar) => ar.id === r.id)).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Form.Select>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showInvite} onHide={() => setShowInvite(false)}>
        <Modal.Header closeButton><Modal.Title>Invite agent</Modal.Title></Modal.Header>
        <Form onSubmit={onInvite}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Form.Group>
            <Form.Group>
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button type="submit">Send invite</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
