/**
 * Repository abstraction. Domain services only talk to `DataStore`.
 * Implementations: MemoryStore (browser demo mode, tests) and D1Store (Cloudflare Worker).
 * The interface is deliberately simple so a PostgreSQL implementation is a drop-in.
 */
import type * as T from "../types";

export interface Repo<E extends { id: string }> {
  get(id: string): Promise<E | undefined>;
  list(filter?: Partial<E> | ((e: E) => boolean)): Promise<E[]>;
  put(entity: E): Promise<E>;
  putMany(entities: E[]): Promise<void>;
  delete(id: string): Promise<void>;
  count(filter?: Partial<E>): Promise<number>;
}

export interface DataStore {
  organizations: Repo<T.Organization>;
  users: Repo<T.User>;
  memberships: Repo<T.Membership>;
  groups: Repo<T.Group>;
  roles: Repo<T.Role>;
  agents: Repo<T.Agent>;
  environments: Repo<T.Environment>;
  servers: Repo<T.Server>;
  applications: Repo<T.Application>;
  repositories: Repo<T.Repository>;
  gitConnections: Repo<T.GitConnection>;
  integrations: Repo<T.Integration>;
  credentials: Repo<T.CredentialReference>;
  changes: Repo<T.Change>;
  evidence: Repo<T.ChangeEvidence>;
  timeline: Repo<T.TimelineEvent>;
  tasks: Repo<T.Task>;
  taskDefinitions: Repo<T.TaskDefinition>;
  policies: Repo<T.Policy>;
  approvals: Repo<T.ApprovalRequest>;
  deployments: Repo<T.Deployment>;
  incidents: Repo<T.Incident>;
  issues: Repo<T.Issue>;
  aiRuns: Repo<T.AIRun>;
  mcpCalls: Repo<T.MCPCall>;
  aiFailures: Repo<T.AIFailure>;
  aiRecoveries: Repo<T.AIRecovery>;
  humanInterventions: Repo<T.HumanIntervention>;
  problemPatterns: Repo<T.ProblemPattern>;
  knowledge: Repo<T.KnowledgeRecord>;
  recommendations: Repo<T.OptimizationRecommendation>;
  experiments: Repo<T.AIExperiment>;
  auditLogs: Repo<T.AuditLog>;
  notifications: Repo<T.Notification>;
  subscriptions: Repo<T.Subscription>;
  usage: Repo<T.UsageRecord & { id: string }>;
  invoices: Repo<T.Invoice>;
  marketplace: Repo<T.MarketplaceItem>;
  automations: Repo<T.Automation>;
  sessions: Repo<Session>;
  passwords: Repo<PasswordRecord>;
}

export interface Session { id: string; userId: string; token: string; organizationId?: string; createdAt: string; expiresAt: string; kind: "WEB" | "MCP" | "AGENT" }
export interface PasswordRecord { id: string; userId: string; hash: string; salt: string; algorithm: "PBKDF2-SHA256" }

export const STORE_COLLECTIONS: (keyof DataStore)[] = [
  "organizations", "users", "memberships", "groups", "roles", "agents", "environments", "servers", "applications", "repositories", "gitConnections", "integrations", "credentials",
  "changes", "evidence", "timeline", "tasks", "taskDefinitions", "policies", "approvals", "deployments", "incidents", "issues", "aiRuns", "mcpCalls", "aiFailures", "aiRecoveries",
  "humanInterventions", "problemPatterns", "knowledge", "recommendations", "experiments", "auditLogs", "notifications", "subscriptions", "usage", "invoices", "marketplace", "automations", "sessions", "passwords",
];

export function matchesFilter<E>(e: E, filter?: Partial<E> | ((e: E) => boolean)): boolean {
  if (!filter) return true;
  if (typeof filter === "function") return filter(e);
  return Object.entries(filter).every(([k, v]) => (e as Record<string, unknown>)[k] === v);
}
