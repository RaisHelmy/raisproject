import type * as T from "../types";
import { DomainError } from "../types";
import { ServiceBase } from "./context";
import { newId } from "../ids";
import { PLANS, planById, usagePct, estimateRoi, marketplaceSplit, checkLimit } from "../billing";
import { DEFAULT_ROLES } from "../permissions";
import { redactObject } from "../engines/privacy";

export class PlatformService extends ServiceBase {
  // ---------- organizations ----------
  async organizationsForUser(userId: string): Promise<(T.Organization & { roleKeys: string[] })[]> {
    const memberships = (await this.store.memberships.list({ userId })).filter((m) => m.status === "ACTIVE");
    const roles = await this.store.roles.list();
    const out: (T.Organization & { roleKeys: string[] })[] = [];
    for (const m of memberships) { const o = await this.store.organizations.get(m.organizationId); if (o) out.push({ ...o, roleKeys: m.roleIds.map((id) => roles.find((r) => r.id === id)?.key ?? id) }); }
    return out;
  }

  async organization(ctx: T.RequestContext): Promise<T.Organization> {
    this.require(ctx, "organization.read");
    return this.assertOrg(ctx, await this.store.organizations.get(ctx.actor.organizationId));
  }

  async updateOrganization(ctx: T.RequestContext, patch: Partial<Pick<T.Organization, "name" | "approvalMode" | "retention">>): Promise<T.Organization> {
    this.require(ctx, "organization.manage");
    const org = await this.organization(ctx);
    const updated = { ...org, ...patch, updatedAt: ctx.now() };
    await this.store.organizations.put(updated);
    await this.audit(ctx, "organization.updated", "organization", org.id, org.name, { risk: patch.approvalMode ? "HIGH" : "LOW", detail: Object.keys(patch).join(",") });
    return updated;
  }

  async createOrganization(userId: string, userName: string, input: { name: string; type: T.OrganizationType }): Promise<T.Organization> {
    const now = new Date().toISOString();
    const org: T.Organization = { id: newId("org"), name: input.name, slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), type: input.type, approvalMode: input.type === "PERSONAL" ? "AUTOMATIC" : "ROUTED", planId: "free", demo: false, verification: { status: "NOT_STARTED" }, retention: { aiRequestMetadataDays: 30, mcpTelemetryDays: 90, taskExecutionDays: 365, changeEvidenceDays: 730, auditLogDays: 730 }, createdAt: now, updatedAt: now };
    await this.store.organizations.put(org);
    if ((await this.store.roles.count()) === 0) await this.store.roles.putMany(DEFAULT_ROLES.map((r) => ({ ...r, id: `role_${r.key}` })));
    await this.store.memberships.put({ id: newId("mem"), organizationId: org.id, userId, status: "ACTIVE", roleIds: ["role_org_owner"], groupIds: [], createdAt: now });
    await this.store.subscriptions.put({ id: newId("sub"), organizationId: org.id, planId: "free", status: "ACTIVE", billingCycle: "MONTHLY", aiMode: "PLATFORM", currentPeriodStart: now, currentPeriodEnd: new Date(Date.now() + 30 * 86400_000).toISOString() });
    await this.store.auditLogs.put({ id: newId("aud"), organizationId: org.id, actorId: userId, actorName: userName, action: "organization.created", resourceType: "organization", resourceId: org.id, resourceLabel: org.name, timestamp: now, result: "SUCCESS", risk: "LOW", correlationId: newId("cor"), executionMode: "HUMAN" });
    return org;
  }

  async requestVerification(ctx: T.RequestContext, kind: "ORGANIZATION" | "USER", provider: string): Promise<T.Verification> {
    const v: T.Verification = { status: "PENDING", provider, reference: `${provider.toUpperCase()}-${newId("").slice(1, 9).toUpperCase()}`, requestedAt: ctx.now() };
    if (kind === "ORGANIZATION") { this.require(ctx, "organization.manage"); const org = await this.organization(ctx); await this.store.organizations.put({ ...org, verification: v }); }
    else { const u = (await this.store.users.get(ctx.actor.userId))!; await this.store.users.put({ ...u, verification: v }); }
    await this.audit(ctx, "verification.requested", kind.toLowerCase(), kind === "ORGANIZATION" ? ctx.actor.organizationId : ctx.actor.userId, undefined, { risk: "LOW", detail: provider });
    return v;
  }

  // ---------- members, groups, roles ----------
  async members(ctx: T.RequestContext): Promise<(T.Membership & { user: T.User; roleNames: string[]; groupNames: string[] })[]> {
    this.require(ctx, "user.read");
    const memberships = await this.store.memberships.list({ organizationId: ctx.actor.organizationId });
    const roles = await this.store.roles.list();
    const groups = await this.store.groups.list({ organizationId: ctx.actor.organizationId });
    const out = [];
    for (const m of memberships) { const user = await this.store.users.get(m.userId); if (user) out.push({ ...m, user, roleNames: m.roleIds.map((id) => roles.find((r) => r.id === id)?.name ?? id), groupNames: m.groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? id) }); }
    return out;
  }

  async invite(ctx: T.RequestContext, input: { email: string; name: string; roleIds: string[]; groupIds?: string[] }): Promise<T.Membership> {
    this.require(ctx, "user.invite");
    const org = await this.organization(ctx);
    const plan = planById(org.planId);
    const count = await this.store.memberships.count({ organizationId: org.id });
    const limit = checkLimit(plan, "users", count);
    if (!limit.ok) throw new DomainError("LIMIT_EXCEEDED", `Your ${plan.name} plan allows ${limit.limit} user(s). Upgrade to invite more.`);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) throw new DomainError("VALIDATION", "A valid email is required");
    let user = (await this.store.users.list({ email: input.email.toLowerCase() }))[0];
    if (!user) { user = { id: newId("usr"), email: input.email.toLowerCase(), name: input.name || input.email.split("@")[0], avatarInitials: (input.name || input.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(), verification: { status: "NOT_STARTED" }, createdAt: ctx.now() }; await this.store.users.put(user); }
    const existing = (await this.store.memberships.list({ organizationId: org.id, userId: user.id }))[0];
    if (existing && existing.status !== "REMOVED") throw new DomainError("VALIDATION", "This user is already a member");
    const m: T.Membership = { id: existing?.id ?? newId("mem"), organizationId: org.id, userId: user.id, status: "INVITED", roleIds: input.roleIds.length ? input.roleIds : ["role_viewer"], groupIds: input.groupIds ?? [], invitedBy: ctx.actor.userId, createdAt: ctx.now() };
    await this.store.memberships.put(m);
    await this.audit(ctx, "user.invited", "user", user.id, user.email, { risk: "MEDIUM" });
    await this.notify(ctx, [user.id], "SYSTEM", `You were invited to ${org.name}`, `Invited by ${ctx.actor.userName}.`, "/");
    return m;
  }

  async updateMembership(ctx: T.RequestContext, membershipId: string, patch: { roleIds?: string[]; groupIds?: string[]; status?: T.MembershipStatus }): Promise<T.Membership> {
    this.require(ctx, patch.roleIds ? "role.manage" : patch.status === "REMOVED" ? "user.remove" : "group.manage");
    const m = this.assertTenant(ctx, await this.store.memberships.get(membershipId), "Membership");
    if (m.userId === ctx.actor.userId && (patch.status === "REMOVED" || (patch.roleIds && !patch.roleIds.includes("role_org_owner") && ctx.actor.isOwner))) throw new DomainError("VALIDATION", "You cannot remove your own owner access");
    const owners = (await this.store.memberships.list({ organizationId: ctx.actor.organizationId, status: "ACTIVE" })).filter((x) => x.roleIds.includes("role_org_owner"));
    if (m.roleIds.includes("role_org_owner") && owners.length === 1 && (patch.status === "REMOVED" || (patch.roleIds && !patch.roleIds.includes("role_org_owner")))) throw new DomainError("VALIDATION", "An organization must keep at least one owner");
    const updated = { ...m, ...patch };
    await this.store.memberships.put(updated);
    await this.audit(ctx, patch.roleIds ? "role.assigned" : patch.status ? `membership.${patch.status.toLowerCase()}` : "group.assigned", "membership", m.id, m.userId, { risk: "HIGH" });
    return updated;
  }

  async groups(ctx: T.RequestContext): Promise<(T.Group & { memberCount: number })[]> {
    this.require(ctx, "group.read");
    const groups = await this.store.groups.list({ organizationId: ctx.actor.organizationId });
    const memberships = await this.store.memberships.list({ organizationId: ctx.actor.organizationId });
    return groups.map((g) => ({ ...g, memberCount: memberships.filter((m) => m.groupIds.includes(g.id)).length }));
  }

  async saveGroup(ctx: T.RequestContext, input: { id?: string; name: string; description?: string }): Promise<T.Group> {
    this.require(ctx, "group.manage");
    if (!input.name.trim()) throw new DomainError("VALIDATION", "Group name is required");
    const g: T.Group = { id: input.id ?? newId("grp"), organizationId: ctx.actor.organizationId, name: input.name.trim(), description: input.description, builtIn: false };
    if (input.id) this.assertTenant(ctx, await this.store.groups.get(input.id), "Group");
    await this.store.groups.put(g);
    await this.audit(ctx, input.id ? "group.updated" : "group.created", "group", g.id, g.name);
    return g;
  }

  async roles(ctx: T.RequestContext): Promise<(T.Role & { memberCount: number })[]> {
    this.require(ctx, "role.read");
    const roles = await this.store.roles.list((r) => r.organizationId === null || r.organizationId === ctx.actor.organizationId);
    const memberships = await this.store.memberships.list({ organizationId: ctx.actor.organizationId });
    return roles.map((r) => ({ ...r, memberCount: memberships.filter((m) => m.roleIds.includes(r.id)).length }));
  }

  async saveRole(ctx: T.RequestContext, input: { id?: string; name: string; description: string; permissions: T.Permission[] }): Promise<T.Role> {
    this.require(ctx, "role.manage");
    if (input.id) { const existing = this.assertTenant(ctx, await this.store.roles.get(input.id), "Role"); if (existing.builtIn) throw new DomainError("VALIDATION", "Built-in roles cannot be edited. Create a custom role instead."); }
    if (input.permissions.includes("security.manage") && !ctx.actor.isOwner) throw new DomainError("FORBIDDEN", "Only the organization owner can grant security.manage");
    const role: T.Role = { id: input.id ?? newId("role"), organizationId: ctx.actor.organizationId, key: input.id ?? "custom_" + input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"), name: input.name, description: input.description, permissions: input.permissions, builtIn: false };
    await this.store.roles.put(role);
    await this.audit(ctx, input.id ? "role.updated" : "role.created", "role", role.id, role.name, { risk: "HIGH" });
    return role;
  }

  // ---------- agents ----------
  async agents(ctx: T.RequestContext): Promise<T.Agent[]> { this.require(ctx, "agent.read"); return this.store.agents.list({ organizationId: ctx.actor.organizationId }); }
  async agent(ctx: T.RequestContext, id: string): Promise<T.Agent> { this.require(ctx, "agent.read"); return this.assertTenant(ctx, await this.store.agents.get(id), "Agent"); }

  async agentAction(ctx: T.RequestContext, id: string, action: "APPROVE" | "QUARANTINE" | "RELEASE" | "DISABLE" | "ENABLE" | "REVOKE" | "UPDATE"): Promise<T.Agent> {
    const perm: T.Permission = action === "QUARANTINE" || action === "RELEASE" || action === "REVOKE" ? "agent.quarantine" : action === "UPDATE" ? "agent.update" : "agent.update";
    this.require(ctx, perm);
    const agent = await this.agent(ctx, id);
    const next: Record<typeof action, T.AgentStatus> = { APPROVE: "ACTIVE", QUARANTINE: "QUARANTINED", RELEASE: "ACTIVE", DISABLE: "DISABLED", ENABLE: "ACTIVE", REVOKE: "REVOKED", UPDATE: agent.status };
    if (action === "APPROVE" && agent.status !== "PENDING_APPROVAL") throw new DomainError("INVALID_STATE", "Agent is not pending approval");
    if (agent.status === "REVOKED") throw new DomainError("INVALID_STATE", "A revoked agent cannot be changed. Register a new agent.");
    const updated: T.Agent = { ...agent, status: next[action], version: action === "UPDATE" ? "1.8.2" : agent.version, lastSeenAt: action === "UPDATE" ? ctx.now() : agent.lastSeenAt, health: action === "UPDATE" ? { ...agent.health, memory: Math.min(agent.health.memory, 60), latencyMs: Math.min(agent.health.latencyMs, 60) } : agent.health };
    if (action === "UPDATE" && agent.status === "DEGRADED") updated.status = "ACTIVE";
    await this.store.agents.put(updated);
    await this.audit(ctx, `agent.${action.toLowerCase()}`, "agent", agent.id, agent.name, { risk: action === "REVOKE" || action === "QUARANTINE" ? "HIGH" : "MEDIUM", detail: action === "UPDATE" ? "Signed update 1.8.2 verified" : undefined });
    if (action === "QUARANTINE") await this.notify(ctx, await this.usersWithRoles(ctx.actor.organizationId, ["org_owner", "security_admin"]), "AGENT_OFFLINE", `${agent.name} quarantined`, `${ctx.actor.userName} quarantined the agent. Tasks routed to it will be blocked.`, `/agents/${agent.id}`);
    return updated;
  }

  async registerAgent(ctx: T.RequestContext, input: { name: string; os: T.Agent["os"]; arch: T.Agent["arch"]; environmentId?: string }): Promise<{ agent: T.Agent; registrationToken: string }> {
    this.require(ctx, "agent.update");
    const org = await this.organization(ctx);
    const plan = planById(org.planId);
    const limit = checkLimit(plan, "agents", await this.store.agents.count({ organizationId: org.id }));
    if (!limit.ok) throw new DomainError("LIMIT_EXCEEDED", `Your ${plan.name} plan allows ${limit.limit} agent(s).`);
    const agent: T.Agent = { id: newId("agt"), organizationId: org.id, name: input.name, status: "PENDING_APPROVAL", mode: "NOT_CONNECTED", capabilities: [], version: "—", os: input.os, arch: input.arch, hostname: "—", environmentId: input.environmentId, lastSeenAt: ctx.now(), registeredAt: ctx.now(), identity: { fingerprint: "pending" }, health: { cpu: 0, memory: 0, disk: 0, latencyMs: 0 } };
    await this.store.agents.put(agent);
    await this.audit(ctx, "agent.registered", "agent", agent.id, agent.name, { risk: "MEDIUM" });
    // The registration token is shown once; only its hash would be stored in a real deployment.
    return { agent, registrationToken: `smcp_reg_${newId("").slice(1)}${newId("").slice(1)}` };
  }

  // ---------- infrastructure ----------
  async environments(ctx: T.RequestContext) { this.require(ctx, "environment.read"); return this.store.environments.list({ organizationId: ctx.actor.organizationId }); }
  async servers(ctx: T.RequestContext) { this.require(ctx, "server.read"); return this.store.servers.list({ organizationId: ctx.actor.organizationId }); }
  async applications(ctx: T.RequestContext) { this.require(ctx, "environment.read"); return this.store.applications.list({ organizationId: ctx.actor.organizationId }); }
  async repositories(ctx: T.RequestContext) { this.require(ctx, "repository.read"); return this.store.repositories.list({ organizationId: ctx.actor.organizationId }); }
  async gitConnections(ctx: T.RequestContext) { this.require(ctx, "repository.read"); return this.store.gitConnections.list({ organizationId: ctx.actor.organizationId }); }
  async integrations(ctx: T.RequestContext) { this.require(ctx, "organization.read"); return this.store.integrations.list({ organizationId: ctx.actor.organizationId }); }
  async credentials(ctx: T.RequestContext) { this.require(ctx, "security.manage"); return this.store.credentials.list({ organizationId: ctx.actor.organizationId }); }

  async environmentSnapshot(ctx: T.RequestContext, environmentId: string) {
    this.require(ctx, "environment.read");
    const env = this.assertTenant(ctx, await this.store.environments.get(environmentId), "Environment");
    const [servers, agent, apps, deployments, incidents] = await Promise.all([
      this.store.servers.list({ environmentId: env.id }), env.agentId ? this.store.agents.get(env.agentId) : undefined, this.store.applications.list({ organizationId: env.organizationId }),
      this.store.deployments.list({ environmentId: env.id }), this.store.incidents.list((i) => i.environmentId === env.id && i.status !== "CLOSED"),
    ]);
    return { environment: env, servers, agent, applications: apps.map((a) => ({ id: a.id, name: a.name, version: a.deployedVersions[env.id] ?? null })), recentDeployments: deployments.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 5), openIncidents: incidents, capturedAt: ctx.now(), mode: env.mode };
  }

  async createGitConnection(ctx: T.RequestContext, input: { name: string; provider: T.GitProviderKind; hosting: T.GitHosting; baseUrl?: string; authMethod: T.GitAuthMethod; credentialRef: string; tlsVerify: boolean; enterpriseCa?: boolean; proxy?: string; secret?: string }): Promise<T.GitConnection> {
    this.require(ctx, "organization.manage");
    const org = await this.organization(ctx);
    const plan = planById(org.planId);
    const limit = checkLimit(plan, "gitConnections", await this.store.gitConnections.count({ organizationId: org.id }));
    if (!limit.ok) throw new DomainError("LIMIT_EXCEEDED", `Your ${plan.name} plan allows ${limit.limit} Git connection(s).`);
    if (input.hosting === "SELF_HOSTED" && !input.baseUrl) throw new DomainError("VALIDATION", "Base URL is required for self-hosted providers");
    if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(input.credentialRef)) throw new DomainError("VALIDATION", "Credential reference must be a short slug like github-production");
    // The secret itself is handed to the secret provider and never persisted in application tables.
    if (input.secret) await this.store.credentials.put({ id: newId("cred"), organizationId: org.id, ref: input.credentialRef, provider: org.demo ? "DEMO" : "CLOUDFLARE_SECRET", kind: "GIT", createdAt: ctx.now() });
    const conn: T.GitConnection = { id: newId("git"), organizationId: org.id, name: input.name, provider: input.provider, hosting: input.hosting, baseUrl: input.hosting === "CLOUD" ? (input.provider === "GITHUB" ? "https://api.github.com" : "https://gitlab.com") : input.baseUrl!, authMethod: input.authMethod, credentialRef: input.credentialRef, tlsVerify: input.tlsVerify, enterpriseCa: input.enterpriseCa, proxy: input.proxy, status: "NOT_CONNECTED" };
    await this.store.gitConnections.put(conn);
    await this.audit(ctx, "integration.created", "git_connection", conn.id, conn.name, { risk: "MEDIUM", detail: `credential: ${conn.credentialRef}` });
    return conn;
  }

  /** Connectivity test. Real providers are Phase 2 — returns an honest NOT_CONNECTED unless the connection is a demo fixture. */
  async testGitConnection(ctx: T.RequestContext, id: string): Promise<T.GitConnection> {
    this.require(ctx, "repository.read");
    const conn = this.assertTenant(ctx, await this.store.gitConnections.get(id), "Git connection");
    const org = await this.organization(ctx);
    const status: T.ConnectionStatus = conn.status === "DEMO" ? "DEMO" : "NOT_CONNECTED";
    const updated = { ...conn, status, lastCheckedAt: ctx.now(), lastError: status === "NOT_CONNECTED" ? "Live provider adapter not enabled in this build (Phase 2). Demo mode only." : undefined };
    await this.store.gitConnections.put(updated);
    await this.audit(ctx, "integration.tested", "git_connection", conn.id, conn.name, { result: status === "DEMO" ? "SUCCESS" : "FAILED" });
    if (org.demo && status === "DEMO") return updated;
    return updated;
  }

  // ---------- deployments, incidents ----------
  async deployments(ctx: T.RequestContext) { this.require(ctx, "environment.read"); return (await this.store.deployments.list({ organizationId: ctx.actor.organizationId })).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
  async deployment(ctx: T.RequestContext, id: string) { this.require(ctx, "environment.read"); const d = this.assertTenant(ctx, await this.store.deployments.get(id), "Deployment"); const task = d.taskId ? await this.store.tasks.get(d.taskId) : undefined; return { deployment: d, task }; }
  async incidents(ctx: T.RequestContext) { this.require(ctx, "environment.read"); return (await this.store.incidents.list({ organizationId: ctx.actor.organizationId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async incident(ctx: T.RequestContext, id: string) { this.require(ctx, "environment.read"); const i = this.assertTenant(ctx, await this.store.incidents.get(id), "Incident"); const task = i.taskId ? await this.store.tasks.get(i.taskId) : undefined; const change = i.changeId ? await this.store.changes.get(i.changeId) : undefined; return { incident: i, task, change }; }
  async resolveIncident(ctx: T.RequestContext, id: string, note: string) { this.require(ctx, "change.manage"); const i = this.assertTenant(ctx, await this.store.incidents.get(id), "Incident"); const u: T.Incident = { ...i, status: "RESOLVED", resolvedAt: ctx.now(), summary: `${i.summary}\nResolved by ${ctx.actor.userName}: ${note}` }; await this.store.incidents.put(u); await this.audit(ctx, "incident.resolved", "incident", i.id, i.key); return u; }

  // ---------- audit, notifications ----------
  async auditLogs(ctx: T.RequestContext, filter: { action?: string; actorId?: string; result?: string; search?: string; limit?: number } = {}) {
    this.require(ctx, "audit.read");
    let list = await this.store.auditLogs.list({ organizationId: ctx.actor.organizationId });
    if (filter.action) list = list.filter((a) => a.action.startsWith(filter.action!));
    if (filter.actorId) list = list.filter((a) => a.actorId === filter.actorId);
    if (filter.result) list = list.filter((a) => a.result === filter.result);
    if (filter.search) { const s = filter.search.toLowerCase(); list = list.filter((a) => a.action.includes(s) || (a.resourceLabel ?? "").toLowerCase().includes(s) || a.actorName.toLowerCase().includes(s) || a.correlationId.includes(s)); }
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, filter.limit ?? 500);
  }
  async notifications(ctx: T.RequestContext) { return (await this.store.notifications.list({ organizationId: ctx.actor.organizationId, userId: ctx.actor.userId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async markNotifications(ctx: T.RequestContext, ids: string[] | "all") { const list = await this.notifications(ctx); for (const n of list) if (ids === "all" || ids.includes(n.id)) await this.store.notifications.put({ ...n, read: true }); }

  // ---------- billing ----------
  async billing(ctx: T.RequestContext) {
    this.require(ctx, "billing.read");
    const org = await this.organization(ctx);
    const plan = planById(org.planId);
    const sub = (await this.store.subscriptions.list({ organizationId: org.id }))[0];
    const period = ctx.now().slice(0, 7);
    const usage = (await this.store.usage.list({ organizationId: org.id, period }))[0] ?? { organizationId: org.id, period, users: await this.store.memberships.count({ organizationId: org.id }), agents: await this.store.agents.count({ organizationId: org.id }), environments: await this.store.environments.count({ organizationId: org.id }), activeChanges: (await this.store.changes.list({ organizationId: org.id })).filter((c) => c.status !== "COMPLETED" && c.status !== "CANCELLED").length, taskExecutions: 0, aiRequests: 0, aiRequestsAvoided: 0, aiCostMyr: 0, automationExecutions: 0 };
    const invoices = (await this.store.invoices.list({ organizationId: org.id })).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    const purchases = (await this.store.marketplace.list()).filter((m) => m.installed && m.pricing !== "FREE");
    return {
      plan, plans: PLANS, subscription: sub, usage, invoices, roi: estimateRoi(usage), commissionPct: 30, marketplace: purchases.map((p) => ({ name: p.name, priceMyr: p.priceMyr ?? 0, split: marketplaceSplit(p.priceMyr ?? 0) })),
      meters: [
        { key: "users", label: "Users", used: usage.users, limit: plan.limits.users, pct: usagePct(usage.users, plan.limits.users) },
        { key: "agents", label: "Agents", used: usage.agents, limit: plan.limits.agents, pct: usagePct(usage.agents, plan.limits.agents) },
        { key: "environments", label: "Environments", used: usage.environments, limit: plan.limits.environments, pct: usagePct(usage.environments, plan.limits.environments) },
        { key: "activeChanges", label: "Active Changes", used: usage.activeChanges, limit: plan.limits.activeChanges, pct: usagePct(usage.activeChanges, plan.limits.activeChanges) },
        { key: "taskExecutions", label: "Task executions", used: usage.taskExecutions, limit: plan.limits.taskExecutionsPerMonth, pct: usagePct(usage.taskExecutions, plan.limits.taskExecutionsPerMonth) },
      ],
    };
  }

  async changePlan(ctx: T.RequestContext, planId: string, cycle: "MONTHLY" | "YEARLY" = "MONTHLY"): Promise<T.Subscription> {
    this.require(ctx, "billing.manage");
    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) throw new DomainError("NOT_FOUND", "Plan not found");
    if (plan.priceMonthlyMyr === null) throw new DomainError("VALIDATION", "Enterprise plans are arranged via sales. Contact sales to proceed.");
    const org = await this.organization(ctx);
    const sub = (await this.store.subscriptions.list({ organizationId: org.id }))[0];
    // Payment processing is mocked in Phase 1: the subscription switches immediately and an invoice is generated.
    const updated: T.Subscription = { ...(sub ?? { id: newId("sub"), organizationId: org.id, aiMode: "PLATFORM" as const, currentPeriodStart: ctx.now(), currentPeriodEnd: ctx.now() }), planId, status: "ACTIVE", billingCycle: cycle, currentPeriodStart: ctx.now(), currentPeriodEnd: new Date(Date.now() + (cycle === "YEARLY" ? 365 : 30) * 86400_000).toISOString() };
    await this.store.subscriptions.put(updated);
    await this.store.organizations.put({ ...org, planId, updatedAt: ctx.now() });
    if (plan.priceMonthlyMyr > 0) await this.store.invoices.put({ id: newId("inv"), organizationId: org.id, number: `INV-${ctx.now().slice(0, 4)}-${Math.floor(Math.random() * 9000 + 1000)}`, period: ctx.now().slice(0, 7), amountMyr: cycle === "YEARLY" ? plan.priceMonthlyMyr * 10 : plan.priceMonthlyMyr, status: "OPEN", issuedAt: ctx.now(), lines: [{ label: `${plan.name} plan (${cycle.toLowerCase()}) — DEMO, payment not processed`, amountMyr: cycle === "YEARLY" ? plan.priceMonthlyMyr * 10 : plan.priceMonthlyMyr }] });
    await this.audit(ctx, "billing.plan_changed", "subscription", updated.id, plan.name, { risk: "MEDIUM" });
    return updated;
  }

  async setAiMode(ctx: T.RequestContext, input: { aiMode: "PLATFORM" | "BYOK"; provider?: T.AIProviderKind; credentialRef?: string; secret?: string }): Promise<T.Subscription> {
    this.require(ctx, "billing.manage");
    const org = await this.organization(ctx);
    const sub = (await this.store.subscriptions.list({ organizationId: org.id }))[0];
    if (!sub) throw new DomainError("NOT_FOUND", "Subscription not found");
    if (input.aiMode === "BYOK" && (!input.provider || !input.credentialRef)) throw new DomainError("VALIDATION", "Provider and credential reference are required for BYOK");
    if (input.secret) await this.store.credentials.put({ id: newId("cred"), organizationId: org.id, ref: input.credentialRef!, provider: org.demo ? "DEMO" : "CLOUDFLARE_SECRET", kind: "AI_PROVIDER", createdAt: ctx.now() });
    const updated: T.Subscription = { ...sub, aiMode: input.aiMode, aiProvider: input.provider, aiCredentialRef: input.credentialRef };
    await this.store.subscriptions.put(updated);
    await this.audit(ctx, "billing.ai_mode_changed", "subscription", sub.id, input.aiMode, { risk: "HIGH", detail: input.credentialRef ? `credential: ${input.credentialRef}` : undefined });
    return updated;
  }

  // ---------- marketplace & automations ----------
  async marketplace(ctx: T.RequestContext) { this.require(ctx, "organization.read"); return this.store.marketplace.list(); }
  async installMarketplaceItem(ctx: T.RequestContext, id: string): Promise<T.Automation> {
    this.require(ctx, "automation.create");
    const item = await this.store.marketplace.get(id);
    if (!item) throw new DomainError("NOT_FOUND", "Marketplace item not found");
    if (item.pricing === "ENTERPRISE") throw new DomainError("VALIDATION", "Enterprise-only automations are arranged via sales.");
    for (const p of item.requiredPermissions) this.require(ctx, p);
    await this.store.marketplace.put({ ...item, installed: true, installs: item.installs + 1 });
    const auto: T.Automation = { id: newId("auto"), organizationId: ctx.actor.organizationId, marketplaceItemId: item.id, name: item.name, description: item.description, version: item.version, enabled: true, trigger: "manual", taskDefinitionId: item.tasks[0] && (await this.store.taskDefinitions.get(item.tasks[0])) ? item.tasks[0] : "health-check", runs: 0 };
    await this.store.automations.put(auto);
    await this.audit(ctx, "automation.installed", "automation", auto.id, auto.name, { risk: item.risk, detail: item.pricing !== "FREE" ? `RM${item.priceMyr} — payment mocked in Phase 1` : undefined });
    return auto;
  }
  async automations(ctx: T.RequestContext) { this.require(ctx, "organization.read"); return this.store.automations.list({ organizationId: ctx.actor.organizationId }); }
  async toggleAutomation(ctx: T.RequestContext, id: string, enabled: boolean) { this.require(ctx, "automation.execute"); const a = this.assertTenant(ctx, await this.store.automations.get(id), "Automation"); const u = { ...a, enabled }; await this.store.automations.put(u); await this.audit(ctx, enabled ? "automation.enabled" : "automation.disabled", "automation", a.id, a.name); return u; }

  // ---------- data export / deletion ----------
  async exportMyData(ctx: T.RequestContext, sections: string[] | "all" = "all"): Promise<Record<string, unknown[]>> {
    this.require(ctx, "data.export");
    const org = ctx.actor.organizationId;
    const all: Record<string, () => Promise<unknown[]>> = {
      tasks: () => this.store.tasks.list({ organizationId: org }), agents: () => this.store.agents.list({ organizationId: org }), activity: () => this.store.timeline.list(), jira: async () => (await this.store.changes.list({ organizationId: org })).flatMap((c) => c.jira.map((j) => ({ changeKey: c.key, ...j }))),
      changes: () => this.store.changes.list({ organizationId: org }), approvals: () => this.store.approvals.list({ organizationId: org }), automations: () => this.store.automations.list({ organizationId: org }), auditLogs: () => this.store.auditLogs.list({ organizationId: org }),
      reports: async () => [], aiTelemetry: () => this.store.aiRuns.list({ organizationId: org }), mcpTelemetry: () => this.store.mcpCalls.list({ organizationId: org }), learningData: () => this.store.recommendations.list({ organizationId: org }),
    };
    const out: Record<string, unknown[]> = {};
    for (const [k, fn] of Object.entries(all)) if (sections === "all" || sections.includes(k)) out[k] = redactObject(await fn());
    await this.audit(ctx, "data.export", "export", "my-data", sections === "all" ? "Download everything" : sections.join(","), { risk: "MEDIUM" });
    return out;
  }

  async requestDeletion(ctx: T.RequestContext, phrase: string): Promise<{ scheduledFor: string }> {
    this.require(ctx, "organization.manage");
    const org = await this.organization(ctx);
    if (phrase !== `DELETE ${org.name.toUpperCase()}`) throw new DomainError("VALIDATION", `Type “DELETE ${org.name.toUpperCase()}” to confirm`);
    const scheduledFor = new Date(Date.now() + org.retention.auditLogDays * 86400_000).toISOString();
    await this.audit(ctx, "data.deletion_requested", "organization", org.id, org.name, { risk: "CRITICAL", detail: `Retention hold until ${scheduledFor.slice(0, 10)}` });
    return { scheduledFor };
  }
}
