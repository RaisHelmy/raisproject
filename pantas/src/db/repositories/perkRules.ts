import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { perkRules } from "../schema";
import { withAudit } from "./withAudit";

export type PerkType =
  | "voucher"
  | "priority_window"
  | "order_value_limit"
  | "cod_eligible";
export type VerificationTier = "unverified" | "verified";

export interface CreatePerkRuleInput {
  name: string;
  verificationTier: VerificationTier;
  perkType: PerkType;
  configJson?: unknown;
  groupId?: string | null;
}

/**
 * Perks (including FCFS priority-window eligibility) are data, not
 * hardcoded `if` statements — see CLAUDE.md. A rule with `groupId: null`
 * applies platform-wide; a group-specific rule overrides it for that group.
 */
export async function createPerkRule(db: Db, input: CreatePerkRuleInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name: input.name,
    verificationTier: input.verificationTier,
    perkType: input.perkType,
    configJson: JSON.stringify(input.configJson ?? {}),
    groupId: input.groupId ?? null,
    active: true,
  };
  return withAudit(
    db,
    { action: "perk_rule.create", entityType: "perk_rule", entityId: row.id },
    async () => {
      await db.insert(perkRules).values(row);
      return row;
    },
  );
}

export async function listActivePerkRules(db: Db, perkType: PerkType) {
  return db
    .select()
    .from(perkRules)
    .where(and(eq(perkRules.perkType, perkType), eq(perkRules.active, true)));
}

export async function deactivatePerkRule(db: Db, ruleId: string) {
  return withAudit(
    db,
    { action: "perk_rule.deactivate", entityType: "perk_rule", entityId: ruleId },
    async () => {
      await db
        .update(perkRules)
        .set({ active: false, updatedAt: nowIso() })
        .where(eq(perkRules.id, ruleId));
      return { ruleId };
    },
  );
}
