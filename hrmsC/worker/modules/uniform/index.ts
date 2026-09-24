import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requireAuth } from "../../core/middleware";
import itemsRoutes from "./itemsRoutes";
import ordersRoutes from "./ordersRoutes";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.route("/items", itemsRoutes);
app.route("/orders", ordersRoutes);

export default app;
