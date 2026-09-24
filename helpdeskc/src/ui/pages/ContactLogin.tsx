import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Button, Alert, Container, Tabs, Tab } from "react-bootstrap";
import { api, ApiError } from "../api";
import { useAuth } from "../auth-context";

export function ContactLogin() {
  const [tab, setTab] = useState("password");

  return (
    <Container style={{ maxWidth: 420 }} className="mt-5">
      <Card>
        <Card.Body>
          <Card.Title className="mb-4">Sign in to support portal</Card.Title>
          <Tabs activeKey={tab} onSelect={(k) => setTab(k ?? "password")} className="mb-3">
            <Tab eventKey="password" title="Password">
              <PasswordForm />
            </Tab>
            <Tab eventKey="magic" title="Email link">
              <MagicLinkForm />
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </Container>
  );
}

function PasswordForm() {
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
      await api.post("/api/auth/contact/password-login", { email, password });
      await refresh();
      navigate("/tickets");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form onSubmit={onSubmit}>
      {error && <Alert variant="danger">{error}</Alert>}
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
  );
}

function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/auth/contact/magic-link", { email });
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  if (sent) {
    return <Alert variant="success">If that email has an account, a sign-in link has been sent. Check your inbox.</Alert>;
  }

  return (
    <Form onSubmit={onSubmit}>
      <Form.Group className="mb-3">
        <Form.Label>Email</Form.Label>
        <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Form.Group>
      <Button type="submit" disabled={submitting} className="w-100">
        {submitting ? "Sending…" : "Send sign-in link"}
      </Button>
    </Form>
  );
}
