import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Card, Badge, Form, Button, Spinner, Alert, ButtonGroup } from "react-bootstrap";
import { api, ApiError, type TicketDetail as TicketDetailData } from "../api";
import { useAuth } from "../auth-context";

const NEXT_STATUSES: Record<string, string[]> = {
  new: ["open", "on_hold", "closed"],
  open: ["pending", "on_hold", "resolved", "closed"],
  pending: ["open", "on_hold", "resolved", "closed"],
  on_hold: ["open", "pending", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const isAgent = session?.subjectType === "agent";
  const [data, setData] = useState<TicketDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const result = await api.get<TicketDetailData>(`/api/tickets/${id}`);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load ticket");
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/tickets/${id}/messages`, { body, isInternalNote });
      setBody("");
      setIsInternalNote(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to post reply");
    } finally {
      setSubmitting(false);
    }
  };

  const onTransition = async (to: string) => {
    try {
      await api.post(`/api/tickets/${id}/transition`, { to });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to change status");
    }
  };

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <div className="text-center py-4"><Spinner animation="border" /></div>;

  const { ticket, messages } = data;

  return (
    <div>
      <Card className="mb-3">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h4>#{ticket.number} — {ticket.subject}</h4>
              <Badge bg="secondary" className="me-2">{ticket.status}</Badge>
              <Badge bg="info">{ticket.priority}</Badge>
            </div>
            {isAgent && (
              <ButtonGroup>
                {(NEXT_STATUSES[ticket.status] ?? []).map((to) => (
                  <Button key={to} size="sm" variant="outline-secondary" onClick={() => onTransition(to)}>
                    → {to}
                  </Button>
                ))}
              </ButtonGroup>
            )}
          </div>
        </Card.Body>
      </Card>

      <h6>Conversation</h6>
      {messages.map((m) => (
        <Card key={m.id} className={`mb-2 ${m.isInternalNote ? "border-warning" : ""}`}>
          <Card.Body className="py-2">
            <div className="d-flex justify-content-between">
              <strong>
                {m.authorType === "contact" ? "Requester" : m.authorType === "agent" ? "Agent" : "System"}
                {m.isInternalNote && <Badge bg="warning" text="dark" className="ms-2">Internal note</Badge>}
              </strong>
              <small className="text-muted">{new Date(m.createdAt).toLocaleString()}</small>
            </div>
            <div>{m.body}</div>
          </Card.Body>
        </Card>
      ))}

      <Card className="mt-3">
        <Card.Body>
          <Form onSubmit={onReply}>
            <Form.Group className="mb-2">
              <Form.Control as="textarea" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply…" required />
            </Form.Group>
            {isAgent && (
              <Form.Check
                type="checkbox"
                id="internal-note"
                className="mb-2"
                label="Internal note (not visible to requester)"
                checked={isInternalNote}
                onChange={(e) => setIsInternalNote(e.target.checked)}
              />
            )}
            <Button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send"}</Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
