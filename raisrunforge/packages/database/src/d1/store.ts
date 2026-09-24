import type { DataStore } from "@runforge/domain";
import type {
  Application,
  ApplicationRevision,
  AuditLog,
  Backup,
  Deployment,
  EnvironmentRecord,
  Event,
  GitConnection,
  Incident,
  Integration,
  Job,
  McpToken,
  Member,
  Organization,
  Project,
  StorageBucket,
  User,
} from "@runforge/shared";
import { D1KeyedRepository, D1TenantRepository, type Schema } from "./generic-repository";

const userSchema: Schema<User> = {
  id: { column: "id" },
  email: { column: "email" },
  name: { column: "name" },
  avatarUrl: { column: "avatar_url" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const organizationSchema: Schema<Organization> = {
  id: { column: "id" },
  name: { column: "name" },
  slug: { column: "slug" },
  plan: { column: "plan" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const memberSchema: Schema<Member> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  userId: { column: "user_id" },
  role: { column: "role" },
  status: { column: "status" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const projectSchema: Schema<Project> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  name: { column: "name" },
  slug: { column: "slug" },
  description: { column: "description" },
  status: { column: "status" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const environmentSchema: Schema<EnvironmentRecord> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  projectId: { column: "project_id" },
  name: { column: "name" },
  slug: { column: "slug" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const applicationSchema: Schema<Application> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  projectId: { column: "project_id" },
  environmentId: { column: "environment_id" },
  environment: { column: "environment" },
  name: { column: "name" },
  slug: { column: "slug" },
  status: { column: "status" },
  runtime: { column: "runtime" },
  runtimeLabel: { column: "runtime_label" },
  packaging: { column: "packaging" },
  source: { column: "source_json", json: true },
  serverId: { column: "server_id" },
  provider: { column: "provider" },
  domain: { column: "domain" },
  url: { column: "url" },
  port: { column: "port" },
  healthPath: { column: "health_path" },
  databaseId: { column: "database_id" },
  storageId: { column: "storage_id" },
  currentRevisionId: { column: "current_revision_id" },
  currentVersion: { column: "current_version" },
  resources: { column: "resources_json", json: true },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const revisionSchema: Schema<ApplicationRevision> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  applicationId: { column: "application_id" },
  version: { column: "version" },
  commitSha: { column: "commit_sha" },
  commitMessage: { column: "commit_message" },
  image: { column: "image" },
  trafficPercent: { column: "traffic_percent" },
  status: { column: "status" },
  deploymentId: { column: "deployment_id" },
  createdAt: { column: "created_at" },
};

const deploymentSchema: Schema<Deployment> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  projectId: { column: "project_id" },
  applicationId: { column: "application_id" },
  applicationName: { column: "application_name" },
  environment: { column: "environment" },
  serverId: { column: "server_id" },
  serverName: { column: "server_name" },
  revisionId: { column: "revision_id" },
  version: { column: "version" },
  commitSha: { column: "commit_sha" },
  commitMessage: { column: "commit_message" },
  branch: { column: "branch" },
  trigger: { column: "trigger" },
  triggeredBy: { column: "triggered_by" },
  status: { column: "status" },
  steps: { column: "steps_json", json: true },
  jobId: { column: "job_id" },
  simulated: { column: "simulated", bool: true },
  durationMs: { column: "duration_ms" },
  errorMessage: { column: "error_message" },
  queuedAt: { column: "queued_at" },
  startedAt: { column: "started_at" },
  finishedAt: { column: "finished_at" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const storageSchema: Schema<StorageBucket> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  projectId: { column: "project_id" },
  name: { column: "name" },
  provider: { column: "provider" },
  region: { column: "region" },
  sizeBytes: { column: "size_bytes" },
  objects: { column: "objects" },
  status: { column: "status" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const backupSchema: Schema<Backup> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  resourceType: { column: "resource_type" },
  resourceId: { column: "resource_id" },
  resourceName: { column: "resource_name" },
  destination: { column: "destination" },
  sizeBytes: { column: "size_bytes" },
  status: { column: "status" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const eventSchema: Schema<Event> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  projectId: { column: "project_id" },
  actorType: { column: "actor_type" },
  actorId: { column: "actor_id" },
  actorName: { column: "actor_name" },
  action: { column: "action" },
  resourceType: { column: "resource_type" },
  resourceId: { column: "resource_id" },
  resourceName: { column: "resource_name" },
  before: { column: "before_json", json: true },
  after: { column: "after_json", json: true },
  status: { column: "status" },
  message: { column: "message" },
  correlationId: { column: "correlation_id" },
  simulated: { column: "simulated", bool: true },
  createdAt: { column: "created_at" },
};

const auditLogSchema: Schema<AuditLog> = {
  ...eventSchema,
  result: { column: "result" },
  ip: { column: "ip" },
  userAgent: { column: "user_agent" },
};

const incidentSchema: Schema<Incident> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  projectId: { column: "project_id" },
  title: { column: "title" },
  severity: { column: "severity" },
  status: { column: "status" },
  resourceType: { column: "resource_type" },
  resourceId: { column: "resource_id" },
  resourceName: { column: "resource_name" },
  impactPercent: { column: "impact_percent" },
  likelyCause: { column: "likely_cause" },
  relatedDeploymentId: { column: "related_deployment_id" },
  relatedChanges: { column: "related_changes_json", json: true },
  startedAt: { column: "started_at" },
  resolvedAt: { column: "resolved_at" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const integrationSchema: Schema<Integration> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  kind: { column: "kind" },
  name: { column: "name" },
  status: { column: "status" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const gitConnectionSchema: Schema<GitConnection> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  provider: { column: "provider" },
  account: { column: "account" },
  status: { column: "status" },
  repositories: { column: "repositories" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const mcpTokenSchema: Schema<McpToken> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  name: { column: "name" },
  tokenHash: { column: "token_hash" },
  tokenPrefix: { column: "token_prefix" },
  level: { column: "level" },
  role: { column: "role" },
  lastUsedAt: { column: "last_used_at" },
  expiresAt: { column: "expires_at" },
  status: { column: "status" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

const jobSchema: Schema<Job> = {
  id: { column: "id" },
  organizationId: { column: "organization_id" },
  type: { column: "type" },
  status: { column: "status" },
  resourceType: { column: "resource_type" },
  resourceId: { column: "resource_id" },
  phase: { column: "phase" },
  progress: { column: "progress" },
  payload: { column: "payload_json", json: true },
  result: { column: "result_json", json: true },
  error: { column: "error" },
  correlationId: { column: "correlation_id" },
  simulated: { column: "simulated", bool: true },
  queuedAt: { column: "queued_at" },
  startedAt: { column: "started_at" },
  finishedAt: { column: "finished_at" },
  createdAt: { column: "created_at" },
  updatedAt: { column: "updated_at" },
};

/** Builds a DataStore backed by a real D1 database (production mode). */
export function createD1DataStore(db: D1Database): DataStore {
  return {
    users: new D1KeyedRepository(db, "users", userSchema),
    organizations: new D1KeyedRepository(db, "organizations", organizationSchema),
    members: new D1TenantRepository(db, "members", memberSchema),
    projects: new D1TenantRepository(db, "projects", projectSchema),
    environments: new D1TenantRepository(db, "environments", environmentSchema),
    applications: new D1TenantRepository(db, "applications", applicationSchema),
    revisions: new D1TenantRepository(db, "application_revisions", revisionSchema),
    deployments: new D1TenantRepository(db, "deployments", deploymentSchema),
    storage: new D1TenantRepository(db, "storage", storageSchema),
    backups: new D1TenantRepository(db, "backups", backupSchema),
    events: new D1TenantRepository(db, "events", eventSchema),
    auditLogs: new D1TenantRepository(db, "audit_logs", auditLogSchema),
    incidents: new D1TenantRepository(db, "incidents", incidentSchema),
    integrations: new D1TenantRepository(db, "integrations", integrationSchema),
    gitConnections: new D1TenantRepository(db, "git_connections", gitConnectionSchema),
    mcpTokens: new D1TenantRepository(db, "mcp_tokens", mcpTokenSchema),
    jobs: new D1TenantRepository(db, "jobs", jobSchema),
  };
}
