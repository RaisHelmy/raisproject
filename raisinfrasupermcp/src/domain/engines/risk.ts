import type { EnvironmentKind, RiskLevel, TaskType } from "../types";

export const RISK_ORDER: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export function riskRank(r: RiskLevel): number { return RISK_ORDER.indexOf(r); }
export function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel { return riskRank(a) >= riskRank(b) ? a : b; }

export interface RiskInput {
  taskType: TaskType;
  environmentKind?: EnvironmentKind;
  destructive?: boolean;
  includesDatabaseMigration?: boolean;
  baseRisk?: RiskLevel;
}

const DESTRUCTIVE_TYPES: TaskType[] = ["VM_DELETE", "ROLLBACK"];
const CHANGE_TYPES: TaskType[] = ["DEPLOYMENT", "DATABASE_MIGRATION", "RESTART", "VM_STOP", "CREDENTIAL_CHANGE", "POLICY_CHANGE", "VM_CREATE", "ENVIRONMENT_BOOTSTRAP"];

/**
 * Deterministic risk calculation.
 *   Install package (dev)          → LOW
 *   Restart development VM         → MEDIUM
 *   Production deployment          → HIGH
 *   Delete production VM           → CRITICAL
 */
export function calculateRisk(input: RiskInput): RiskLevel {
  let risk: RiskLevel = input.baseRisk ?? "LOW";
  const env = input.environmentKind ?? "DEVELOPMENT";
  const destructive = input.destructive || DESTRUCTIVE_TYPES.includes(input.taskType);

  if (input.taskType === "RESTART" || input.taskType === "VM_STOP" || input.taskType === "VM_START") risk = maxRisk(risk, "MEDIUM");
  if (CHANGE_TYPES.includes(input.taskType) && env === "STAGING") risk = maxRisk(risk, "MEDIUM");
  if (CHANGE_TYPES.includes(input.taskType) && env === "PRODUCTION") risk = maxRisk(risk, "HIGH");
  if (input.includesDatabaseMigration && env === "PRODUCTION") risk = maxRisk(risk, "HIGH");
  if (input.taskType === "CREDENTIAL_CHANGE" || input.taskType === "POLICY_CHANGE") risk = maxRisk(risk, "HIGH");
  if (destructive && env === "PRODUCTION") risk = "CRITICAL";
  else if (destructive && env === "STAGING") risk = maxRisk(risk, "HIGH");
  else if (destructive) risk = maxRisk(risk, "MEDIUM");
  return risk;
}
