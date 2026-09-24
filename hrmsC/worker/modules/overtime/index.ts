import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import routes from "./routes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);
app.route("/", routes);

export default app;
