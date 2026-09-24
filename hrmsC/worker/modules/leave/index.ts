import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import typesRoutes from "./typesRoutes";
import balancesRoutes from "./balancesRoutes";
import applicationsRoutes from "./applicationsRoutes";
import quotaRoutes from "./quotaRoutes";
import encashmentRoutes from "./encashmentRoutes";
import calendarRoutes from "./calendarRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.route("/types", typesRoutes);
app.route("/balances", balancesRoutes);
app.route("/applications", applicationsRoutes);
app.route("/quota", quotaRoutes);
app.route("/encashment", encashmentRoutes);
app.route("/calendar", calendarRoutes);

export default app;
