import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { requirePermission } from "../../core/middleware";
import { balancesForEmployee } from "./balanceService";

const app = new Hono<AppEnv>();

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 404);
  const year = Number(c.req.query("year") ?? new Date().getFullYear());
  const balances = await balancesForEmployee(c.env.DB, auth.tenantId, auth.employeeId, year);
  return c.json({ balances });
});

app.get("/", requirePermission("leave.balances.view_others"), async (c) => {
  const auth = c.get("auth");
  const employeeId = c.req.query("employeeId");
  if (!employeeId) return c.json({ error: "employeeId is required" }, 400);
  const year = Number(c.req.query("year") ?? new Date().getFullYear());
  const balances = await balancesForEmployee(c.env.DB, auth.tenantId, employeeId, year);
  return c.json({ balances });
});

export default app;
