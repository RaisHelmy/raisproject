import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Table, Button, Modal, Form, Alert } from "react-bootstrap";
import { api, ApiError, type Account } from "../../api";

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [scopeByTeam, setScopeByTeam] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.get<{ accounts: Account[] }>("/api/accounts").then((r) => setAccounts(r.accounts));

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/accounts", { name, scopeByTeam });
      setShowCreate(false);
      setName("");
      setScopeByTeam(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create account");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Accounts</h4>
        <Button size="sm" onClick={() => setShowCreate(true)}>New account</Button>
      </div>
      <Table hover>
        <thead>
          <tr><th>Name</th><th>Team-scoped</th></tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id}>
              <td><Link to={`/admin/accounts/${a.id}`}>{a.name}</Link></td>
              <td>{a.scopeByTeam ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={showCreate} onHide={() => setShowCreate(false)}>
        <Modal.Header closeButton><Modal.Title>New account</Modal.Title></Modal.Header>
        <Form onSubmit={onCreate}>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Name</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </Form.Group>
            <Form.Check
              type="checkbox"
              label="Narrow Contact visibility to their Team"
              checked={scopeByTeam}
              onChange={(e) => setScopeByTeam(e.target.checked)}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
