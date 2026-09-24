import type { RuleAction } from "./types";

export interface RuleActionResult {
  ticketPatch?: Partial<{
    assigneeAgentId: string;
    priority: "low" | "medium" | "high" | "urgent";
    queue: string;
    tags: string[];
  }>;
  notification?: { target: "assignee" | "requester" | "queue"; template: string };
}

/** Pure translation of one rule action into a ticket patch and/or a notification to send. */
export function applyRuleAction(action: RuleAction, currentTags: string[]): RuleActionResult {
  switch (action.type) {
    case "assign":
      return { ticketPatch: { assigneeAgentId: action.agentId } };
    case "set_priority":
      return { ticketPatch: { priority: action.priority } };
    case "move_queue":
      return { ticketPatch: { queue: action.queue } };
    case "add_tag":
      return { ticketPatch: { tags: currentTags.includes(action.tag) ? currentTags : [...currentTags, action.tag] } };
    case "notify":
      return { notification: { target: action.target, template: action.template } };
  }
}
