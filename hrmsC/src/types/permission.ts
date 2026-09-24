export type PermissionKey =
  | "employees.manage"
  | "leave.types.manage"
  | "leave.balances.view_others"
  | "leave.approve"
  | "attendance.team.view"
  | "attendance.manage"
  | "claims.approve"
  | "requests.types.manage"
  | "requests.approve"
  | "assets.manage"
  | "vendors.manage"
  | "training.manage"
  | "training.approve"
  | "payroll.manage"
  | "recruitment.manage"
  | "uniform.manage"
  | "uniform.approve"
  | "ltip.manage"
  | "workflows.manage"
  | "workflows.routing_logs.view"
  | "workflows.reassign_tasks"
  | "claims.types.manage"
  | "overtime.manage"
  | "overtime.approve"
  | "workschedule.manage"
  | "leave.quota.manage"
  | "leave.quota.approve"
  | "leave.encashment.approve";

export type PermissionDef = {
  key: PermissionKey;
  label: string;
  module: string;
  defaultRoles: Array<"hr" | "manager">;
};

export type PermissionGrants = Record<PermissionKey, boolean>;
