import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import typesRoutes from "./typesRoutes";
import requestsRoutes from "./requestsRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.route("/types", typesRoutes);
app.route("/", requestsRoutes);

export default app;
