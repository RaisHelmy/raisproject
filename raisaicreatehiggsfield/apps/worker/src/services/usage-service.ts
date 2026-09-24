import type { AuthContext, Sen } from "@raisai/shared";
import type { Env } from "../env";

export interface UsagePoint {
  day: string;
  generations: number;
  spentSen: Sen;
}

export interface UsageBreakdown {
  key: string;
  label: string;
  count: number;
  spentSen: Sen;
}

export interface UsageSummary {
  totalSpentSen: Sen;
  todaySpentSen: Sen;
  monthSpentSen: Sen;
  generations: number;
  workflowRuns: number;
  failureRate: number;
  daily: UsagePoint[];
  byModel: UsageBreakdown[];
  byCategory: UsageBreakdown[];
  byProject: UsageBreakdown[];
}

/**
 * Spending and activity for the usage dashboard (§73).
 *
 * Aggregates are computed from `generations` directly rather than a rollup
 * table: at this scale it is exact and one query, and a nightly rollup can be
 * introduced behind the same shape when volume justifies it.
 */
export class UsageService {
  constructor(private readonly env: Pick<Env, "DB">) {}

  async summary(auth: AuthContext, days = 30): Promise<UsageSummary> {
    const window = Math.min(Math.max(days, 1), 365);
    const since = new Date(Date.now() - window * 86_400_000).toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

    const [daily, byModel, byCategory, byProject, totals, runs] = await Promise.all([
      this.env.DB
        .prepare(
          `SELECT substring(created_at,1,10) AS day, COUNT(*) AS generations, COALESCE(SUM(actual_cost_sen),0) AS spent_sen
             FROM generations WHERE org_id = ? AND created_at >= ?
            GROUP BY day ORDER BY day ASC`,
        )
        .bind(auth.orgId, since)
        .all<{ day: string; generations: number; spent_sen: number }>(),

      this.env.DB
        .prepare(
          `SELECT g.model_id AS key, COALESCE(m.display_name, g.model_id) AS label,
                  COUNT(*) AS count, COALESCE(SUM(g.actual_cost_sen),0) AS spent_sen
             FROM generations g LEFT JOIN models m ON m.id = g.model_id
            WHERE g.org_id = ? AND g.created_at >= ?
            GROUP BY g.model_id ORDER BY spent_sen DESC LIMIT 10`,
        )
        .bind(auth.orgId, since)
        .all<{ key: string; label: string; count: number; spent_sen: number }>(),

      this.env.DB
        .prepare(
          `SELECT COALESCE(m.category, 'other') AS key, COALESCE(m.category, 'other') AS label,
                  COUNT(*) AS count, COALESCE(SUM(g.actual_cost_sen),0) AS spent_sen
             FROM generations g LEFT JOIN models m ON m.id = g.model_id
            WHERE g.org_id = ? AND g.created_at >= ?
            GROUP BY key ORDER BY spent_sen DESC`,
        )
        .bind(auth.orgId, since)
        .all<{ key: string; label: string; count: number; spent_sen: number }>(),

      this.env.DB
        .prepare(
          `SELECT g.project_id AS key, COALESCE(p.name, 'Unknown project') AS label,
                  COUNT(*) AS count, COALESCE(SUM(g.actual_cost_sen),0) AS spent_sen
             FROM generations g LEFT JOIN projects p ON p.id = g.project_id
            WHERE g.org_id = ? AND g.created_at >= ?
            GROUP BY g.project_id ORDER BY spent_sen DESC LIMIT 10`,
        )
        .bind(auth.orgId, since)
        .all<{ key: string; label: string; count: number; spent_sen: number }>(),

      this.env.DB
        .prepare(
          `SELECT COALESCE(SUM(actual_cost_sen),0) AS total,
                  COALESCE(SUM(CASE WHEN substring(created_at,1,10) = ? THEN actual_cost_sen ELSE 0 END),0) AS today,
                  COALESCE(SUM(CASE WHEN substring(created_at,1,10) >= ? THEN actual_cost_sen ELSE 0 END),0) AS month,
                  COUNT(*) AS generations,
                  COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),0) AS failures
             FROM generations WHERE org_id = ?`,
        )
        .bind(today, monthStart, auth.orgId)
        .first<{ total: number; today: number; month: number; generations: number; failures: number }>(),

      this.env.DB
        .prepare(`SELECT COUNT(*) AS n FROM workflow_runs WHERE org_id = ?`)
        .bind(auth.orgId)
        .first<{ n: number }>(),
    ]);

    const map = (rows: { key: string; label: string; count: number; spent_sen: number }[]): UsageBreakdown[] =>
      rows.map((r) => ({ key: r.key, label: r.label, count: r.count, spentSen: r.spent_sen }));

    const generations = totals?.generations ?? 0;
    return {
      totalSpentSen: totals?.total ?? 0,
      todaySpentSen: totals?.today ?? 0,
      monthSpentSen: totals?.month ?? 0,
      generations,
      workflowRuns: runs?.n ?? 0,
      failureRate: generations > 0 ? (totals?.failures ?? 0) / generations : 0,
      daily: daily.results.map((r) => ({ day: r.day, generations: r.generations, spentSen: r.spent_sen })),
      byModel: map(byModel.results),
      byCategory: map(byCategory.results),
      byProject: map(byProject.results),
    };
  }
}
