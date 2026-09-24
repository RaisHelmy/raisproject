export type RuleTrigger = "created" | "updated" | "sla_warning";

export type ConditionOp = "eq" | "neq" | "in" | "contains";

export interface RuleCondition {
  field: string; // e.g. "priority", "category", "status", "field.<templateFieldKey>"
  op: ConditionOp;
  value: unknown;
}

// Webhooks are intentionally not a supported action at MVP (CLAUDE.md §17 —
// deferred until decided).
export type RuleAction =
  | { type: "assign"; agentId: string }
  | { type: "set_priority"; priority: "low" | "medium" | "high" | "urgent" }
  | { type: "add_tag"; tag: string }
  | { type: "notify"; target: "assignee" | "requester" | "queue"; template: string }
  | { type: "move_queue"; queue: string };

export interface AutomationRule {
  id: string;
  name: string;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  enabled: boolean;
}

export interface RuleEvaluationContext {
  ticket: Record<string, unknown>;
  fieldValues: Record<string, unknown>;
}
