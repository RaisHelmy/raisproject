/**
 * DEMO Jira adapter — clearly labelled, never pretends to be a real integration.
 * Issues live in the local `jira_issues` table with is_demo=1. Creating an issue allocates
 * the next key in the project. Failure simulation is controlled by the `demo.jira_failure_mode`
 * setting: "none" | "next_create" | "always" (used for the "Jira API failure" demo scenario).
 */
import type { CreateIssueInput, JiraClient, JiraIssue, JiraIssueTypeInfo, JiraProjectInfo, JiraStatusInfo, JiraTransition, JiraUser } from "./client";
import { JiraApiError, normaliseCategory } from "./client";
import type { JiraRepository, SettingsRepository } from "../../repositories/interfaces";
import type { JiraIssueRow } from "../../repositories/types";
import { uuid } from "../../lib/ids";
import { nowIso } from "../../lib/time";

export const DEMO_SITE = "https://demo.atlassian.net";
export const DEMO_ACCOUNT: JiraUser = { account_id: "demo-rais", display_name: "Rais (demo)", email: "rais@example.com" };

const DEMO_STATUSES: JiraStatusInfo[] = [
  { id: "1", name: "To Do", category: "new" },
  { id: "2", name: "In Progress", category: "indeterminate" },
  { id: "3", name: "Done", category: "done" },
];

export class DemoJiraClient implements JiraClient {
  readonly mode = "demo" as const;
  readonly site_url = DEMO_SITE;

  constructor(private readonly jira: JiraRepository, private readonly settings: SettingsRepository, private readonly demoUsers: JiraUser[] = [DEMO_ACCOUNT]) {}

  async myself() { return DEMO_ACCOUNT; }
  async testConnection() { return { ok: true, account: DEMO_ACCOUNT, error: null }; }

  async searchIssues(jql: string, max = 100): Promise<JiraIssue[]> {
    // Very small JQL subset: project = X, assignee = Y, text ~ "..."
    const project = /project\s*=\s*"?([A-Z][A-Z0-9]+)"?/i.exec(jql)?.[1];
    const text = /(?:text|summary)\s*~\s*"([^"]+)"/i.exec(jql)?.[1];
    const assignee = /assignee\s*=\s*"?([\w-]+)"?/i.exec(jql)?.[1];
    const r = await this.jira.listIssues({ project_keys: project ? [project.toUpperCase()] : undefined, search: text, assignee_account_id: assignee, is_demo: true }, { offset: 0, limit: max });
    return r.items.map(rowToIssue);
  }

  async getIssue(key: string) {
    const r = await this.jira.findIssue(key);
    return r && r.is_demo ? rowToIssue(r) : null;
  }

  async createIssue(input: CreateIssueInput): Promise<JiraIssue> {
    await this.maybeFail("create");
    const existing = await this.jira.allIssues([input.project_key]);
    const next = existing.reduce((m, i) => Math.max(m, Number(i.issue_key.split("-")[1] ?? 0)), 1000) + 1;
    const key = `${input.project_key}-${next}`;
    const assignee = input.assignee_account_id ? this.demoUsers.find((u) => u.account_id === input.assignee_account_id) ?? { account_id: input.assignee_account_id, display_name: input.assignee_account_id, email: null } : null;
    const now = nowIso();
    const row: JiraIssueRow = {
      id: uuid(), issue_key: key, issue_id: String(10000 + next), project_key: input.project_key, summary: input.summary, description: input.description,
      status: "To Do", status_category: "new", issue_type: input.issue_type, assignee_account_id: assignee?.account_id ?? null, assignee_name: assignee?.display_name ?? null,
      priority: "Medium", due_date: input.due_date ?? null, resolved_at: null, jira_created_at: now, jira_updated_at: now, url: `${DEMO_SITE}/browse/${key}`, is_demo: 1, synced_at: now,
    };
    await this.jira.upsertIssues([row]);
    return rowToIssue(row);
  }

  async updateIssue(key: string, fields: Partial<Pick<CreateIssueInput, "summary" | "description" | "due_date" | "labels">>) {
    await this.maybeFail("update");
    const r = await this.jira.findIssue(key);
    if (!r) throw new JiraApiError(`Issue ${key} does not exist.`, 404, "JIRA_NOT_FOUND", false);
    await this.jira.upsertIssues([{ ...r, summary: fields.summary ?? r.summary, description: fields.description ?? r.description, due_date: fields.due_date === undefined ? r.due_date : fields.due_date, jira_updated_at: nowIso(), synced_at: nowIso() }]);
  }

  async assignIssue(key: string, accountId: string | null) {
    const r = await this.jira.findIssue(key);
    if (!r) throw new JiraApiError(`Issue ${key} does not exist.`, 404, "JIRA_NOT_FOUND", false);
    const u = accountId ? this.demoUsers.find((x) => x.account_id === accountId) : null;
    await this.jira.upsertIssues([{ ...r, assignee_account_id: accountId, assignee_name: u?.display_name ?? accountId, jira_updated_at: nowIso(), synced_at: nowIso() }]);
  }

  async getTransitions(_key: string): Promise<JiraTransition[]> {
    return DEMO_STATUSES.map((s) => ({ id: s.id, name: s.name, to_status: s.name }));
  }

  async transitionIssue(key: string, transitionId: string) {
    const r = await this.jira.findIssue(key);
    const s = DEMO_STATUSES.find((x) => x.id === transitionId);
    if (!r || !s) throw new JiraApiError("Invalid transition.", 400, "JIRA_BAD_REQUEST", false);
    await this.jira.upsertIssues([{ ...r, status: s.name, status_category: s.category, resolved_at: s.category === "done" ? nowIso() : null, jira_updated_at: nowIso(), synced_at: nowIso() }]);
  }

  async addComment(key: string, _body: string) {
    const r = await this.jira.findIssue(key);
    if (!r) throw new JiraApiError(`Issue ${key} does not exist.`, 404, "JIRA_NOT_FOUND", false);
  }

  async getProject(key: string): Promise<JiraProjectInfo | null> {
    const issues = await this.jira.allIssues([key]);
    return issues.length ? { id: `demo-${key}`, key, name: `${key} (demo)` } : { id: `demo-${key}`, key, name: `${key} (demo)` };
  }
  async listProjects(): Promise<JiraProjectInfo[]> {
    const all = await this.jira.allIssues();
    const keys = [...new Set(all.filter((i) => i.is_demo).map((i) => i.project_key))];
    return keys.map((k) => ({ id: `demo-${k}`, key: k, name: `${k} (demo)` }));
  }
  async searchUsers(query: string): Promise<JiraUser[]> {
    const q = query.toLowerCase();
    return this.demoUsers.filter((u) => u.display_name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q));
  }
  async getIssueTypes(_projectKey: string): Promise<JiraIssueTypeInfo[]> {
    return [{ id: "10001", name: "Task", subtask: false }, { id: "10002", name: "Bug", subtask: false }, { id: "10003", name: "Story", subtask: false }];
  }
  async getStatuses(_projectKey: string) { return DEMO_STATUSES; }

  private async maybeFail(op: string) {
    const mode = (await this.settings.get<string>("demo.jira_failure_mode")) ?? "none";
    if (mode === "always" || (mode === "next_create" && op === "create")) {
      if (mode === "next_create") await this.settings.set("demo.jira_failure_mode", "none", null);
      throw new JiraApiError("Simulated Jira outage (demo failure mode).", 503, "JIRA_UNAVAILABLE", true);
    }
  }
}

export function rowToIssue(r: JiraIssueRow): JiraIssue {
  return {
    id: r.issue_id ?? r.id, key: r.issue_key, project_key: r.project_key, summary: r.summary, description: r.description, status: r.status,
    status_category: normaliseCategory(r.status_category), issue_type: r.issue_type,
    assignee: r.assignee_account_id ? { account_id: r.assignee_account_id, display_name: r.assignee_name ?? r.assignee_account_id, email: null } : null,
    priority: r.priority, due_date: r.due_date, resolved_at: r.resolved_at, created: r.jira_created_at, updated: r.jira_updated_at, url: r.url,
  };
}
