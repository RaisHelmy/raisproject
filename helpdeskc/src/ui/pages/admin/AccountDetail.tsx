import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Card, Table, Button, Form, Row, Col, Alert, Spinner } from "react-bootstrap";
import { api, ApiError, type Account, type Team, type Contact } from "../../api";

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactTeamId, setContactTeamId] = useState("");

  const load = async () => {
    const res = await api.get<{ account: Account; teams: Team[]; contacts: Contact[] }>(`/api/accounts/${id}`);
    setAccount(res.account);
    setTeams(res.teams);
    setContacts(res.contacts);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const addTeam = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/accounts/${id}/teams`, { name: teamName });
      setTeamName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add team");
    }
  };

  const addContact = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/api/accounts/${id}/contacts`, { email: contactEmail, name: contactName, teamId: contactTeamId || undefined });
      setContactEmail("");
      setContactName("");
      setContactTeamId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add contact");
    }
  };

  if (!account) return <div className="text-center py-4"><Spinner animation="border" /></div>;

  return (
    <div>
      <h4>{account.name}</h4>
      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="mt-4">
        <Col md={6}>
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Teams</Card.Title>
              <Table size="sm">
                <tbody>
                  {teams.map((t) => <tr key={t.id}><td>{t.name}</td></tr>)}
                </tbody>
              </Table>
              <Form onSubmit={addTeam} className="d-flex gap-2">
                <Form.Control size="sm" placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
                <Button size="sm" type="submit">Add</Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col md={6}>
          <Card>
            <Card.Body>
              <Card.Title>Contacts</Card.Title>
              <Table size="sm">
                <thead><tr><th>Name</th><th>Email</th><th>Team</th></tr></thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.email}</td>
                      <td>{teams.find((t) => t.id === c.teamId)?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Form onSubmit={addContact}>
                <Row className="g-2">
                  <Col><Form.Control size="sm" placeholder="Name" value={contactName} onChange={(e) => setContactName(e.target.value)} required /></Col>
                  <Col><Form.Control size="sm" type="email" placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required /></Col>
                  <Col>
                    <Form.Select size="sm" value={contactTeamId} onChange={(e) => setContactTeamId(e.target.value)}>
                      <option value="">No team</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Form.Select>
                  </Col>
                  <Col xs="auto"><Button size="sm" type="submit">Add</Button></Col>
                </Row>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
