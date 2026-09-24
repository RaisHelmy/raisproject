import type { SuperMcp } from "../domain/services";
import type { RequestContext, AIRequestPurpose } from "../domain/types";
import { MCP_TOOLS, MCP_RESOURCES, callTool, readResource } from "../domain/mcp/tools";
import { DomainError } from "../domain/types";
import { redact } from "../domain/engines/privacy";

interface JsonRpc { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> }

const PURPOSE_BY_TOOL: Record<string, AIRequestPurpose> = { "super.change.create": "CREATE_CHANGE", "super.change.plan": "CREATE_CHANGE", "super.task": "PLAN_TASK", "super.project.create": "PLAN_TASK", "super.application.deploy": "DEPLOYMENT", "super.application.rollback": "DEPLOYMENT", "super.incident.diagnose": "DIAGNOSE_FAILURE", "super.incident.heal": "DIAGNOSE_FAILURE", "super.project.analyze": "REPOSITORY_ANALYSIS", "super.ai.optimization": "RECOMMENDATION", "super.ai.recommendations": "RECOMMENDATION" };

/**
 * Section 51/54 — single shared remote MCP endpoint (Streamable HTTP, JSON-RPC 2.0).
 * Identity: Bearer MCP token → user → organization → actor (resolved server-side). One AI run per MCP session id.
 */
export async function handleMcp(app: SuperMcp, ctx: RequestContext, body: JsonRpc | JsonRpc[], sessionId: string, client: string): Promise<unknown> {
  const messages = Array.isArray(body) ? body : [body];
  const results = [];
  for (const msg of messages) results.push(await handleOne(app, ctx, msg, sessionId, client));
  return Array.isArray(body) ? results : results[0];
}

const runsBySession = new Map<string, { runId: string; at: number }>();

async function runFor(app: SuperMcp, ctx: RequestContext, sessionId: string, client: string, toolName: string): Promise<string> {
  const existing = runsBySession.get(sessionId);
  if (existing && Date.now() - existing.at < 10 * 60_000) { existing.at = Date.now(); return existing.runId; }
  const run = await app.telemetry.startRun(ctx, { purpose: PURPOSE_BY_TOOL[toolName] ?? "CHECK_STATUS", client, provider: "ANTHROPIC", model: "external-mcp-client", summary: `MCP session ${sessionId.slice(0, 8)} via ${client}`, contextItemCount: 0 });
  runsBySession.set(sessionId, { runId: run.id, at: Date.now() });
  return run.id;
}

async function handleOne(app: SuperMcp, ctx: RequestContext, msg: JsonRpc, sessionId: string, client: string) {
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const err = (code: number, message: string, data?: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message, data } });
  try {
    switch (msg.method) {
      case "initialize": return ok({ protocolVersion: "2025-03-26", capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } }, serverInfo: { name: "super-mcp", version: "0.1.0" }, instructions: "Super MCP is a governed control plane. Tools never execute raw commands; they create policy-checked tasks. Prefer super.environment.snapshot and super.change.get over repeated status calls." });
      case "notifications/initialized": case "ping": return ok({});
      case "tools/list": return ok({ tools: MCP_TOOLS.map((t) => ({ name: t.name, description: `[${t.risk}] ${t.description}`, inputSchema: t.inputSchema })) });
      case "resources/list": return ok({ resources: [] });
      case "resources/templates/list": return ok({ resourceTemplates: MCP_RESOURCES });
      case "resources/read": { const uri = String(msg.params?.uri ?? ""); const runId = await runFor(app, ctx, sessionId, client, "super.change.get"); const t0 = Date.now(); const data = await readResource(app, ctx, uri); await app.telemetry.recordCall(ctx, runId, { toolName: "resource:" + uri.split("/")[2], durationMs: Date.now() - t0, status: "SUCCESS", inputs: { uri } }); return ok({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(data) }] }); }
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
        const tool = MCP_TOOLS.find((t) => t.name === name);
        if (!tool) return err(-32602, `Unknown tool ${name}`);
        const runId = await runFor(app, ctx, sessionId, client, name);
        const t0 = Date.now();
        try {
          const result = await callTool(app, { ...ctx, executionMode: "AI" }, name, args, runId);
          await app.telemetry.recordCall(ctx, runId, { toolName: name, toolVersion: tool.version, durationMs: Date.now() - t0, status: "SUCCESS", inputs: args, changeId: typeof args.changeId === "string" ? args.changeId : undefined });
          return ok({ content: [{ type: "text", text: redact(JSON.stringify(result, null, 2), { pii: false }).text }], isError: false });
        } catch (e) {
          const d = e as DomainError;
          await app.telemetry.recordCall(ctx, runId, { toolName: name, toolVersion: tool.version, durationMs: Date.now() - t0, status: "FAILED", errorCode: d.code ?? "ERROR", inputs: args });
          if (d instanceof DomainError && (d.code === "POLICY_DENIED" || d.code === "FORBIDDEN")) await app.store.aiFailures.put({ id: `aif_${Date.now()}`, organizationId: ctx.actor.organizationId, aiRunId: runId, type: d.code === "FORBIDDEN" ? "AUTHORIZATION_FAILURE" : "POLICY_BLOCK", rootCause: d.code === "FORBIDDEN" ? "Permission" : "Policy", message: d.message, at: ctx.now(), recovered: false });
          return ok({ content: [{ type: "text", text: `${d.code ?? "ERROR"}: ${d.message}${d.detail ? "\n" + JSON.stringify(d.detail) : ""}` }], isError: true });
        }
      }
      default: return err(-32601, `Method not found: ${msg.method}`);
    }
  } catch (e) { return err(-32000, (e as Error).message); }
}
