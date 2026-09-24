import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth, requireRole } from "../../core/middleware";
import usersRoutes from "./usersRoutes";
import auditLogRoutes from "./auditLogRoutes";
import permissionsRoutes from "./permissionsRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);
app.use("*", requireRole("admin"));

app.route("/users", usersRoutes);
app.route("/audit-logs", auditLogRoutes);
app.route("/permissions", permissionsRoutes);

export default app;
