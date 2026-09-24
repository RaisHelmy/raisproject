import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Container, Alert, Spinner } from "react-bootstrap";
import { api, ApiError } from "../api";
import { useAuth } from "../auth-context";

export function MagicLinkVerify() {
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Missing sign-in token.");
      return;
    }
    (async () => {
      try {
        await api.post("/api/auth/contact/magic-link/verify", { token });
        await refresh();
        navigate("/tickets");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "This link is invalid or has expired.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Container style={{ maxWidth: 420 }} className="mt-5 text-center">
      {error ? <Alert variant="danger">{error}</Alert> : <Spinner animation="border" />}
    </Container>
  );
}
