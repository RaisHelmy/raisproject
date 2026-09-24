import { useState } from "react";
import type { AuditLogDTO } from "@xuanzhi/shared-types";
import { useLoad, PageHeader, StatusBadge } from "./_shared";
import { Pager } from "@/components/ui";
import { useT } from "@/i18n";

export default function AuditPage() {
  const { t, locale } = useT(); const [page, setPage] = useState(1); const [action, setAction] = useState(""); const [resource, setResource] = useState("");
  const { data } = useLoad<{ items: AuditLogDTO[]; total: number }>("/admin/audit", { action, resource_type: resource, page, page_size: 50 });
  return (
    <>
      <PageHeader title={t("admin.audit")} subtitle="Append-only record of administrative and security-relevant actions." actions={<><input className="form-control form-control-sm" placeholder="action prefix (admin.model)" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} /><input className="form-control form-control-sm" placeholder="resource type" value={resource} onChange={(e) => { setResource(e.target.value); setPage(1); }} /></>} />
      <div className="card"><div className="table-responsive"><table className="table table-hover mb-0 fs-13"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Resource</th><th>IP</th><th>Result</th><th>Details</th></tr></thead>
        <tbody>{data?.items.map((a) => <tr key={a.id}><td className="text-nowrap">{new Date(a.created_at).toLocaleString(locale)}</td><td>{a.actor_email ?? <span className="text-faint">system</span>}</td><td><code>{a.action}</code></td><td>{a.resource_type}{a.resource_id && <span className="text-faint"> · {a.resource_id.slice(0, 8)}</span>}</td><td className="text-muted">{a.ip}</td><td><StatusBadge s={a.result} /></td><td className="text-muted text-truncate" style={{ maxWidth: 320 }} title={JSON.stringify(a.details)}>{a.details ? JSON.stringify(a.details) : ""}</td></tr>)}</tbody></table></div></div>
      {data && <Pager page={page} pageSize={50} total={data.total} onPage={setPage} />}
    </>
  );
}
