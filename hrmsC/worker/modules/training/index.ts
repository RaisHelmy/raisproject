import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import programsRoutes from "./programsRoutes";
import enrollmentsRoutes from "./enrollmentsRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.route("/programs", programsRoutes);
app.route("/enrollments", enrollmentsRoutes);

export default app;
