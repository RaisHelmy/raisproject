import { queryAll, queryOne, type Db } from "./db";
import type { AuthContext, Role } from "./types";

// Every key here corresponds to a route that used to be gated with
// requireRole("admin", "hr") or requireRole("admin", "hr", "manager").
// `admin`-only gates (deletes, user management, audit log) are NOT part of
// this system — they stay hardcoded requireRole("admin") in their route
// files, deliberately: those are single-actor, hard-to-reverse operations
// where a misconfigured permission grant is a real risk, not a business
// decision worth making tenant-configurable.
export const PERMISSION_KEYS = [
  "employees.manage",
  "leave.types.manage",
  "leave.balances.view_others",
  "leave.approve",
  "attendance.team.view",
  "attendance.manage",
  "claims.approve",
  "requests.types.manage",
  "requests.approve",
  "assets.manage",
  "vendors.manage",
  "training.manage",
  "training.approve",
  "payroll.manage",
  "recruitment.manage",
  "uniform.manage",
  "uniform.approve",
  "ltip.manage",
  "workflows.manage",
  "workflows.routing_logs.view",
  "workflows.reassign_tasks",
  "claims.types.manage",
  "overtime.manage",
  "overtime.approve",
  "workschedule.manage",
  "leave.quota.manage",
  "leave.quota.approve",
  "leave.encashment.approve",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionDef = {
  key: PermissionKey;
  label: string;
  module: string;
  /** Roles (besides the always-on admin) granted this by default — exactly
   * mirrors what the old hardcoded requireRole(...) call allowed, so a
   * freshly-registered tenant behaves identically until an admin edits
   * something in Admin > Role Permissions. */
  defaultRoles: Array<"hr" | "manager">;
};

export const PERMISSIONS: PermissionDef[] = [
  { key: "employees.manage", label: "Create & edit employees", module: "Employees", defaultRoles: ["hr"] },
  { key: "leave.types.manage", label: "Manage leave types", module: "Leave", defaultRoles: ["hr"] },
  { key: "leave.balances.view_others", label: "View others' leave balances", module: "Leave", defaultRoles: ["hr", "manager"] },
  { key: "leave.approve", label: "Approve leave applications", module: "Leave", defaultRoles: ["hr", "manager"] },
  { key: "attendance.team.view", label: "View team timesheets", module: "Attendance", defaultRoles: ["hr", "manager"] },
  { key: "attendance.manage", label: "Edit timesheet remarks", module: "Attendance", defaultRoles: ["hr"] },
  { key: "claims.approve", label: "Approve claims", module: "Claims", defaultRoles: ["hr", "manager"] },
  { key: "requests.types.manage", label: "Manage request types", module: "Requests", defaultRoles: ["hr"] },
  { key: "requests.approve", label: "Approve employee requests", module: "Requests", defaultRoles: ["hr", "manager"] },
  { key: "assets.manage", label: "Manage asset registry & assignments", module: "Assets", defaultRoles: ["hr"] },
  { key: "vendors.manage", label: "Manage vendors", module: "Vendors", defaultRoles: ["hr"] },
  { key: "training.manage", label: "Manage training programs & enrollments", module: "Training", defaultRoles: ["hr"] },
  { key: "training.approve", label: "Approve training enrollments", module: "Training", defaultRoles: ["hr", "manager"] },
  { key: "payroll.manage", label: "Generate & view payslips", module: "Payroll", defaultRoles: ["hr"] },
  { key: "recruitment.manage", label: "Manage job postings & pipeline", module: "Recruitment", defaultRoles: ["hr"] },
  { key: "uniform.manage", label: "Manage uniform catalog", module: "Uniform", defaultRoles: ["hr"] },
  { key: "uniform.approve", label: "Approve uniform orders", module: "Uniform", defaultRoles: ["hr", "manager"] },
  { key: "ltip.manage", label: "Manage equity grants", module: "LTIP", defaultRoles: ["hr"] },
  { key: "workflows.manage", label: "Configure approval workflows", module: "Admin", defaultRoles: ["hr"] },
  { key: "workflows.routing_logs.view", label: "View tenant-wide routing logs", module: "Admin", defaultRoles: ["hr"] },
  { key: "workflows.reassign_tasks", label: "Reassign pending approval tasks", module: "Admin", defaultRoles: ["hr"] },
  { key: "claims.types.manage", label: "Manage claim types", module: "Claims", defaultRoles: ["hr"] },
  { key: "overtime.manage", label: "Manage overtime requests", module: "Attendance", defaultRoles: ["hr"] },
  { key: "overtime.approve", label: "Approve overtime requests", module: "Attendance", defaultRoles: ["hr", "manager"] },
  { key: "workschedule.manage", label: "Manage work schedules & assignments", module: "Attendance", defaultRoles: ["hr"] },
  { key: "leave.quota.manage", label: "Manage leave quota types", module: "Leave", defaultRoles: ["hr"] },
  { key: "leave.quota.approve", label: "Approve leave quota requests", module: "Leave", defaultRoles: ["hr", "manager"] },
  { key: "leave.encashment.approve", label: "Approve leave encashment requests", module: "Leave", defaultRoles: ["hr", "manager"] },
];

export function defaultGrant(role: Role, key: PermissionKey): boolean {
  if (role === "admin") return true;
  if (role === "employee") return false;
  const def = PERMISSIONS.find((p) => p.key === key);
  return !!def?.defaultRoles.includes(role);
}

export async function hasPermission(db: Db, auth: AuthContext, key: PermissionKey): Promise<boolean> {
  if (auth.role === "admin") return true;
  const override = await queryOne<{ granted: number }>(
    db,
    `SELECT granted FROM role_permissions WHERE tenant_id = ? AND role = ? AND permission_key = ?`,
    [auth.tenantId, auth.role, key],
  );
  if (override) return !!override.granted;
  return defaultGrant(auth.role, key);
}

/** Resolves every permission key for the given role in one pass — used by
 * GET /auth/me so the frontend can gate UI without a round-trip per check. */
export async function resolveAllPermissions(
  db: Db,
  tenantId: string,
  role: Role,
): Promise<Record<PermissionKey, boolean>> {
  const result = {} as Record<PermissionKey, boolean>;
  if (role === "admin") {
    for (const key of PERMISSION_KEYS) result[key] = true;
    return result;
  }
  const rows = await queryAll<{ permission_key: string; granted: number }>(
    db,
    `SELECT permission_key, granted FROM role_permissions WHERE tenant_id = ? AND role = ?`,
    [tenantId, role],
  );
  const overrideMap = new Map(rows.map((r) => [r.permission_key, !!r.granted]));
  for (const key of PERMISSION_KEYS) {
    result[key] = overrideMap.has(key) ? overrideMap.get(key)! : defaultGrant(role, key);
  }
  return result;
}
