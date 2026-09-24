import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import typesRoutes from "./typesRoutes";
import claimsRoutes from "./claimsRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.route("/types", typesRoutes);
app.route("/", claimsRoutes);

export default app;
