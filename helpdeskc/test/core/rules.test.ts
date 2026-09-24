import { describe, expect, test } from "bun:test";
import { evaluateRules } from "../../src/core/rules/evaluate";
import { applyRuleAction } from "../../src/core/rules/apply";
import type { AutomationRule } from "../../src/core/rules/types";

const rule: AutomationRule = {
  id: "r1",
  name: "High priority bugs to Amy",
  trigger: "created",
  enabled: true,
  conditions: [{ field: "priority", op: "eq", value: "high" }],
  actions: [{ type: "assign", agentId: "amy" }],
};

describe("evaluateRules", () => {
  test("matches when conditions are satisfied", () => {
    const matched = evaluateRules([rule], "created", { ticket: { priority: "high" }, fieldValues: {} });
    expect(matched).toEqual([rule]);
  });

  test("does not match on the wrong trigger", () => {
    const matched = evaluateRules([rule], "updated", { ticket: { priority: "high" }, fieldValues: {} });
    expect(matched).toEqual([]);
  });

  test("does not match when conditions fail", () => {
    const matched = evaluateRules([rule], "created", { ticket: { priority: "low" }, fieldValues: {} });
    expect(matched).toEqual([]);
  });

  test("skips disabled rules", () => {
    const matched = evaluateRules([{ ...rule, enabled: false }], "created", { ticket: { priority: "high" }, fieldValues: {} });
    expect(matched).toEqual([]);
  });

  test("loop guard: skips a rule already fired for this event chain", () => {
    const matched = evaluateRules([rule], "created", { ticket: { priority: "high" }, fieldValues: {} }, new Set(["r1"]));
    expect(matched).toEqual([]);
  });

  test("matches a field.<key> condition against fieldValues", () => {
    const fieldRule: AutomationRule = {
      ...rule,
      conditions: [{ field: "field.severity", op: "eq", value: "critical" }],
    };
    expect(evaluateRules([fieldRule], "created", { ticket: {}, fieldValues: { severity: "critical" } })).toEqual([fieldRule]);
    expect(evaluateRules([fieldRule], "created", { ticket: {}, fieldValues: { severity: "low" } })).toEqual([]);
  });
});

describe("applyRuleAction", () => {
  test("assign produces an assigneeAgentId patch", () => {
    expect(applyRuleAction({ type: "assign", agentId: "amy" }, [])).toEqual({ ticketPatch: { assigneeAgentId: "amy" } });
  });
  test("add_tag appends without duplicating", () => {
    expect(applyRuleAction({ type: "add_tag", tag: "urgent" }, ["vip"])).toEqual({ ticketPatch: { tags: ["vip", "urgent"] } });
    expect(applyRuleAction({ type: "add_tag", tag: "vip" }, ["vip"])).toEqual({ ticketPatch: { tags: ["vip"] } });
  });
  test("notify produces a notification, not a ticket patch", () => {
    expect(applyRuleAction({ type: "notify", target: "assignee", template: "sla_warning" }, [])).toEqual({
      notification: { target: "assignee", template: "sla_warning" },
    });
  });
});
