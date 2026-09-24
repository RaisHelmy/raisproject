import { useState } from "react";
import type { McpToolDefinition, McpToolResult } from "@runforge/shared";
import { api } from "../api/client";
import { useApi } from "../hooks/useApi";
import { ConfirmDialog } from "../components/ConfirmDialog";

const LEVEL_COLOR: Record<string, string> = { READ: "healthy", WRITE: "degraded", DANGEROUS: "failed" };

export function Mcp() {
  const { data: tools } = useApi(() => api.get<McpToolDefinition[]>("/mcp/tools"), []);
  const [selected, setSelected] = useState<McpToolDefinition | null>(null);
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<McpToolResult | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ token: string; name: string; args: Record<string, unknown> } | null>(null);

  async function callTool(confirmationToken?: string) {
    if (!selected) return;
    let parsedArgs: Record<string, unknown> = {};
    try { parsedArgs = JSON.parse(args); } catch { /* ignore, leave empty */ }
    const r = await api.post<McpToolResult>("/mcp/call", { name: selected.name, arguments: parsedArgs, confirmationToken });
    if (r.requiresConfirmation) {
      setPendingConfirm({ token: r.requiresConfirmation.confirmationToken, name: selected.name, args: parsedArgs });
    } else {
      setResult(r);
      setPendingConfirm(null);
    }
  }

  return (
    <div>
      <div className="rf-page-header">
        <div>
          <h1 className="rf-page-title">MCP</h1>
          <div className="rf-page-sub">RunForge's Model Context Protocol server — the same tools Claude, ChatGPT or any MCP client can call.</div>
        </div>
      </div>

      <div className="rf-card mb-3">
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill text-success" />
          <span>Connected — {tools?.length ?? 0} tools exposed</span>
        </div>
        <div className="rf-faint mt-1">Claude Desktop · ChatGPT (read only) — every call passes Authentication → Authorization → Domain Service → Provider → Audit Event.</div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="rf-table-card">
            <table className="rf-table">
              <thead><tr><th>Tool</th><th>Level</th></tr></thead>
              <tbody>
                {tools?.map((t) => (
                  <tr key={t.name} className={selected?.name === t.name ? "table-active" : ""} onClick={() => { setSelected(t); setArgs("{}"); setResult(null); }}>
                    <td className="rf-mono">{t.name}</td>
                    <td><span className={`rf-badge rf-badge-${LEVEL_COLOR[t.level]}`}><span className="dot" />{t.level}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="col-md-6">
          {selected ? (
            <div className="rf-card">
              <div className="fw-semibold rf-mono mb-1">{selected.name}</div>
              <div className="rf-faint mb-2">{selected.description}</div>
              <label className="rf-faint mb-1 d-block">Arguments (JSON)</label>
              <textarea className="form-control rf-mono mb-2" rows={4} value={args} onChange={(e) => setArgs(e.target.value)} />
              <button className="btn-rf btn-rf-primary" onClick={() => callTool()}>Call Tool</button>
              {result && (
                <pre className="rf-mono mt-3 p-2" style={{ background: "var(--rf-surface-raised)", borderRadius: 8, maxHeight: 260, overflow: "auto" }}>
                  {result.content.map((c) => c.text).join("\n")}
                </pre>
              )}
            </div>
          ) : (
            <div className="rf-empty"><i className="bi bi-cpu" />Select a tool to try it.</div>
          )}
        </div>
      </div>

      {pendingConfirm && (
        <ConfirmDialog
          title="Dangerous MCP action"
          danger
          confirmLabel="Approve"
          onConfirm={() => callTool(pendingConfirm.token)}
          onCancel={() => setPendingConfirm(null)}
        >
          <p><span className="rf-mono">{pendingConfirm.name}</span> is a DANGEROUS action and requires explicit approval before RunForge will execute it.</p>
          <pre className="rf-mono rf-faint">{JSON.stringify(pendingConfirm.args, null, 2)}</pre>
        </ConfirmDialog>
      )}
    </div>
  );
}
