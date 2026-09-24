import type { Sql } from "postgres";
import type { DataStore, Repo } from "../domain/repository/store";
import { STORE_COLLECTIONS, matchesFilter } from "../domain/repository/store";

/**
 * PostgreSQL implementation of the repository abstraction (via Hyperdrive + postgres.js).
 * Each collection maps to a table with indexed lookup columns and a JSON `data` aggregate column.
 * This replaces the former D1/SQLite implementation (see git history / migrations/0001_init.sql for
 * the original SQLite-dialect schema, preserved for reference — not deleted).
 */
const TABLES: Record<keyof DataStore, string> = {
  organizations: "organizations", users: "users", memberships: "organization_memberships", groups: "groups", roles: "roles", agents: "agents", environments: "environments", servers: "servers", applications: "applications", repositories: "repositories",
  gitConnections: "git_connections", integrations: "integrations", credentials: "credentials", changes: "changes", evidence: "change_evidence", timeline: "change_timeline", tasks: "tasks", taskDefinitions: "task_definitions", policies: "policies", approvals: "approval_requests",
  deployments: "deployments", incidents: "incidents", issues: "issues", aiRuns: "ai_runs", mcpCalls: "mcp_calls", aiFailures: "ai_failures", aiRecoveries: "ai_recoveries", humanInterventions: "human_interventions", problemPatterns: "problem_patterns", knowledge: "knowledge_records",
  recommendations: "optimization_recommendations", experiments: "ai_experiments", auditLogs: "audit_logs", notifications: "notifications", subscriptions: "subscriptions", usage: "usage_records", invoices: "invoices", marketplace: "marketplace_items", automations: "automations", sessions: "sessions", passwords: "passwords",
};

/** Columns projected out of the aggregate for indexing (camelCase field → snake_case column). */
const PROJECTIONS: Partial<Record<keyof DataStore, Record<string, string>>> = {
  organizations: { slug: "slug", name: "name", type: "type", planId: "plan_id" },
  users: { email: "email", name: "name" },
  passwords: { userId: "user_id" },
  sessions: { userId: "user_id", kind: "kind", expiresAt: "expires_at", token: "token_hash" },
  memberships: { organizationId: "organization_id", userId: "user_id", status: "status" },
  groups: { organizationId: "organization_id", name: "name" },
  roles: { organizationId: "organization_id", key: "key", name: "name" },
  agents: { organizationId: "organization_id", status: "status", environmentId: "environment_id", lastSeenAt: "last_seen_at" },
  environments: { organizationId: "organization_id", kind: "kind", name: "name" },
  servers: { organizationId: "organization_id", environmentId: "environment_id" },
  applications: { organizationId: "organization_id", slug: "slug" },
  gitConnections: { organizationId: "organization_id", provider: "provider", status: "status" },
  repositories: { organizationId: "organization_id", connectionId: "connection_id", fullName: "full_name" },
  integrations: { organizationId: "organization_id", kind: "kind", status: "status" },
  credentials: { organizationId: "organization_id", ref: "ref", kind: "kind" },
  changes: { organizationId: "organization_id", key: "key", status: "status", currentStageKey: "current_stage", ownerId: "owner_id", risk: "risk" },
  evidence: { changeId: "change_id", stageKey: "stage_key", type: "type" },
  timeline: { changeId: "change_id", at: "at", kind: "kind" },
  taskDefinitions: { version: "version", type: "type" },
  tasks: { organizationId: "organization_id", key: "key", changeId: "change_id", definitionId: "definition_id", definitionVersion: "definition_version", type: "type", status: "status", risk: "risk", environmentId: "environment_id", agentId: "agent_id", aiRunId: "ai_run_id" },
  policies: { organizationId: "organization_id", scope: "scope", enabled: "enabled", version: "version" },
  approvals: { organizationId: "organization_id", key: "key", status: "status", kind: "kind", changeId: "change_id", taskId: "task_id", requestedById: "requested_by", risk: "risk" },
  deployments: { organizationId: "organization_id", changeId: "change_id", taskId: "task_id", applicationId: "application_id", environmentId: "environment_id", status: "status", version: "version" },
  incidents: { organizationId: "organization_id", key: "key", severity: "severity", status: "status", changeId: "change_id", taskId: "task_id" },
  issues: { organizationId: "organization_id", key: "key", type: "type", status: "status" },
  aiRuns: { organizationId: "organization_id", userId: "user_id", key: "key", purpose: "purpose", provider: "provider", status: "status", changeId: "change_id", startTime: "start_time" },
  mcpCalls: { organizationId: "organization_id", aiRunId: "ai_run_id", userId: "user_id", toolName: "tool_name", status: "status", durationMs: "duration_ms", changeId: "change_id", taskId: "task_id", agentId: "agent_id", startTime: "start_time" },
  aiFailures: { organizationId: "organization_id", aiRunId: "ai_run_id", type: "type" },
  aiRecoveries: { organizationId: "organization_id", failureId: "failure_id" },
  humanInterventions: { organizationId: "organization_id", userId: "user_id" },
  problemPatterns: { organizationId: "organization_id", signature: "signature", occurrences: "occurrences" },
  knowledge: { organizationId: "organization_id", type: "type" },
  recommendations: { organizationId: "organization_id", type: "type", status: "status" },
  experiments: { organizationId: "organization_id", status: "status" },
  auditLogs: { organizationId: "organization_id", actorId: "actor_id", action: "action", resourceType: "resource_type", resourceId: "resource_id", result: "result", risk: "risk", correlationId: "correlation_id", timestamp: "timestamp" },
  notifications: { organizationId: "organization_id", userId: "user_id", read: "read" },
  subscriptions: { organizationId: "organization_id", planId: "plan_id", status: "status" },
  usage: { organizationId: "organization_id", period: "period" },
  invoices: { organizationId: "organization_id", number: "number", status: "status", amountMyr: "amount_myr" },
  marketplace: { publisher: "publisher", pricing: "pricing" },
  automations: { organizationId: "organization_id", enabled: "enabled" },
};

function sqlValue(v: unknown): string | number | null { if (v === undefined || v === null) return null; if (typeof v === "boolean") return v ? 1 : 0; if (typeof v === "number") return v; return String(v); }

/**
 * Note: table/column names here are dynamic per-collection identifiers (not user input), so we build
 * parameterized queries with `sql.unsafe(text, params)` — postgres.js's tagged-template `sql\`...\``
 * cannot interpolate identifiers, only values. Values are still passed as bound parameters ($1, $2, ...),
 * so this remains injection-safe; it is the direct, dialect-faithful port of the previous D1
 * `prepare(...).bind(...)` calls (`?` placeholders → `$1..$n`).
 */
class PgRepo<E extends { id: string }> implements Repo<E> {
  constructor(private sql: Sql, private table: string, private projection: Record<string, string>) {}
  private parse(row: Record<string, unknown> | undefined): E | undefined { return row ? (JSON.parse(String(row.data)) as E) : undefined; }
  async get(id: string) {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(`SELECT data FROM ${this.table} WHERE id = $1`, [id]);
    return this.parse(rows[0]);
  }
  async list(filter?: Partial<E> | ((e: E) => boolean)) {
    const where: string[] = []; const binds: (string | number | null)[] = [];
    let residual: Partial<E> | ((e: E) => boolean) | undefined = filter;
    if (filter && typeof filter !== "function") {
      const rest: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(filter)) { const col = this.projection[k]; if (col) { binds.push(sqlValue(v)); where.push(`${col} = $${binds.length}`); } else rest[k] = v; }
      residual = Object.keys(rest).length ? (rest as Partial<E>) : undefined;
    }
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(`SELECT data FROM ${this.table}${where.length ? " WHERE " + where.join(" AND ") : ""}`, binds);
    return rows.map((r) => JSON.parse(String(r.data)) as E).filter((e) => matchesFilter(e, residual));
  }
  private upsertQuery(e: E): { text: string; params: (string | number | null)[] } {
    const now = new Date().toISOString();
    const rec = e as unknown as Record<string, unknown>;
    const cols = ["id", "created_at", "updated_at", "data"]; const vals: (string | number | null)[] = [e.id, String(rec.createdAt ?? now), now, JSON.stringify(e)];
    for (const [field, col] of Object.entries(this.projection)) { if (col === "created_at" || col === "updated_at") continue; cols.push(col); vals.push(sqlValue(rec[field])); }
    const updates = cols.filter((c) => c !== "id" && c !== "created_at").map((c) => `${c} = excluded.${c}`).join(", ");
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
    return { text: `INSERT INTO ${this.table} (${cols.join(",")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`, params: vals };
  }
  async put(e: E) { const { text, params } = this.upsertQuery(e); await this.sql.unsafe(text, params); return e; }
  async putMany(list: E[]) {
    if (!list.length) return;
    for (let i = 0; i < list.length; i += 50) {
      const batch = list.slice(i, i + 50);
      await this.sql.begin((tx) => Promise.all(batch.map((e) => { const { text, params } = this.upsertQuery(e); return tx.unsafe(text, params); })));
    }
  }
  async delete(id: string) { await this.sql.unsafe(`DELETE FROM ${this.table} WHERE id = $1`, [id]); }
  async count(filter?: Partial<E>) { return (await this.list(filter)).length; }
}

export function createPgStore(sql: Sql): DataStore {
  const store = {} as Record<string, unknown>;
  for (const name of STORE_COLLECTIONS) store[name] = new PgRepo(sql, TABLES[name], PROJECTIONS[name] ?? {});
  return store as unknown as DataStore;
}
