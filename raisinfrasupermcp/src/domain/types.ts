/**
 * Super MCP domain model.
 * Pure TypeScript — no framework, no database coupling.
 * The same types are used by the browser (demo mode), the Cloudflare Worker and the tests.
 */

export type ISODate = string;

// ---------------------------------------------------------------------------
// Identity & tenancy
// ---------------------------------------------------------------------------

export type OrganizationType = "PERSONAL" | "COMPANY";
export type ApprovalMode = "AUTOMATIC" | "ROUTED";
export type VerificationStatus = "NOT_STARTED" | "PENDING" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED";
export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
export type ConnectionStatus = "DEMO" | "CONNECTED" | "NOT_CONNECTED" | "ERROR";
export type DataClassification = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";

export interface Verification {
  status: VerificationStatus;
  provider?: string;
  reference?: string;
  requestedAt?: ISODate;
  reviewedAt?: ISODate;
  expiresAt?: ISODate;
  note?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  approvalMode: ApprovalMode;
  planId: string;
  demo: boolean;
  verification: Verification;
  retention: RetentionPolicy;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface RetentionPolicy {
  aiRequestMetadataDays: number;
  mcpTelemetryDays: number;
  taskExecutionDays: number;
  changeEvidenceDays: number;
  auditLogDays: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarInitials: string;
  verification: Verification;
  createdAt: ISODate;
  lastLoginAt?: ISODate;
}

export interface Membership {
  id: string;
  organizationId: string;
  userId: string;
  status: MembershipStatus;
  roleIds: string[];
  groupIds: string[];
  invitedBy?: string;
  createdAt: ISODate;
}

export interface Group {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  builtIn: boolean;
}

export interface Role {
  id: string;
  organizationId: string | null; // null = platform default role
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  builtIn: boolean;
}

export type Permission =
  | "organization.read" | "organization.manage"
  | "user.read" | "user.invite" | "user.remove"
  | "group.read" | "group.manage"
  | "role.read" | "role.manage"
  | "agent.read" | "agent.execute" | "agent.update" | "agent.quarantine"
  | "environment.read" | "environment.execute" | "environment.restart" | "environment.shutdown"
  | "server.read" | "server.install" | "server.configure" | "server.restart"
  | "docker.read" | "docker.deploy" | "docker.restart"
  | "proxmox.read" | "proxmox.vm.create" | "proxmox.vm.start" | "proxmox.vm.stop" | "proxmox.vm.delete"
  | "repository.read" | "repository.clone" | "repository.build"
  | "deployment.create" | "deployment.rollback"
  | "database.read" | "database.migrate" | "database.backup" | "database.restore"
  | "jira.read" | "jira.write" | "jira.worklog"
  | "change.read" | "change.create" | "change.manage"
  | "task.create" | "task.execute" | "task.approve" | "task.reject" | "task.cancel"
  | "automation.create" | "automation.execute"
  | "audit.read"
  | "security.manage" | "policy.manage"
  | "billing.read" | "billing.manage"
  | "analytics.read"
  | "data.export";

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export type AgentStatus = "REGISTERING" | "PENDING_APPROVAL" | "ACTIVE" | "DEGRADED" | "QUARANTINED" | "DISABLED" | "REVOKED";
export type AgentCapability =
  | "filesystem" | "process" | "service" | "package-manager" | "network" | "docker" | "git"
  | "database" | "proxmox" | "application" | "deployment" | "monitoring" | "diagnostics";

export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  status: AgentStatus;
  mode: ConnectionStatus;
  capabilities: AgentCapability[];
  version: string;
  os: "linux" | "windows" | "macos";
  arch: "x64" | "arm64";
  hostname: string;
  environmentId?: string;
  lastSeenAt: ISODate;
  registeredAt: ISODate;
  policyId?: string;
  identity: { fingerprint: string; certificateExpiresAt?: ISODate };
  health: { cpu: number; memory: number; disk: number; latencyMs: number };
  repoCache?: { repositoryId: string; branch: string; commit: string; lastFetchAt: ISODate; sizeMb: number; healthy: boolean }[];
}

export type EnvironmentKind = "DEVELOPMENT" | "STAGING" | "PRODUCTION";
export type HealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";

export interface Environment {
  id: string;
  organizationId: string;
  name: string;
  kind: EnvironmentKind;
  agentId?: string;
  mode: ConnectionStatus;
  health: HealthStatus;
  url?: string;
  servers: string[]; // server ids
}

export interface Server {
  id: string;
  organizationId: string;
  environmentId: string;
  name: string;
  host: string;
  os: string;
  kind: "VM" | "BARE_METAL" | "CONTAINER_HOST";
  proxmoxVmId?: number;
  proxmoxNode?: string;
  cpu: number;
  memoryGb: number;
  diskGb: number;
  status: "RUNNING" | "STOPPED" | "DEGRADED";
  components: Record<string, string>; // e.g. docker: "26.1", nginx: "1.25"
}

export interface Application {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  repositoryId: string;
  runtime: string;
  deployedVersions: Record<string, string>; // environmentId -> version
}

export type GitProviderKind = "GITHUB" | "GITLAB";
export type GitHosting = "CLOUD" | "SELF_HOSTED";
export type GitAuthMethod = "OAUTH" | "APP" | "PAT" | "SERVICE_CREDENTIAL";

export interface GitConnection {
  id: string;
  organizationId: string;
  name: string;
  provider: GitProviderKind;
  hosting: GitHosting;
  baseUrl: string;
  authMethod: GitAuthMethod;
  credentialRef: string; // never the secret
  tlsVerify: boolean;
  enterpriseCa?: boolean;
  proxy?: string;
  status: ConnectionStatus;
  lastCheckedAt?: ISODate;
  lastError?: string;
}

export interface Repository {
  id: string;
  organizationId: string;
  connectionId: string;
  name: string;
  fullName: string;
  provider: GitProviderKind;
  url: string;
  defaultBranch: string;
  detectedStack: string[];
  lastCommit?: { sha: string; message: string; author: string; at: ISODate };
}

export interface Integration {
  id: string;
  organizationId: string;
  kind: "JIRA" | "SLACK" | "TEAMS" | "EMAIL" | "PROXMOX" | "DOCKER" | "WEBHOOK";
  name: string;
  baseUrl?: string;
  credentialRef?: string;
  status: ConnectionStatus;
  config: Record<string, string | number | boolean>;
}

export interface CredentialReference {
  id: string;
  organizationId: string;
  ref: string; // e.g. github-production
  provider: "VAULT" | "CLOUDFLARE_SECRET" | "ENV" | "DEMO";
  kind: "GIT" | "JIRA" | "PROXMOX" | "DATABASE" | "AI_PROVIDER" | "GENERIC";
  createdAt: ISODate;
  lastUsedAt?: ISODate;
  rotatedAt?: ISODate;
}

// ---------------------------------------------------------------------------
// Change (the central object)
// ---------------------------------------------------------------------------

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ChangeStageKey =
  | "INTENTION" | "REQUIREMENTS" | "JIRA" | "DEVELOPMENT" | "REVIEW" | "TESTING"
  | "DEPLOYMENT_PREPARATION" | "APPROVAL" | "DEPLOYMENT" | "LIVE_VALIDATION" | "UAT" | "CLOSURE";

export type StageState = "PENDING" | "ACTIVE" | "BLOCKED" | "COMPLETED" | "SKIPPED" | "FAILED";
export type ChangeStatus = "DRAFT" | "ACTIVE" | "BLOCKED" | "AWAITING_APPROVAL" | "DEPLOYING" | "COMPLETED" | "CANCELLED";

export type ImpactComponent = "Frontend" | "Backend" | "Database" | "File Storage" | "Infrastructure" | "External API" | "Mobile";
export type ImpactStatus = "AFFECTED" | "NO_CHANGE" | "REVIEW";

export interface ChangeImpact {
  component: ImpactComponent;
  status: ImpactStatus;
  note?: string;
}

export interface ChangeStage {
  key: ChangeStageKey;
  name: string;
  order: number;
  state: StageState;
  ownerId?: string;
  startedAt?: ISODate;
  completedAt?: ISODate;
  progress: number; // 0..100
}

export type ChecklistCategory = "Frontend" | "Backend" | "Database" | "Infrastructure" | "Security" | "General";

export interface ChecklistItem {
  id: string;
  stageKey: ChangeStageKey;
  category: ChecklistCategory;
  title: string;
  required: boolean;
  state: "PENDING" | "DONE" | "FAILED" | "WAIVED";
  automated: boolean;
  evidenceId?: string;
}

export interface ChangeBlocker {
  id: string;
  title: string;
  reason: string;
  missing: string[];
  waitingFor?: { userId?: string; roleKey?: string; label: string };
  approvalRequestId?: string;
  stageKey: ChangeStageKey;
  createdAt: ISODate;
  resolvedAt?: ISODate;
}

export type EvidenceType =
  | "REQUIREMENTS" | "JIRA_ISSUE" | "GIT_COMMIT" | "PULL_REQUEST" | "CI_RESULT" | "TEST_RESULT"
  | "DOCKER_IMAGE" | "DEPLOYMENT_LOG" | "SERVER_HEALTH" | "APPROVAL" | "SMOKE_TEST" | "UAT_RESULT" | "ROLLBACK" | "INCIDENT";

export interface ChangeEvidence {
  id: string;
  changeId: string;
  stageKey: ChangeStageKey;
  type: EvidenceType;
  title: string;
  reference?: string;
  summary?: string;
  source: ExecutionMode;
  createdAt: ISODate;
  classification: DataClassification;
}

export interface TimelineEvent {
  id: string;
  changeId: string;
  at: ISODate;
  kind: "STAGE" | "TASK" | "APPROVAL" | "DEPLOYMENT" | "INCIDENT" | "COMMENT" | "SYSTEM" | "AI";
  message: string;
  actor: string; // user name, "Task Engine", "AI", "Agent"
  executionMode: ExecutionMode;
}

export interface JiraLink {
  key: string;
  type: "Epic" | "Story" | "Task" | "Bug";
  title: string;
  status: string;
  url?: string;
}

export interface Change {
  id: string;
  organizationId: string;
  key: string; // CHG-104
  title: string;
  description: string;
  intent: string;
  status: ChangeStatus;
  risk: RiskLevel;
  ownerId: string;
  requestedById: string;
  applicationId?: string;
  repositoryId?: string;
  targetEnvironmentId?: string;
  version?: string;
  stages: ChangeStage[];
  currentStageKey: ChangeStageKey;
  impacts: ChangeImpact[];
  checklist: ChecklistItem[];
  blockers: ChangeBlocker[];
  requirements: string[];
  jira: JiraLink[];
  git: { branch?: string; commits: number; pullRequest?: { number: number; state: "OPEN" | "MERGED" | "CLOSED"; url?: string }; ciStatus?: "PENDING" | "RUNNING" | "PASSED" | "FAILED" };
  rollbackPlan: string[];
  dependencies: string[]; // change ids
  demoScenario?: DemoFailureScenario;
  createdAt: ISODate;
  updatedAt: ISODate;
  closedAt?: ISODate;
  analytics: ChangeAnalytics;
}

export interface ChangeAnalytics {
  aiRunCount: number;
  mcpCallCount: number;
  taskCount: number;
  agentOperationCount: number;
  failures: number;
  recoveries: number;
  rollbacks: number;
  humanInterventions: number;
  blockedMinutes: number;
  waitingMinutes: number;
  stageMinutes: Partial<Record<ChangeStageKey, number>>;
}

export interface NextAction {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  title: string;
  description: string;
  changeId?: string;
  changeKey?: string;
  approvalRequestId?: string;
  taskId?: string;
  risk?: RiskLevel;
  environment?: string;
  requestedBy?: string;
  actionLabel: string;
  href: string;
  safe: boolean;
  waitingFor?: string;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  state: "PASS" | "WARN" | "FAIL" | "PENDING";
  required: boolean;
  detail?: string;
}

export interface Readiness {
  score: number;
  checks: ReadinessCheck[];
  deployable: boolean;
}

// ---------------------------------------------------------------------------
// Tasks & Task Engine
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "QUEUED" | "PLANNING" | "DISCOVERING" | "POLICY_CHECK" | "WAITING_APPROVAL" | "EXECUTING" | "VERIFYING"
  | "COMPLETED" | "FAILED" | "DIAGNOSING" | "RECOVERY" | "RETRY" | "ESCALATED" | "ROLLED_BACK" | "CANCELLED";

export type TaskType =
  | "DEPLOYMENT" | "ROLLBACK" | "DATABASE_MIGRATION" | "PROJECT_CREATE" | "ENVIRONMENT_BOOTSTRAP" | "RESTART"
  | "VM_CREATE" | "VM_DELETE" | "VM_START" | "VM_STOP" | "PACKAGE_INSTALL" | "REPOSITORY_ANALYZE" | "DIAGNOSE"
  | "BACKUP" | "HEALTH_CHECK" | "CREDENTIAL_CHANGE" | "POLICY_CHANGE" | "CUSTOM";

export type ExecutionMode = "AI" | "TASK_ENGINE" | "AGENT" | "HUMAN" | "AUTOMATION" | "WEBHOOK" | "SYSTEM";

export interface TaskStepDefinition {
  id: string;
  name: string;
  kind: "DISCOVERY" | "PRECONDITION" | "EXECUTE" | "VALIDATE" | "ROLLBACK";
  capability?: AgentCapability;
  idempotent: boolean;
  estimatedSeconds: number;
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  trigger: string; // error code pattern
  kind: "KNOWN_RECOVERY" | "RETRY" | "ALTERNATIVE" | "ROLLBACK" | "AI_DIAGNOSIS";
  maxAttempts: number;
  knowledgeRecordId?: string;
}

export interface TaskDefinition {
  id: string;
  name: string;
  version: string;
  type: TaskType;
  description: string;
  inputs: { name: string; type: "string" | "number" | "boolean" | "select"; required: boolean; options?: string[] }[];
  preconditions: string[];
  discovery: string[];
  steps: TaskStepDefinition[];
  validators: string[];
  recoveryStrategies: RecoveryStrategy[];
  outputs: string[];
  rollback: string[];
  permissions: Permission[];
  riskLevel: RiskLevel;
  approvalRequirements: string;
  aiDecisionsWithoutEngine: number; // how many AI decisions this would take without the Task Engine
  aiDecisionsWithEngine: number;
}

export interface TaskStepExecution {
  id: string;
  stepId: string;
  name: string;
  sequence: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED" | "RECOVERED";
  startedAt?: ISODate;
  finishedAt?: ISODate;
  durationMs?: number;
  error?: string;
  recoveryAction?: string;
  executionMode: ExecutionMode;
  output?: string;
}

export interface TaskLogEntry {
  at: ISODate;
  level: "INFO" | "WARN" | "ERROR";
  message: string;
  executionMode: ExecutionMode;
}

export interface Task {
  id: string;
  organizationId: string;
  key: string; // TSK-2041
  changeId?: string;
  definitionId: string;
  definitionVersion: string;
  type: TaskType;
  name: string;
  status: TaskStatus;
  risk: RiskLevel;
  environmentId?: string;
  agentId?: string;
  applicationId?: string;
  requestedById: string;
  executionMode: ExecutionMode;
  aiRunId?: string;
  approvalRequestId?: string;
  inputs: Record<string, string | number | boolean>;
  steps: TaskStepExecution[];
  log: TaskLogEntry[];
  attemptCount: number;
  recoveryCount: number;
  rolledBack: boolean;
  policyDecision?: PolicyDecision;
  scenario?: DemoFailureScenario;
  createdAt: ISODate;
  startedAt?: ISODate;
  finishedAt?: ISODate;
  summary?: string;
  error?: string;
  scheduledFor?: ISODate;
}

export type DemoFailureScenario = "NONE" | "HEALTH_CHECK_FAIL_THEN_RECOVER" | "HEALTH_CHECK_FAIL_ROLLBACK" | "SDK_MISMATCH" | "DOCKER_BUILD_FAIL";

// ---------------------------------------------------------------------------
// Policy & Approval
// ---------------------------------------------------------------------------

export type PolicyScope = "PLATFORM" | "ORGANIZATION" | "GROUP" | "ENVIRONMENT" | "RESOURCE";
export type ApprovalStrategy = "ANY" | "ALL" | "SEQUENTIAL" | "PARALLEL";
export type ApproverKind = "USER" | "ORG_OWNER" | "ORG_ADMIN" | "SECURITY_ADMIN" | "MANAGER" | "GROUP" | "ROLE" | "DEPARTMENT";

export interface ApproverRef {
  kind: ApproverKind;
  id?: string; // user/group/role id where applicable
  label: string;
}

export interface PolicyCondition {
  taskTypes?: TaskType[];
  environmentKinds?: EnvironmentKind[];
  minRisk?: RiskLevel;
  capabilities?: AgentCapability[];
  destructive?: boolean;
  includesDatabaseMigration?: boolean;
}

export interface PolicyEffect {
  mode: "AUTOMATIC" | "REQUIRE_APPROVAL" | "DENY";
  requiredApprovals?: number;
  approvers?: ApproverRef[];
  strategy?: ApprovalStrategy;
  typedConfirmation?: boolean;
  restrictCapabilities?: AgentCapability[];
}

export interface Policy {
  id: string;
  organizationId: string | null; // null = platform default
  scope: PolicyScope;
  scopeRef?: string; // group / environment / resource id
  name: string;
  description?: string;
  enabled: boolean;
  version: number;
  priority: number;
  when: PolicyCondition;
  then: PolicyEffect;
  builtIn: boolean;
  updatedAt: ISODate;
  updatedById?: string;
}

export interface PolicyDecision {
  risk: RiskLevel;
  mode: "AUTOMATIC" | "REQUIRE_APPROVAL" | "DENY";
  requiredApprovals: number;
  approvers: ApproverRef[];
  strategy: ApprovalStrategy;
  typedConfirmation: boolean;
  matchedPolicies: { id: string; name: string; scope: PolicyScope; version: number }[];
  result: "AUTO" | "WAITING_APPROVAL" | "DENIED";
  explanation: string[];
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "EXPIRED" | "CANCELLED";

export interface ApprovalSlot {
  approver: ApproverRef;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  decidedById?: string;
  decidedByName?: string;
  decidedAt?: ISODate;
  comment?: string;
  sequence: number;
}

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  key: string; // APR-31
  title: string;
  kind: "DEPLOYMENT" | "DATABASE_MIGRATION" | "RESTART" | "DELETION" | "CREDENTIAL" | "POLICY" | "AGENT" | "TASK" | "OTHER";
  changeId?: string;
  taskId?: string;
  environmentId?: string;
  environmentName?: string;
  risk: RiskLevel;
  requestedById: string;
  requestedByName: string;
  requiredApprovals: number;
  strategy: ApprovalStrategy;
  slots: ApprovalSlot[];
  status: ApprovalStatus;
  summary: string[]; // "Docker image updated", ...
  policyDecision?: PolicyDecision;
  createdAt: ISODate;
  decidedAt?: ISODate;
  expiresAt?: ISODate;
}

// ---------------------------------------------------------------------------
// Deployments, incidents
// ---------------------------------------------------------------------------

export type DeploymentStatus = "PENDING" | "BUILDING" | "TESTING" | "PACKAGING" | "DEPLOYING" | "VERIFYING" | "HEALING" | "HEALTHY" | "FAILED" | "ROLLED_BACK";

export interface Deployment {
  id: string;
  organizationId: string;
  changeId?: string;
  taskId?: string;
  applicationId: string;
  applicationName: string;
  environmentId: string;
  environmentName: string;
  version: string;
  previousVersion?: string;
  status: DeploymentStatus;
  health: HealthStatus;
  agentId?: string;
  startedAt: ISODate;
  finishedAt?: ISODate;
  healthChecks: { name: string; status: "PASS" | "FAIL" | "PENDING"; at: ISODate; detail?: string }[];
  rollbackOfId?: string;
  executionMode: ExecutionMode;
}

export type IncidentSeverity = "SEV1" | "SEV2" | "SEV3" | "SEV4";
export type RootCause =
  | "AI" | "Task Engine" | "Agent" | "Network" | "Git" | "GitHub" | "GitLab" | "Jira" | "CI/CD" | "Docker" | "Proxmox"
  | "Database" | "Application" | "Configuration" | "Permission" | "Policy" | "Human" | "Unknown";

export interface Incident {
  id: string;
  organizationId: string;
  key: string;
  title: string;
  severity: IncidentSeverity;
  status: "OPEN" | "MITIGATING" | "RESOLVED" | "CLOSED";
  changeId?: string;
  deploymentId?: string;
  taskId?: string;
  environmentId?: string;
  rootCause: RootCause;
  summary: string;
  selfHealed: boolean;
  jiraKey?: string;
  createdAt: ISODate;
  resolvedAt?: ISODate;
}

export interface Issue {
  id: string;
  organizationId: string;
  key: string;
  type: "BUILD_FAILURE" | "AGENT_DISCONNECT" | "DEPLOYMENT_FAILURE" | "INTEGRATION_FAILURE" | "REPEATED_TIMEOUT" | "POLICY_CONFLICT" | "SELF_HEALING_FAILURE";
  title: string;
  status: "OPEN" | "RESOLVED";
  rootCause: RootCause;
  links: Partial<Record<"changeId" | "taskId" | "aiRunId" | "mcpCallId" | "agentId" | "repositoryId" | "deploymentId" | "incidentId" | "jiraKey", string>>;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// AI / MCP telemetry & learning
// ---------------------------------------------------------------------------

export type AIProviderKind = "OPENAI" | "ANTHROPIC" | "GOOGLE" | "DEMO";
export type AIRequestPurpose =
  | "CREATE_CHANGE" | "PLAN_TASK" | "DIAGNOSE_FAILURE" | "CHECK_STATUS" | "RECOMMENDATION" | "CODE_ANALYSIS"
  | "REPOSITORY_ANALYSIS" | "DEPLOYMENT" | "INCIDENT_ANALYSIS" | "APPROVAL_ANALYSIS";

export interface AIRun {
  id: string;
  key: string; // AIR-10482
  organizationId: string;
  userId: string;
  provider: AIProviderKind;
  model: string;
  purpose: AIRequestPurpose;
  client: string; // Claude, ChatGPT, VS Code, Super MCP Web
  startTime: ISODate;
  endTime?: ISODate;
  durationMs: number;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number; // MYR, estimated
  costIsEstimate: boolean;
  mcpCallCount: number;
  taskCount: number;
  agentOperationCount: number;
  successCount: number;
  failureCount: number;
  retryCount: number;
  approvalCount: number;
  humanInterventionCount: number;
  recoveryCount: number;
  rollbackCount: number;
  aiDecisions: number;
  deterministicOperations: number;
  aiRequestsAvoided: number;
  context: { contextType: string; contextItemCount: number; contextSizeEstimate: number; sourceCount: number; relevantItemCount?: number };
  changeId?: string;
  finalStatus: string;
  trace: AITraceEntry[];
}

export interface AITraceEntry {
  at: ISODate;
  kind: "REQUEST" | "DECISION" | "TOOL" | "POLICY" | "APPROVAL" | "EXECUTION" | "VALIDATION" | "RESULT";
  message: string; // decision summary only — never chain-of-thought
  reasonCategory?: string;
  toolName?: string;
  policyResult?: string;
  executionResult?: string;
}

export interface MCPCall {
  id: string;
  aiRunId: string;
  organizationId: string;
  userId: string;
  toolName: string;
  toolVersion: string;
  startTime: ISODate;
  endTime: ISODate;
  durationMs: number;
  status: "SUCCESS" | "FAILED";
  errorCode?: string;
  taskId?: string;
  changeId?: string;
  agentId?: string;
  parentCallId?: string;
  sequenceNumber: number;
  dependencyCallId?: string;
  cache: { hit: boolean; ageMs?: number; refreshReason?: string };
  redundant: boolean;
  inputHash: string;
}

export interface MCPToolUsage {
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgDurationMs: number;
  p95DurationMs: number;
  retries: number;
  avgCallsPerRun: number;
  avgCallsPerChange: number;
  avgCallsPerTask: number;
  redundantCalls: number;
}

export type AIFailureType =
  | "TIMEOUT" | "INVALID_TOOL_CALL" | "WRONG_PARAMETERS" | "INSUFFICIENT_CONTEXT" | "INCORRECT_PLAN" | "POLICY_BLOCK"
  | "AUTHORIZATION_FAILURE" | "TOOL_FAILURE" | "AGENT_UNAVAILABLE" | "INTEGRATION_FAILURE" | "UNKNOWN";

export interface AIFailure {
  id: string;
  organizationId: string;
  aiRunId: string;
  taskId?: string;
  type: AIFailureType;
  rootCause: RootCause;
  message: string;
  at: ISODate;
  recovered: boolean;
}

export interface AIRecovery {
  id: string;
  organizationId: string;
  failureId: string;
  originalTaskId: string;
  diagnosis: string;
  recovery: string;
  result: "SUCCESS" | "FAILED";
  recoveryCount: number;
  timeToRecoveryMs: number;
  executionMode: ExecutionMode;
  at: ISODate;
}

export interface HumanIntervention {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  aiRunId?: string;
  taskId?: string;
  changeId?: string;
  reason: string;
  action: string;
  at: ISODate;
}

export interface ProblemPattern {
  id: string;
  organizationId: string;
  title: string;
  signature: string;
  occurrences: number;
  affectedRepositories: number;
  likelyCause: string;
  recommendation: string;
  rootCause: RootCause;
  firstSeenAt: ISODate;
  lastSeenAt: ISODate;
}

export type KnowledgeType =
  | "KNOWN_FAILURE" | "KNOWN_RECOVERY" | "BEST_PRACTICE" | "TASK_OPTIMIZATION" | "TOOL_OPTIMIZATION"
  | "ENVIRONMENT_PATTERN" | "REPOSITORY_PATTERN" | "DEPLOYMENT_PATTERN";

export interface KnowledgeRecord {
  id: string;
  organizationId: string | null;
  type: KnowledgeType;
  title: string;
  condition: string;
  resolution: string;
  successRate: number;
  applications: number;
  taskDefinitionId?: string;
  createdAt: ISODate;
}

export type RecommendationType =
  | "CREATE_DETERMINISTIC_TASK" | "CONSOLIDATE_MCP_TOOL" | "ADD_CACHE" | "IMPROVE_REPOSITORY_INDEX" | "IMPROVE_FAILURE_RECOVERY"
  | "ADD_PRECONDITION" | "ADD_VALIDATOR" | "ADD_ROLLBACK" | "CHANGE_APPROVAL_RULE" | "IMPROVE_AGENT_ROUTING" | "REDUCE_AI_CONTEXT" | "ADD_AUTOMATION";

export interface OptimizationRecommendation {
  id: string;
  organizationId: string;
  type: RecommendationType;
  title: string;
  description: string;
  evidence: string; // "1,842 redundant calls"
  estimatedReductionPct: number;
  estimatedSavingsMyr?: number;
  status: "NEW" | "REVIEWING" | "APPROVED" | "IMPLEMENTED" | "REJECTED" | "IGNORED";
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface AIExperiment {
  id: string;
  organizationId: string;
  name: string;
  oldStrategy: string;
  newStrategy: string;
  calls: { before: number; after: number };
  contextSize: { before: number; after: number };
  latencyMs: { before: number; after: number };
  outcome: "PENDING" | "IMPROVED" | "NO_CHANGE" | "REGRESSED";
  savingsPct: number;
  status: "DRAFT" | "RUNNING" | "COMPLETED";
}

// ---------------------------------------------------------------------------
// Audit, notifications, billing, marketplace
// ---------------------------------------------------------------------------

export interface AuditLog {
  id: string;
  organizationId: string;
  actorId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  resourceLabel?: string;
  timestamp: ISODate;
  result: "SUCCESS" | "DENIED" | "FAILED";
  risk: RiskLevel;
  correlationId: string;
  executionMode: ExecutionMode;
  detail?: string;
}

export type NotificationEvent =
  | "APPROVAL_REQUESTED" | "APPROVAL_APPROVED" | "APPROVAL_REJECTED" | "DEPLOYMENT_STARTED" | "DEPLOYMENT_COMPLETED"
  | "DEPLOYMENT_FAILED" | "INCIDENT_CREATED" | "SELF_HEALING_STARTED" | "ROLLBACK" | "AGENT_OFFLINE" | "CHANGE_UPDATED" | "SYSTEM";

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  channel: "IN_APP" | "EMAIL";
  createdAt: ISODate;
}

export interface Plan {
  id: string;
  name: string;
  priceMonthlyMyr: number | null; // null = contact sales
  target: string;
  limits: {
    organizations: number | null;
    users: number | null;
    agents: number | null;
    environments: number | null;
    gitConnections: number | null;
    activeChanges: number | null;
    taskExecutionsPerMonth: number | null;
  };
  features: string[];
  highlighted?: boolean;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";
  billingCycle: "MONTHLY" | "YEARLY";
  aiMode: "PLATFORM" | "BYOK";
  aiProvider?: AIProviderKind;
  aiCredentialRef?: string;
  currentPeriodStart: ISODate;
  currentPeriodEnd: ISODate;
}

export interface UsageRecord {
  organizationId: string;
  period: string; // YYYY-MM
  users: number;
  agents: number;
  environments: number;
  activeChanges: number;
  taskExecutions: number;
  aiRequests: number;
  aiRequestsAvoided: number;
  aiCostMyr: number;
  automationExecutions: number;
}

export interface Invoice {
  id: string;
  organizationId: string;
  number: string;
  period: string;
  amountMyr: number;
  status: "PAID" | "OPEN" | "VOID";
  issuedAt: ISODate;
  lines: { label: string; amountMyr: number }[];
}

export interface MarketplaceItem {
  id: string;
  name: string;
  publisher: string;
  description: string;
  category: string;
  pricing: "FREE" | "PAID" | "SUBSCRIPTION" | "ENTERPRISE";
  priceMyr?: number;
  version: string;
  rating: number;
  installs: number;
  risk: RiskLevel;
  requiredIntegrations: string[];
  requiredPermissions: Permission[];
  approvalRequirements: string;
  triggers: string[];
  tasks: string[];
  installed: boolean;
}

export interface Automation {
  id: string;
  organizationId: string;
  marketplaceItemId?: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  schedule?: string; // cron
  trigger: string;
  taskDefinitionId: string;
  runs: number;
  lastRunAt?: ISODate;
  lastResult?: "SUCCESS" | "FAILED";
}

// ---------------------------------------------------------------------------
// Request context (server-side authorization input)
// ---------------------------------------------------------------------------

export interface Actor {
  userId: string;
  userName: string;
  organizationId: string;
  membershipId: string;
  roleKeys: string[];
  permissions: Permission[];
  isOwner: boolean;
}

export interface RequestContext {
  actor: Actor;
  correlationId: string;
  executionMode: ExecutionMode;
  now: () => ISODate;
}

export class DomainError extends Error {
  constructor(public code: "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE" | "VALIDATION" | "POLICY_DENIED" | "LIMIT_EXCEEDED", message: string, public detail?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
  }
}
