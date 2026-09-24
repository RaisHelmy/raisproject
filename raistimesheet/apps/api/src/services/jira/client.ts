/** Jira client abstraction. The rest of the app never touches Jira REST directly. */

export interface JiraUser { account_id: string; display_name: string; email: string | null }
export interface JiraProjectInfo { id: string; key: string; name: string }
export interface JiraIssueTypeInfo { id: string; name: string; subtask: boolean }
export interface JiraStatusInfo { id: string; name: string; category: "new" | "indeterminate" | "done" | "unknown" }
export interface JiraTransition { id: string; name: string; to_status: string }

export interface JiraIssue {
  id: string;
  key: string;
  project_key: string;
  summary: string;
  description: string | null;
  status: string;
  status_category: "new" | "indeterminate" | "done" | "unknown";
  issue_type: string;
  assignee: JiraUser | null;
  priority: string | null;
  due_date: string | null;
  resolved_at: string | null;
  created: string | null;
  updated: string | null;
  url: string | null;
}

export interface CreateIssueInput {
  project_key: string;
  issue_type: string;
  summary: string;
  description: string;
  assignee_account_id?: string | null;
  labels?: string[];
  due_date?: string | null;
}

export class JiraApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string, readonly retryable: boolean) {
    super(message);
    this.name = "JiraApiError";
  }
}

export interface JiraClient {
  readonly mode: "cloud" | "demo";
  readonly site_url: string | null;
  myself(): Promise<JiraUser>;
  testConnection(): Promise<{ ok: boolean; account: JiraUser | null; error: string | null }>;
  searchIssues(jql: string, max?: number): Promise<JiraIssue[]>;
  getIssue(key: string): Promise<JiraIssue | null>;
  createIssue(input: CreateIssueInput): Promise<JiraIssue>;
  updateIssue(key: string, fields: Partial<Pick<CreateIssueInput, "summary" | "description" | "due_date" | "labels">>): Promise<void>;
  assignIssue(key: string, accountId: string | null): Promise<void>;
  getTransitions(key: string): Promise<JiraTransition[]>;
  transitionIssue(key: string, transitionId: string): Promise<void>;
  addComment(key: string, body: string): Promise<void>;
  getProject(key: string): Promise<JiraProjectInfo | null>;
  listProjects(): Promise<JiraProjectInfo[]>;
  searchUsers(query: string): Promise<JiraUser[]>;
  getIssueTypes(projectKey: string): Promise<JiraIssueTypeInfo[]>;
  getStatuses(projectKey: string): Promise<JiraStatusInfo[]>;
}

export function issueUrl(site: string | null, key: string): string | null {
  return site ? `${site.replace(/\/$/, "")}/browse/${key}` : null;
}

export function normaliseCategory(key: string | undefined | null): JiraIssue["status_category"] {
  const k = (key ?? "").toLowerCase();
  if (k === "new" || k === "to-do" || k === "todo" || k === "undefined") return k === "undefined" ? "unknown" : "new";
  if (k === "indeterminate" || k === "in progress" || k === "inprogress") return "indeterminate";
  if (k === "done" || k === "complete") return "done";
  return "unknown";
}
