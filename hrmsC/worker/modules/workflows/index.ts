import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import definitionsRoutes from "./definitionsRoutes";
import instancesRoutes from "./instancesRoutes";
import reassignRoutes from "./reassignRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.route("/definitions", definitionsRoutes);
app.route("/reassign", reassignRoutes);
app.route("/", instancesRoutes);

export default app;
