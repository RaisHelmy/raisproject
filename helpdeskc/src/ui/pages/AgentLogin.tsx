import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Button, Alert, Container } from "react-bootstrap";
import { api, ApiError } from "../api";
import { useAuth } from "../auth-context";

export function AgentLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/agent/login", { email, password });
      await refresh();
      navigate("/tickets");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container style={{ maxWidth: 420 }} className="mt-5">
      <Card>
        <Card.Body>
          <Card.Title className="mb-4">Agent sign in</Card.Title>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Form.Group>
            <Button type="submit" disabled={submitting} className="w-100">
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
