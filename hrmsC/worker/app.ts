import { Hono } from "hono";
import type { AppEnv } from "./core/types";
import authRoutes from "./modules/auth/routes";
import employeeRoutes from "./modules/employees/routes";
import leaveRoutes from "./modules/leave";
import attendanceRoutes from "./modules/attendance/routes";
import claimsRoutes from "./modules/claims";
import adminRoutes from "./modules/admin";
import dashboardRoutes from "./modules/dashboard/routes";
import workflowRoutes from "./modules/workflows";
import attachmentsRoutes from "./modules/attachments/routes";
import requestsRoutes from "./modules/requests";
import assetsRoutes from "./modules/assets/routes";
import vendorsRoutes from "./modules/vendors/routes";
import trainingRoutes from "./modules/training";
import payrollRoutes from "./modules/payroll/routes";
import recruitmentRoutes from "./modules/recruitment";
import uniformRoutes from "./modules/uniform";
import notificationsRoutes from "./modules/notifications/routes";
import ltipRoutes from "./modules/ltip/routes";
import simulateRoutes from "./modules/simulate/routes";
import overtimeRoutes from "./modules/overtime";
import workscheduleRoutes from "./modules/workschedule";

const app = new Hono<AppEnv>().basePath("/api");

app.route("/auth", authRoutes);
app.route("/employees", employeeRoutes);
app.route("/leave", leaveRoutes);
app.route("/attendance", attendanceRoutes);
app.route("/claims", claimsRoutes);
app.route("/admin", adminRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/workflows", workflowRoutes);
app.route("/attachments", attachmentsRoutes);
app.route("/requests", requestsRoutes);
app.route("/assets", assetsRoutes);
app.route("/vendors", vendorsRoutes);
app.route("/training", trainingRoutes);
app.route("/payroll", payrollRoutes);
app.route("/recruitment", recruitmentRoutes);
app.route("/uniform", uniformRoutes);
app.route("/notifications", notificationsRoutes);
app.route("/ltip", ltipRoutes);
app.route("/simulate", simulateRoutes);
app.route("/overtime", overtimeRoutes);
app.route("/workschedule", workscheduleRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
