/**
 * Jira Cloud REST API v3 client. Supports OAuth 2.0 (3LO) bearer tokens via api.atlassian.com
 * and Basic auth (email + API token) directly against the site. Runs only inside the Worker.
 */
import type { CreateIssueInput, JiraClient, JiraIssue, JiraIssueTypeInfo, JiraProjectInfo, JiraStatusInfo, JiraTransition, JiraUser } from "./client";
import { JiraApiError, issueUrl, normaliseCategory } from "./client";
import type { Logger } from "../../lib/logger";

export type JiraAuth =
  | { type: "oauth"; cloud_id: string; access_token: string; site_url: string }
  | { type: "basic"; site_url: string; email: string; api_token: string };

interface RawIssue {
  id: string; key: string;
  fields: {
    summary: string; description?: unknown; status?: { name: string; statusCategory?: { key?: string } }; issuetype?: { name: string };
    assignee?: { accountId: string; displayName: string; emailAddress?: string } | null; priority?: { name: string } | null;
    duedate?: string | null; resolutiondate?: string | null; created?: string; updated?: string; project?: { key: string };
  };
}

const FIELDS = "summary,description,status,issuetype,assignee,priority,duedate,resolutiondate,created,updated,project";

export class JiraCloudClient implements JiraClient {
  readonly mode = "cloud" as const;
  readonly site_url: string;
  private readonly base: string;
  private readonly authHeader: string;

  constructor(private readonly auth: JiraAuth, private readonly log: Logger) {
    this.site_url = auth.site_url.replace(/\/$/, "");
    if (auth.type === "oauth") {
      this.base = `https://api.atlassian.com/ex/jira/${auth.cloud_id}/rest/api/3`;
      this.authHeader = `Bearer ${auth.access_token}`;
    } else {
      this.base = `${this.site_url}/rest/api/3`;
      this.authHeader = `Basic ${btoa(`${auth.email}:${auth.api_token}`)}`;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(this.base + path);
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: { Authorization: this.authHeader, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      this.log.warn("jira_network_error", { path, error: e });
      throw new JiraApiError("Could not reach Jira.", 0, "JIRA_NETWORK", true);
    }
    this.log.debug("jira_request", { method, path, status: res.status, ms: Date.now() - started });
    if (res.status === 204) return undefined as T;
    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    const text = await res.text().catch(() => "");
    let message = `Jira responded with HTTP ${res.status}.`;
    try {
      const j = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string>; message?: string };
      const parts = [...(j.errorMessages ?? []), ...Object.entries(j.errors ?? {}).map(([k, v]) => `${k}: ${v}`)];
      if (parts.length) message = parts.join("; ");
      else if (j.message) message = j.message;
    } catch { /* keep default */ }
    const retryable = res.status === 429 || res.status >= 500;
    const code = res.status === 401 ? "JIRA_UNAUTHORIZED" : res.status === 403 ? "JIRA_FORBIDDEN" : res.status === 404 ? "JIRA_NOT_FOUND" : res.status === 429 ? "JIRA_RATE_LIMITED" : res.status >= 500 ? "JIRA_UNAVAILABLE" : "JIRA_BAD_REQUEST";
    throw new JiraApiError(message, res.status, code, retryable);
  }

  async myself(): Promise<JiraUser> {
    const me = await this.request<{ accountId: string; displayName: string; emailAddress?: string }>("GET", "/myself");
    return { account_id: me.accountId, display_name: me.displayName, email: me.emailAddress ?? null };
  }

  async testConnection() {
    try {
      const account = await this.myself();
      return { ok: true, account, error: null };
    } catch (e) {
      return { ok: false, account: null, error: e instanceof Error ? e.message : "Unknown error" };
    }
  }

  async searchIssues(jql: string, max = 100): Promise<JiraIssue[]> {
    const out: JiraIssue[] = [];
    let nextPageToken: string | undefined;
    do {
      const body: Record<string, unknown> = { jql, maxResults: Math.min(100, max - out.length), fields: FIELDS.split(",") };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      const r = await this.request<{ issues: RawIssue[]; nextPageToken?: string; isLast?: boolean }>("POST", "/search/jql", body);
      out.push(...(r.issues ?? []).map((i) => this.map(i)));
      nextPageToken = r.isLast ? undefined : r.nextPageToken;
    } while (nextPageToken && out.length < max);
    return out;
  }

  async getIssue(key: string): Promise<JiraIssue | null> {
    try {
      return this.map(await this.request<RawIssue>("GET", `/issue/${encodeURIComponent(key)}`, undefined, { fields: FIELDS }));
    } catch (e) {
      if (e instanceof JiraApiError && e.status === 404) return null;
      throw e;
    }
  }

  async createIssue(input: CreateIssueInput): Promise<JiraIssue> {
    const fields: Record<string, unknown> = {
      project: { key: input.project_key },
      issuetype: { name: input.issue_type },
      summary: input.summary,
      description: adf(input.description),
    };
    if (input.assignee_account_id) fields.assignee = { accountId: input.assignee_account_id };
    if (input.labels?.length) fields.labels = input.labels;
    if (input.due_date) fields.duedate = input.due_date;
    const created = await this.request<{ id: string; key: string }>("POST", "/issue", { fields });
    const full = await this.getIssue(created.key);
    return full ?? { id: created.id, key: created.key, project_key: input.project_key, summary: input.summary, description: input.description, status: "To Do", status_category: "new", issue_type: input.issue_type, assignee: null, priority: null, due_date: input.due_date ?? null, resolved_at: null, created: new Date().toISOString(), updated: new Date().toISOString(), url: issueUrl(this.site_url, created.key) };
  }

  async updateIssue(key: string, fields: Partial<Pick<CreateIssueInput, "summary" | "description" | "due_date" | "labels">>): Promise<void> {
    const f: Record<string, unknown> = {};
    if (fields.summary !== undefined) f.summary = fields.summary;
    if (fields.description !== undefined) f.description = adf(fields.description);
    if (fields.due_date !== undefined) f.duedate = fields.due_date;
    if (fields.labels !== undefined) f.labels = fields.labels;
    await this.request("PUT", `/issue/${encodeURIComponent(key)}`, { fields: f });
  }

  async assignIssue(key: string, accountId: string | null): Promise<void> {
    await this.request("PUT", `/issue/${encodeURIComponent(key)}/assignee`, { accountId });
  }

  async getTransitions(key: string): Promise<JiraTransition[]> {
    const r = await this.request<{ transitions: { id: string; name: string; to: { name: string } }[] }>("GET", `/issue/${encodeURIComponent(key)}/transitions`);
    return r.transitions.map((t) => ({ id: t.id, name: t.name, to_status: t.to.name }));
  }

  async transitionIssue(key: string, transitionId: string): Promise<void> {
    await this.request("POST", `/issue/${encodeURIComponent(key)}/transitions`, { transition: { id: transitionId } });
  }

  async addComment(key: string, body: string): Promise<void> {
    await this.request("POST", `/issue/${encodeURIComponent(key)}/comment`, { body: adf(body) });
  }

  async getProject(key: string): Promise<JiraProjectInfo | null> {
    try {
      const p = await this.request<{ id: string; key: string; name: string }>("GET", `/project/${encodeURIComponent(key)}`);
      return { id: p.id, key: p.key, name: p.name };
    } catch (e) {
      if (e instanceof JiraApiError && e.status === 404) return null;
      throw e;
    }
  }

  async listProjects(): Promise<JiraProjectInfo[]> {
    const r = await this.request<{ values: { id: string; key: string; name: string }[] }>("GET", "/project/search", undefined, { maxResults: "100" });
    return r.values.map((p) => ({ id: p.id, key: p.key, name: p.name }));
  }

  async searchUsers(query: string): Promise<JiraUser[]> {
    const r = await this.request<{ accountId: string; displayName: string; emailAddress?: string }[]>("GET", "/user/search", undefined, { query, maxResults: "20" });
    return r.map((u) => ({ account_id: u.accountId, display_name: u.displayName, email: u.emailAddress ?? null }));
  }

  async getIssueTypes(projectKey: string): Promise<JiraIssueTypeInfo[]> {
    const p = await this.request<{ issueTypes?: { id: string; name: string; subtask: boolean }[] }>("GET", `/project/${encodeURIComponent(projectKey)}`);
    return (p.issueTypes ?? []).map((t) => ({ id: t.id, name: t.name, subtask: t.subtask }));
  }

  async getStatuses(projectKey: string): Promise<JiraStatusInfo[]> {
    const r = await this.request<{ statuses: { id: string; name: string; statusCategory?: { key?: string } }[] }[]>("GET", `/project/${encodeURIComponent(projectKey)}/statuses`);
    const seen = new Map<string, JiraStatusInfo>();
    for (const t of r) for (const s of t.statuses) seen.set(s.id, { id: s.id, name: s.name, category: normaliseCategory(s.statusCategory?.key) });
    return [...seen.values()];
  }

  private map(i: RawIssue): JiraIssue {
    const f = i.fields;
    return {
      id: i.id, key: i.key, project_key: f.project?.key ?? i.key.split("-")[0]!, summary: f.summary, description: adfToText(f.description),
      status: f.status?.name ?? "Unknown", status_category: normaliseCategory(f.status?.statusCategory?.key), issue_type: f.issuetype?.name ?? "Task",
      assignee: f.assignee ? { account_id: f.assignee.accountId, display_name: f.assignee.displayName, email: f.assignee.emailAddress ?? null } : null,
      priority: f.priority?.name ?? null, due_date: f.duedate ?? null, resolved_at: f.resolutiondate ?? null, created: f.created ?? null, updated: f.updated ?? null,
      url: issueUrl(this.site_url, i.key),
    };
  }
}

/** Minimal Atlassian Document Format for plain paragraphs. */
export function adf(text: string) {
  return { type: "doc", version: 1, content: text.split(/\n{2,}/).map((para) => ({ type: "paragraph", content: [{ type: "text", text: para.replace(/\n/g, " ") || " " }] })) };
}

export function adfToText(doc: unknown): string | null {
  if (!doc) return null;
  if (typeof doc === "string") return doc;
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { type?: string; text?: string; content?: unknown[] };
    if (node.type === "text" && node.text) out.push(node.text);
    if (Array.isArray(node.content)) { node.content.forEach(walk); if (node.type === "paragraph") out.push("\n"); }
  };
  walk(doc);
  return out.join("").trim() || null;
}
