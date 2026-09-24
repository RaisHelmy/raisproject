import { useEffect, useState, type FormEvent } from "react";
import { Table, Button, Modal, Form, Alert, Row, Col, Badge } from "react-bootstrap";
import { api, ApiError, type TemplateSummary, type TemplateField, type TemplateVersion } from "../../api";

const FIELD_TYPES = ["text", "textarea", "select", "multiselect", "date", "number", "checkbox", "file", "email", "url"];
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const load = () => api.get<{ templates: TemplateSummary[] }>("/api/templates").then((r) => setTemplates(r.templates));

  useEffect(() => {
    void load();
  }, []);

  const onArchive = async (id: string) => {
    if (!confirm("Archive this template? Existing tickets keep the version they were raised with.")) return;
    await api.delete(`/api/templates/${id}`);
    await load();
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="mb-0">Templates</h4>
        <Button size="sm" onClick={() => setEditingId("new")}>New template</Button>
      </div>
      <Table hover>
        <thead><tr><th>Name</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td>{t.name} {t.isDefault && <Badge bg="secondary">default</Badge>}</td>
              <td className="text-muted">{t.description}</td>
              <td>
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => setEditingId(t.id)}>Edit</Button>
                <Button size="sm" variant="outline-danger" onClick={() => onArchive(t.id)}>Archive</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {editingId && (
        <TemplateEditor templateId={editingId === "new" ? null : editingId} onClose={() => setEditingId(null)} onSaved={async () => { setEditingId(null); await load(); }} />
      )}
    </div>
  );
}

function TemplateEditor({ templateId, onClose, onSaved }: { templateId: string | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("medium");
  const [fields, setFields] = useState<TemplateField[]>([{ key: "summary", label: "Summary", type: "textarea", required: true }]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;
    void api.get<{ template: TemplateSummary; versions: TemplateVersion[] }>(`/api/templates/${templateId}`).then((res) => {
      setName(res.template.name);
      setDescription(res.template.description ?? "");
      const latest = res.versions[0];
      if (latest) {
        setFields(latest.fields);
        setCategory(latest.defaults.category);
        setPriority(latest.defaults.priority);
      }
    });
  }, [templateId]);

  const updateField = (i: number, patch: Partial<TemplateField>) => {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const removeField = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));
  const addField = () => setFields((prev) => [...prev, { key: "", label: "", type: "text", required: false }]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const defaults = { category, priority };
    try {
      if (templateId) {
        await api.post(`/api/templates/${templateId}/versions`, { name, description, fields, defaults });
      } else {
        await api.post("/api/templates", { name, description, fields, defaults });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save template");
    }
  };

  return (
    <Modal show onHide={onClose} size="lg">
      <Modal.Header closeButton><Modal.Title>{templateId ? "Edit template (creates a new version)" : "New template"}</Modal.Title></Modal.Header>
      <Form onSubmit={onSubmit}>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Row className="mb-3">
            <Col md={6}>
              <Form.Label>Name</Form.Label>
              <Form.Control value={name} onChange={(e) => setName(e.target.value)} required />
            </Col>
            <Col md={6}>
              <Form.Label>Description</Form.Label>
              <Form.Control value={description} onChange={(e) => setDescription(e.target.value)} />
            </Col>
          </Row>
          <Row className="mb-3">
            <Col md={6}>
              <Form.Label>Default category</Form.Label>
              <Form.Control value={category} onChange={(e) => setCategory(e.target.value)} required />
            </Col>
            <Col md={6}>
              <Form.Label>Default priority</Form.Label>
              <Form.Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Form.Select>
            </Col>
          </Row>

          <Form.Label>Fields</Form.Label>
          {fields.map((f, i) => (
            <Row key={i} className="g-2 mb-2 align-items-center">
              <Col md={2}><Form.Control size="sm" placeholder="key" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} required /></Col>
              <Col md={3}><Form.Control size="sm" placeholder="label" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} required /></Col>
              <Col md={2}>
                <Form.Select size="sm" value={f.type} onChange={(e) => updateField(i, { type: e.target.value })}>
                  {FIELD_TYPES.map((ft) => <option key={ft} value={ft}>{ft}</option>)}
                </Form.Select>
              </Col>
              <Col md={3}>
                {(f.type === "select" || f.type === "multiselect") && (
                  <Form.Control
                    size="sm"
                    placeholder="options (comma-separated)"
                    value={f.options?.join(",") ?? ""}
                    onChange={(e) => updateField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  />
                )}
              </Col>
              <Col md={1}>
                <Form.Check type="checkbox" label="req" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
              </Col>
              <Col md={1}>
                <Button size="sm" variant="outline-danger" onClick={() => removeField(i)}>&times;</Button>
              </Col>
            </Row>
          ))}
          <Button size="sm" variant="outline-secondary" onClick={addField}>+ Add field</Button>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
