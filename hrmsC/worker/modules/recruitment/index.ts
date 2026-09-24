import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import postingsRoutes from "./postingsRoutes";
import applicationsRoutes from "./applicationsRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.route("/postings", postingsRoutes);
app.route("/applications", applicationsRoutes);

export default app;
