import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Button, Alert, Spinner } from "react-bootstrap";
import { api, ApiError } from "../api";
import { useAuth } from "../auth-context";

interface TemplateField {
  key: string;
  label: string;
  type: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  visibleWhen?: { whenFieldKey: string; equals: unknown };
}

interface TemplateSummary {
  id: string;
  name: string;
  description: string | null;
  fields: TemplateField[];
}

export function NewTicket() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api.get<{ templates: TemplateSummary[] }>("/api/templates").then((res) => {
      setTemplates(res.templates);
      if (res.templates[0]) setTemplateId(res.templates[0].id);
    });
  }, []);

  const template = templates.find((t) => t.id === templateId);

  if (session?.subjectType === "agent") {
    return <Alert variant="info">Raising a ticket on behalf of a requester isn't available in this UI yet — use the API directly.</Alert>;
  }

  const isVisible = (field: TemplateField) => !field.visibleWhen || values[field.visibleWhen.whenFieldKey] === field.visibleWhen.equals;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const result = await api.post<{ id: string }>("/api/tickets", { templateId, subject, fieldValues: values });
      navigate(`/tickets/${result.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.fieldErrors) setFieldErrors(Object.fromEntries(err.fieldErrors.map((fe) => [fe.key, fe.message])));
      } else {
        setError("Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (templates.length === 0) return <div className="text-center py-4"><Spinner animation="border" /></div>;

  return (
    <Card>
      <Card.Body>
        <Card.Title>New ticket</Card.Title>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form onSubmit={onSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Type</Form.Label>
            <Form.Select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setValues({}); }}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Subject</Form.Label>
            <Form.Control value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </Form.Group>

          {template?.fields.filter(isVisible).map((field) => (
            <Form.Group className="mb-3" key={field.key}>
              <Form.Label>{field.label}{field.required && " *"}</Form.Label>
              {renderField(field, values[field.key], (v) => setValues((prev) => ({ ...prev, [field.key]: v })))}
              {field.helpText && <Form.Text className="text-muted">{field.helpText}</Form.Text>}
              {fieldErrors[field.key] && <div className="text-danger small">{fieldErrors[field.key]}</div>}
            </Form.Group>
          ))}

          <Button type="submit" disabled={submitting || !templateId}>{submitting ? "Submitting…" : "Submit ticket"}</Button>
        </Form>
      </Card.Body>
    </Card>
  );
}

function renderField(field: TemplateField, value: unknown, onChange: (v: unknown) => void) {
  switch (field.type) {
    case "textarea":
      return <Form.Control as="textarea" rows={4} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
    case "select":
      return (
        <Form.Select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required}>
          <option value="" disabled>Choose…</option>
          {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </Form.Select>
      );
    case "multiselect": {
      const selected = (value as string[]) ?? [];
      return (
        <div>
          {field.options?.map((o) => (
            <Form.Check
              key={o}
              inline
              type="checkbox"
              label={o}
              checked={selected.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((v) => v !== o))}
            />
          ))}
        </div>
      );
    }
    case "checkbox":
      return <Form.Check type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case "number":
      return <Form.Control type="number" value={(value as number) ?? ""} onChange={(e) => onChange(Number(e.target.value))} required={field.required} />;
    case "date":
      return <Form.Control type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
    case "email":
      return <Form.Control type="email" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
    case "url":
      return <Form.Control type="url" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
    case "file":
      return <div className="text-muted small">Attach files after the ticket is created.</div>;
    default:
      return <Form.Control value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />;
  }
}
