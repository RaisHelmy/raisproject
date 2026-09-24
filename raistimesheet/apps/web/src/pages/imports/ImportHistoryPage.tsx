import { Link, useSearchParams } from "react-router-dom";
import type { ImportDTO } from "@rais/shared-types";
import { useApi } from "@/hooks/useApi";
import { Card, DataTable, EmptyState, ErrorAlert, PageHeader, Pagination, Spinner, StatusBadge, type Column } from "@/components/ui";
import { fmtDateTime } from "@/services/format";
import { useAuth } from "@/services/auth";

export default function ImportHistoryPage() {
  const [sp, setSp] = useSearchParams();
  const { isApprover } = useAuth();
  const page = Number(sp.get("page") ?? "1");
  const all = sp.get("all") === "1";
  const list = useApi<{ items: ImportDTO[]; total: number; page: number; page_size: number }>("/imports", { page, all: all ? 1 : undefined }, { poll: 15000 });
  const columns: Column<ImportDTO>[] = [
    { key: "file", header: "Conversation", render: (r) => <><Link to={`/imports/${r.id}`} className="fw-medium text-decoration-none">{r.filename}</Link><div className="small text-secondary">{fmtDateTime(r.created_at)} · {r.project_code}</div></>, priority: 1 },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} />, priority: 1 },
    { key: "msgs", header: "Messages", render: (r) => r.message_count || "—", priority: 3 },
    { key: "tasks", header: "Tasks detected", render: (r) => r.tasks_detected, priority: 2 },
    { key: "prov", header: "AI provider", render: (r) => <span className="small">{r.ai_provider ?? "—"}</span>, priority: 3 },
    { key: "act", header: "", className: "text-end", render: (r) => r.status === "READY_FOR_REVIEW" ? <Link to={`/imports/${r.id}/review`} className="btn btn-sm btn-primary">Review</Link> : <Link to={`/imports/${r.id}`} className="btn btn-sm btn-outline-secondary">Open</Link>, priority: 1 },
  ];
  return (
    <div>
      <PageHeader title="Import History" subtitle="Every conversation you've uploaded and where it is in the pipeline." actions={<>{isApprover && <button className="btn btn-outline-secondary" onClick={() => { const n = new URLSearchParams(sp); all ? n.delete("all") : n.set("all", "1"); setSp(n); }}>{all ? "Show mine" : "Show everyone's"}</button>}<Link to="/imports/new" className="btn btn-primary"><i className="bi bi-whatsapp me-1" />New import</Link></>} />
      <ErrorAlert error={list.error} onRetry={list.reload} />
      {!list.data ? <Spinner /> : (
        <Card className="p-0">
          <DataTable columns={columns} rows={list.data.items} keyOf={(r) => r.id} rowLink={(r) => `/imports/${r.id}`} empty={<EmptyState icon="whatsapp" title="No imports yet." body="Upload a WhatsApp export and the assistant will prepare your timesheet." action={<Link to="/imports/new" className="btn btn-primary">Import WhatsApp conversation</Link>} />} />
          <div className="px-3 pb-3"><Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={(p) => { const n = new URLSearchParams(sp); n.set("page", String(p)); setSp(n); }} /></div>
        </Card>
      )}
    </div>
  );
}
