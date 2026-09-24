import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Form, Button, Alert, Container } from "react-bootstrap";
import { api, ApiError } from "../api";
import { useAuth } from "../auth-context";

export function AcceptInvite() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = params.get("token");
    if (!token) {
      setError("Missing invite token.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/auth/agent/accept-invite", { token, password });
      await refresh();
      navigate("/tickets");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This invite is invalid or has expired.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container style={{ maxWidth: 420 }} className="mt-5">
      <Card>
        <Card.Body>
          <Card.Title className="mb-4">Set your password</Card.Title>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={onSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus />
            </Form.Group>
            <Button type="submit" disabled={submitting} className="w-100">{submitting ? "Setting up…" : "Set password and sign in"}</Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}
