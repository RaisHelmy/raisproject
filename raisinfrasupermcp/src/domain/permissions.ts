import type { Permission, Role, Actor } from "./types";

export const ALL_PERMISSIONS: Permission[] = [
  "organization.read", "organization.manage",
  "user.read", "user.invite", "user.remove",
  "group.read", "group.manage",
  "role.read", "role.manage",
  "agent.read", "agent.execute", "agent.update", "agent.quarantine",
  "environment.read", "environment.execute", "environment.restart", "environment.shutdown",
  "server.read", "server.install", "server.configure", "server.restart",
  "docker.read", "docker.deploy", "docker.restart",
  "proxmox.read", "proxmox.vm.create", "proxmox.vm.start", "proxmox.vm.stop", "proxmox.vm.delete",
  "repository.read", "repository.clone", "repository.build",
  "deployment.create", "deployment.rollback",
  "database.read", "database.migrate", "database.backup", "database.restore",
  "jira.read", "jira.write", "jira.worklog",
  "change.read", "change.create", "change.manage",
  "task.create", "task.execute", "task.approve", "task.reject", "task.cancel",
  "automation.create", "automation.execute",
  "audit.read",
  "security.manage", "policy.manage",
  "billing.read", "billing.manage",
  "analytics.read",
  "data.export",
];

const READ_ALL: Permission[] = ALL_PERMISSIONS.filter((p) => p.endsWith(".read"));

const DEVELOPER: Permission[] = [
  ...READ_ALL,
  "change.create", "change.manage", "repository.clone", "repository.build", "task.create", "task.execute",
  "jira.write", "jira.worklog", "docker.deploy", "deployment.create", "analytics.read",
];

const DEVOPS: Permission[] = [
  ...DEVELOPER,
  "agent.execute", "agent.update", "environment.execute", "environment.restart", "server.install", "server.configure",
  "server.restart", "docker.restart", "proxmox.vm.create", "proxmox.vm.start", "proxmox.vm.stop", "deployment.rollback",
  "database.migrate", "database.backup", "database.restore", "task.approve", "task.reject", "task.cancel",
  "automation.create", "automation.execute", "data.export",
];

const QA: Permission[] = [...READ_ALL, "change.manage", "task.create", "jira.write", "jira.worklog", "analytics.read"];

const SECURITY_ADMIN: Permission[] = [
  ...READ_ALL, "security.manage", "policy.manage", "agent.quarantine", "agent.update", "task.approve", "task.reject",
  "task.cancel", "user.read", "audit.read", "data.export", "analytics.read", "role.manage", "group.manage",
];

const AUTOMATION_ADMIN: Permission[] = [...DEVOPS, "automation.create", "automation.execute", "policy.manage"];
const AUDITOR: Permission[] = [...READ_ALL, "audit.read", "data.export", "analytics.read"];
const VIEWER: Permission[] = READ_ALL;
const ORG_ADMIN: Permission[] = ALL_PERMISSIONS.filter((p) => p !== "security.manage");
const ORG_OWNER: Permission[] = ALL_PERMISSIONS;

export const DEFAULT_ROLES: Omit<Role, "id">[] = [
  { organizationId: null, key: "org_owner", name: "Organization Owner", description: "Full control, including billing and security policy.", permissions: ORG_OWNER, builtIn: true },
  { organizationId: null, key: "org_admin", name: "Organization Admin", description: "Manage users, groups, roles and infrastructure.", permissions: ORG_ADMIN, builtIn: true },
  { organizationId: null, key: "security_admin", name: "Security Admin", description: "Policies, approvals, quarantine and audit.", permissions: SECURITY_ADMIN, builtIn: true },
  { organizationId: null, key: "automation_admin", name: "Automation Admin", description: "Create and run automations and policies.", permissions: AUTOMATION_ADMIN, builtIn: true },
  { organizationId: null, key: "devops", name: "DevOps", description: "Deploy, operate and heal environments.", permissions: DEVOPS, builtIn: true },
  { organizationId: null, key: "developer", name: "Developer", description: "Create Changes, build and test.", permissions: DEVELOPER, builtIn: true },
  { organizationId: null, key: "qa", name: "QA", description: "Test plans, testing queue and UAT.", permissions: QA, builtIn: true },
  { organizationId: null, key: "auditor", name: "Auditor", description: "Read-only access including audit logs and exports.", permissions: AUDITOR, builtIn: true },
  { organizationId: null, key: "viewer", name: "Viewer", description: "Read-only.", permissions: VIEWER, builtIn: true },
];

export function can(actor: Actor, permission: Permission): boolean {
  return actor.permissions.includes(permission);
}

export function requirePermission(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new PermissionDenied(permission);
  }
}

export class PermissionDenied extends Error {
  code = "FORBIDDEN" as const;
  constructor(public permission: Permission) {
    super(`Permission required: ${permission}`);
    this.name = "PermissionDenied";
  }
}

export function permissionsForRoles(roleKeys: string[], roles: Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const key of roleKeys) {
    const role = roles.find((r) => r.key === key || r.id === key);
    role?.permissions.forEach((p) => set.add(p));
  }
  return [...set];
}

/** Which permission is required to execute a task of a given type. */
export const TASK_TYPE_PERMISSION: Record<string, Permission> = {
  DEPLOYMENT: "deployment.create",
  ROLLBACK: "deployment.rollback",
  DATABASE_MIGRATION: "database.migrate",
  PROJECT_CREATE: "task.create",
  ENVIRONMENT_BOOTSTRAP: "server.install",
  RESTART: "environment.restart",
  VM_CREATE: "proxmox.vm.create",
  VM_DELETE: "proxmox.vm.delete",
  VM_START: "proxmox.vm.start",
  VM_STOP: "proxmox.vm.stop",
  PACKAGE_INSTALL: "server.install",
  REPOSITORY_ANALYZE: "repository.read",
  DIAGNOSE: "task.create",
  BACKUP: "database.backup",
  HEALTH_CHECK: "environment.read",
  CREDENTIAL_CHANGE: "security.manage",
  POLICY_CHANGE: "policy.manage",
  CUSTOM: "task.create",
};
