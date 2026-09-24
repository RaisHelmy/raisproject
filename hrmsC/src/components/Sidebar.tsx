import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { PermissionKey, Role } from "../types";

type NavItem = { to: string; icon: string; label: string; roles?: Role[]; permission?: PermissionKey };
type NavSection = { heading: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    heading: "Employees",
    items: [{ to: "/employees", icon: "bi-people", label: "Directory" }],
  },
  {
    heading: "Leave",
    items: [
      { to: "/leave/apply", icon: "bi-calendar-plus", label: "Apply" },
      { to: "/leave/history", icon: "bi-clock-history", label: "My History" },
      { to: "/leave/balance", icon: "bi-pie-chart", label: "Balance" },
      { to: "/leave/approvals", icon: "bi-check2-square", label: "Approvals", permission: "leave.approve" },
      { to: "/leave/calendar", icon: "bi-calendar3", label: "Calendar" },
      { to: "/leave/quota/apply", icon: "bi-award", label: "Request Quota" },
      { to: "/leave/quota/history", icon: "bi-clock-history", label: "My Quota Requests" },
      { to: "/leave/quota/approvals", icon: "bi-check2-square", label: "Quota Approvals", permission: "leave.quota.approve" },
      { to: "/leave/quota/manage", icon: "bi-sliders", label: "Quota Grants", permission: "leave.quota.manage" },
      { to: "/leave/encashment/apply", icon: "bi-cash-stack", label: "Request Encashment" },
      { to: "/leave/encashment/history", icon: "bi-clock-history", label: "My Encashment Requests" },
      {
        to: "/leave/encashment/approvals",
        icon: "bi-check2-square",
        label: "Encashment Approvals",
        permission: "leave.encashment.approve",
      },
      { to: "/leave/types", icon: "bi-sliders", label: "Leave Types", permission: "leave.types.manage" },
    ],
  },
  {
    heading: "Attendance",
    items: [
      { to: "/attendance", icon: "bi-fingerprint", label: "Clock In/Out" },
      { to: "/attendance/team", icon: "bi-people-fill", label: "Team Timesheet", permission: "attendance.team.view" },
      { to: "/overtime/apply", icon: "bi-alarm", label: "Request Overtime" },
      { to: "/overtime/history", icon: "bi-clock-history", label: "My Overtime" },
      { to: "/overtime/approvals", icon: "bi-check2-square", label: "Overtime Approvals", permission: "overtime.approve" },
      { to: "/workschedule", icon: "bi-calendar-week", label: "Work Schedules", permission: "workschedule.manage" },
      { to: "/workschedule/assignments", icon: "bi-person-lines-fill", label: "Schedule Assignments", permission: "workschedule.manage" },
    ],
  },
  {
    heading: "Claims",
    items: [
      { to: "/claims/apply", icon: "bi-receipt", label: "Submit Claim" },
      { to: "/claims/history", icon: "bi-clock-history", label: "My History" },
      { to: "/claims/approvals", icon: "bi-check2-square", label: "Approvals", permission: "claims.approve" },
      { to: "/claims/types", icon: "bi-sliders", label: "Claim Types", permission: "claims.types.manage" },
    ],
  },
  {
    heading: "Requests",
    items: [
      { to: "/requests/apply", icon: "bi-file-earmark-plus", label: "Submit Request" },
      { to: "/requests/history", icon: "bi-clock-history", label: "My History" },
      { to: "/requests/approvals", icon: "bi-check2-square", label: "Approvals", permission: "requests.approve" },
      { to: "/requests/types", icon: "bi-sliders", label: "Request Types", permission: "requests.types.manage" },
    ],
  },
  {
    heading: "Assets",
    items: [
      { to: "/assets", icon: "bi-box-seam", label: "Registry" },
      { to: "/assets/mine", icon: "bi-person-badge", label: "My Assets" },
    ],
  },
  {
    heading: "Vendors",
    items: [{ to: "/vendors", icon: "bi-shop", label: "Directory" }],
  },
  {
    heading: "Training",
    items: [
      { to: "/training/programs", icon: "bi-mortarboard", label: "Calendar" },
      { to: "/training/enrollments/mine", icon: "bi-clock-history", label: "My Enrollments" },
      { to: "/training/enrollments/approvals", icon: "bi-check2-square", label: "Approvals", permission: "training.approve" },
      { to: "/training/enrollments/manage", icon: "bi-list-check", label: "Manage Enrollments", permission: "training.manage" },
    ],
  },
  {
    heading: "Payroll",
    items: [
      { to: "/payroll/mine", icon: "bi-cash-coin", label: "My Payslips" },
      { to: "/payroll/manage", icon: "bi-calculator", label: "Generate Payslip", permission: "payroll.manage" },
    ],
  },
  {
    heading: "Recruitment",
    items: [
      { to: "/recruitment/postings", icon: "bi-briefcase", label: "Job Postings" },
      { to: "/recruitment/applications/mine", icon: "bi-clock-history", label: "My Applications" },
      { to: "/recruitment/pipeline", icon: "bi-kanban", label: "Pipeline", permission: "recruitment.manage" },
    ],
  },
  {
    heading: "Uniform",
    items: [
      { to: "/uniform/order", icon: "bi-bag", label: "Order" },
      { to: "/uniform/history", icon: "bi-clock-history", label: "My Orders" },
      { to: "/uniform/approvals", icon: "bi-check2-square", label: "Approvals", permission: "uniform.approve" },
      { to: "/uniform/catalog", icon: "bi-sliders", label: "Catalog", permission: "uniform.manage" },
    ],
  },
  {
    heading: "LTIP",
    items: [
      { to: "/ltip/mine", icon: "bi-graph-up-arrow", label: "My Grants" },
      { to: "/ltip/manage", icon: "bi-gem", label: "Manage Grants", permission: "ltip.manage" },
    ],
  },
  {
    heading: "Admin",
    items: [
      { to: "/admin/users", icon: "bi-person-gear", label: "Users", roles: ["admin"] },
      { to: "/admin/role-permissions", icon: "bi-shield-lock", label: "Role Permissions", roles: ["admin"] },
      { to: "/admin/workflows", icon: "bi-diagram-3", label: "Workflow Routing", permission: "workflows.manage" },
      { to: "/admin/reassign-tasks", icon: "bi-arrow-left-right", label: "Reassign Tasks", permission: "workflows.reassign_tasks" },
      { to: "/admin/routing-logs", icon: "bi-signpost-split", label: "Routing Logs", permission: "workflows.routing_logs.view" },
      { to: "/admin/audit-log", icon: "bi-journal-text", label: "Audit Log", roles: ["admin"] },
    ],
  },
];

function Item({ to, icon, label }: NavItem) {
  return (
    <li className="nav-item">
      <NavLink
        to={to}
        end
        className={({ isActive }) => `nav-link d-flex align-items-center gap-2 ${isActive ? "active" : "text-white-50"}`}
      >
        <i className={`bi ${icon}`} />
        {label}
      </NavLink>
    </li>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <div className="text-uppercase text-white-50 small fw-semibold px-3 mt-3 mb-1" style={{ letterSpacing: "0.05em" }}>
      {children}
    </div>
  );
}

export function Sidebar() {
  const { auth, can } = useAuth();
  if (!auth) return null;

  function allowed(item: NavItem): boolean {
    if (item.roles && !item.roles.includes(auth!.role)) return false;
    if (item.permission && !can(item.permission)) return false;
    return true;
  }

  return (
    <nav className="d-flex flex-column bg-dark p-2" style={{ width: 240, minHeight: "100vh", overflowY: "auto" }}>
      <div className="text-white fs-5 fw-bold px-3 py-3">HRMS</div>
      <ul className="nav nav-pills flex-column mb-auto">
        <Item to="/" icon="bi-speedometer2" label="Dashboard" />
        {SECTIONS.map((section) => {
          const items = section.items.filter(allowed);
          if (items.length === 0) return null;
          return (
            <div key={section.heading}>
              <Heading>{section.heading}</Heading>
              {items.map((item) => (
                <Item key={item.to} {...item} />
              ))}
            </div>
          );
        })}
      </ul>
    </nav>
  );
}
