import type { ReactElement } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { RegisterTenant } from "./pages/RegisterTenant";
import { Dashboard } from "./pages/Dashboard";
import { EmployeeList } from "./pages/employees/EmployeeList";
import { EmployeeDetail } from "./pages/employees/EmployeeDetail";
import { EmployeeForm } from "./pages/employees/EmployeeForm";
import { LeaveApply } from "./pages/leave/LeaveApply";
import { LeaveHistory } from "./pages/leave/LeaveHistory";
import { LeaveApprovals } from "./pages/leave/LeaveApprovals";
import { LeaveBalance } from "./pages/leave/LeaveBalance";
import { LeaveTypesAdmin } from "./pages/leave/LeaveTypesAdmin";
import { LeaveQuotaApply } from "./pages/leave/LeaveQuotaApply";
import { LeaveQuotaHistory } from "./pages/leave/LeaveQuotaHistory";
import { LeaveQuotaApprovals } from "./pages/leave/LeaveQuotaApprovals";
import { LeaveQuotaManage } from "./pages/leave/LeaveQuotaManage";
import { LeaveEncashmentApply } from "./pages/leave/LeaveEncashmentApply";
import { LeaveEncashmentHistory } from "./pages/leave/LeaveEncashmentHistory";
import { LeaveEncashmentApprovals } from "./pages/leave/LeaveEncashmentApprovals";
import { LeaveCalendar } from "./pages/leave/LeaveCalendar";
import { Attendance } from "./pages/attendance/Attendance";
import { TeamAttendance } from "./pages/attendance/TeamAttendance";
import { ClaimApply } from "./pages/claims/ClaimApply";
import { ClaimHistory } from "./pages/claims/ClaimHistory";
import { ClaimApprovals } from "./pages/claims/ClaimApprovals";
import { ClaimTypesAdmin } from "./pages/claims/ClaimTypesAdmin";
import { RequestApply } from "./pages/requests/RequestApply";
import { RequestHistory } from "./pages/requests/RequestHistory";
import { RequestApprovals } from "./pages/requests/RequestApprovals";
import { RequestTypesAdmin } from "./pages/requests/RequestTypesAdmin";
import { AssetList } from "./pages/assets/AssetList";
import { AssetForm } from "./pages/assets/AssetForm";
import { AssetDetail } from "./pages/assets/AssetDetail";
import { MyAssets } from "./pages/assets/MyAssets";
import { VendorList } from "./pages/vendors/VendorList";
import { VendorForm } from "./pages/vendors/VendorForm";
import { VendorDetail } from "./pages/vendors/VendorDetail";
import { ProgramList } from "./pages/training/ProgramList";
import { ProgramForm } from "./pages/training/ProgramForm";
import { ProgramDetail } from "./pages/training/ProgramDetail";
import { MyEnrollments } from "./pages/training/MyEnrollments";
import { EnrollmentApprovals } from "./pages/training/EnrollmentApprovals";
import { ManageEnrollments } from "./pages/training/ManageEnrollments";
import { MyPayslips } from "./pages/payroll/MyPayslips";
import { PayslipAdmin } from "./pages/payroll/PayslipAdmin";
import { PostingList } from "./pages/recruitment/PostingList";
import { PostingForm } from "./pages/recruitment/PostingForm";
import { PostingDetail } from "./pages/recruitment/PostingDetail";
import { MyApplications } from "./pages/recruitment/MyApplications";
import { ApplicationPipeline } from "./pages/recruitment/ApplicationPipeline";
import { UniformCatalogAdmin } from "./pages/uniform/UniformCatalogAdmin";
import { UniformOrderForm } from "./pages/uniform/UniformOrderForm";
import { UniformOrderHistory } from "./pages/uniform/UniformOrderHistory";
import { UniformApprovals } from "./pages/uniform/UniformApprovals";
import { MyGrants } from "./pages/ltip/MyGrants";
import { GrantAdmin } from "./pages/ltip/GrantAdmin";
import { Users } from "./pages/admin/Users";
import { AuditLog } from "./pages/admin/AuditLog";
import { Workflows } from "./pages/admin/workflows";
import { RoutingLogs } from "./pages/admin/RoutingLogs";
import { RolePermissions } from "./pages/admin/RolePermissions";
import { ReassignTasks } from "./pages/admin/ReassignTasks";
import { InstanceDetail } from "./pages/workflows/InstanceDetail";
import { OvertimeApply } from "./pages/overtime/OvertimeApply";
import { OvertimeHistory } from "./pages/overtime/OvertimeHistory";
import { OvertimeApprovals } from "./pages/overtime/OvertimeApprovals";
import { ScheduleAdmin } from "./pages/workschedule/ScheduleAdmin";
import { ScheduleAssignments } from "./pages/workschedule/ScheduleAssignments";
import type { PermissionKey, Role } from "./types";

type RouteDef = { path: string; element: ReactElement; roles?: Role[]; permission?: PermissionKey };

const routes: RouteDef[] = [
  { path: "/", element: <Dashboard /> },

  { path: "/employees", element: <EmployeeList /> },
  { path: "/employees/new", element: <EmployeeForm />, permission: "employees.manage" },
  { path: "/employees/:id", element: <EmployeeDetail /> },

  { path: "/leave/apply", element: <LeaveApply /> },
  { path: "/leave/history", element: <LeaveHistory /> },
  { path: "/leave/balance", element: <LeaveBalance /> },
  { path: "/leave/approvals", element: <LeaveApprovals />, permission: "leave.approve" },
  { path: "/leave/types", element: <LeaveTypesAdmin />, permission: "leave.types.manage" },
  { path: "/leave/calendar", element: <LeaveCalendar /> },

  { path: "/leave/quota/apply", element: <LeaveQuotaApply /> },
  { path: "/leave/quota/history", element: <LeaveQuotaHistory /> },
  { path: "/leave/quota/approvals", element: <LeaveQuotaApprovals />, permission: "leave.quota.approve" },
  { path: "/leave/quota/manage", element: <LeaveQuotaManage />, permission: "leave.quota.manage" },

  { path: "/leave/encashment/apply", element: <LeaveEncashmentApply /> },
  { path: "/leave/encashment/history", element: <LeaveEncashmentHistory /> },
  { path: "/leave/encashment/approvals", element: <LeaveEncashmentApprovals />, permission: "leave.encashment.approve" },

  { path: "/attendance", element: <Attendance /> },
  { path: "/attendance/team", element: <TeamAttendance />, permission: "attendance.team.view" },

  { path: "/overtime/apply", element: <OvertimeApply /> },
  { path: "/overtime/history", element: <OvertimeHistory /> },
  { path: "/overtime/approvals", element: <OvertimeApprovals />, permission: "overtime.approve" },

  { path: "/workschedule", element: <ScheduleAdmin />, permission: "workschedule.manage" },
  { path: "/workschedule/assignments", element: <ScheduleAssignments />, permission: "workschedule.manage" },

  { path: "/claims/apply", element: <ClaimApply /> },
  { path: "/claims/history", element: <ClaimHistory /> },
  { path: "/claims/approvals", element: <ClaimApprovals />, permission: "claims.approve" },
  { path: "/claims/types", element: <ClaimTypesAdmin />, permission: "claims.types.manage" },

  { path: "/requests/apply", element: <RequestApply /> },
  { path: "/requests/history", element: <RequestHistory /> },
  { path: "/requests/approvals", element: <RequestApprovals />, permission: "requests.approve" },
  { path: "/requests/types", element: <RequestTypesAdmin />, permission: "requests.types.manage" },

  { path: "/assets", element: <AssetList /> },
  { path: "/assets/new", element: <AssetForm />, permission: "assets.manage" },
  { path: "/assets/mine", element: <MyAssets /> },
  { path: "/assets/:id", element: <AssetDetail /> },

  { path: "/vendors", element: <VendorList /> },
  { path: "/vendors/new", element: <VendorForm />, permission: "vendors.manage" },
  { path: "/vendors/:id", element: <VendorDetail /> },

  { path: "/training/programs", element: <ProgramList /> },
  { path: "/training/programs/new", element: <ProgramForm />, permission: "training.manage" },
  { path: "/training/programs/:id", element: <ProgramDetail /> },
  { path: "/training/enrollments/mine", element: <MyEnrollments /> },
  { path: "/training/enrollments/approvals", element: <EnrollmentApprovals />, permission: "training.approve" },
  { path: "/training/enrollments/manage", element: <ManageEnrollments />, permission: "training.manage" },

  { path: "/payroll/mine", element: <MyPayslips /> },
  { path: "/payroll/manage", element: <PayslipAdmin />, permission: "payroll.manage" },

  { path: "/recruitment/postings", element: <PostingList /> },
  { path: "/recruitment/postings/new", element: <PostingForm />, permission: "recruitment.manage" },
  { path: "/recruitment/postings/:id", element: <PostingDetail /> },
  { path: "/recruitment/applications/mine", element: <MyApplications /> },
  { path: "/recruitment/pipeline", element: <ApplicationPipeline />, permission: "recruitment.manage" },

  { path: "/uniform/catalog", element: <UniformCatalogAdmin />, permission: "uniform.manage" },
  { path: "/uniform/order", element: <UniformOrderForm /> },
  { path: "/uniform/history", element: <UniformOrderHistory /> },
  { path: "/uniform/approvals", element: <UniformApprovals />, permission: "uniform.approve" },

  { path: "/ltip/mine", element: <MyGrants /> },
  { path: "/ltip/manage", element: <GrantAdmin />, permission: "ltip.manage" },

  { path: "/admin/users", element: <Users />, roles: ["admin"] },
  { path: "/admin/audit-log", element: <AuditLog />, roles: ["admin"] },
  { path: "/admin/role-permissions", element: <RolePermissions />, roles: ["admin"] },
  { path: "/admin/workflows", element: <Workflows />, permission: "workflows.manage" },
  { path: "/admin/reassign-tasks", element: <ReassignTasks />, permission: "workflows.reassign_tasks" },
  { path: "/admin/routing-logs", element: <RoutingLogs />, permission: "workflows.routing_logs.view" },

  { path: "/workflows/:id", element: <InstanceDetail /> },
];

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<RegisterTenant />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {routes.map(({ path, element, roles, permission }) => (
          <Route
            key={path}
            path={path}
            element={
              roles || permission ? (
                <ProtectedRoute roles={roles} permission={permission}>
                  {element}
                </ProtectedRoute>
              ) : (
                element
              )
            }
          />
        ))}
      </Route>
    </Routes>
  );
}
