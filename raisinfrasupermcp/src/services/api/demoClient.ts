import type { ApiClient, Session } from "./client";
import { ApiError } from "./client";
import { createMemoryStore, type MemoryStore } from "@/domain/repository/memory";
import { seedDemo, DEMO } from "@/domain/seed/demo";
import { createSuperMcp, resolveActor, makeContext, type SuperMcp } from "@/domain/services";
import type { RequestContext, Task } from "@/domain/types";
import { DomainError } from "@/domain/types";
import { hash, newId } from "@/domain/ids";

const STORAGE_KEY = "supermcp.demo.v1";
const SESSION_KEY = "supermcp.demo.session";

/**
 * DEMO mode client: the whole platform runs in the browser against MockAgent/MockGitHub/MockJira data.
 * State persists to localStorage so the Change Journey survives reloads. Nothing touches real infrastructure.
 */
export class DemoClient implements ApiClient {
  readonly mode = "DEMO" as const;
  private store: MemoryStore;
  private app: SuperMcp;
  private session: Session | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private ready: Promise<void>;

  constructor() {
    this.store = createMemoryStore(() => this.scheduleSave());
    this.app = createSuperMcp(this.store);
    this.ready = this.init();
  }

  private async init() {
    let restored = false;
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { this.store.restore(JSON.parse(raw)); restored = true; } } catch { /* fresh start */ }
    if (!restored) await seedDemo(this.store);
    try { const s = localStorage.getItem(SESSION_KEY); if (s) { const { userId, organizationId } = JSON.parse(s); this.session = await this.buildSession(userId, organizationId); } } catch { this.session = null; }
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store.snapshot())); } catch { /* quota */ } }, 300);
  }

  private async buildSession(userId: string, organizationId: string): Promise<Session> {
    const user = await this.store.users.get(userId);
    if (!user) throw new ApiError("NOT_FOUND", "User not found");
    const organizations = await this.app.platform.organizationsForUser(userId);
    const organization = organizations.find((o) => o.id === organizationId) ?? organizations[0];
    if (!organization) throw new ApiError("FORBIDDEN", "No organization membership");
    const actor = await resolveActor(this.store, userId, organization.id);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, organizationId: organization.id }));
    return { user, organization, organizations, actor, mode: "DEMO" };
  }

  private ctx(mode: RequestContext["executionMode"] = "HUMAN"): RequestContext {
    if (!this.session) throw new ApiError("UNAUTHENTICATED", "Please sign in");
    return makeContext(this.session.actor, mode);
  }

  private async wrap<R>(fn: () => Promise<R>): Promise<R> {
    await this.ready;
    try { return await fn(); }
    catch (e) {
      if (e instanceof DomainError) throw new ApiError(e.code, e.message, e.detail);
      if (e instanceof Error && "permission" in e) throw new ApiError("FORBIDDEN", e.message);
      throw e;
    }
  }

  auth: ApiClient["auth"] = {
    session: async () => { await this.ready; return this.session; },
    login: async (email, password) => this.wrap(async () => {
      const user = (await this.store.users.list((u) => u.email.toLowerCase() === email.toLowerCase()))[0];
      const pw = user ? (await this.store.passwords.list({ userId: user.id }))[0] : undefined;
      if (!user || !pw || pw.hash !== hash(password + ":" + user.id)) throw new ApiError("UNAUTHENTICATED", "Incorrect email or password. Demo users: ahmad@abc.example / sarah@abc.example / daniel@abc.example with password demo1234.");
      await this.store.users.put({ ...user, lastLoginAt: new Date().toISOString() });
      this.session = await this.buildSession(user.id, (await this.app.platform.organizationsForUser(user.id))[0].id);
      await this.store.auditLogs.put({ id: newId("aud"), organizationId: this.session.organization.id, actorId: user.id, actorName: user.name, action: "auth.login", resourceType: "user", resourceId: user.id, resourceLabel: user.name, timestamp: new Date().toISOString(), result: "SUCCESS", risk: "LOW", correlationId: newId("cor"), executionMode: "HUMAN" });
      return this.session;
    }),
    demoLogin: async (userId) => this.wrap(async () => { this.session = await this.buildSession(userId, DEMO.orgId); return this.session; }),
    register: async (input) => this.wrap(async () => {
      if (!input.email.includes("@") || input.password.length < 8) throw new ApiError("VALIDATION", "Valid email and a password of at least 8 characters are required");
      if ((await this.store.users.list((u) => u.email.toLowerCase() === input.email.toLowerCase())).length) throw new ApiError("VALIDATION", "An account with this email already exists");
      const user = { id: newId("usr"), email: input.email.toLowerCase(), name: input.name, avatarInitials: input.name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase(), verification: { status: "NOT_STARTED" as const }, createdAt: new Date().toISOString() };
      await this.store.users.put(user);
      await this.store.passwords.put({ id: newId("pwd"), userId: user.id, hash: hash(input.password + ":" + user.id), salt: user.id, algorithm: "PBKDF2-SHA256" });
      const org = await this.app.platform.createOrganization(user.id, user.name, { name: input.organizationName, type: input.organizationType });
      this.session = await this.buildSession(user.id, org.id);
      return this.session;
    }),
    logout: async () => { if (this.session) await this.store.auditLogs.put({ id: newId("aud"), organizationId: this.session.organization.id, actorId: this.session.user.id, actorName: this.session.user.name, action: "auth.logout", resourceType: "user", resourceId: this.session.user.id, timestamp: new Date().toISOString(), result: "SUCCESS", risk: "LOW", correlationId: newId("cor"), executionMode: "HUMAN" }); this.session = null; localStorage.removeItem(SESSION_KEY); },
    switchOrganization: async (organizationId) => this.wrap(async () => { this.session = await this.buildSession(this.session!.user.id, organizationId); return this.session; }),
  };

  dashboard = () => this.wrap(() => this.app.dashboard.get(this.ctx()));
  command = (text: string) => this.wrap(() => this.app.command.run(this.ctx(), text));

  changes: ApiClient["changes"] = {
    list: (f) => this.wrap(() => this.app.changes.list(this.ctx(), f)),
    get: (id) => this.wrap(() => this.app.changes.get(this.ctx(), id)),
    plan: (intent) => this.wrap(() => this.app.changes.plan(this.ctx(), intent)),
    create: (input) => this.wrap(() => this.app.changes.create(this.ctx(), input)),
    update: (id, patch) => this.wrap(() => this.app.changes.update(this.ctx(), id, patch)),
    confirmRequirements: (id, r) => this.wrap(() => this.app.changes.confirmRequirements(this.ctx(), id, r)),
    syncJira: (id) => this.wrap(() => this.app.changes.syncJira(this.ctx(), id)),
    skipStage: (id, key, reason) => this.wrap(() => this.app.changes.skipStage(this.ctx(), id, key, reason)),
    gitEvent: (id, event) => this.wrap(() => this.app.changes.gitEvent(this.ctx(), id, event, "WEBHOOK")),
    toggleChecklist: (id, itemId, state) => this.wrap(() => this.app.changes.toggleChecklist(this.ctx(), id, itemId, state)),
    requestDeployment: (id) => this.wrap(() => this.app.changes.requestDeployment(this.ctx(), id)),
    recordUat: (id, result, note) => this.wrap(() => this.app.changes.recordUat(this.ctx(), id, result, note)),
    close: (id, outcome) => this.wrap(() => this.app.changes.close(this.ctx(), id, outcome)),
    cancel: (id, reason) => this.wrap(() => this.app.changes.cancel(this.ctx(), id, reason)),
    comment: (id, text) => this.wrap(() => this.app.changes.comment(this.ctx(), id, text)),
  };

  tasks: ApiClient["tasks"] = {
    list: (f) => this.wrap(() => this.app.tasks.list(this.ctx(), f)),
    get: (id) => this.wrap(() => this.app.tasks.get(this.ctx(), id)),
    definitions: async () => this.app.tasks.definitions(),
    create: (input) => this.wrap(() => this.app.tasks.create(this.ctx(), input)),
    execute: (id, onUpdate?: (t: Task) => void) => this.wrap(() => this.app.tasks.execute(this.ctx(), id, { speed: 0.35, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), onUpdate })),
    cancel: (id) => this.wrap(() => this.app.tasks.cancel(this.ctx(), id)),
  };

  approvals: ApiClient["approvals"] = {
    list: (f) => this.wrap(() => this.app.approvals.list(this.ctx(), f)),
    get: (id) => this.wrap(() => this.app.approvals.get(this.ctx(), id)),
    decide: (id, d, c, t) => this.wrap(() => this.app.approvals.decide(this.ctx(), id, d, c, t)),
  };

  policies: ApiClient["policies"] = {
    list: () => this.wrap(() => this.app.policies.list(this.ctx())),
    get: (id) => this.wrap(() => this.app.policies.get(this.ctx(), id)),
    save: (input) => this.wrap(() => this.app.policies.save(this.ctx(), input)),
    toggle: (id, enabled) => this.wrap(() => this.app.policies.toggle(this.ctx(), id, enabled)),
    remove: (id) => this.wrap(() => this.app.policies.remove(this.ctx(), id)),
    simulate: (input) => this.wrap(() => this.app.policies.simulate(this.ctx(), input)),
  };

  platform: ApiClient["platform"] = {
    organization: () => this.wrap(() => this.app.platform.organization(this.ctx())),
    updateOrganization: (p) => this.wrap(async () => { const o = await this.app.platform.updateOrganization(this.ctx(), p); this.session = await this.buildSession(this.session!.user.id, o.id); return o; }),
    requestVerification: (k, p) => this.wrap(() => this.app.platform.requestVerification(this.ctx(), k, p)),
    members: () => this.wrap(() => this.app.platform.members(this.ctx())),
    invite: (i) => this.wrap(() => this.app.platform.invite(this.ctx(), i)),
    updateMembership: (id, p) => this.wrap(() => this.app.platform.updateMembership(this.ctx(), id, p)),
    groups: () => this.wrap(() => this.app.platform.groups(this.ctx())),
    saveGroup: (i) => this.wrap(() => this.app.platform.saveGroup(this.ctx(), i)),
    roles: () => this.wrap(() => this.app.platform.roles(this.ctx())),
    saveRole: (i) => this.wrap(() => this.app.platform.saveRole(this.ctx(), i)),
    agents: () => this.wrap(() => this.app.platform.agents(this.ctx())),
    agent: (id) => this.wrap(() => this.app.platform.agent(this.ctx(), id)),
    agentAction: (id, a) => this.wrap(() => this.app.platform.agentAction(this.ctx(), id, a)),
    registerAgent: (i) => this.wrap(() => this.app.platform.registerAgent(this.ctx(), i)),
    environments: () => this.wrap(() => this.app.platform.environments(this.ctx())),
    environmentSnapshot: (id) => this.wrap(() => this.app.platform.environmentSnapshot(this.ctx(), id)),
    servers: () => this.wrap(() => this.app.platform.servers(this.ctx())),
    applications: () => this.wrap(() => this.app.platform.applications(this.ctx())),
    repositories: () => this.wrap(() => this.app.platform.repositories(this.ctx())),
    gitConnections: () => this.wrap(() => this.app.platform.gitConnections(this.ctx())),
    createGitConnection: (i) => this.wrap(() => this.app.platform.createGitConnection(this.ctx(), i)),
    testGitConnection: (id) => this.wrap(() => this.app.platform.testGitConnection(this.ctx(), id)),
    integrations: () => this.wrap(() => this.app.platform.integrations(this.ctx())),
    credentials: () => this.wrap(() => this.app.platform.credentials(this.ctx())),
    deployments: () => this.wrap(() => this.app.platform.deployments(this.ctx())),
    deployment: (id) => this.wrap(() => this.app.platform.deployment(this.ctx(), id)),
    incidents: () => this.wrap(() => this.app.platform.incidents(this.ctx())),
    incident: (id) => this.wrap(() => this.app.platform.incident(this.ctx(), id)),
    resolveIncident: (id, n) => this.wrap(() => this.app.platform.resolveIncident(this.ctx(), id, n)),
    auditLogs: (f) => this.wrap(() => this.app.platform.auditLogs(this.ctx(), f)),
    notifications: () => this.wrap(() => this.app.platform.notifications(this.ctx())),
    markNotifications: (ids) => this.wrap(() => this.app.platform.markNotifications(this.ctx(), ids)),
    billing: () => this.wrap(() => this.app.platform.billing(this.ctx())),
    changePlan: (p, c) => this.wrap(async () => { const s = await this.app.platform.changePlan(this.ctx(), p, c); this.session = await this.buildSession(this.session!.user.id, this.session!.organization.id); return s; }),
    setAiMode: (i) => this.wrap(() => this.app.platform.setAiMode(this.ctx(), i)),
    marketplace: () => this.wrap(() => this.app.platform.marketplace(this.ctx())),
    installMarketplaceItem: (id) => this.wrap(() => this.app.platform.installMarketplaceItem(this.ctx(), id)),
    automations: () => this.wrap(() => this.app.platform.automations(this.ctx())),
    toggleAutomation: (id, e) => this.wrap(() => this.app.platform.toggleAutomation(this.ctx(), id, e)),
    exportMyData: (s) => this.wrap(() => this.app.platform.exportMyData(this.ctx(), s)),
    requestDeletion: (p) => this.wrap(() => this.app.platform.requestDeletion(this.ctx(), p)),
  };

  telemetry: ApiClient["telemetry"] = {
    summary: (d) => this.wrap(() => this.app.telemetry.summary(this.ctx(), d)),
    runs: (f) => this.wrap(() => this.app.telemetry.runs(this.ctx(), f as never)),
    run: (id) => this.wrap(() => this.app.telemetry.run(this.ctx(), id)),
    calls: (f) => this.wrap(() => this.app.telemetry.calls(this.ctx(), f as never)),
    toolAnalytics: () => this.wrap(() => this.app.telemetry.toolAnalytics(this.ctx())),
    recommendations: () => this.wrap(() => this.app.telemetry.recommendations(this.ctx())),
    updateRecommendation: (id, s) => this.wrap(() => this.app.telemetry.updateRecommendation(this.ctx(), id, s)),
    analyze: () => this.wrap(() => this.app.telemetry.analyze(this.ctx())),
    learning: () => this.wrap(() => this.app.telemetry.learning(this.ctx())),
    exportLearningData: () => this.wrap(() => this.app.telemetry.exportLearningData(this.ctx())),
  };

  demoLab: ApiClient["demoLab"] = {
    scenarios: async () => this.app.demoLab.scenarios(),
    prepare: (id) => this.wrap(() => this.app.demoLab.prepare(this.ctx(), id)),
    reset: async () => { const userId = this.session?.user.id; this.store.reset(); localStorage.removeItem(STORAGE_KEY); await seedDemo(this.store); if (userId) { try { this.session = await this.buildSession(userId, DEMO.orgId); } catch { this.session = null; } } },
  };
}
