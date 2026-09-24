import type { AppContext } from "./context";

/** Append-only admin/security audit trail. Never throws (logging must not break the action). */
export async function audit(ctx: AppContext, a: { action: string; resource_type: string; resource_id?: string | null; result?: "ok" | "error"; details?: unknown; actor_id?: string | null }): Promise<void> {
  try {
    await ctx.repos.audit.insert({ actor_id: a.actor_id === undefined ? ctx.user?.id ?? null : a.actor_id, action: a.action, resource_type: a.resource_type, resource_id: a.resource_id ?? null, ip: ctx.ip, result: a.result ?? "ok", details: a.details ?? null });
  } catch (e) { ctx.log.warn("audit_failed", { error: e as Error, action: a.action }); }
}
