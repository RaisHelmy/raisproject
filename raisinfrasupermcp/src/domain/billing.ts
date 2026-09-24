import type { Plan, UsageRecord } from "./types";

/** Plan definitions are configuration, not business logic (section 124). Prices in MYR. */
export const PLANS: Plan[] = [
  { id: "free", name: "Free", priceMonthlyMyr: 0, target: "Individual developers", limits: { organizations: 1, users: 1, agents: 1, environments: 1, gitConnections: 1, activeChanges: 5, taskExecutionsPerMonth: 20 }, features: ["1 organization", "1 user", "1 agent", "1 environment", "1 GitHub/GitLab connection", "5 active Changes", "20 task executions / month", "Basic AI analytics", "Demo Lab"] },
  { id: "pro", name: "Pro", priceMonthlyMyr: 79, target: "Freelancers, power developers, consultants", limits: { organizations: 1, users: 1, agents: 5, environments: 10, gitConnections: 3, activeChanges: null, taskExecutionsPerMonth: 500 }, features: ["1 user", "5 agents", "10 environments", "Unlimited Changes", "GitHub & GitLab", "Jira", "Docker", "Proxmox", "Deployment automation", "Self-healing", "AI optimization", "Reports"] },
  { id: "team", name: "Team", priceMonthlyMyr: 599, target: "Software houses and engineering teams", highlighted: true, limits: { organizations: 3, users: 10, agents: 20, environments: 50, gitConnections: 10, activeChanges: null, taskExecutionsPerMonth: 5000 }, features: ["10 users", "20 agents", "50 environments", "Unlimited Changes", "GitHub & GitLab", "Jira", "CI/CD", "Docker", "Proxmox", "Approval workflows", "RBAC", "Audit logs", "Deployment history", "Self-healing", "AI optimization", "Engineering reports"] },
  { id: "business", name: "Business", priceMonthlyMyr: 2500, target: "10–50+ engineers", limits: { organizations: 10, users: 50, agents: 100, environments: null, gitConnections: null, activeChanges: null, taskExecutionsPerMonth: 50000 }, features: ["50 users", "100 agents", "Unlimited environments", "Enterprise GitLab", "GitHub Enterprise", "Jira", "Advanced RBAC", "SSO", "Audit", "Custom policies", "Advanced analytics", "AI optimization", "Priority support"] },
  { id: "enterprise", name: "Enterprise", priceMonthlyMyr: null, target: "Large organizations, on-prem", limits: { organizations: null, users: null, agents: null, environments: null, gitConnections: null, activeChanges: null, taskExecutionsPerMonth: null }, features: ["Unlimited users, agents, environments", "SSO & SCIM", "Enterprise GitLab / GitHub Enterprise Server", "Private networking", "Advanced audit & custom retention", "Custom integrations", "SLA & dedicated support", "On-prem licensing available"] },
];

export const MARKETPLACE_COMMISSION_PCT = 30; // configurable platform share

export function planById(id: string): Plan { return PLANS.find((p) => p.id === id) ?? PLANS[0]; }

export function usagePct(used: number, limit: number | null): number | null {
  if (limit === null) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}

export interface LimitCheck { ok: boolean; metric: string; used: number; limit: number | null }

export function checkLimit(plan: Plan, metric: keyof Plan["limits"], used: number): LimitCheck {
  const limit = plan.limits[metric];
  return { ok: limit === null || used < limit, metric, used, limit };
}

export function monthlyPrice(plan: Plan, cycle: "MONTHLY" | "YEARLY"): number | null {
  if (plan.priceMonthlyMyr === null) return null;
  return cycle === "YEARLY" ? Math.round(plan.priceMonthlyMyr * 10) : plan.priceMonthlyMyr; // 2 months free yearly
}

export function marketplaceSplit(priceMyr: number, commissionPct = MARKETPLACE_COMMISSION_PCT): { publisher: number; platform: number } {
  const platform = +(priceMyr * (commissionPct / 100)).toFixed(2);
  return { publisher: +(priceMyr - platform).toFixed(2), platform };
}

/** ROI estimates (section 123). Clearly labelled as estimates in the UI. */
export function estimateRoi(usage: UsageRecord, opts = { minutesPerAvoidedAiRequest: 2.3, minutesPerSelfHealedFailure: 45, myrPerEngineerHour: 40, myrPerAiRequest: 0.12 }) {
  const hoursSaved = (usage.aiRequestsAvoided * opts.minutesPerAvoidedAiRequest) / 60;
  const aiSavings = usage.aiRequestsAvoided * opts.myrPerAiRequest;
  return { estimatedEngineeringHoursSaved: Math.round(hoursSaved), estimatedSavingsMyr: Math.round(aiSavings + hoursSaved * opts.myrPerEngineerHour), isEstimate: true as const };
}
