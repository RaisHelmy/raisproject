import type { TaskStatus } from "../types";

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  QUEUED: ["PLANNING", "CANCELLED"],
  PLANNING: ["DISCOVERING", "FAILED", "CANCELLED"],
  DISCOVERING: ["POLICY_CHECK", "FAILED", "CANCELLED"],
  POLICY_CHECK: ["WAITING_APPROVAL", "EXECUTING", "FAILED", "CANCELLED"],
  WAITING_APPROVAL: ["EXECUTING", "CANCELLED", "FAILED"],
  EXECUTING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["DIAGNOSING", "ESCALATED", "ROLLED_BACK"],
  DIAGNOSING: ["RECOVERY", "ESCALATED", "ROLLED_BACK"],
  RECOVERY: ["RETRY", "ROLLED_BACK", "ESCALATED"],
  RETRY: ["EXECUTING", "VERIFYING", "FAILED"],
  ESCALATED: ["RETRY", "CANCELLED"],
  ROLLED_BACK: ["ESCALATED", "COMPLETED"],
  CANCELLED: [],
};

export const TERMINAL_STATES: TaskStatus[] = ["COMPLETED", "CANCELLED"];
export const ATTENTION_STATES: TaskStatus[] = ["FAILED", "DIAGNOSING", "RECOVERY", "RETRY", "ESCALATED", "ROLLED_BACK"];

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(from: TaskStatus, to: TaskStatus): TaskStatus {
  if (!canTransition(from, to)) throw new Error(`Invalid task transition ${from} → ${to}`);
  return to;
}

export function isHealing(s: TaskStatus): boolean { return ["DIAGNOSING", "RECOVERY", "RETRY"].includes(s); }
export function isActive(s: TaskStatus): boolean { return !TERMINAL_STATES.includes(s) && s !== "ESCALATED"; }
