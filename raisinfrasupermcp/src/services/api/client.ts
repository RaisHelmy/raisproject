/**
 * Frontend API boundary. Two implementations:
 *  - DemoClient: runs the domain in-process against an in-memory store persisted to localStorage (DEMO mode).
 *  - HttpClient: calls the Cloudflare Worker (/api). Same surface, so pages don't care.
 */
import type * as T from "@/domain/types";
import type { ChangeDetail, CreateChangeInput, Dashboard, CommandResult, ApprovalDetail, TelemetrySummary, CreateTaskInput, DemoScenarioStep } from "@/domain/services";
import type { ChangePlan } from "@/domain/ai/provider";
import type { SimulationInput } from "@/domain/services/policyService";
import type { Decision } from "@/domain/engines/approval";

export interface Session { user: T.User; organization: T.Organization; organizations: (T.Organization & { roleKeys: string[] })[]; actor: T.Actor; mode: "DEMO" | "CONNECTED" }

export interface ApiClient {
  readonly mode: "DEMO" | "CONNECTED";
  auth: {
    session(): Promise<Session | null>;
    login(email: string, password: string): Promise<Session>;
    register(input: { name: string; email: string; password: string; organizationName: string; organizationType: T.OrganizationType }): Promise<Session>;
    logout(): Promise<void>;
    switchOrganization(organizationId: string): Promise<Session>;
    demoLogin(userId: string): Promise<Session>;
  };
  dashboard(): Promise<Dashboard>;
  command(text: string): Promise<CommandResult>;
  changes: {
    list(filter?: { view?: "all" | "mine" | "blocked" | "awaiting" | "completed" | "active"; search?: string }): Promise<(T.Change & { progress: number; stageName: string })[]>;
    get(id: string): Promise<ChangeDetail>;
    plan(intent: string): Promise<{ plan: ChangePlan; aiRunId: string; provider: T.AIProviderKind; model: string }>;
    create(input: CreateChangeInput): Promise<T.Change>;
    update(id: string, patch: Record<string, unknown>): Promise<T.Change>;
    confirmRequirements(id: string, requirements?: string[]): Promise<T.Change>;
    syncJira(id: string): Promise<T.Change>;
    skipStage(id: string, key: T.ChangeStageKey, reason: string): Promise<T.Change>;
    gitEvent(id: string, event: { type: "COMMITS" | "PR_OPENED" | "PR_MERGED" | "CI_PASSED" | "CI_FAILED"; commits?: number; prNumber?: number }): Promise<T.Change>;
    toggleChecklist(id: string, itemId: string, state: T.ChecklistItem["state"]): Promise<T.Change>;
    requestDeployment(id: string): Promise<{ change: T.Change; task: T.Task; approvalRequestId?: string }>;
    recordUat(id: string, result: "PASSED" | "FAILED", note: string): Promise<T.Change>;
    close(id: string, outcome: string): Promise<T.Change>;
    cancel(id: string, reason: string): Promise<T.Change>;
    comment(id: string, text: string): Promise<T.TimelineEvent>;
  };
  tasks: {
    list(filter?: { status?: "active" | "scheduled" | "completed" | "failed"; changeId?: string }): Promise<T.Task[]>;
    get(id: string): Promise<{ task: T.Task; definition?: T.TaskDefinition; deployment?: T.Deployment; aiRequestsAvoided: number }>;
    definitions(): Promise<T.TaskDefinition[]>;
    create(input: CreateTaskInput): Promise<{ task: T.Task; approvalRequestId?: string }>;
    execute(id: string, onUpdate?: (task: T.Task) => void): Promise<T.Task>;
    cancel(id: string): Promise<T.Task>;
  };
  approvals: {
    list(filter?: { status?: T.ApprovalStatus; mine?: boolean }): Promise<(T.ApprovalRequest & { canDecide: boolean })[]>;
    get(id: string): Promise<ApprovalDetail>;
    decide(id: string, decision: Decision, comment?: string, typedConfirmation?: string): Promise<{ request: T.ApprovalRequest; unlockedTaskId?: string }>;
  };
  policies: {
    list(): Promise<T.Policy[]>;
    get(id: string): Promise<T.Policy>;
    save(input: Partial<T.Policy> & { name: string; when: T.PolicyCondition; then: T.PolicyEffect }): Promise<T.Policy>;
    toggle(id: string, enabled: boolean): Promise<T.Policy>;
    remove(id: string): Promise<void>;
    simulate(input: SimulationInput): Promise<T.PolicyDecision & { subject: string; environmentName?: string }>;
  };
  platform: {
    organization(): Promise<T.Organization>;
    updateOrganization(patch: Partial<Pick<T.Organization, "name" | "approvalMode" | "retention">>): Promise<T.Organization>;
    requestVerification(kind: "ORGANIZATION" | "USER", provider: string): Promise<T.Verification>;
    members(): Promise<(T.Membership & { user: T.User; roleNames: string[]; groupNames: string[] })[]>;
    invite(input: { email: string; name: string; roleIds: string[]; groupIds?: string[] }): Promise<T.Membership>;
    updateMembership(id: string, patch: { roleIds?: string[]; groupIds?: string[]; status?: T.MembershipStatus }): Promise<T.Membership>;
    groups(): Promise<(T.Group & { memberCount: number })[]>;
    saveGroup(input: { id?: string; name: string; description?: string }): Promise<T.Group>;
    roles(): Promise<(T.Role & { memberCount: number })[]>;
    saveRole(input: { id?: string; name: string; description: string; permissions: T.Permission[] }): Promise<T.Role>;
    agents(): Promise<T.Agent[]>;
    agent(id: string): Promise<T.Agent>;
    agentAction(id: string, action: "APPROVE" | "QUARANTINE" | "RELEASE" | "DISABLE" | "ENABLE" | "REVOKE" | "UPDATE"): Promise<T.Agent>;
    registerAgent(input: { name: string; os: T.Agent["os"]; arch: T.Agent["arch"]; environmentId?: string }): Promise<{ agent: T.Agent; registrationToken: string }>;
    environments(): Promise<T.Environment[]>;
    environmentSnapshot(id: string): Promise<unknown>;
    servers(): Promise<T.Server[]>;
    applications(): Promise<T.Application[]>;
    repositories(): Promise<T.Repository[]>;
    gitConnections(): Promise<T.GitConnection[]>;
    createGitConnection(input: { name: string; provider: T.GitProviderKind; hosting: T.GitHosting; baseUrl?: string; authMethod: T.GitAuthMethod; credentialRef: string; tlsVerify: boolean; enterpriseCa?: boolean; proxy?: string; secret?: string }): Promise<T.GitConnection>;
    testGitConnection(id: string): Promise<T.GitConnection>;
    integrations(): Promise<T.Integration[]>;
    credentials(): Promise<T.CredentialReference[]>;
    deployments(): Promise<T.Deployment[]>;
    deployment(id: string): Promise<{ deployment: T.Deployment; task?: T.Task }>;
    incidents(): Promise<T.Incident[]>;
    incident(id: string): Promise<{ incident: T.Incident; task?: T.Task; change?: T.Change }>;
    resolveIncident(id: string, note: string): Promise<T.Incident>;
    auditLogs(filter?: { action?: string; actorId?: string; result?: string; search?: string; limit?: number }): Promise<T.AuditLog[]>;
    notifications(): Promise<T.Notification[]>;
    markNotifications(ids: string[] | "all"): Promise<void>;
    billing(): Promise<BillingSummary>;
    changePlan(planId: string, cycle?: "MONTHLY" | "YEARLY"): Promise<T.Subscription>;
    setAiMode(input: { aiMode: "PLATFORM" | "BYOK"; provider?: T.AIProviderKind; credentialRef?: string; secret?: string }): Promise<T.Subscription>;
    marketplace(): Promise<T.MarketplaceItem[]>;
    installMarketplaceItem(id: string): Promise<T.Automation>;
    automations(): Promise<T.Automation[]>;
    toggleAutomation(id: string, enabled: boolean): Promise<T.Automation>;
    exportMyData(sections?: string[] | "all"): Promise<Record<string, unknown[]>>;
    requestDeletion(phrase: string): Promise<{ scheduledFor: string }>;
  };
  telemetry: {
    summary(days?: number): Promise<TelemetrySummary>;
    runs(filter?: Record<string, string | number | undefined>): Promise<T.AIRun[]>;
    run(id: string): Promise<{ run: T.AIRun; calls: T.MCPCall[]; tasks: T.Task[] }>;
    calls(filter?: Record<string, string | number | boolean | undefined>): Promise<T.MCPCall[]>;
    toolAnalytics(): Promise<{ usage: T.MCPToolUsage[]; overuse: { toolName: string; maxPerRun: number; runs: number; suggestion: string; estimatedReductionPct: number }[]; redundant: { toolName: string; redundant: number; total: number; pct: number }[] }>;
    recommendations(): Promise<T.OptimizationRecommendation[]>;
    updateRecommendation(id: string, status: T.OptimizationRecommendation["status"]): Promise<T.OptimizationRecommendation>;
    analyze(): Promise<{ added: number; patterns: number }>;
    learning(): Promise<{ patterns: T.ProblemPattern[]; knowledge: T.KnowledgeRecord[]; failures: T.AIFailure[]; recoveries: T.AIRecovery[]; interventions: T.HumanIntervention[]; experiments: T.AIExperiment[]; issues: T.Issue[] }>;
    exportLearningData(): Promise<Record<string, unknown[]>>;
  };
  demoLab: {
    scenarios(): Promise<{ id: string; title: string; description: string; scenario: T.DemoFailureScenario }[]>;
    prepare(id: string): Promise<{ changeId?: string; taskId?: string; approvalRequestId?: string; steps: DemoScenarioStep[] }>;
    reset(): Promise<void>;
  };
}

export interface BillingSummary {
  plan: T.Plan; plans: T.Plan[]; subscription?: T.Subscription; usage: T.UsageRecord; invoices: T.Invoice[]; roi: { estimatedEngineeringHoursSaved: number; estimatedSavingsMyr: number; isEstimate: true }; commissionPct: number;
  marketplace: { name: string; priceMyr: number; split: { publisher: number; platform: number } }[];
  meters: { key: string; label: string; used: number; limit: number | null; pct: number | null }[];
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public detail?: Record<string, unknown>) { super(message); this.name = "ApiError"; }
}
