import type { Policy, PolicyDecision, RequestContext, TaskType, EnvironmentKind } from "../types";
import { DomainError } from "../types";
import { ServiceBase } from "./context";
import { evaluatePolicy } from "../engines/policy";
import { newId } from "../ids";

export interface SimulationInput { userId?: string; taskType: TaskType; environmentId?: string; environmentKind?: EnvironmentKind; includesDatabaseMigration?: boolean; destructive?: boolean }

export class PolicyService extends ServiceBase {
  async list(ctx: RequestContext): Promise<Policy[]> {
    this.require(ctx, "organization.read");
    return (await this.store.policies.list((p) => p.organizationId === null || p.organizationId === ctx.actor.organizationId)).sort((a, b) => a.scope.localeCompare(b.scope) || b.priority - a.priority);
  }

  async get(ctx: RequestContext, id: string): Promise<Policy> {
    this.require(ctx, "organization.read");
    return this.assertTenant(ctx, await this.store.policies.get(id), "Policy");
  }

  async save(ctx: RequestContext, input: Partial<Policy> & { name: string; when: Policy["when"]; then: Policy["then"] }): Promise<Policy> {
    this.require(ctx, "policy.manage");
    const existing = input.id ? await this.store.policies.get(input.id) : undefined;
    if (existing) {
      this.assertTenant(ctx, existing, "Policy");
      if (existing.builtIn) throw new DomainError("VALIDATION", "Platform default policies cannot be edited. Create an organization policy that is more restrictive instead.");
    }
    if (!input.name.trim()) throw new DomainError("VALIDATION", "Policy name is required");
    if (input.then.mode === "REQUIRE_APPROVAL" && (!input.then.requiredApprovals || input.then.requiredApprovals < 1)) throw new DomainError("VALIDATION", "Required approvals must be at least 1");
    const policy: Policy = {
      id: existing?.id ?? newId("pol"), organizationId: ctx.actor.organizationId, scope: input.scope ?? "ORGANIZATION", scopeRef: input.scopeRef, name: input.name, description: input.description, enabled: input.enabled ?? true,
      version: existing ? existing.version + 1 : 1, priority: input.priority ?? 10, when: input.when, then: input.then, builtIn: false, updatedAt: ctx.now(), updatedById: ctx.actor.userId,
    };
    await this.store.policies.put(policy);
    await this.audit(ctx, existing ? "policy.updated" : "policy.created", "policy", policy.id, policy.name, { risk: "HIGH", detail: `v${policy.version}` });
    return policy;
  }

  async toggle(ctx: RequestContext, id: string, enabled: boolean): Promise<Policy> {
    this.require(ctx, "policy.manage");
    const p = this.assertTenant(ctx, await this.store.policies.get(id), "Policy");
    if (p.builtIn) throw new DomainError("VALIDATION", "Platform default policies cannot be disabled");
    const updated = { ...p, enabled, version: p.version + 1, updatedAt: ctx.now(), updatedById: ctx.actor.userId };
    await this.store.policies.put(updated);
    await this.audit(ctx, enabled ? "policy.enabled" : "policy.disabled", "policy", p.id, p.name, { risk: "HIGH" });
    return updated;
  }

  async remove(ctx: RequestContext, id: string): Promise<void> {
    this.require(ctx, "policy.manage");
    const p = this.assertTenant(ctx, await this.store.policies.get(id), "Policy");
    if (p.builtIn) throw new DomainError("VALIDATION", "Platform default policies cannot be deleted");
    await this.store.policies.delete(id);
    await this.audit(ctx, "policy.deleted", "policy", p.id, p.name, { risk: "HIGH" });
  }

  /** Section 44 — Policy Simulator. */
  async simulate(ctx: RequestContext, input: SimulationInput): Promise<PolicyDecision & { subject: string; environmentName?: string }> {
    this.require(ctx, "organization.read");
    const org = this.assertOrg(ctx, await this.store.organizations.get(ctx.actor.organizationId));
    const env = input.environmentId ? await this.store.environments.get(input.environmentId) : undefined;
    const user = input.userId ? await this.store.users.get(input.userId) : undefined;
    const membership = input.userId ? (await this.store.memberships.list({ userId: input.userId, organizationId: org.id }))[0] : undefined;
    const policies = await this.store.policies.list((p) => p.organizationId === null || p.organizationId === org.id);
    const decision = evaluatePolicy({ organization: org, taskType: input.taskType, environmentKind: env?.kind ?? input.environmentKind, environmentId: env?.id, groupIds: membership?.groupIds, includesDatabaseMigration: input.includesDatabaseMigration, destructive: input.destructive }, policies);
    return { ...decision, subject: user?.name ?? ctx.actor.userName, environmentName: env?.name };
  }

  async evaluateFor(ctx: RequestContext, input: { taskType: TaskType; environmentId?: string; includesDatabaseMigration?: boolean; destructive?: boolean; capabilities?: import("../types").AgentCapability[]; resourceId?: string }): Promise<PolicyDecision> {
    const org = this.assertOrg(ctx, await this.store.organizations.get(ctx.actor.organizationId));
    const env = input.environmentId ? await this.store.environments.get(input.environmentId) : undefined;
    const membership = await this.store.memberships.get(ctx.actor.membershipId);
    const policies = await this.store.policies.list((p) => p.organizationId === null || p.organizationId === org.id);
    return evaluatePolicy({ organization: org, taskType: input.taskType, environmentKind: env?.kind, environmentId: env?.id, resourceId: input.resourceId, groupIds: membership?.groupIds, includesDatabaseMigration: input.includesDatabaseMigration, destructive: input.destructive, capabilities: input.capabilities }, policies);
  }
}
