import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import { overviewRoutes } from "./routes/overview";
import { projectRoutes } from "./routes/projects";
import { applicationRoutes } from "./routes/applications";
import { deploymentRoutes } from "./routes/deployments";
import { serverRoutes } from "./routes/servers";
import { containerRoutes } from "./routes/containers";
import { databaseRoutes } from "./routes/databases";
import { networkingRoutes } from "./routes/networking";
import { observabilityRoutes } from "./routes/observability";
import { miscRoutes } from "./routes/misc";
import { mcpRoutes } from "./routes/mcp";
import { authRoutes } from "./routes/auth";

export function createApp() {
  const app = new Hono();

  app.use("*", cors({ origin: "*", allowHeaders: ["Content-Type", "Authorization", "X-RunForge-Demo-User", "X-RunForge-Demo-Role", "X-RunForge-Organization"] }));

  app.get("/", (c) => c.json({ name: "RunForge API", status: "ok", mode: "demo" }));
  app.get("/health", (c) => c.json({ status: "ok" }));

  const api = new Hono();
  api.use("*", authMiddleware);
  api.route("/", overviewRoutes);
  api.route("/", projectRoutes);
  api.route("/", applicationRoutes);
  api.route("/", deploymentRoutes);
  api.route("/", serverRoutes);
  api.route("/", containerRoutes);
  api.route("/", databaseRoutes);
  api.route("/", networkingRoutes);
  api.route("/", observabilityRoutes);
  api.route("/", miscRoutes);
  api.route("/", mcpRoutes);
  api.route("/auth", authRoutes);

  app.route("/api", api);

  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: { code: "INTERNAL_ERROR", message: err.message } }, 500);
  });

  return app;
}
