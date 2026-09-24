import type { AutomationRule, RuleCondition, RuleEvaluationContext, RuleTrigger } from "./types";

export const MAX_RULES_PER_TENANT = 50;

function fieldValue(ctx: RuleEvaluationContext, field: string): unknown {
  if (field.startsWith("field.")) {
    return ctx.fieldValues[field.slice("field.".length)];
  }
  return ctx.ticket[field];
}

function matchesCondition(ctx: RuleEvaluationContext, cond: RuleCondition): boolean {
  const actual = fieldValue(ctx, cond.field);
  switch (cond.op) {
    case "eq":
      return actual === cond.value;
    case "neq":
      return actual !== cond.value;
    case "in":
      return Array.isArray(cond.value) && cond.value.includes(actual);
    case "contains":
      return typeof actual === "string" && typeof cond.value === "string" && actual.includes(cond.value);
  }
}

function matchesAllConditions(ctx: RuleEvaluationContext, conditions: RuleCondition[]): boolean {
  return conditions.every((c) => matchesCondition(ctx, c));
}

/**
 * Returns the rules (in order) that should fire for this trigger + context.
 *
 * Loop protection (CLAUDE.md §10): `alreadyFiredRuleIds` must contain every
 * rule that has already fired for this same ticket within the current
 * event chain (i.e. this pass plus any pass triggered as a direct
 * consequence of this one). The caller — the queue consumer applying
 * actions — owns propagating that set forward; a rule is never evaluated
 * twice against the same triggering event.
 */
export function evaluateRules(
  rules: AutomationRule[],
  trigger: RuleTrigger,
  ctx: RuleEvaluationContext,
  alreadyFiredRuleIds: ReadonlySet<string> = new Set(),
): AutomationRule[] {
  return rules
    .filter((r) => r.enabled)
    .filter((r) => r.trigger === trigger)
    .filter((r) => !alreadyFiredRuleIds.has(r.id))
    .filter((r) => matchesAllConditions(ctx, r.conditions));
}
