/** Configurable data retention. Never deletes timesheets/approvals; audit only if policy > 0 days. */
import type { AppContext } from "./context";
import { nowIso } from "../lib/time";
import { audit } from "./audit";

export interface RetentionPolicy { raw_import_days: number; report_days: number; audit_days: number }

export async function getRetentionPolicy(ctx: AppContext): Promise<RetentionPolicy> {
  const stored = await ctx.repos.settings.get<Partial<RetentionPolicy>>("retention");
  return {
    raw_import_days: stored?.raw_import_days ?? (Number(ctx.env.RETENTION_RAW_IMPORT_DAYS ?? "90") || 90),
    report_days: stored?.report_days ?? (Number(ctx.env.RETENTION_REPORT_DAYS ?? "180") || 180),
    audit_days: stored?.audit_days ?? (Number(ctx.env.RETENTION_AUDIT_DAYS ?? "0") || 0),
  };
}

export async function applyRetention(ctx: AppContext): Promise<{ raw_imports: number; reports: number; audit_rows: number; sessions: number }> {
  const policy = await getRetentionPolicy(ctx);
  const cutoff = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  let raw = 0, reports = 0, auditRows = 0;
  if (policy.raw_import_days > 0) {
    for (const i of await ctx.repos.imports.olderThan(cutoff(policy.raw_import_days), true)) {
      if (i.r2_key_original) await ctx.env.FILES.delete(i.r2_key_original);
      await ctx.repos.imports.update(i.id, { raw_deleted_at: nowIso(), updated_at: nowIso() });
      raw++;
    }
  }
  if (policy.report_days > 0) {
    for (const r of await ctx.repos.reports.olderThan(cutoff(policy.report_days))) {
      if (r.r2_key) await ctx.env.FILES.delete(r.r2_key);
      await ctx.repos.reports.delete(r.id);
      reports++;
    }
  }
  if (policy.audit_days > 0) auditRows = await ctx.repos.audit.deleteOlderThan(cutoff(policy.audit_days));
  const sessions = await ctx.repos.sessions.deleteExpired(nowIso());
  if (raw || reports || auditRows) await audit(ctx, { entity_type: "settings", entity_id: "retention", action: "retention_applied", after: { raw, reports, audit_rows: auditRows }, actor_id: null });
  return { raw_imports: raw, reports, audit_rows: auditRows, sessions };
}
