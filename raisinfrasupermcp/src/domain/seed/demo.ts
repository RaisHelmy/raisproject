import type * as T from "../types";
import type { DataStore } from "../repository/store";
import { DEFAULT_ROLES } from "../permissions";
import { platformDefaultPolicies } from "../engines/policy";
import { TASK_CATALOG } from "../engines/taskCatalog";
import { initialStages, generateChecklist, completeStage } from "../engines/changeLifecycle";
import { generateRecommendations, detectProblemPatterns } from "../engines/optimization";
import { daysAgo, hoursAgo, minutesAgo, hash } from "../ids";

export const DEMO = {
  orgId: "org_abc",
  personalOrgId: "org_ahmad_personal",
  users: { ahmad: "usr_ahmad", sarah: "usr_sarah", daniel: "usr_daniel" },
  envs: { dev: "env_dev", staging: "env_staging", prod: "env_prod" },
  agents: { dev: "agt_dev", staging: "agt_staging", prod: "agt_prod" },
  apps: { claims: "app_claims", payments: "app_payments", customer: "app_customer" },
  repos: { claims: "repo_claims", payments: "repo_payments", customer: "repo_customer" },
  changes: { claims: "chg_claims_upload", payments: "chg_payments_gateway", customer: "chg_customer_profile", claimsRelease: "chg_claims_v28" },
  approvals: { claimsProd: "apr_claims_prod", paymentsMigration: "apr_payments_migration" },
  password: "demo1234",
};

let seq = 0;
const id = (p: string) => `${p}_${(++seq).toString(36).padStart(4, "0")}`;

export async function seedDemo(store: DataStore, base = Date.now()): Promise<void> {
  const now = new Date(base).toISOString();
  const ago = { d: (n: number) => daysAgo(n, base), h: (n: number) => hoursAgo(n, base), m: (n: number) => minutesAgo(n, base) };

  // ----- roles (platform) -----
  const roles: T.Role[] = DEFAULT_ROLES.map((r) => ({ ...r, id: `role_${r.key}` }));
  await store.roles.putMany(roles);

  // ----- organizations -----
  const retention: T.RetentionPolicy = { aiRequestMetadataDays: 30, mcpTelemetryDays: 90, taskExecutionDays: 365, changeEvidenceDays: 730, auditLogDays: 730 };
  const org: T.Organization = { id: DEMO.orgId, name: "ABC Sdn Bhd", slug: "abc", type: "COMPANY", approvalMode: "ROUTED", planId: "team", demo: true, verification: { status: "VERIFIED", provider: "SSM", reference: "SSM-2024-0184", requestedAt: ago.d(120), reviewedAt: ago.d(118) }, retention, createdAt: ago.d(180), updatedAt: now };
  const personal: T.Organization = { id: DEMO.personalOrgId, name: "Ahmad (Personal)", slug: "ahmad", type: "PERSONAL", approvalMode: "AUTOMATIC", planId: "free", demo: true, verification: { status: "NOT_STARTED" }, retention, createdAt: ago.d(200), updatedAt: now };
  await store.organizations.putMany([org, personal]);

  // ----- users -----
  const users: T.User[] = [
    { id: DEMO.users.ahmad, email: "ahmad@abc.example", name: "Ahmad Razak", avatarInitials: "AR", verification: { status: "VERIFIED", provider: "email", reviewedAt: ago.d(200) }, createdAt: ago.d(200), lastLoginAt: ago.m(5) },
    { id: DEMO.users.sarah, email: "sarah@abc.example", name: "Sarah Lim", avatarInitials: "SL", verification: { status: "VERIFIED", provider: "email", reviewedAt: ago.d(150) }, createdAt: ago.d(150), lastLoginAt: ago.h(2) },
    { id: DEMO.users.daniel, email: "daniel@abc.example", name: "Daniel Tan", avatarInitials: "DT", verification: { status: "PENDING", provider: "email" }, createdAt: ago.d(90), lastLoginAt: ago.h(1) },
  ];
  await store.users.putMany(users);
  // demo passwords (PBKDF2 is applied by the worker on register; demo uses a marker hash so demo logins work in-memory)
  await store.passwords.putMany(users.map((u) => ({ id: `pwd_${u.id}`, userId: u.id, hash: hash(DEMO.password + ":" + u.id), salt: u.id, algorithm: "PBKDF2-SHA256" as const })));

  // ----- groups & memberships -----
  const groups: T.Group[] = ["Engineering", "DevOps", "QA", "Security", "Management", "Support"].map((g) => ({ id: `grp_${g.toLowerCase()}`, organizationId: org.id, name: g, builtIn: true }));
  await store.groups.putMany(groups);
  await store.memberships.putMany([
    { id: "mem_ahmad_abc", organizationId: org.id, userId: DEMO.users.ahmad, status: "ACTIVE", roleIds: ["role_org_owner"], groupIds: ["grp_management", "grp_engineering"], createdAt: ago.d(180) },
    { id: "mem_sarah_abc", organizationId: org.id, userId: DEMO.users.sarah, status: "ACTIVE", roleIds: ["role_security_admin"], groupIds: ["grp_security"], createdAt: ago.d(150) },
    { id: "mem_daniel_abc", organizationId: org.id, userId: DEMO.users.daniel, status: "ACTIVE", roleIds: ["role_devops", "role_developer"], groupIds: ["grp_engineering", "grp_devops"], createdAt: ago.d(90) },
    { id: "mem_ahmad_personal", organizationId: personal.id, userId: DEMO.users.ahmad, status: "ACTIVE", roleIds: ["role_org_owner"], groupIds: [], createdAt: ago.d(200) },
  ]);

  // ----- policies -----
  const policies = platformDefaultPolicies(now);
  policies.push({ id: "pol_abc_prod_deploy_2", organizationId: org.id, scope: "ORGANIZATION", name: "ABC: Production deployment with database change requires Security + Owner", description: "Company policy — any production deployment that touches the database needs both Security Admin and Organization Owner.", enabled: true, version: 3, priority: 10, builtIn: false, updatedAt: ago.d(12), updatedById: DEMO.users.sarah, when: { taskTypes: ["DEPLOYMENT"], environmentKinds: ["PRODUCTION"], includesDatabaseMigration: true }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 2, approvers: [{ kind: "SECURITY_ADMIN", label: "Security Admin" }, { kind: "ORG_OWNER", label: "Organization Owner" }], strategy: "ALL" } });
  policies.push({ id: "pol_abc_prod_env", organizationId: org.id, scope: "ENVIRONMENT", scopeRef: DEMO.envs.prod, name: "Production: AI-originated tasks using the database capability need Security", description: "Capability-scoped policy: any AI-originated task in Production that touches the database capability requires Security Admin sign-off.", enabled: true, version: 1, priority: 5, builtIn: false, updatedAt: ago.d(30), when: { environmentKinds: ["PRODUCTION"], capabilities: ["database"] }, then: { mode: "REQUIRE_APPROVAL", requiredApprovals: 1, approvers: [{ kind: "SECURITY_ADMIN", label: "Security Admin" }], strategy: "ANY" } });
  await store.policies.putMany(policies);
  await store.taskDefinitions.putMany(TASK_CATALOG);

  // ----- infrastructure -----
  const envs: T.Environment[] = [
    { id: DEMO.envs.dev, organizationId: org.id, name: "Development", kind: "DEVELOPMENT", agentId: DEMO.agents.dev, mode: "DEMO", health: "HEALTHY", url: "https://dev.claims.abc.example", servers: ["srv_dev1"] },
    { id: DEMO.envs.staging, organizationId: org.id, name: "Staging", kind: "STAGING", agentId: DEMO.agents.staging, mode: "DEMO", health: "HEALTHY", url: "https://staging.claims.abc.example", servers: ["srv_stg1"] },
    { id: DEMO.envs.prod, organizationId: org.id, name: "Production", kind: "PRODUCTION", agentId: DEMO.agents.prod, mode: "DEMO", health: "HEALTHY", url: "https://claims.abc.example", servers: ["srv_prod1", "srv_prod2", "srv_prod_db"] },
  ];
  await store.environments.putMany(envs);
  await store.servers.putMany([
    { id: "srv_dev1", organizationId: org.id, environmentId: DEMO.envs.dev, name: "dev-app-01", host: "10.10.1.21", os: "Ubuntu 24.04", kind: "VM", proxmoxVmId: 101, proxmoxNode: "pve-node-1", cpu: 4, memoryGb: 8, diskGb: 80, status: "RUNNING", components: { docker: "27.1", nginx: "1.26", git: "2.45", agent: "1.8.2" } },
    { id: "srv_stg1", organizationId: org.id, environmentId: DEMO.envs.staging, name: "stg-app-01", host: "10.10.2.21", os: "Ubuntu 24.04", kind: "VM", proxmoxVmId: 102, proxmoxNode: "pve-node-1", cpu: 4, memoryGb: 16, diskGb: 120, status: "RUNNING", components: { docker: "27.1", nginx: "1.26", git: "2.45", portainer: "2.21", agent: "1.8.2" } },
    { id: "srv_prod1", organizationId: org.id, environmentId: DEMO.envs.prod, name: "prod-app-01", host: "10.10.3.21", os: "Ubuntu 22.04", kind: "VM", proxmoxVmId: 201, proxmoxNode: "pve-node-2", cpu: 8, memoryGb: 32, diskGb: 240, status: "RUNNING", components: { docker: "26.1", nginx: "1.24", git: "2.43", agent: "1.8.2" } },
    { id: "srv_prod2", organizationId: org.id, environmentId: DEMO.envs.prod, name: "prod-app-02", host: "10.10.3.22", os: "Ubuntu 22.04", kind: "VM", proxmoxVmId: 202, proxmoxNode: "pve-node-2", cpu: 8, memoryGb: 32, diskGb: 240, status: "RUNNING", components: { docker: "26.1", nginx: "1.24", git: "2.43", agent: "1.8.1" } },
    { id: "srv_prod_db", organizationId: org.id, environmentId: DEMO.envs.prod, name: "prod-db-01", host: "10.10.3.31", os: "Ubuntu 22.04", kind: "VM", proxmoxVmId: 103, proxmoxNode: "pve-node-1", cpu: 8, memoryGb: 64, diskGb: 1000, status: "RUNNING", components: { postgresql: "16.3", agent: "1.8.2" } },
  ]);
  const agentBase = { organizationId: org.id, mode: "DEMO" as const, version: "1.8.2", os: "linux" as const, arch: "x64" as const, registeredAt: ago.d(88), policyId: "pol_platform_prod_deploy" };
  await store.agents.putMany([
    { ...agentBase, id: DEMO.agents.dev, name: "Development Agent", status: "ACTIVE", hostname: "dev-app-01", environmentId: DEMO.envs.dev, capabilities: ["filesystem", "process", "service", "package-manager", "network", "docker", "git", "database", "application", "deployment", "monitoring", "diagnostics"], lastSeenAt: ago.m(0.3), identity: { fingerprint: "SHA256:8f1c…9a2e", certificateExpiresAt: ago.d(-300) }, health: { cpu: 23, memory: 41, disk: 58, latencyMs: 38 }, repoCache: [{ repositoryId: DEMO.repos.claims, branch: "feature/document-upload", commit: "a91f3c2", lastFetchAt: ago.m(14), sizeMb: 212, healthy: true }, { repositoryId: DEMO.repos.customer, branch: "main", commit: "0c7de11", lastFetchAt: ago.h(3), sizeMb: 96, healthy: true }] },
    { ...agentBase, id: DEMO.agents.staging, name: "Staging Agent", status: "ACTIVE", hostname: "stg-app-01", environmentId: DEMO.envs.staging, capabilities: ["filesystem", "process", "service", "docker", "git", "database", "deployment", "monitoring", "diagnostics"], lastSeenAt: ago.m(0.5), identity: { fingerprint: "SHA256:33ab…c0d1", certificateExpiresAt: ago.d(-300) }, health: { cpu: 31, memory: 55, disk: 44, latencyMs: 41 }, repoCache: [{ repositoryId: DEMO.repos.claims, branch: "main", commit: "e02b7f9", lastFetchAt: ago.h(1), sizeMb: 205, healthy: true }] },
    { ...agentBase, id: DEMO.agents.prod, name: "Production Agent", status: "DEGRADED", version: "1.8.1", hostname: "prod-app-02", environmentId: DEMO.envs.prod, capabilities: ["service", "docker", "git", "deployment", "monitoring", "diagnostics"], lastSeenAt: ago.m(6), identity: { fingerprint: "SHA256:aa02…77ef", certificateExpiresAt: ago.d(-42) }, health: { cpu: 78, memory: 83, disk: 71, latencyMs: 210 }, repoCache: [{ repositoryId: DEMO.repos.claims, branch: "main", commit: "e02b7f9", lastFetchAt: ago.h(9), sizeMb: 205, healthy: true }] },
  ]);
  await store.gitConnections.putMany([
    { id: "git_github_abc", organizationId: org.id, name: "GitHub — abc-sdn-bhd", provider: "GITHUB", hosting: "CLOUD", baseUrl: "https://api.github.com", authMethod: "APP", credentialRef: "github-production", tlsVerify: true, status: "DEMO", lastCheckedAt: ago.m(20) },
    { id: "git_gitlab_corp", organizationId: org.id, name: "GitLab — corp (self-managed)", provider: "GITLAB", hosting: "SELF_HOSTED", baseUrl: "https://gitlab.abc.internal", authMethod: "PAT", credentialRef: "gitlab-corp", tlsVerify: true, enterpriseCa: true, proxy: "http://proxy.abc.internal:3128", status: "DEMO", lastCheckedAt: ago.m(45) },
  ]);
  await store.repositories.putMany([
    { id: DEMO.repos.claims, organizationId: org.id, connectionId: "git_github_abc", name: "claims-portal", fullName: "abc-sdn-bhd/claims-portal", provider: "GITHUB", url: "https://github.com/abc-sdn-bhd/claims-portal", defaultBranch: "main", detectedStack: [".NET 10", "React", "PostgreSQL", "Docker"], lastCommit: { sha: "a91f3c2", message: "feat(upload): add antivirus scan hook", author: "Daniel Tan", at: ago.h(3) } },
    { id: DEMO.repos.payments, organizationId: org.id, connectionId: "git_gitlab_corp", name: "payments-api", fullName: "corp/payments-api", provider: "GITLAB", url: "https://gitlab.abc.internal/corp/payments-api", defaultBranch: "main", detectedStack: [".NET 10", "PostgreSQL", "Docker", "Docker Compose"], lastCommit: { sha: "5d81ac0", message: "chore: bump gateway sdk to 4.2", author: "Ahmad Razak", at: ago.d(1) } },
    { id: DEMO.repos.customer, organizationId: org.id, connectionId: "git_github_abc", name: "customer-service", fullName: "abc-sdn-bhd/customer-service", provider: "GITHUB", url: "https://github.com/abc-sdn-bhd/customer-service", defaultBranch: "main", detectedStack: ["Bun", "Node", "React", "Docker"], lastCommit: { sha: "0c7de11", message: "feat(profile): new layout", author: "Daniel Tan", at: ago.d(2) } },
  ]);
  await store.applications.putMany([
    { id: DEMO.apps.claims, organizationId: org.id, name: "Claims Portal", slug: "claims-portal", repositoryId: DEMO.repos.claims, runtime: ".NET 10 + React", deployedVersions: { [DEMO.envs.dev]: "v2.8.0-dev.41", [DEMO.envs.staging]: "v2.8.0-rc.3", [DEMO.envs.prod]: "v2.7.4" } },
    { id: DEMO.apps.payments, organizationId: org.id, name: "Payments API", slug: "payments-api", repositoryId: DEMO.repos.payments, runtime: ".NET 10", deployedVersions: { [DEMO.envs.dev]: "v2.4.1-dev.12", [DEMO.envs.staging]: "v2.4.1", [DEMO.envs.prod]: "v2.3.9" } },
    { id: DEMO.apps.customer, organizationId: org.id, name: "Customer Portal", slug: "customer-portal", repositoryId: DEMO.repos.customer, runtime: "Bun + React", deployedVersions: { [DEMO.envs.dev]: "v1.12.0-dev.3", [DEMO.envs.staging]: "v1.11.2", [DEMO.envs.prod]: "v1.11.2" } },
  ]);
  await store.integrations.putMany([
    { id: "int_jira", organizationId: org.id, kind: "JIRA", name: "Jira — abc.atlassian.net", baseUrl: "https://abc.atlassian.net", credentialRef: "jira-company", status: "DEMO", config: { project: "CLM", worklogs: true } },
    { id: "int_proxmox", organizationId: org.id, kind: "PROXMOX", name: "Proxmox — pve.abc.internal", baseUrl: "https://pve.abc.internal:8006", credentialRef: "proxmox-production", status: "DEMO", config: { nodes: 2, vms: 5 } },
    { id: "int_email", organizationId: org.id, kind: "EMAIL", name: "Email notifications", status: "NOT_CONNECTED", config: {} },
    { id: "int_slack", organizationId: org.id, kind: "SLACK", name: "Slack", status: "NOT_CONNECTED", config: {} },
  ]);
  await store.credentials.putMany([
    { id: "cred_1", organizationId: org.id, ref: "github-production", provider: "DEMO", kind: "GIT", createdAt: ago.d(88), lastUsedAt: ago.m(20), rotatedAt: ago.d(30) },
    { id: "cred_2", organizationId: org.id, ref: "gitlab-corp", provider: "DEMO", kind: "GIT", createdAt: ago.d(80), lastUsedAt: ago.m(45), rotatedAt: ago.d(30) },
    { id: "cred_3", organizationId: org.id, ref: "jira-company", provider: "DEMO", kind: "JIRA", createdAt: ago.d(80), lastUsedAt: ago.h(2) },
    { id: "cred_4", organizationId: org.id, ref: "proxmox-production", provider: "DEMO", kind: "PROXMOX", createdAt: ago.d(70), lastUsedAt: ago.h(9) },
  ]);

  // ----- changes -----
  const analytics = (a: Partial<T.ChangeAnalytics> = {}): T.ChangeAnalytics => ({ aiRunCount: 0, mcpCallCount: 0, taskCount: 0, agentOperationCount: 0, failures: 0, recoveries: 0, rollbacks: 0, humanInterventions: 0, blockedMinutes: 0, waitingMinutes: 0, stageMinutes: {}, ...a });
  const mk = (partial: Omit<T.Change, "stages" | "checklist" | "currentStageKey" | "analytics" | "blockers" | "dependencies" | "git"> & Partial<Pick<T.Change, "git" | "blockers" | "dependencies" | "analytics">>, completeUpTo: T.ChangeStageKey | null, createdAt: string): T.Change => {
    const prodTarget = partial.targetEnvironmentId === DEMO.envs.prod;
    let c: T.Change = { ...partial, stages: initialStages(), checklist: generateChecklist(partial.impacts, prodTarget), currentStageKey: "INTENTION", blockers: partial.blockers ?? [], dependencies: partial.dependencies ?? [], git: partial.git ?? { commits: 0 }, analytics: partial.analytics ?? analytics() };
    if (completeUpTo) {
      const order = c.stages.map((s) => s.key);
      let t = new Date(createdAt).getTime();
      for (const key of order) { t += 6 * 3600_000; c = completeStage(c, key, new Date(t).toISOString()); if (key === completeUpTo) break; }
    }
    return c;
  };

  // 1. Claims Document Upload — 78%, at Deployment Preparation, pending DB migration approval (blocked)
  let claims = mk({
    id: DEMO.changes.claims, organizationId: org.id, key: "CHG-104", title: "Claims Document Upload", description: "Allow customers to upload supporting documents (PDF/JPG, max 10 MB) when submitting a claim. Files are virus-scanned and stored in object storage; metadata is persisted in PostgreSQL.",
    intent: "Add customer document upload to the claims portal.", status: "BLOCKED", risk: "HIGH", ownerId: DEMO.users.daniel, requestedById: DEMO.users.ahmad, applicationId: DEMO.apps.claims, repositoryId: DEMO.repos.claims, targetEnvironmentId: DEMO.envs.prod, version: "v2.8.0",
    impacts: [{ component: "Frontend", status: "AFFECTED", note: "Upload widget in claim form" }, { component: "Backend", status: "AFFECTED", note: "POST /claims/{id}/documents" }, { component: "Database", status: "AFFECTED", note: "New table claim_documents" }, { component: "File Storage", status: "AFFECTED", note: "R2 bucket claims-docs" }, { component: "Infrastructure", status: "NO_CHANGE" }, { component: "External API", status: "NO_CHANGE" }, { component: "Mobile", status: "NO_CHANGE" }],
    requirements: ["Customers can attach up to 5 documents per claim", "Accepted types: PDF, JPG, PNG; max 10 MB each", "Files are virus-scanned before storage", "Documents visible to claim handlers", "Upload is audited"],
    jira: [{ key: "CLM-412", type: "Epic", title: "Claims document upload", status: "In Progress", url: "https://abc.atlassian.net/browse/CLM-412" }, { key: "CLM-413", type: "Story", title: "Upload widget", status: "Done" }, { key: "CLM-414", type: "Story", title: "Document API + storage", status: "Done" }, { key: "CLM-415", type: "Task", title: "claim_documents migration", status: "In Review" }, { key: "CLM-416", type: "Task", title: "Antivirus scan integration", status: "Done" }],
    git: { branch: "feature/document-upload", commits: 23, pullRequest: { number: 218, state: "MERGED", url: "https://github.com/abc-sdn-bhd/claims-portal/pull/218" }, ciStatus: "PASSED" },
    rollbackPlan: ["Redeploy claims-portal v2.7.4 image", "Run down-migration 20240901_claim_documents", "Disable upload feature flag"],
    demoScenario: "HEALTH_CHECK_FAIL_THEN_RECOVER", createdAt: ago.d(9), updatedAt: ago.h(2), analytics: analytics({ aiRunCount: 6, mcpCallCount: 41, taskCount: 9, agentOperationCount: 112, failures: 1, recoveries: 1, humanInterventions: 2, blockedMinutes: 140, waitingMinutes: 380, stageMinutes: { DEVELOPMENT: 4320, TESTING: 900, REVIEW: 360 } }),
  }, "TESTING", ago.d(9));
  claims.checklist = claims.checklist.map((c) => c.stageKey === "TESTING" || c.stageKey === "REVIEW" ? { ...c, state: "DONE" } : c.title === "Backup verified" || c.title === "Docker image built and scanned" || c.title === "Static asset validation" || c.title === "Deployed to staging" || c.title === "Capacity check" ? { ...c, state: "DONE" } : c);
  claims.blockers = [{ id: "blk_claims_1", title: "Production deployment cannot start", reason: "Database migration approval is required before deployment preparation can complete.", missing: ["Database migration approval", "Production deployment approval"], waitingFor: { roleKey: "security_admin", label: "Sarah Lim — Security Admin" }, approvalRequestId: DEMO.approvals.paymentsMigration.replace("payments", "claims"), stageKey: "DEPLOYMENT_PREPARATION", createdAt: ago.h(3) }];
  claims.stages = claims.stages.map((s) => s.key === "DEPLOYMENT_PREPARATION" ? { ...s, state: "BLOCKED", progress: 70 } : s);

  // 2. Claims Portal v2.8 release — awaiting production approval (the demo scenario)
  let claimsRelease = mk({
    id: DEMO.changes.claimsRelease, organizationId: org.id, key: "CHG-108", title: "Claims Portal v2.8", description: "Production release of Claims Portal v2.8: document upload, faster claim search, and security patches.",
    intent: "Deploy Claims Portal v2.8 to Production.", status: "AWAITING_APPROVAL", risk: "HIGH", ownerId: DEMO.users.daniel, requestedById: DEMO.users.daniel, applicationId: DEMO.apps.claims, repositoryId: DEMO.repos.claims, targetEnvironmentId: DEMO.envs.prod, version: "v2.8.0",
    impacts: [{ component: "Frontend", status: "AFFECTED" }, { component: "Backend", status: "AFFECTED" }, { component: "Database", status: "NO_CHANGE", note: "Migration shipped separately in CHG-104" }, { component: "File Storage", status: "NO_CHANGE" }, { component: "Infrastructure", status: "NO_CHANGE" }, { component: "External API", status: "NO_CHANGE" }, { component: "Mobile", status: "NO_CHANGE" }],
    requirements: ["Zero-downtime rolling deployment", "Health checks pass on both app nodes", "Smoke tests pass", "Rollback within 5 minutes if needed"],
    jira: [{ key: "CLM-430", type: "Task", title: "Release v2.8 to production", status: "In Progress" }],
    git: { branch: "release/2.8", commits: 41, pullRequest: { number: 231, state: "MERGED" }, ciStatus: "PASSED" },
    rollbackPlan: ["Redeploy claims-portal v2.7.4 image on both nodes", "Verify health", "Notify owner"],
    dependencies: [DEMO.changes.claims], demoScenario: "HEALTH_CHECK_FAIL_THEN_RECOVER", createdAt: ago.d(2), updatedAt: ago.m(35),
    analytics: analytics({ aiRunCount: 3, mcpCallCount: 14, taskCount: 4, agentOperationCount: 36, waitingMinutes: 35, stageMinutes: { DEVELOPMENT: 600, TESTING: 240 } }),
  }, "DEPLOYMENT_PREPARATION", ago.d(2));
  claimsRelease.checklist = claimsRelease.checklist.map((c) => c.stageKey === "APPROVAL" || c.stageKey === "UAT" || c.stageKey === "LIVE_VALIDATION" ? c : { ...c, state: "DONE" });

  // 3. Payment Gateway Upgrade — development, PR open
  let payments = mk({
    id: DEMO.changes.payments, organizationId: org.id, key: "CHG-106", title: "Payment Gateway Upgrade", description: "Upgrade payments-api to gateway SDK 4.2 with 3-D Secure 2.2, including a migration to store the new authentication reference.",
    intent: "Upgrade the payment gateway SDK to 4.2 with 3DS2 support.", status: "ACTIVE", risk: "HIGH", ownerId: DEMO.users.ahmad, requestedById: DEMO.users.ahmad, applicationId: DEMO.apps.payments, repositoryId: DEMO.repos.payments, targetEnvironmentId: DEMO.envs.prod, version: "v2.4.1",
    impacts: [{ component: "Frontend", status: "NO_CHANGE" }, { component: "Backend", status: "AFFECTED" }, { component: "Database", status: "AFFECTED", note: "payment_auth_reference column" }, { component: "File Storage", status: "NO_CHANGE" }, { component: "Infrastructure", status: "NO_CHANGE" }, { component: "External API", status: "AFFECTED", note: "Gateway 4.2 endpoints" }, { component: "Mobile", status: "REVIEW", note: "SDK callback URL may change" }],
    requirements: ["3DS2 challenge flow supported", "Backwards compatible with 3DS1 for 30 days", "Auth reference persisted", "PCI scope unchanged"],
    jira: [{ key: "PAY-88", type: "Epic", title: "Gateway 4.2 upgrade", status: "In Progress" }, { key: "PAY-89", type: "Story", title: "3DS2 challenge flow", status: "In Progress" }, { key: "PAY-90", type: "Task", title: "Migration: payment_auth_reference", status: "To Do" }],
    git: { branch: "feature/gateway-4.2", commits: 8, pullRequest: { number: 57, state: "OPEN", url: "https://gitlab.abc.internal/corp/payments-api/-/merge_requests/57" }, ciStatus: "RUNNING" },
    rollbackPlan: ["Redeploy payments-api v2.3.9", "Down-migrate payment_auth_reference"],
    demoScenario: "DOCKER_BUILD_FAIL", createdAt: ago.d(5), updatedAt: ago.h(1), analytics: analytics({ aiRunCount: 4, mcpCallCount: 22, taskCount: 3, agentOperationCount: 40, stageMinutes: { DEVELOPMENT: 2880 } }),
  }, "JIRA", ago.d(5));
  claims = { ...claims }; payments = { ...payments };

  // 4. Customer Profile Redesign — UAT
  let customer = mk({
    id: DEMO.changes.customer, organizationId: org.id, key: "CHG-101", title: "Customer Profile Redesign", description: "New responsive profile page with editable contact preferences.",
    intent: "Redesign the customer profile page.", status: "ACTIVE", risk: "LOW", ownerId: DEMO.users.daniel, requestedById: DEMO.users.sarah, applicationId: DEMO.apps.customer, repositoryId: DEMO.repos.customer, targetEnvironmentId: DEMO.envs.prod, version: "v1.12.0",
    impacts: [{ component: "Frontend", status: "AFFECTED" }, { component: "Backend", status: "NO_CHANGE" }, { component: "Database", status: "NO_CHANGE" }, { component: "File Storage", status: "NO_CHANGE" }, { component: "Infrastructure", status: "NO_CHANGE" }, { component: "External API", status: "NO_CHANGE" }, { component: "Mobile", status: "AFFECTED" }],
    requirements: ["Responsive on mobile", "Preferences editable inline", "Accessibility AA"],
    jira: [{ key: "CUS-201", type: "Story", title: "Profile redesign", status: "In UAT" }],
    git: { branch: "feature/profile-redesign", commits: 17, pullRequest: { number: 402, state: "MERGED" }, ciStatus: "PASSED" },
    rollbackPlan: ["Redeploy customer-portal v1.11.2"],
    createdAt: ago.d(14), updatedAt: ago.h(5), analytics: analytics({ aiRunCount: 5, mcpCallCount: 19, taskCount: 6, agentOperationCount: 71, humanInterventions: 1, stageMinutes: { DEVELOPMENT: 5760, TESTING: 720, DEPLOYMENT: 12, LIVE_VALIDATION: 30 } }),
  }, "LIVE_VALIDATION", ago.d(14));
  customer.checklist = customer.checklist.map((c) => c.stageKey === "UAT" ? c : { ...c, state: "DONE" });

  // 5. A completed change for history
  let completed = mk({
    id: "chg_done_1", organizationId: org.id, key: "CHG-097", title: "Claims search performance", description: "Add composite index and query caching to claims search.", intent: "Make claims search faster.", status: "COMPLETED", risk: "MEDIUM", ownerId: DEMO.users.daniel, requestedById: DEMO.users.ahmad, applicationId: DEMO.apps.claims, repositoryId: DEMO.repos.claims, targetEnvironmentId: DEMO.envs.prod, version: "v2.7.4",
    impacts: [{ component: "Frontend", status: "NO_CHANGE" }, { component: "Backend", status: "AFFECTED" }, { component: "Database", status: "AFFECTED" }, { component: "File Storage", status: "NO_CHANGE" }, { component: "Infrastructure", status: "NO_CHANGE" }, { component: "External API", status: "NO_CHANGE" }, { component: "Mobile", status: "NO_CHANGE" }],
    requirements: ["p95 search latency < 400ms"], jira: [{ key: "CLM-390", type: "Story", title: "Search performance", status: "Done" }],
    git: { branch: "perf/search-index", commits: 6, pullRequest: { number: 201, state: "MERGED" }, ciStatus: "PASSED" }, rollbackPlan: ["Drop index", "Redeploy v2.7.3"],
    createdAt: ago.d(30), updatedAt: ago.d(20), closedAt: ago.d(20), analytics: analytics({ aiRunCount: 4, mcpCallCount: 17, taskCount: 5, agentOperationCount: 52, failures: 1, recoveries: 1, stageMinutes: { DEVELOPMENT: 2400, TESTING: 300, APPROVAL: 95, DEPLOYMENT: 9, UAT: 1440 } }),
  }, "CLOSURE", ago.d(30));
  completed.checklist = completed.checklist.map((c) => ({ ...c, state: "DONE" }));
  await store.changes.putMany([claims, claimsRelease, payments, customer, completed]);

  // ----- approvals -----
  const approvals: T.ApprovalRequest[] = [
    { id: DEMO.approvals.claimsProd, organizationId: org.id, key: "APR-31", title: "Deploy Claims Portal v2.8 to Production", kind: "DEPLOYMENT", changeId: claimsRelease.id, environmentId: DEMO.envs.prod, environmentName: "Production", risk: "HIGH", requestedById: DEMO.users.daniel, requestedByName: "Daniel Tan", requiredApprovals: 1, strategy: "ANY", slots: [{ approver: { kind: "ORG_OWNER", label: "Organization Owner" }, status: "PENDING", sequence: 1 }], status: "PENDING", summary: ["Docker image claims-portal:v2.8.0 (sha256:9f2c…)", "No database migration", "Nginx unchanged", "Rolling deployment across prod-app-01 / prod-app-02"], createdAt: ago.m(35), expiresAt: ago.d(-2) },
    { id: DEMO.approvals.paymentsMigration.replace("payments", "claims"), organizationId: org.id, key: "APR-30", title: "Production migration: claim_documents", kind: "DATABASE_MIGRATION", changeId: claims.id, environmentId: DEMO.envs.prod, environmentName: "Production", risk: "HIGH", requestedById: DEMO.users.daniel, requestedByName: "Daniel Tan", requiredApprovals: 2, strategy: "ALL", slots: [{ approver: { kind: "SECURITY_ADMIN", label: "Security Admin" }, status: "PENDING", sequence: 1 }, { approver: { kind: "ORG_OWNER", label: "Organization Owner" }, status: "APPROVED", sequence: 2, decidedById: DEMO.users.ahmad, decidedByName: "Ahmad Razak", decidedAt: ago.h(2), comment: "Backup verified on staging." }], status: "PENDING", summary: ["New table claim_documents (est. 0 rows)", "Backup verified 2h ago", "Estimated duration: 4s", "Rollback script prepared"], createdAt: ago.h(3) },
    { id: "apr_done_1", organizationId: org.id, key: "APR-27", title: "Deploy Customer Portal v1.12.0 to Production", kind: "DEPLOYMENT", changeId: customer.id, environmentId: DEMO.envs.prod, environmentName: "Production", risk: "LOW", requestedById: DEMO.users.daniel, requestedByName: "Daniel Tan", requiredApprovals: 1, strategy: "ANY", slots: [{ approver: { kind: "ORG_OWNER", label: "Organization Owner" }, status: "APPROVED", sequence: 1, decidedById: DEMO.users.ahmad, decidedByName: "Ahmad Razak", decidedAt: ago.h(6) }], status: "APPROVED", summary: ["Frontend only", "No migration"], createdAt: ago.h(7), decidedAt: ago.h(6) },
    { id: "apr_done_2", organizationId: org.id, key: "APR-22", title: "Deploy Claims Portal v2.7.4 to Production", kind: "DEPLOYMENT", changeId: completed.id, environmentId: DEMO.envs.prod, environmentName: "Production", risk: "MEDIUM", requestedById: DEMO.users.daniel, requestedByName: "Daniel Tan", requiredApprovals: 1, strategy: "ANY", slots: [{ approver: { kind: "ORG_OWNER", label: "Organization Owner" }, status: "APPROVED", sequence: 1, decidedById: DEMO.users.ahmad, decidedByName: "Ahmad Razak", decidedAt: ago.d(21) }], status: "APPROVED", summary: ["Composite index migration", "Backup verified"], createdAt: ago.d(21), decidedAt: ago.d(21) },
  ];
  await store.approvals.putMany(approvals);

  // ----- tasks (history) -----
  const def = (i: string) => TASK_CATALOG.find((d) => d.id === i)!;
  const doneSteps = (d: T.TaskDefinition, at: string, failAt?: string): T.TaskStepExecution[] => d.steps.map((s, i) => ({ id: id("stp"), stepId: s.id, name: s.name, sequence: i + 1, status: s.id === failAt ? "FAILED" : "COMPLETED", startedAt: at, finishedAt: at, durationMs: s.estimatedSeconds * 1000, executionMode: s.capability ? "AGENT" : "TASK_ENGINE", error: s.id === failAt ? "Health endpoint returned 503" : undefined }));
  const tasks: T.Task[] = [
    { id: "tsk_2041", organizationId: org.id, key: "TSK-2041", changeId: customer.id, definitionId: "deploy-application", definitionVersion: "1.4.0", type: "DEPLOYMENT", name: "Deploy customer-portal v1.12.0 to Production", status: "COMPLETED", risk: "LOW", environmentId: DEMO.envs.prod, agentId: DEMO.agents.prod, applicationId: DEMO.apps.customer, requestedById: DEMO.users.daniel, executionMode: "TASK_ENGINE", aiRunId: "air_10471", approvalRequestId: "apr_done_1", inputs: { applicationId: DEMO.apps.customer, environmentId: DEMO.envs.prod, version: "v1.12.0" }, steps: doneSteps(def("deploy-application"), ago.h(5.9)), log: [{ at: ago.h(5.9), level: "INFO", message: "Deploy Application completed: 10 deterministic steps.", executionMode: "TASK_ENGINE" }], attemptCount: 1, recoveryCount: 0, rolledBack: false, createdAt: ago.h(6), startedAt: ago.h(6), finishedAt: ago.h(5.8), summary: "Deploy Application completed: 10 deterministic steps." },
    { id: "tsk_2038", organizationId: org.id, key: "TSK-2038", changeId: claims.id, definitionId: "deploy-application", definitionVersion: "1.4.0", type: "DEPLOYMENT", name: "Deploy claims-portal v2.8.0-rc.3 to Staging", status: "COMPLETED", risk: "MEDIUM", environmentId: DEMO.envs.staging, agentId: DEMO.agents.staging, applicationId: DEMO.apps.claims, requestedById: DEMO.users.daniel, executionMode: "TASK_ENGINE", aiRunId: "air_10468", inputs: { applicationId: DEMO.apps.claims, environmentId: DEMO.envs.staging, version: "v2.8.0-rc.3", includesMigration: true }, steps: doneSteps(def("deploy-application"), ago.d(1)), log: [], attemptCount: 2, recoveryCount: 1, rolledBack: false, createdAt: ago.d(1), startedAt: ago.d(1), finishedAt: ago.d(1), summary: "Deploy Application completed: 12 deterministic steps, 1 recovery action (restart container)." },
    { id: "tsk_2035", organizationId: org.id, key: "TSK-2035", changeId: payments.id, definitionId: "deploy-application", definitionVersion: "1.3.2", type: "DEPLOYMENT", name: "Deploy payments-api v2.4.1-dev.12 to Development", status: "ESCALATED", risk: "LOW", environmentId: DEMO.envs.dev, agentId: DEMO.agents.dev, applicationId: DEMO.apps.payments, requestedById: DEMO.users.ahmad, executionMode: "TASK_ENGINE", aiRunId: "air_10462", inputs: { applicationId: DEMO.apps.payments, environmentId: DEMO.envs.dev, version: "v2.4.1-dev.12" }, steps: doneSteps(def("deploy-application"), ago.d(2), "docker-build"), log: [{ at: ago.d(2), level: "ERROR", message: "✕ Build Docker image: npm ERR! peer dependency mismatch", executionMode: "AGENT" }, { at: ago.d(2), level: "WARN", message: "Recovery (retry): Retry build", executionMode: "TASK_ENGINE" }, { at: ago.d(2), level: "ERROR", message: "Escalated after 2 retries", executionMode: "SYSTEM" }], attemptCount: 3, recoveryCount: 2, rolledBack: false, createdAt: ago.d(2), startedAt: ago.d(2), finishedAt: ago.d(2), summary: "Escalated: Docker build failed after 2 retries", error: "BUILD_FAILED" },
    { id: "tsk_2029", organizationId: org.id, key: "TSK-2029", changeId: completed.id, definitionId: "deploy-application", definitionVersion: "1.3.2", type: "DEPLOYMENT", name: "Deploy claims-portal v2.7.4 to Production", status: "COMPLETED", risk: "HIGH", environmentId: DEMO.envs.prod, agentId: DEMO.agents.prod, applicationId: DEMO.apps.claims, requestedById: DEMO.users.daniel, executionMode: "TASK_ENGINE", aiRunId: "air_10440", approvalRequestId: "apr_done_2", inputs: { applicationId: DEMO.apps.claims, environmentId: DEMO.envs.prod, version: "v2.7.4", includesMigration: true }, steps: doneSteps(def("deploy-application"), ago.d(21)), log: [], attemptCount: 2, recoveryCount: 1, rolledBack: false, createdAt: ago.d(21), startedAt: ago.d(21), finishedAt: ago.d(21), summary: "Completed with 1 recovery (health check warm-up)." },
    { id: "tsk_2027", organizationId: org.id, key: "TSK-2027", definitionId: "create-dotnet-project", definitionVersion: "2.0.0", type: "PROJECT_CREATE", name: "Create .NET project: notification-service (Clean Architecture + CQRS)", status: "COMPLETED", risk: "LOW", environmentId: DEMO.envs.dev, agentId: DEMO.agents.dev, requestedById: DEMO.users.ahmad, executionMode: "TASK_ENGINE", aiRunId: "air_10431", inputs: { name: "notification-service", architecture: "Clean Architecture", dotnetVersion: "10.0", database: "SQLite" }, steps: doneSteps(def("create-dotnet-project"), ago.d(6)).map((s) => s.stepId === "check-sdk" ? { ...s, status: "RECOVERED", recoveryAction: "Install required .NET SDK", error: "Project requires .NET 10; Agent has .NET 8" } : s), log: [], attemptCount: 2, recoveryCount: 1, rolledBack: false, createdAt: ago.d(6), startedAt: ago.d(6), finishedAt: ago.d(6), summary: "Completed: 12 steps, 1 known recovery (.NET SDK mismatch → installed .NET 10)." },
    { id: "tsk_2022", organizationId: org.id, key: "TSK-2022", definitionId: "deploy-application", definitionVersion: "1.3.2", type: "DEPLOYMENT", name: "Deploy customer-service v1.11.1 to Development", status: "ESCALATED", risk: "LOW", environmentId: DEMO.envs.dev, agentId: DEMO.agents.dev, applicationId: DEMO.apps.customer, requestedById: DEMO.users.daniel, executionMode: "TASK_ENGINE", inputs: {}, steps: doneSteps(def("deploy-application"), ago.d(8), "docker-build"), log: [], attemptCount: 3, recoveryCount: 2, rolledBack: false, createdAt: ago.d(8), finishedAt: ago.d(8), summary: "Escalated: Docker build failed", error: "BUILD_FAILED" },
    { id: "tsk_2050", organizationId: org.id, key: "TSK-2050", definitionId: "backup-database", definitionVersion: "1.0.1", type: "BACKUP", name: "Nightly PostgreSQL backup — Production", status: "QUEUED", risk: "LOW", environmentId: DEMO.envs.prod, agentId: DEMO.agents.prod, requestedById: DEMO.users.ahmad, executionMode: "AUTOMATION", inputs: { environmentId: DEMO.envs.prod }, steps: [], log: [], attemptCount: 0, recoveryCount: 0, rolledBack: false, createdAt: ago.h(1), scheduledFor: ago.h(-5) },
  ];
  await store.tasks.putMany(tasks);

  // ----- deployments -----
  await store.deployments.putMany([
    { id: "dep_1", organizationId: org.id, changeId: customer.id, taskId: "tsk_2041", applicationId: DEMO.apps.customer, applicationName: "customer-portal", environmentId: DEMO.envs.prod, environmentName: "Production", version: "v1.12.0", previousVersion: "v1.11.2", status: "HEALTHY", health: "HEALTHY", agentId: DEMO.agents.prod, startedAt: ago.h(6), finishedAt: ago.h(5.8), healthChecks: [{ name: "GET /health", status: "PASS", at: ago.h(5.8) }, { name: "Smoke: login", status: "PASS", at: ago.h(5.8) }], executionMode: "TASK_ENGINE" },
    { id: "dep_2", organizationId: org.id, changeId: claims.id, taskId: "tsk_2038", applicationId: DEMO.apps.claims, applicationName: "claims-portal", environmentId: DEMO.envs.staging, environmentName: "Staging", version: "v2.8.0-rc.3", previousVersion: "v2.8.0-rc.2", status: "HEALTHY", health: "HEALTHY", agentId: DEMO.agents.staging, startedAt: ago.d(1), finishedAt: ago.d(1), healthChecks: [{ name: "GET /health", status: "FAIL", at: ago.d(1), detail: "503 warming up" }, { name: "GET /health (retry)", status: "PASS", at: ago.d(1) }], executionMode: "TASK_ENGINE" },
    { id: "dep_3", organizationId: org.id, changeId: completed.id, taskId: "tsk_2029", applicationId: DEMO.apps.claims, applicationName: "claims-portal", environmentId: DEMO.envs.prod, environmentName: "Production", version: "v2.7.4", previousVersion: "v2.7.3", status: "HEALTHY", health: "HEALTHY", agentId: DEMO.agents.prod, startedAt: ago.d(21), finishedAt: ago.d(21), healthChecks: [{ name: "GET /health", status: "PASS", at: ago.d(21) }], executionMode: "TASK_ENGINE" },
    { id: "dep_4", organizationId: org.id, applicationId: DEMO.apps.payments, applicationName: "payments-api", environmentId: DEMO.envs.prod, environmentName: "Production", version: "v2.3.9", previousVersion: "v2.3.8", status: "HEALTHY", health: "HEALTHY", agentId: DEMO.agents.prod, startedAt: ago.d(40), finishedAt: ago.d(40), healthChecks: [{ name: "GET /health", status: "PASS", at: ago.d(40) }], executionMode: "TASK_ENGINE" },
  ]);

  // ----- incidents & issues -----
  await store.incidents.putMany([
    { id: "inc_1", organizationId: org.id, key: "INC-19", title: "payments-api Docker build failing in Development", severity: "SEV3", status: "OPEN", changeId: payments.id, taskId: "tsk_2035", environmentId: DEMO.envs.dev, rootCause: "Docker", summary: "Peer dependency mismatch in image build; self-healing retried twice then escalated.", selfHealed: false, jiraKey: "PAY-91", createdAt: ago.d(2) },
    { id: "inc_2", organizationId: org.id, key: "INC-18", title: "Production Agent degraded (high memory)", severity: "SEV2", status: "MITIGATING", environmentId: DEMO.envs.prod, rootCause: "Agent", summary: "prod-app-02 agent memory at 83%; heartbeat latency 210ms. Container log rotation applied.", selfHealed: false, createdAt: ago.h(4) },
    { id: "inc_3", organizationId: org.id, key: "INC-15", title: "Staging health check failed after deploy (self-healed)", severity: "SEV4", status: "RESOLVED", changeId: claims.id, deploymentId: "dep_2", taskId: "tsk_2038", environmentId: DEMO.envs.staging, rootCause: "Application", summary: "Container warm-up exceeded health-check window. Known recovery: restart + warm-up wait.", selfHealed: true, createdAt: ago.d(1), resolvedAt: ago.d(1) },
  ]);
  await store.issues.putMany([
    { id: "iss_1", organizationId: org.id, key: "ISS-77", type: "BUILD_FAILURE", title: "Docker build failure: peer dependency mismatch", status: "OPEN", rootCause: "Docker", links: { taskId: "tsk_2035", changeId: payments.id, repositoryId: DEMO.repos.payments, incidentId: "inc_1", jiraKey: "PAY-91" }, createdAt: ago.d(2) },
    { id: "iss_2", organizationId: org.id, key: "ISS-76", type: "AGENT_DISCONNECT", title: "Production Agent heartbeat delayed", status: "OPEN", rootCause: "Agent", links: { agentId: DEMO.agents.prod, incidentId: "inc_2" }, createdAt: ago.h(4) },
    { id: "iss_3", organizationId: org.id, key: "ISS-71", type: "REPEATED_TIMEOUT", title: "GitLab pipeline retrieval slow (avg 2.8s)", status: "OPEN", rootCause: "GitLab", links: { repositoryId: DEMO.repos.payments }, createdAt: ago.d(4) },
  ]);

  // ----- AI runs & MCP calls (telemetry) -----
  const runs: T.AIRun[] = [];
  const calls: T.MCPCall[] = [];
  const tools = ["super.change.status", "super.environment.inspect", "super.deployment.status", "super.change.get", "super.application.deploy", "super.task", "super.incident.diagnose", "super.project.analyze", "super.jira.update", "super.environment.snapshot", "super.change.next_action", "super.system.health"];
  const purposes: T.AIRequestPurpose[] = ["CREATE_CHANGE", "PLAN_TASK", "DIAGNOSE_FAILURE", "CHECK_STATUS", "RECOMMENDATION", "REPOSITORY_ANALYSIS", "DEPLOYMENT", "INCIDENT_ANALYSIS", "APPROVAL_ANALYSIS", "CODE_ANALYSIS"];
  const clients = ["Claude", "ChatGPT", "VS Code", "Super MCP Web", "Cursor"];
  const changeIds = [claims.id, claimsRelease.id, payments.id, customer.id, completed.id];
  let rnd = 42;
  const rand = () => { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; };
  for (let i = 0; i < 120; i++) {
    const start = new Date(base - rand() * 28 * 86400_000);
    const purpose = purposes[Math.floor(rand() * purposes.length)];
    const nCalls = purpose === "CHECK_STATUS" ? 3 + Math.floor(rand() * 14) : purpose === "REPOSITORY_ANALYSIS" ? 4 + Math.floor(rand() * 6) : 1 + Math.floor(rand() * 5);
    const failed = rand() < 0.08;
    const runId = i < 5 ? ["air_10471", "air_10468", "air_10462", "air_10440", "air_10431"][i] : `air_${10300 + i}`;
    const aiDecisions = 1 + Math.floor(rand() * 4);
    const det = purpose === "DEPLOYMENT" ? 10 + Math.floor(rand() * 8) : Math.floor(rand() * 6);
    const ctxItems = purpose === "REPOSITORY_ANALYSIS" ? 3000 + Math.floor(rand() * 8000) : 20 + Math.floor(rand() * 200);
    const inTok = 2000 + Math.floor(rand() * 30000);
    const outTok = 300 + Math.floor(rand() * 3000);
    const durationMs = 4000 + Math.floor(rand() * 90000);
    const run: T.AIRun = {
      id: runId, key: `AIR-${runId.replace("air_", "")}`, organizationId: org.id, userId: [DEMO.users.ahmad, DEMO.users.daniel, DEMO.users.sarah][Math.floor(rand() * 3)], provider: (["ANTHROPIC", "OPENAI", "ANTHROPIC", "GOOGLE"] as T.AIProviderKind[])[Math.floor(rand() * 4)], model: "", purpose, client: clients[Math.floor(rand() * clients.length)],
      startTime: start.toISOString(), endTime: new Date(start.getTime() + durationMs).toISOString(), durationMs, status: failed ? "FAILED" : "COMPLETED", inputTokens: inTok, outputTokens: outTok, estimatedCost: +((inTok * 0.000012 + outTok * 0.00006) * 4.7).toFixed(3), costIsEstimate: true,
      mcpCallCount: nCalls, taskCount: purpose === "DEPLOYMENT" || purpose === "PLAN_TASK" ? 1 : 0, agentOperationCount: det, successCount: failed ? nCalls - 1 : nCalls, failureCount: failed ? 1 : 0, retryCount: rand() < 0.2 ? 1 : 0, approvalCount: purpose === "DEPLOYMENT" && rand() < 0.5 ? 1 : 0, humanInterventionCount: rand() < 0.1 ? 1 : 0, recoveryCount: rand() < 0.15 ? 1 : 0, rollbackCount: rand() < 0.03 ? 1 : 0,
      aiDecisions, deterministicOperations: det, aiRequestsAvoided: purpose === "DEPLOYMENT" ? 23 : purpose === "PLAN_TASK" ? 12 : det > 0 ? det : 0,
      context: { contextType: purpose === "REPOSITORY_ANALYSIS" ? "repository" : "change", contextItemCount: ctxItems, contextSizeEstimate: ctxItems * 380, sourceCount: 1 + Math.floor(rand() * 4), relevantItemCount: purpose === "REPOSITORY_ANALYSIS" ? 8 + Math.floor(rand() * 20) : Math.floor(ctxItems * 0.6) },
      changeId: changeIds[Math.floor(rand() * changeIds.length)], finalStatus: failed ? "TOOL_FAILURE" : "SUCCESS", trace: [],
    };
    run.model = run.provider === "ANTHROPIC" ? "claude-sonnet-5" : run.provider === "OPENAI" ? "gpt-5" : "gemini-2.5-pro";
    let prev: string | undefined;
    for (let j = 0; j < nCalls; j++) {
      const toolName = purpose === "CHECK_STATUS" ? tools[Math.floor(rand() * 4)] : purpose === "REPOSITORY_ANALYSIS" ? "super.project.analyze" : tools[Math.floor(rand() * tools.length)];
      const dur = toolName === "super.project.analyze" ? 1800 + Math.floor(rand() * 2400) : 80 + Math.floor(rand() * 600);
      const at = new Date(start.getTime() + j * 1200);
      const inputHash = hash(`${toolName}:${run.changeId}:${Math.floor(rand() * (purpose === "CHECK_STATUS" ? 2 : 50))}`);
      const redundant = calls.some((c) => c.aiRunId === runId && c.inputHash === inputHash);
      const c: T.MCPCall = { id: id("mcp"), aiRunId: runId, organizationId: org.id, userId: run.userId, toolName, toolVersion: "1.0.0", startTime: at.toISOString(), endTime: new Date(at.getTime() + dur).toISOString(), durationMs: dur, status: failed && j === nCalls - 1 ? "FAILED" : "SUCCESS", errorCode: failed && j === nCalls - 1 ? "TOOL_FAILURE" : undefined, changeId: run.changeId, sequenceNumber: j + 1, parentCallId: prev, cache: { hit: redundant, ageMs: redundant ? 1200 : undefined, refreshReason: redundant ? undefined : "state-changed" }, redundant, inputHash };
      calls.push(c); prev = c.id;
    }
    run.trace = [
      { at: run.startTime, kind: "REQUEST", message: "User request received" },
      { at: run.startTime, kind: "DECISION", message: `AI interpreted request as ${purpose.toLowerCase().replace("_", " ")}`, reasonCategory: purpose },
      ...calls.filter((c) => c.aiRunId === runId).slice(0, 4).map((c) => ({ at: c.startTime, kind: "TOOL" as const, message: c.toolName, toolName: c.toolName, executionResult: c.status })),
      { at: run.endTime!, kind: "RESULT", message: failed ? "Tool failure — escalated" : "Completed", executionResult: run.finalStatus },
    ];
    runs.push(run);
  }
  // The showcase run for the Claims v2.8 approval
  runs.push({ id: "air_10482", key: "AIR-10482", organizationId: org.id, userId: DEMO.users.daniel, provider: "ANTHROPIC", model: "claude-sonnet-5", purpose: "DEPLOYMENT", client: "Claude", startTime: ago.m(36), endTime: ago.m(35), durationMs: 48000, status: "COMPLETED", inputTokens: 9800, outputTokens: 1200, estimatedCost: 0.89, costIsEstimate: true, mcpCallCount: 4, taskCount: 1, agentOperationCount: 0, successCount: 4, failureCount: 0, retryCount: 0, approvalCount: 1, humanInterventionCount: 0, recoveryCount: 0, rollbackCount: 0, aiDecisions: 4, deterministicOperations: 0, aiRequestsAvoided: 8, context: { contextType: "change", contextItemCount: 12, contextSizeEstimate: 4800, sourceCount: 3, relevantItemCount: 12 }, changeId: claimsRelease.id, finalStatus: "WAITING_APPROVAL", trace: [
    { at: ago.m(36), kind: "REQUEST", message: "User request received: “Deploy Claims Portal v2.8 to Production”" },
    { at: ago.m(36), kind: "DECISION", message: "AI interpreted request as production deployment of an existing Change", reasonCategory: "DEPLOYMENT" },
    { at: ago.m(36), kind: "TOOL", message: "super.change.get", toolName: "super.change.get", executionResult: "SUCCESS" },
    { at: ago.m(36), kind: "TOOL", message: "super.deployment.status", toolName: "super.deployment.status", executionResult: "SUCCESS" },
    { at: ago.m(36), kind: "DECISION", message: "Created deployment task deploy-application v1.4.0", reasonCategory: "PLAN_TASK" },
    { at: ago.m(35), kind: "POLICY", message: "Policy evaluated: Production deployment requires 1 approval", policyResult: "WAITING_APPROVAL" },
    { at: ago.m(35), kind: "APPROVAL", message: "Approval APR-31 requested from Organization Owner" },
    { at: ago.m(35), kind: "RESULT", message: "Waiting for approval", executionResult: "WAITING_APPROVAL" },
  ] });
  await store.aiRuns.putMany(runs);
  await store.mcpCalls.putMany(calls);

  await store.aiFailures.putMany([
    { id: "aif_1", organizationId: org.id, aiRunId: "air_10462", taskId: "tsk_2035", type: "TOOL_FAILURE", rootCause: "Docker", message: "Docker build failed: peer dependency mismatch", at: ago.d(2), recovered: false },
    { id: "aif_2", organizationId: org.id, aiRunId: "air_10320", type: "INSUFFICIENT_CONTEXT", rootCause: "AI", message: "Repository analysis loaded 8,421 files; plan referenced a non-existent project", at: ago.d(6), recovered: true },
    { id: "aif_3", organizationId: org.id, aiRunId: "air_10333", type: "POLICY_BLOCK", rootCause: "Policy", message: "Attempted production restart without approval", at: ago.d(9), recovered: true },
    { id: "aif_4", organizationId: org.id, aiRunId: "air_10340", type: "WRONG_PARAMETERS", rootCause: "AI", message: "super.application.deploy called with environment name instead of id", at: ago.d(11), recovered: true },
  ]);
  await store.aiRecoveries.putMany([
    { id: "rec_1", organizationId: org.id, failureId: "aif_2", originalTaskId: "tsk_2027", diagnosis: "Context overload: irrelevant repository files", recovery: "Narrowed context to detected project manifests", result: "SUCCESS", recoveryCount: 1, timeToRecoveryMs: 41000, executionMode: "AI", at: ago.d(6) },
    { id: "rec_2", organizationId: org.id, failureId: "aif_4", originalTaskId: "tsk_2029", diagnosis: "Parameter validation failed", recovery: "Resolved environment id from name via super.environment.inspect", result: "SUCCESS", recoveryCount: 1, timeToRecoveryMs: 3800, executionMode: "TASK_ENGINE", at: ago.d(11) },
  ]);
  await store.humanInterventions.putMany([
    { id: "hi_1", organizationId: org.id, userId: DEMO.users.daniel, userName: "Daniel Tan", taskId: "tsk_2035", changeId: payments.id, reason: "Escalated Docker build failure", action: "Pinned peer dependency manually", at: ago.d(2) },
    { id: "hi_2", organizationId: org.id, userId: DEMO.users.sarah, userName: "Sarah Lim", changeId: claims.id, reason: "Policy clarification", action: "Added ABC production migration policy", at: ago.d(12) },
    { id: "hi_3", organizationId: org.id, userId: DEMO.users.ahmad, userName: "Ahmad Razak", changeId: customer.id, aiRunId: "air_10471", reason: "Approval", action: "Approved production deployment", at: ago.h(6) },
  ]);
  await store.knowledge.putMany([
    { id: "kr_dotnet_sdk", organizationId: null, type: "KNOWN_RECOVERY", title: ".NET SDK mismatch", condition: "Project requires .NET 10; Agent has .NET 8", resolution: "Install .NET 10 SDK via package manager, re-run check-sdk", successRate: 0.98, applications: 41, taskDefinitionId: "create-dotnet-project", createdAt: ago.d(60) },
    { id: "kr_container_restart", organizationId: null, type: "KNOWN_RECOVERY", title: "Health check fails during container warm-up", condition: "HEALTH_CHECK_FAILED within 30s of container start", resolution: "Restart container, wait for warm-up (up to 45s), re-run health check", successRate: 0.91, applications: 133, taskDefinitionId: "deploy-application", createdAt: ago.d(70) },
    { id: "kr_docker_peer", organizationId: org.id, type: "KNOWN_FAILURE", title: "Docker build: npm peer dependency mismatch", condition: "BUILD_FAILED with 'peer dependency' in output", resolution: "Not yet deterministic — recommendation open", successRate: 0.55, applications: 41, createdAt: ago.d(20) },
    { id: "kr_deploy_pattern", organizationId: org.id, type: "DEPLOYMENT_PATTERN", title: "Rolling deploy across 2 prod nodes", condition: "PRODUCTION with ≥2 app servers", resolution: "Deploy node 2 first, verify, then node 1", successRate: 1, applications: 9, createdAt: ago.d(40) },
  ]);
  const patterns = detectProblemPatterns(tasks, org.id, now);
  patterns.push({ id: "pp_docker", organizationId: org.id, title: "Docker build failed ×41", signature: "DEPLOYMENT:docker-build", occurrences: 41, affectedRepositories: 18, likelyCause: "Dependency mismatch", recommendation: "Create deterministic Docker recovery task", rootCause: "Docker", firstSeenAt: ago.d(60), lastSeenAt: ago.d(2) });
  await store.problemPatterns.putMany(patterns.filter((p, i, a) => a.findIndex((x) => x.signature === p.signature) === i));
  const recs = generateRecommendations(calls, runs, tasks, org.id, now);
  recs.unshift(
    { id: "rec_top_1", organizationId: org.id, type: "CONSOLIDATE_MCP_TOOL", title: "Consolidate environment inspection", description: "super.environment.inspect, server.inspect and docker.inspect are called repeatedly within single AI runs. One super.environment.snapshot resource returns everything.", evidence: "1,842 redundant calls", estimatedReductionPct: 78, estimatedSavingsMyr: 312, status: "REVIEWING", createdAt: ago.d(3), updatedAt: ago.d(1) },
    { id: "rec_top_2", organizationId: org.id, type: "ADD_CACHE", title: "Cache repository metadata", description: "Repository metadata (branches, last commit, stack) is fetched on every run although webhooks already signal changes.", evidence: "921 repeated calls", estimatedReductionPct: 54, estimatedSavingsMyr: 140, status: "NEW", createdAt: ago.d(3), updatedAt: ago.d(3) },
    { id: "rec_top_3", organizationId: org.id, type: "CREATE_DETERMINISTIC_TASK", title: "Create deterministic Docker recovery", description: "Docker build failures caused by dependency mismatch were diagnosed by AI 84 times. Encode 'clear cache → pin peer dependency → rebuild' as a recovery strategy.", evidence: "84 AI diagnoses", estimatedReductionPct: 90, estimatedSavingsMyr: 410, status: "APPROVED", createdAt: ago.d(5), updatedAt: ago.h(20) },
    { id: "rec_top_4", organizationId: org.id, type: "IMPROVE_AGENT_ROUTING", title: "Improve GitLab pipeline retrieval", description: "Pipeline status via the self-managed GitLab API averages 2.8s. Route through the Agent local cache with incremental polling.", evidence: "Average latency 2.8s", estimatedReductionPct: 60, status: "NEW", createdAt: ago.d(4), updatedAt: ago.d(4) },
  );
  await store.recommendations.putMany(recs);
  await store.experiments.putMany([{ id: "exp_1", organizationId: org.id, name: "Snapshot vs. inspect for status checks", oldStrategy: "environment.inspect ×N", newStrategy: "environment.snapshot ×1", calls: { before: 14, after: 1 }, contextSize: { before: 52000, after: 9000 }, latencyMs: { before: 18400, after: 2100 }, outcome: "IMPROVED", savingsPct: 83, status: "COMPLETED" }]);

  // ----- audit & notifications -----
  const audit = (n: number, actorId: string, actorName: string, action: string, resourceType: string, resourceId: string, resourceLabel: string, at: string, risk: T.RiskLevel = "LOW", result: T.AuditLog["result"] = "SUCCESS", mode: T.ExecutionMode = "HUMAN", detail?: string): T.AuditLog => ({ id: `aud_${n}`, organizationId: org.id, actorId, actorName, action, resourceType, resourceId, resourceLabel, timestamp: at, result, risk, correlationId: `cor_${hash(action + at)}`, executionMode: mode, detail });
  await store.auditLogs.putMany([
    audit(1, DEMO.users.ahmad, "Ahmad Razak", "auth.login", "user", DEMO.users.ahmad, "Ahmad Razak", ago.m(5)),
    audit(2, DEMO.users.daniel, "Daniel Tan", "approval.requested", "approval", DEMO.approvals.claimsProd, "APR-31 Deploy Claims Portal v2.8", ago.m(35), "HIGH", "SUCCESS", "AI", "Requested via Claude (AIR-10482)"),
    audit(3, DEMO.users.daniel, "Daniel Tan", "task.create", "task", "tsk_pending_claims", "Deploy claims-portal v2.8.0 to Production", ago.m(35), "HIGH", "SUCCESS", "AI"),
    audit(4, DEMO.users.ahmad, "Ahmad Razak", "approval.approved", "approval", "apr_done_1", "APR-27 Deploy Customer Portal v1.12.0", ago.h(6), "LOW"),
    audit(5, DEMO.users.daniel, "Daniel Tan", "deployment.completed", "deployment", "dep_1", "customer-portal v1.12.0 → Production", ago.h(5.8), "LOW", "SUCCESS", "TASK_ENGINE"),
    audit(6, DEMO.users.ahmad, "Ahmad Razak", "approval.approved", "approval", "apr_claims_migration", "APR-30 Production migration: claim_documents (1/2)", ago.h(2), "HIGH"),
    audit(7, DEMO.users.sarah, "Sarah Lim", "auth.login", "user", DEMO.users.sarah, "Sarah Lim", ago.h(2)),
    audit(8, DEMO.users.sarah, "Sarah Lim", "policy.updated", "policy", "pol_abc_prod_deploy_2", "ABC: Production deployment with database change", ago.d(12), "HIGH"),
    audit(9, DEMO.users.daniel, "Daniel Tan", "task.escalated", "task", "tsk_2035", "Deploy payments-api v2.4.1-dev.12", ago.d(2), "LOW", "FAILED", "TASK_ENGINE", "BUILD_FAILED after 2 retries"),
    audit(10, DEMO.users.daniel, "Daniel Tan", "credential.used", "credential", "cred_1", "github-production", ago.m(20), "MEDIUM", "SUCCESS", "AGENT"),
    audit(11, DEMO.users.daniel, "Daniel Tan", "deployment.denied", "task", "tsk_denied", "Restart payments-api (Production)", ago.d(9), "HIGH", "DENIED", "AI", "Policy: Production restart requires 1 approval"),
    audit(12, DEMO.users.ahmad, "Ahmad Razak", "agent.registered", "agent", DEMO.agents.prod, "Production Agent", ago.d(88), "MEDIUM"),
    audit(13, DEMO.users.sarah, "Sarah Lim", "data.export", "export", "exp_1", "Audit logs (CSV)", ago.d(3), "MEDIUM"),
  ]);
  await store.notifications.putMany([
    { id: "ntf_1", organizationId: org.id, userId: DEMO.users.ahmad, event: "APPROVAL_REQUESTED", title: "Production deployment approval required", body: "Daniel requested approval to deploy Claims Portal v2.8 to Production (risk HIGH).", href: `/approvals/${DEMO.approvals.claimsProd}`, read: false, channel: "IN_APP", createdAt: ago.m(35) },
    { id: "ntf_2", organizationId: org.id, userId: DEMO.users.sarah, event: "APPROVAL_REQUESTED", title: "Migration approval required", body: "Production migration claim_documents needs Security Admin approval (1 of 2 done).", href: `/approvals/apr_claims_migration`, read: false, channel: "IN_APP", createdAt: ago.h(3) },
    { id: "ntf_3", organizationId: org.id, userId: DEMO.users.ahmad, event: "AGENT_OFFLINE", title: "Production Agent degraded", body: "prod-app-02 agent memory 83%, heartbeat latency 210ms.", href: `/agents/${DEMO.agents.prod}`, read: false, channel: "IN_APP", createdAt: ago.h(4) },
    { id: "ntf_4", organizationId: org.id, userId: DEMO.users.daniel, event: "DEPLOYMENT_COMPLETED", title: "customer-portal v1.12.0 deployed", body: "Production deployment healthy. Live validation passed; UAT activated.", href: `/changes/${customer.id}`, read: true, channel: "IN_APP", createdAt: ago.h(5.8) },
    { id: "ntf_5", organizationId: org.id, userId: DEMO.users.ahmad, event: "INCIDENT_CREATED", title: "INC-19: payments-api Docker build failing", body: "Self-healing retried twice then escalated. Owner notified.", href: `/incidents/inc_1`, read: true, channel: "IN_APP", createdAt: ago.d(2) },
  ]);

  // ----- evidence & timeline for key changes -----
  const ev = (changeId: string, stageKey: T.ChangeStageKey, type: T.EvidenceType, title: string, at: string, reference?: string, summary?: string, source: T.ExecutionMode = "SYSTEM"): T.ChangeEvidence => ({ id: id("evd"), changeId, stageKey, type, title, reference, summary, source, createdAt: at, classification: "INTERNAL" });
  await store.evidence.putMany([
    ev(claims.id, "REQUIREMENTS", "REQUIREMENTS", "Requirements confirmed (5 items)", ago.d(9), undefined, undefined, "HUMAN"),
    ev(claims.id, "JIRA", "JIRA_ISSUE", "CLM-412 Epic + 4 issues created", ago.d(9), "CLM-412", undefined, "TASK_ENGINE"),
    ev(claims.id, "DEVELOPMENT", "GIT_COMMIT", "23 commits on feature/document-upload", ago.h(3), "a91f3c2", undefined, "AGENT"),
    ev(claims.id, "REVIEW", "PULL_REQUEST", "PR #218 merged", ago.d(1), "#218", "2 approvals, 14 comments", "WEBHOOK"),
    ev(claims.id, "TESTING", "CI_RESULT", "CI passed (build, 412 tests)", ago.d(1), "run 8812", undefined, "WEBHOOK"),
    ev(claims.id, "TESTING", "TEST_RESULT", "Integration tests: 88 passed", ago.d(1), undefined, undefined, "AGENT"),
    ev(claims.id, "DEPLOYMENT_PREPARATION", "DOCKER_IMAGE", "claims-portal:v2.8.0-rc.3", ago.d(1), "sha256:9f2c…a1", "184 MB, 0 critical CVEs", "AGENT"),
    ev(claims.id, "DEPLOYMENT_PREPARATION", "DEPLOYMENT_LOG", "Staging deployment (self-healed)", ago.d(1), "dep_2", "1 recovery: container warm-up", "TASK_ENGINE"),
    ev(claims.id, "DEPLOYMENT_PREPARATION", "APPROVAL", "APR-30 migration approval 1/2", ago.h(2), "APR-30", "Ahmad approved; waiting Security Admin", "HUMAN"),
    ev(claimsRelease.id, "DEVELOPMENT", "GIT_COMMIT", "41 commits on release/2.8", ago.d(1), "e02b7f9", undefined, "AGENT"),
    ev(claimsRelease.id, "REVIEW", "PULL_REQUEST", "PR #231 merged", ago.d(1), "#231", undefined, "WEBHOOK"),
    ev(claimsRelease.id, "TESTING", "CI_RESULT", "CI passed", ago.d(1), "run 8830", undefined, "WEBHOOK"),
    ev(claimsRelease.id, "DEPLOYMENT_PREPARATION", "DOCKER_IMAGE", "claims-portal:v2.8.0", ago.h(5), "sha256:77ab…", "184 MB, 0 critical CVEs", "AGENT"),
    ev(claimsRelease.id, "DEPLOYMENT_PREPARATION", "SERVER_HEALTH", "Production nodes healthy (2/2)", ago.h(1), undefined, "cpu 31%, mem 58%", "AGENT"),
    ev(customer.id, "DEPLOYMENT", "DEPLOYMENT_LOG", "customer-portal v1.12.0 → Production", ago.h(5.8), "dep_1", undefined, "TASK_ENGINE"),
    ev(customer.id, "LIVE_VALIDATION", "SMOKE_TEST", "Smoke tests passed (6/6)", ago.h(5.7), undefined, undefined, "AGENT"),
  ]);
  const tl = (changeId: string, at: string, kind: T.TimelineEvent["kind"], message: string, actor: string, mode: T.ExecutionMode): T.TimelineEvent => ({ id: id("tl"), changeId, at, kind, message, actor, executionMode: mode });
  await store.timeline.putMany([
    tl(claims.id, ago.d(9), "AI", "Change created from intent “Add customer document upload to the claims portal.”", "AI (Claude)", "AI"),
    tl(claims.id, ago.d(9), "STAGE", "Requirements confirmed", "Ahmad Razak", "HUMAN"),
    tl(claims.id, ago.d(9), "TASK", "Jira Epic CLM-412 and 4 issues created", "Task Engine", "TASK_ENGINE"),
    tl(claims.id, ago.d(1), "SYSTEM", "PR #218 merged → Development complete → Testing activated", "Webhook", "WEBHOOK"),
    tl(claims.id, ago.d(1), "SYSTEM", "CI passed → Testing complete → Deployment Preparation activated", "Webhook", "WEBHOOK"),
    tl(claims.id, ago.d(1), "DEPLOYMENT", "Staging deployment healthy after 1 self-healing recovery", "Task Engine", "TASK_ENGINE"),
    tl(claims.id, ago.h(3), "APPROVAL", "Migration approval APR-30 requested (2 required)", "Task Engine", "TASK_ENGINE"),
    tl(claims.id, ago.h(2), "APPROVAL", "Ahmad Razak approved APR-30 (1/2)", "Ahmad Razak", "HUMAN"),
    tl(claims.id, ago.h(2), "SYSTEM", "Blocked: waiting for Security Admin approval", "System", "SYSTEM"),
    tl(claimsRelease.id, ago.d(2), "AI", "Change created from intent “Deploy Claims Portal v2.8 to Production.”", "AI (Claude)", "AI"),
    tl(claimsRelease.id, ago.d(1), "SYSTEM", "PR #231 merged, CI passed → Deployment Preparation activated", "Webhook", "WEBHOOK"),
    tl(claimsRelease.id, ago.h(1), "SYSTEM", "Checklist complete → Approval requested", "System", "SYSTEM"),
    tl(claimsRelease.id, ago.m(35), "APPROVAL", "APR-31 requested from Organization Owner (risk HIGH)", "AI (Claude) via Daniel Tan", "AI"),
    tl(customer.id, ago.h(6), "APPROVAL", "APR-27 approved by Ahmad Razak", "Ahmad Razak", "HUMAN"),
    tl(customer.id, ago.h(6), "DEPLOYMENT", "Deployment to Production started", "Task Engine", "TASK_ENGINE"),
    tl(customer.id, ago.h(5.8), "DEPLOYMENT", "Deployment healthy → Live Validation activated", "Task Engine", "TASK_ENGINE"),
    tl(customer.id, ago.h(5.7), "SYSTEM", "Live validation passed → UAT activated", "System", "SYSTEM"),
  ]);

  // ----- billing -----
  await store.subscriptions.putMany([
    { id: "sub_abc", organizationId: org.id, planId: "team", status: "ACTIVE", billingCycle: "MONTHLY", aiMode: "PLATFORM", currentPeriodStart: ago.d(18), currentPeriodEnd: ago.d(-12) },
    { id: "sub_personal", organizationId: personal.id, planId: "free", status: "ACTIVE", billingCycle: "MONTHLY", aiMode: "BYOK", aiProvider: "ANTHROPIC", aiCredentialRef: "anthropic-personal", currentPeriodStart: ago.d(18), currentPeriodEnd: ago.d(-12) },
  ]);
  const period = now.slice(0, 7);
  await store.usage.putMany([
    { id: `use_${org.id}_${period}`, organizationId: org.id, period, users: 7, agents: 12, environments: 18, activeChanges: 4, taskExecutions: 2841, aiRequests: 932, aiRequestsAvoided: 4812, aiCostMyr: 486.2, automationExecutions: 3700 },
    { id: `use_${personal.id}_${period}`, organizationId: personal.id, period, users: 1, agents: 1, environments: 1, activeChanges: 1, taskExecutions: 12, aiRequests: 40, aiRequestsAvoided: 130, aiCostMyr: 9.4, automationExecutions: 3 },
  ]);
  await store.invoices.putMany([
    { id: "inv_3", organizationId: org.id, number: "INV-2026-0091", period: period, amountMyr: 599, status: "OPEN", issuedAt: ago.d(18), lines: [{ label: "Team plan", amountMyr: 599 }] },
    { id: "inv_2", organizationId: org.id, number: "INV-2026-0074", period: "2026-08", amountMyr: 698, status: "PAID", issuedAt: ago.d(48), lines: [{ label: "Team plan", amountMyr: 599 }, { label: "Marketplace: PostgreSQL Disaster Recovery", amountMyr: 99 }] },
    { id: "inv_1", organizationId: org.id, number: "INV-2026-0058", period: "2026-07", amountMyr: 599, status: "PAID", issuedAt: ago.d(78), lines: [{ label: "Team plan", amountMyr: 599 }] },
  ]);

  // ----- marketplace & automations -----
  const mp = (i: number, name: string, publisher: string, description: string, category: string, pricing: T.MarketplaceItem["pricing"], priceMyr: number | undefined, risk: T.RiskLevel, integrations: string[], perms: T.Permission[], approval: string, installed = false): T.MarketplaceItem => ({ id: `mkt_${i}`, name, publisher, description, category, pricing, priceMyr, version: "1." + i + ".0", rating: 4 + (i % 10) / 10, installs: 120 * i + 40, risk, requiredIntegrations: integrations, requiredPermissions: perms, approvalRequirements: approval, triggers: ["manual", "schedule", "webhook"], tasks: [name.toLowerCase().replace(/\s+/g, "-")], installed });
  await store.marketplace.putMany([
    mp(1, ".NET Project Factory", "Super MCP", "Generate .NET solutions with Clean Architecture, CQRS or Vertical Slice.", "Software Factory", "FREE", undefined, "LOW", [], ["task.create"], "None", true),
    mp(2, "Docker Recovery", "Super MCP", "Deterministic recovery for common Docker build and runtime failures.", "Self-Healing", "FREE", undefined, "MEDIUM", ["Docker"], ["docker.restart"], "None"),
    mp(3, "PostgreSQL Backup", "Super MCP", "Scheduled backups with integrity verification and retention.", "Database", "FREE", undefined, "LOW", ["Database"], ["database.backup"], "None", true),
    mp(4, "Proxmox VM Deployment", "Super MCP", "Create, configure and bootstrap VMs from templates.", "Infrastructure", "PAID", 149, "MEDIUM", ["Proxmox"], ["proxmox.vm.create"], "Per policy"),
    mp(5, "GitLab CI Repair", "OpsForge", "Diagnose and repair failing GitLab pipelines.", "CI/CD", "PAID", 99, "MEDIUM", ["GitLab"], ["repository.build"], "None"),
    mp(6, "GitHub Actions Repair", "OpsForge", "Diagnose and repair failing GitHub Actions workflows.", "CI/CD", "PAID", 99, "MEDIUM", ["GitHub"], ["repository.build"], "None"),
    mp(7, "Nginx Setup", "Super MCP", "Install and configure Nginx with hardened defaults.", "Infrastructure", "FREE", undefined, "MEDIUM", [], ["server.install", "server.configure"], "Production: 1 approval"),
    mp(8, "SSL Renewal", "Super MCP", "Automated certificate renewal with validation and rollback.", "Security", "FREE", undefined, "MEDIUM", [], ["server.configure"], "None", true),
    mp(9, "Security Hardening", "SecureStack", "CIS-aligned OS and Docker hardening with a report.", "Security", "SUBSCRIPTION", 49, "HIGH", [], ["server.configure", "security.manage"], "Security Admin approval"),
    mp(10, "Database Migration", "Super MCP", "Backup, dry-run, apply and verify migrations.", "Database", "FREE", undefined, "HIGH", ["Database"], ["database.migrate"], "Production: 2 approvals", true),
    mp(11, "Server Doctor", "Super MCP", "Diagnose disk, memory, CPU, network and service issues.", "Diagnostics", "FREE", undefined, "LOW", [], ["server.read"], "None", true),
    mp(12, "PostgreSQL Disaster Recovery", "DataGuard", "Point-in-time recovery playbook with validation.", "Database", "PAID", 99, "CRITICAL", ["Database"], ["database.restore"], "2 approvals + typed confirmation", true),
    mp(13, "Environment Doctor", "Super MCP", "Detect drift and missing components across environments.", "Diagnostics", "FREE", undefined, "LOW", [], ["environment.read"], "None"),
    mp(14, "Enterprise Compliance Pack", "SecureStack", "Evidence collection for ISO 27001 / SOC 2.", "Security", "ENTERPRISE", undefined, "LOW", [], ["audit.read"], "None"),
  ]);
  await store.automations.putMany([
    { id: "auto_1", organizationId: org.id, marketplaceItemId: "mkt_3", name: "Nightly PostgreSQL backup (Production)", description: "Backup + verify every night at 02:00.", version: "1.3.0", enabled: true, schedule: "0 2 * * *", trigger: "schedule", taskDefinitionId: "backup-database", runs: 88, lastRunAt: ago.h(22), lastResult: "SUCCESS" },
    { id: "auto_2", organizationId: org.id, marketplaceItemId: "mkt_8", name: "SSL renewal check", description: "Renew certificates expiring within 14 days.", version: "1.8.0", enabled: true, schedule: "0 4 * * 1", trigger: "schedule", taskDefinitionId: "health-check", runs: 12, lastRunAt: ago.d(3), lastResult: "SUCCESS" },
    { id: "auto_3", organizationId: org.id, marketplaceItemId: "mkt_11", name: "Server Doctor on agent degraded", description: "Run diagnostics when an agent reports DEGRADED.", version: "1.11.0", enabled: true, trigger: "agent.degraded", taskDefinitionId: "diagnose-incident", runs: 5, lastRunAt: ago.h(4), lastResult: "SUCCESS" },
    { id: "auto_4", organizationId: org.id, marketplaceItemId: "mkt_1", name: ".NET Project Factory", description: "On-demand project generation.", version: "2.0.0", enabled: true, trigger: "manual", taskDefinitionId: "create-dotnet-project", runs: 7, lastRunAt: ago.d(6), lastResult: "SUCCESS" },
  ]);
}
