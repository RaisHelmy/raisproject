import { and, eq, isNull, or } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { commissionRules } from "../schema";
import { withAudit } from "./withAudit";
import type { commissionRules as commissionRulesTable } from "../schema";

export type CommissionableType = (typeof commissionRulesTable.$inferSelect)["jobType"];

export interface CreateCommissionRuleInput {
  jobType: CommissionableType;
  groupId?: string | null;
  amountMinor: number;
}

export async function createCommissionRule(db: Db, input: CreateCommissionRuleInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    jobType: input.jobType,
    groupId: input.groupId ?? null,
    amountMinor: input.amountMinor,
    active: true,
  };
  return withAudit(
    db,
    { action: "commission_rule.create", entityType: "commission_rule", entityId: row.id },
    async () => {
      await db.insert(commissionRules).values(row);
      return row;
    },
  );
}

/**
 * A group-specific active rule for this job type wins over the
 * platform-wide (groupId: null) one. Throws rather than silently charging
 * nothing if no rule exists at all — CLAUDE.md says never hardcode the
 * amount, which cuts both ways: there is no code-level fallback fee either.
 */
export async function getCommissionAmountMinor(
  db: Db,
  groupId: string | null,
  jobType: CommissionableType,
): Promise<number> {
  const rows = await db
    .select()
    .from(commissionRules)
    .where(
      and(
        eq(commissionRules.jobType, jobType),
        eq(commissionRules.active, true),
        groupId === null
          ? isNull(commissionRules.groupId)
          : or(eq(commissionRules.groupId, groupId), isNull(commissionRules.groupId)),
      ),
    );
  const groupSpecific = rows.find((r) => r.groupId === groupId);
  const platformWide = rows.find((r) => r.groupId === null);
  const rule = groupSpecific ?? platformWide;
  if (!rule) {
    throw new Error(
      `no active commission rule for jobType=${jobType} groupId=${groupId ?? "null"}`,
    );
  }
  return rule.amountMinor;
}
