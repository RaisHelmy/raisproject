import { useState } from "react";
import type { Template } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";

const TABS: Array<{ key: Template["kind"]; label: string }> = [
  { key: "application", label: "Application" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "database", label: "Database" },
];

export function Templates() {
  const [kind, setKind] = useState<Template["kind"]>("application");
  const { data: templates, loading } = useApi(() => api.get<Template[]>(`/templates?kind=${kind}`), [kind]);

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">Templates</h1>
          <div className="rf-page-sub">Application, infrastructure and database starting points.</div>
        </div>
      </div>
      <div className="rf-tabs">
        {TABS.map((t) => <div key={t.key} className={`rf-tab ${kind === t.key ? "active" : ""}`} onClick={() => setKind(t.key)}>{t.label}</div>)}
      </div>
      {loading && <div className="rf-skeleton" style={{ height: 160 }} />}
      <div className="row g-3">
        {templates?.map((t) => (
          <div className="col-md-6 col-xl-4" key={t.id}>
            <div className="rf-card h-100">
              <div className="fw-semibold mb-1">{t.name}</div>
              <div className="rf-faint mb-2">{t.description}</div>
              <div className="d-flex flex-wrap gap-1">
                {t.tags.map((tag) => <span key={tag} className="rf-badge rf-badge-unknown">{tag}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
