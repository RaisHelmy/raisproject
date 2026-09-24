#!/usr/bin/env node
/**
 * Rais Timesheet — MCP server (stdio) for Claude Desktop.
 *
 * The Worker API is plain REST + Bearer auth; Claude Desktop speaks MCP, so
 * this process bridges the two. Zero dependencies on purpose — it is run
 * directly by Claude Desktop (`node rais-timesheet-mcp.mjs`) and an npm
 * install step is one more thing to break on a machine we don't control.
 *
 * Auth: RAIS_TIMESHEET_TOKEN (a personal API token). Requests with a Bearer
 * token skip the API's CSRF check and are recorded with source="mcp", so no
 * cookie/session handling is needed here.
 *
 * Env:
 *   RAIS_TIMESHEET_TOKEN  (required) personal API token
 *   RAIS_TIMESHEET_API    (optional) API base, defaults to production
 */

const API = (process.env.RAIS_TIMESHEET_API || "https://rais-timesheet-api.raishelmy97.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.RAIS_TIMESHEET_TOKEN;

async function call(method, path, { query, body } = {}) {
  if (!TOKEN) throw new Error("RAIS_TIMESHEET_TOKEN is not set. See IMPORTANT.md.");
  const url = new URL(`${API}/api${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 300)}`); }
  if (!res.ok || json.success === false) {
    const e = json.error || {};
    throw new Error(`${e.code || `HTTP_${res.status}`}: ${e.message || text.slice(0, 300)}${e.reference ? ` (ref ${e.reference})` : ""}`);
  }
  return json.data;
}

/** tool name -> { description, inputSchema, run } */
const TOOLS = {
  whoami: {
    description: "Show which Rais Timesheet account this MCP connection is acting as, its roles, and whether AI/Jira are in demo mode.",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/auth/me"),
  },
  list_projects: {
    description: "List projects (code, name, client, Jira project key, working hours). Use this to get the project_id needed to create a timesheet.",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/projects"),
  },
  list_jira_projects: {
    description: "List the projects that actually exist on the connected Jira site, so a Rais project can be mapped to a real Jira project key.",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/jira/projects"),
  },
  jira_connection: {
    description: "Show the Jira connection status (site, account, health, last sync, whether the demo adapter is active).",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/jira/connection"),
  },
  sync_jira: {
    description: "Pull the latest issues from Jira into the local cache and reconcile approved timesheets against them. Run this after pushing timesheet changes.",
    inputSchema: { type: "object", properties: {} },
    run: () => call("POST", "/jira/sync", { body: {} }),
  },
  list_jira_issues: {
    description: "List cached Jira issues with delay/timesheet-link status.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "mine", "open", "completed", "delayed", "due_soon", "missing_timesheet"], description: "Default 'all'." },
        q: { type: "string", description: "Free-text search over issue key/summary." },
        project_key: { type: "string", description: "Restrict to one Jira project key, e.g. HIRA." },
        page: { type: "number" },
        page_size: { type: "number", description: "Max 100." },
      },
    },
    run: (a) => call("GET", "/jira/issues", { query: a }),
  },
  get_jira_issue: {
    description: "Get one Jira issue by key, with its linked timesheets and delay classification.",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Issue key, e.g. HIRA-147." },
        refresh: { type: "boolean", description: "Fetch fresh from Jira instead of the cache." },
      },
      required: ["key"],
    },
    run: (a) => call("GET", `/jira/issues/${encodeURIComponent(a.key)}`, { query: a.refresh ? { refresh: "1" } : {} }),
  },
  list_timesheets: {
    description: "List timesheets. Defaults to your own; approvers can pass scope='all'.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["mine", "all"] },
        status: { type: "string", description: "Comma-separated: DRAFT,SUBMITTED,APPROVED,REJECTED." },
        project_id: { type: "string" },
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD" },
        q: { type: "string" },
        page: { type: "number" },
        page_size: { type: "number" },
      },
    },
    run: (a) => call("GET", "/timesheets", { query: a }),
  },
  create_timesheet: {
    description: "Create a DRAFT timesheet entry. This is how processed WhatsApp work items get pushed in. Give either duration_minutes, or start_time+end_time.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "From list_projects (e.g. p-int)." },
        work_date: { type: "string", description: "YYYY-MM-DD" },
        title: { type: "string", description: "3-200 chars." },
        description: { type: "string", description: "What was actually done. Max 5000 chars." },
        start_time: { type: "string", description: "HH:MM" },
        end_time: { type: "string", description: "HH:MM" },
        duration_minutes: { type: "number", description: "0-1440." },
        work_status: { type: "string", enum: ["COMPLETED", "IN_PROGRESS", "BLOCKED", "UNKNOWN"] },
      },
      required: ["project_id", "work_date", "title"],
    },
    run: (a) => call("POST", "/timesheets", { body: a }),
  },
  update_timesheet: {
    description: "Update a DRAFT timesheet.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        work_date: { type: "string", description: "YYYY-MM-DD" },
        start_time: { type: "string", description: "HH:MM" },
        end_time: { type: "string", description: "HH:MM" },
        duration_minutes: { type: "number" },
        work_status: { type: "string", enum: ["COMPLETED", "IN_PROGRESS", "BLOCKED", "UNKNOWN"] },
      },
      required: ["id"],
    },
    run: (a) => { const { id, ...rest } = a; return call("PATCH", `/timesheets/${encodeURIComponent(id)}`, { body: rest }); },
  },
  submit_timesheet: {
    description: "Submit a DRAFT timesheet for approval.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    run: (a) => call("POST", `/timesheets/${encodeURIComponent(a.id)}/submit`, { body: {} }),
  },
  approve_timesheet: {
    description: "Approve a SUBMITTED timesheet (ADMIN/APPROVER only). Approval triggers Jira reconciliation.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    run: (a) => call("POST", `/timesheets/${encodeURIComponent(a.id)}/approve`, { body: {} }),
  },
  jira_summary: {
    description: "Counts of approved timesheets by Jira sync state (linked, needs review, ready to create, errors).",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/jira/summary"),
  },
  jira_reconciliation: {
    description: "Approved timesheets and their Jira match candidates — the queue of things needing a link or a new Jira issue.",
    inputSchema: {
      type: "object",
      properties: {
        view: { type: "string", enum: ["needs_action", "suggested", "ready_to_create", "ready_to_sync", "synced", "errors", "all"] },
        project_id: { type: "string" },
        page: { type: "number" },
        page_size: { type: "number" },
      },
    },
    run: (a) => call("GET", "/jira/reconciliation", { query: a }),
  },
  link_timesheet_to_issue: {
    description: "Link an approved timesheet to an existing Jira issue and add a traceability comment on the issue.",
    inputSchema: {
      type: "object",
      properties: {
        timesheet_id: { type: "string" },
        issue_key: { type: "string", description: "e.g. HIRA-147" },
      },
      required: ["timesheet_id", "issue_key"],
    },
    run: (a) => call("POST", `/jira/timesheets/${encodeURIComponent(a.timesheet_id)}/link`, { body: { issue_key: a.issue_key, match_type: "MANUAL" } }),
  },
  create_jira_issue_from_timesheet: {
    description: "Create a new Jira issue from an approved timesheet. Blocked if a likely duplicate exists unless force=true.",
    inputSchema: {
      type: "object",
      properties: {
        timesheet_id: { type: "string" },
        summary: { type: "string" },
        description: { type: "string" },
        issue_type: { type: "string", description: "e.g. Task. Defaults to the project's default." },
        force: { type: "boolean", description: "Create even if a potential duplicate was detected." },
      },
      required: ["timesheet_id"],
    },
    run: (a) => { const { timesheet_id, ...rest } = a; return call("POST", `/jira/timesheets/${encodeURIComponent(timesheet_id)}/create`, { body: rest }); },
  },
  jira_sync_errors: {
    description: "Open Jira synchronisation errors, with their user-facing reference codes.",
    inputSchema: { type: "object", properties: { page: { type: "number" }, page_size: { type: "number" } } },
    run: (a) => call("GET", "/jira/errors", { query: a }),
  },
  dashboard: {
    description: "Dashboard KPIs: pending approvals, hours logged, Jira sync health.",
    inputSchema: { type: "object", properties: {} },
    run: () => call("GET", "/dashboard"),
  },
};

// ---- MCP stdio transport (JSON-RPC 2.0, newline-delimited) ----------------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function failure(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(msg) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    return result(id, {
      protocolVersion: params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "rais-timesheet", version: "1.0.0" },
    });
  }

  // Notifications carry no id and expect no response.
  if (id === undefined) return;

  if (method === "ping") return result(id, {});

  if (method === "tools/list") {
    return result(id, {
      tools: Object.entries(TOOLS).map(([name, t]) => ({
        name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }

  if (method === "tools/call") {
    const tool = TOOLS[params?.name];
    if (!tool) return failure(id, -32602, `Unknown tool: ${params?.name}`);
    try {
      const data = await tool.run(params.arguments || {});
      return result(id, { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
    } catch (err) {
      // Report tool failures as results with isError so the model can react
      // and retry, rather than as protocol-level errors.
      return result(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
    }
  }

  return failure(id, -32601, `Method not found: ${method}`);
}

let buffer = "";
// Tool calls are async; exiting the moment stdin closes would cancel any
// still in flight (and silently drop their responses). Track them and drain
// before exiting.
const inFlight = new Set();
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && inFlight.size === 0) process.exit(0);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    const p = Promise.resolve(handle(msg))
      .catch((err) => { if (msg?.id !== undefined) failure(msg.id, -32603, err.message); })
      .finally(() => { inFlight.delete(p); maybeExit(); });
    inFlight.add(p);
  }
});
process.stdin.on("end", () => { stdinClosed = true; maybeExit(); });
