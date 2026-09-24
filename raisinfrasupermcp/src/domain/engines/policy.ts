import type { ApproverRef, ApprovalStrategy, EnvironmentKind, Organization, Policy, PolicyDecision, PolicyScope, RiskLevel, TaskType, AgentCapability } from "../types";
import { calculateRisk, riskRank } from "./risk";

export interface PolicyEvaluationInput {
  organization: Organization;
  taskType: TaskType;
  environmentKind?: EnvironmentKind;
  environmentId?: string;
  resourceId?: string;
  groupIds?: string[];
  destructive?: boolean;
  includesDatabaseMigration?: boolean;
  capabilities?: AgentCapability[];
  baseRisk?: RiskLevel;
}

const SCOPE_ORDER: PolicyScope[] = ["PLATFORM", "ORGANIZATION", "GROUP", "ENVIRONMENT", "RESOURCE"];

function matches(policy: Policy, input: PolicyEvaluationInput, risk: RiskLevel): boolean {
  if (!policy.enabled) return false;
  if (policy.organizationId && policy.organizationId !== input.organization.id) return false;
  if (policy.scope === "GROUP" && policy.scopeRef && !(input.groupIds ?? []).includes(policy.scopeRef)) return false;
  if (policy.scope === "ENVIRONMENT" && policy.scopeRef && policy.scopeRef !== input.environmentId) return false;
  if (policy.scope === "RESOURCE" && policy.scopeRef && policy.scopeRef !== input.resourceId) return false;
  const w = policy.when;
  if (w.taskTypes && !w.taskTypes.includes(input.taskType)) return false;
  if (w.environmentKinds && (!input.environmentKind || !w.environmentKinds.includes(input.environmentKind))) return false;
  if (w.minRisk && riskRank(risk) < riskRank(w.minRisk)) return false;
  if (w.destructive !== undefined && Boolean(input.destructive) !== w.destructive) return false;
  if (w.includesDatabaseMigration !== undefined && Boolean(input.includesDatabaseMigration) !== w.includesDatabaseMigration) return false;
  if (w.capabilities && !(input.capabilities ?? []).some((c) => w.capabilities!.includes(c))) return false;
  return true;
}

function dedupeApprovers(list: ApproverRef[]): ApproverRef[] {
  const seen = new Set<string>();
  return list.filter((a) => { const k = `${a.kind}:${a.id ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/**
 * Policy inheritance:
 *   Platform Default → Organization → Group → Environment → Resource → Task Decision
 * The most restrictive effect always wins: DENY > REQUIRE_APPROVAL (max approvals, union of approvers) > AUTOMATIC.
 * Personal organizations default to AUTOMATIC unless a matching policy is more restrictive.
 */
export function evaluatePolicy(input: PolicyEvaluationInput, policies: Policy[]): PolicyDecision {
  const risk = calculateRisk({ taskType: input.taskType, environmentKind: input.environmentKind, destructive: input.destructive, includesDatabaseMigration: input.includesDatabaseMigration, baseRisk: input.baseRisk });
  const explanation: string[] = [`Risk calculated as ${risk} (${input.taskType} on ${input.environmentKind ?? "DEVELOPMENT"}${input.includesDatabaseMigration ? ", includes database migration" : ""}${input.destructive ? ", destructive" : ""}).`];

  const matched = policies
    .filter((p) => matches(p, input, risk))
    .sort((a, b) => SCOPE_ORDER.indexOf(a.scope) - SCOPE_ORDER.indexOf(b.scope) || b.priority - a.priority);

  let mode: PolicyDecision["mode"] = "AUTOMATIC";
  let requiredApprovals = 0;
  let approvers: ApproverRef[] = [];
  let strategy: ApprovalStrategy = "ANY";
  let typedConfirmation = false;

  if (input.organization.approvalMode === "AUTOMATIC" && input.organization.type === "PERSONAL") {
    explanation.push("Personal organization: approval mode defaults to AUTOMATIC.");
  }

  for (const p of matched) {
    explanation.push(`Matched ${p.scope.toLowerCase()} policy “${p.name}” (v${p.version}) → ${p.then.mode}${p.then.requiredApprovals ? ` ×${p.then.requiredApprovals}` : ""}.`);
    if (p.then.mode === "DENY") { mode = "DENY"; continue; }
    if (p.then.mode === "REQUIRE_APPROVAL") {
      if (mode !== "DENY") mode = "REQUIRE_APPROVAL";
      requiredApprovals = Math.max(requiredApprovals, p.then.requiredApprovals ?? 1);
      approvers = dedupeApprovers([...approvers, ...(p.then.approvers ?? [])]);
      if (p.then.strategy === "ALL" || (strategy !== "ALL" && p.then.strategy)) strategy = p.then.strategy;
      typedConfirmation = typedConfirmation || Boolean(p.then.typedConfirmation);
    }
  }

  // Organization-level ROUTED mode: at minimum, HIGH+ risk always requires 1 approval from an org owner/admin.
  if (input.organization.approvalMode === "ROUTED" && riskRank(risk) >= riskRank("HIGH") && mode === "AUTOMATIC") {
    mode = "REQUIRE_APPROVAL";
    requiredApprovals = 1;
    approvers = [{ kind: "ORG_OWNER", label: "Organization Owner" }];
    explanation.push("Organization approval mode is ROUTED: HIGH risk requires at least 1 approval.");
  }
  if (risk === "CRITICAL") typedConfirmation = true;
  if (mode === "REQUIRE_APPROVAL" && approvers.length === 0) approvers = [{ kind: "ORG_OWNER", label: "Organization Owner" }];
  if (mode === "REQUIRE_APPROVAL" && requiredApprovals > approvers.length && approvers.length > 0) {
    // cannot require more approvals than distinct approver slots — pad with org owner
    approvers = dedupeApprovers([...approvers, { kind: "ORG_OWNER", label: "Organization Owner" }, { kind: "ORG_ADMIN", label: "Organization Admin" }]).slice(0, Math.max(requiredApprovals, approvers.length));
  }
  if (mode === "REQUIRE_APPROVAL" && requiredApprovals > 1 && strategy === "ANY") strategy = "ALL";

  const result: PolicyDecision["result"] = mode === "DENY" ? "DENIED" : mode === "REQUIRE_APPROVAL" ? "WAITING_APPROVAL" : "AUTO";
  explanation.push(result === "AUTO" ? "Result: automatic execution." : result === "DENIED" ? "Result: denied by policy." : `Result: waiting for ${requiredApprovals} approval(s) from ${approvers.map((a) => a.label).join(", ")}.`);

  return {
    risk, mode, requiredApprovals: mode === "REQUIRE_APPROVAL" ? requiredApprovals : 0, approvers: mode === "REQUIRE_APPROVAL" ? approvers : [],
    strategy, typedConfirmation, matchedPolicies: matched.map((p) => ({ id: p.id, name: p.name, scope: p.scope, version: p.version })), result, explanation,
  };
}

/** Platform default policies (section 42 of the product spec). */
export function platformDefaultPolicies(now: string): Policy[] {
  const base = { organizationId: null, scope: "PLATFORM" as const, enabled: true, version: 1, builtIn: true, updatedAt: now, priority: 0 };
  return [
    { ...base, id: "pol_platform_dev_auto", name: "Development is automatic", when: { environmentKinds: ["DEVELOPMENT"] }, then: { mode: "AUTOMATIC" } },
    { ...base, id: "pol_platform_staging_auto", name: "Staging is automatic", when: { environmentKinds: ["STAGING"] }, then: { mode: "AUTOMATIC" } },
    { ...base, id: "pol_platform_prod_deploy", name: "Production deployment requires 1 approval", when: { taskTypes: ["DEPLOYMENT"], environmentKinds: ["PRODUCTION"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 1, approvers: [{ kind: "ORG_OWNER", label: "Organization Owner" }], strategy: "ANY" } },
    { ...base, id: "pol_platform_prod_migration", name: "Production database migration requires 2 approvals", when: { environmentKinds: ["PRODUCTION"], includesDatabaseMigration: true }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 2, approvers: [{ kind: "SECURITY_ADMIN", label: "Security Admin" }, { kind: "ORG_OWNER", label: "Organization Owner" }], strategy: "ALL" } },
    { ...base, id: "pol_platform_prod_restart", name: "Production restart requires 1 approval", when: { taskTypes: ["RESTART", "VM_STOP"], environmentKinds: ["PRODUCTION"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 1, approvers: [{ kind: "ORG_ADMIN", label: "Organization Admin" }], strategy: "ANY" } },
    { ...base, id: "pol_platform_prod_delete", name: "Production deletion requires 2 approvals", when: { taskTypes: ["VM_DELETE"], environmentKinds: ["PRODUCTION"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 2, approvers: [{ kind: "SECURITY_ADMIN", label: "Security Admin" }, { kind: "ORG_OWNER", label: "Organization Owner" }], strategy: "ALL", typedConfirmation: true } },
    { ...base, id: "pol_platform_credentials", name: "Credential changes require Security approval", when: { taskTypes: ["CREDENTIAL_CHANGE"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 1, approvers: [{ kind: "SECURITY_ADMIN", label: "Security Admin" }], strategy: "ANY" } },
    { ...base, id: "pol_platform_policy", name: "Security policy changes require Owner approval", when: { taskTypes: ["POLICY_CHANGE"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 1, approvers: [{ kind: "ORG_OWNER", label: "Organization Owner" }], strategy: "ANY" } },
  ];
}
