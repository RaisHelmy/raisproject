import { useState } from "react";
import { useApp, errorMessage } from "@/app/providers";
import { PageHeader, Panel } from "@/components/Panels";
import { downloadFile, toCsv } from "@/utils/format";
import { StatusBadge } from "@/components/StatusBadge";

const SECTIONS = [["tasks", "Tasks"], ["agents", "Agents"], ["activity", "Activity"], ["jira", "Jira"], ["changes", "Changes"], ["approvals", "Approvals"], ["automations", "Automations"], ["auditLogs", "Audit Logs"], ["reports", "Reports"], ["aiTelemetry", "AI Telemetry"], ["mcpTelemetry", "MCP Telemetry"], ["learningData", "Learning Data"]];

export function MyData({ exportOnly }: { exportOnly?: boolean }) {
  const { api, toast, can } = useApp();
  const [sel, setSel] = useState<string[]>(SECTIONS.map((s) => s[0]));
  const [busy, setBusy] = useState(false);
  const run = async (fmt: "json" | "csv" | "zip" | "excel", sections: string[] | "all" = sel) => {
    setBusy(true);
    try {
      const data = await api.platform.exportMyData(sections);
      const stamp = new Date().toISOString().slice(0, 10);
      if (fmt === "json" || fmt === "zip") downloadFile(`supermcp-my-data-${stamp}.json`, JSON.stringify(data, null, 2));
      else for (const [k, rows] of Object.entries(data)) if ((rows as unknown[]).length) downloadFile(`supermcp-${k}-${stamp}.csv`, toCsv(rows as Record<string, unknown>[]), "text/csv");
      toast(fmt === "zip" ? "ZIP bundling arrives with R2 export jobs — delivered as a single JSON for now" : fmt === "excel" ? "Excel delivered as CSV per section (XLSX writer pending)" : "Export ready — secrets redacted", "success");
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(false); }
  };
  return <div><PageHeader title={exportOnly ? "Export" : "My Data"} subtitle="Your data belongs to you. Export everything or pick sections. Secrets and credentials are always redacted." />
    <div className="row g-3"><div className="col-lg-7"><Panel title="Sections"><div className="row">{SECTIONS.map(([k, l]) => <div className="col-6" key={k}><div className="form-check"><input id={"s" + k} type="checkbox" className="form-check-input" checked={sel.includes(k)} onChange={(e) => setSel(e.target.checked ? [...sel, k] : sel.filter((x) => x !== k))} /><label htmlFor={"s" + k} className="form-check-label">{l}</label></div></div>)}</div>
      <div className="d-flex gap-2 mt-3 flex-wrap">{(["json", "csv", "excel", "zip"] as const).map((f) => <button key={f} className="btn btn-outline-secondary" disabled={busy || !sel.length || !can("data.export")} onClick={() => run(f)}>{f.toUpperCase()}{(f === "zip" || f === "excel") && <StatusBadge status="PENDING" label="partial" />}</button>)}</div></Panel></div>
      <div className="col-lg-5"><Panel title="Download everything"><p className="small text-secondary">One JSON containing all sections. Data exports are audited.</p><button className="btn btn-primary" disabled={busy || !can("data.export")} onClick={() => run("json", "all")}><i className="bi bi-download me-1" />Download Everything</button></Panel>
        <div className="mt-3"><Panel title="Account & data deletion"><p className="small text-secondary">Organization deletion with retention/legal hold is in Organization → Settings → Danger zone.</p></Panel></div></div></div></div>;
}
