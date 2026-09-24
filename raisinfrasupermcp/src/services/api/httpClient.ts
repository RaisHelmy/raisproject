import type { ApiClient, Session } from "./client";
import { ApiError } from "./client";

/**
 * CONNECTED mode client: talks to the Cloudflare Worker at /api. Session is a bearer token in memory + localStorage.
 * The Worker resolves the actor from the session — the client never sends organization/role/permission claims.
 */
export class HttpClient implements ApiClient {
  readonly mode = "CONNECTED" as const;
  private token: string | null = localStorage.getItem("supermcp.token");

  private async req<R>(method: string, path: string, body?: unknown): Promise<R> {
    const res = await fetch(`/api${path}`, { method, headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { code?: string; message?: string; detail?: Record<string, unknown> };
    if (!res.ok) throw new ApiError(json.code ?? "ERROR", json.message ?? `Request failed (${res.status})`, json.detail);
    return json as R;
  }
  private get = <R>(p: string) => this.req<R>("GET", p);
  private post = <R>(p: string, b?: unknown) => this.req<R>("POST", p, b ?? {});
  private q(f?: Record<string, unknown>) { const s = new URLSearchParams(); for (const [k, v] of Object.entries(f ?? {})) if (v !== undefined && v !== "") s.set(k, String(v)); const str = s.toString(); return str ? `?${str}` : ""; }
  private setToken(s: Session & { token?: string }) { if (s.token) { this.token = s.token; localStorage.setItem("supermcp.token", s.token); } return s; }

  auth: ApiClient["auth"] = {
    session: async () => { if (!this.token) return null; try { return await this.get<Session>("/auth/session"); } catch { return null; } },
    login: async (email, password) => this.setToken(await this.post("/auth/login", { email, password })),
    register: async (input) => this.setToken(await this.post("/auth/register", input)),
    logout: async () => { await this.post("/auth/logout").catch(() => {}); this.token = null; localStorage.removeItem("supermcp.token"); },
    switchOrganization: async (organizationId) => this.setToken(await this.post("/auth/switch", { organizationId })),
    demoLogin: async () => { throw new ApiError("VALIDATION", "Demo login is only available in demo mode"); },
  };
  dashboard = () => this.get<Awaited<ReturnType<ApiClient["dashboard"]>>>("/dashboard");
  command = (text: string) => this.post<Awaited<ReturnType<ApiClient["command"]>>>("/command", { text });

  changes: ApiClient["changes"] = {
    list: (f) => this.get(`/changes${this.q(f)}`), get: (id) => this.get(`/changes/${id}`), plan: (intent) => this.post("/changes/plan", { intent }), create: (i) => this.post("/changes", i), update: (id, p) => this.req("PATCH", `/changes/${id}`, p),
    confirmRequirements: (id, r) => this.post(`/changes/${id}/requirements`, { requirements: r }), syncJira: (id) => this.post(`/changes/${id}/jira`), skipStage: (id, key, reason) => this.post(`/changes/${id}/skip`, { key, reason }), gitEvent: (id, e) => this.post(`/changes/${id}/git`, e),
    toggleChecklist: (id, itemId, state) => this.post(`/changes/${id}/checklist`, { itemId, state }), requestDeployment: (id) => this.post(`/changes/${id}/deploy`), recordUat: (id, result, note) => this.post(`/changes/${id}/uat`, { result, note }), close: (id, outcome) => this.post(`/changes/${id}/close`, { outcome }), cancel: (id, reason) => this.post(`/changes/${id}/cancel`, { reason }), comment: (id, text) => this.post(`/changes/${id}/comments`, { text }),
  };
  tasks: ApiClient["tasks"] = {
    list: (f) => this.get(`/tasks${this.q(f)}`), get: (id) => this.get(`/tasks/${id}`), definitions: () => this.get("/tasks/definitions"), create: (i) => this.post("/tasks", i),
    execute: async (id, onUpdate) => { await this.post(`/tasks/${id}/execute`); let last: Awaited<ReturnType<ApiClient["tasks"]["get"]>>["task"]; do { await new Promise((r) => setTimeout(r, 1500)); last = (await this.get<Awaited<ReturnType<ApiClient["tasks"]["get"]>>>(`/tasks/${id}`)).task; onUpdate?.(last); } while (!["COMPLETED", "ESCALATED", "CANCELLED", "WAITING_APPROVAL"].includes(last.status)); return last; },
    cancel: (id) => this.post(`/tasks/${id}/cancel`),
  };
  approvals: ApiClient["approvals"] = { list: (f) => this.get(`/approvals${this.q(f)}`), get: (id) => this.get(`/approvals/${id}`), decide: (id, decision, comment, typedConfirmation) => this.post(`/approvals/${id}/decide`, { decision, comment, typedConfirmation }) };
  policies: ApiClient["policies"] = { list: () => this.get("/policies"), get: (id) => this.get(`/policies/${id}`), save: (i) => this.post("/policies", i), toggle: (id, enabled) => this.post(`/policies/${id}/toggle`, { enabled }), remove: (id) => this.req("DELETE", `/policies/${id}`), simulate: (i) => this.post("/policies/simulate", i) };
  platform: ApiClient["platform"] = {
    organization: () => this.get("/organizations/current"), updateOrganization: (p) => this.req("PATCH", "/organizations/current", p), requestVerification: (kind, provider) => this.post("/organizations/verification", { kind, provider }),
    members: () => this.get("/users"), invite: (i) => this.post("/users/invite", i), updateMembership: (id, p) => this.req("PATCH", `/users/memberships/${id}`, p), groups: () => this.get("/groups"), saveGroup: (i) => this.post("/groups", i), roles: () => this.get("/roles"), saveRole: (i) => this.post("/roles", i),
    agents: () => this.get("/agents"), agent: (id) => this.get(`/agents/${id}`), agentAction: (id, action) => this.post(`/agents/${id}/action`, { action }), registerAgent: (i) => this.post("/agents/register", i),
    environments: () => this.get("/environments"), environmentSnapshot: (id) => this.get(`/environments/${id}/snapshot`), servers: () => this.get("/environments/servers"), applications: () => this.get("/environments/applications"), repositories: () => this.get("/integrations/repositories"), gitConnections: () => this.get("/integrations/git"), createGitConnection: (i) => this.post("/integrations/git", i), testGitConnection: (id) => this.post(`/integrations/git/${id}/test`), integrations: () => this.get("/integrations"), credentials: () => this.get("/integrations/credentials"),
    deployments: () => this.get("/deployments"), deployment: (id) => this.get(`/deployments/${id}`), incidents: () => this.get("/incidents"), incident: (id) => this.get(`/incidents/${id}`), resolveIncident: (id, note) => this.post(`/incidents/${id}/resolve`, { note }),
    auditLogs: (f) => this.get(`/audit${this.q(f)}`), notifications: () => this.get("/notifications"), markNotifications: (ids) => this.post("/notifications/read", { ids }),
    billing: () => this.get("/billing"), changePlan: (planId, cycle) => this.post("/billing/plan", { planId, cycle }), setAiMode: (i) => this.post("/billing/ai", i), marketplace: () => this.get("/marketplace"), installMarketplaceItem: (id) => this.post(`/marketplace/${id}/install`), automations: () => this.get("/marketplace/automations"), toggleAutomation: (id, enabled) => this.post(`/marketplace/automations/${id}/toggle`, { enabled }),
    exportMyData: (sections) => this.post("/data/export", { sections }), requestDeletion: (phrase) => this.post("/data/delete", { phrase }),
  };
  telemetry: ApiClient["telemetry"] = { summary: (days) => this.get(`/ai/summary${this.q({ days })}`), runs: (f) => this.get(`/ai/runs${this.q(f)}`), run: (id) => this.get(`/ai/runs/${id}`), calls: (f) => this.get(`/mcp/calls${this.q(f)}`), toolAnalytics: () => this.get("/mcp/tools"), recommendations: () => this.get("/ai/recommendations"), updateRecommendation: (id, status) => this.post(`/ai/recommendations/${id}`, { status }), analyze: () => this.post("/ai/analyze"), learning: () => this.get("/ai/learning"), exportLearningData: () => this.post("/ai/export") };
  demoLab: ApiClient["demoLab"] = { scenarios: () => this.get("/demo/scenarios"), prepare: (id) => this.post(`/demo/${id}/prepare`), reset: () => this.post("/demo/reset") };
}
