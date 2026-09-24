import type { AppContext } from "./context";
import { uuid } from "../lib/ids";
import { nowIso } from "../lib/time";

export interface AuditInput {
  entity_type: "timesheet" | "import" | "work_item" | "jira_link" | "jira_issue" | "sync_job" | "user" | "project" | "client" | "settings" | "jira_connection" | "report" | "session";
  entity_id: string;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  actor_id?: string | null;
}

/** Append-only audit trail. Never stores secrets; callers pass already-safe snapshots. */
export async function audit(ctx: AppContext, a: AuditInput): Promise<void> {
  await ctx.repos.audit.append({
    id: uuid(),
    actor_id: a.actor_id === undefined ? ctx.user?.id ?? null : a.actor_id,
    entity_type: a.entity_type,
    entity_id: a.entity_id,
    action: a.action,
    before_json: a.before === undefined ? null : JSON.stringify(a.before),
    after_json: a.after === undefined ? null : JSON.stringify(a.after),
    reason: a.reason ?? null,
    source: ctx.source,
    correlation_id: ctx.correlationId,
    created_at: nowIso(),
  });
}

export async function notify(ctx: AppContext, userId: string, n: { type: string; title: string; body?: string; link: string }): Promise<void> {
  await ctx.repos.notifications.create({ id: uuid(), user_id: userId, type: n.type, title: n.title, body: n.body ?? "", link: n.link, is_read: 0, created_at: nowIso() });
}

/** Notify every approver/admin (owner role). */
export async function notifyApprovers(ctx: AppContext, n: { type: string; title: string; body?: string; link: string }): Promise<void> {
  const users = await ctx.repos.users.list();
  const roles = await ctx.repos.users.rolesForMany(users.map((u) => u.id));
  const targets = users.filter((u) => u.is_active && (roles.get(u.id) ?? []).some((r) => r === "ADMIN" || r === "APPROVER"));
  await Promise.all(targets.map((u) => notify(ctx, u.id, n)));
}

/** Pick only the fields worth auditing on a timesheet row. */
export function timesheetSnapshot(t: Record<string, unknown>): Record<string, unknown> {
  const keys = ["title", "description", "work_date", "start_time", "end_time", "duration_minutes", "status", "work_status", "jira_sync_status", "project_id", "rejection_reason"];
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in t) out[k] = t[k];
  return out;
}
