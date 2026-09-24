import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { queryOne, recordAudit } from "../../core/db";
import { requireAuth, requireRole } from "../../core/middleware";
import { startSimulation, stopSimulation } from "../../core/session";
import type { UserRow } from "../auth/types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

// Only a real admin session can START a simulation. Deliberately NOT under
// worker/modules/admin/'s blanket requireRole("admin") gate — while a
// simulation is active the session's role IS the target employee's role,
// so /stop must stay reachable by non-admin roles too (its own safety check
// is stopSimulation()'s backup-cookie validation, not a role gate).
app.post("/:employeeId/start", requireRole("admin"), async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;

  if (auth.simulatedByUserId) {
    return c.json({ error: "Already simulating — return to admin before starting a new simulation" }, 400);
  }

  const employee = await queryOne<{ id: string; full_name: string; user_id: string | null }>(
    db,
    `SELECT id, full_name, user_id FROM employees WHERE id = ? AND tenant_id = ?`,
    [c.req.param("employeeId"), auth.tenantId],
  );
  if (!employee) return c.json({ error: "Not found" }, 404);
  if (!employee.user_id) return c.json({ error: "This employee has no login to simulate" }, 400);

  const targetUser = await queryOne<UserRow>(db, `SELECT * FROM users WHERE id = ?`, [employee.user_id]);
  if (!targetUser || !targetUser.is_active) return c.json({ error: "This employee's account is inactive" }, 400);
  if (targetUser.role === "admin") return c.json({ error: "Cannot simulate another admin" }, 400);

  await startSimulation(
    c,
    {
      userId: targetUser.id,
      tenantId: targetUser.tenant_id,
      role: targetUser.role,
      employeeId: employee.id,
      email: targetUser.email,
      name: targetUser.name,
    },
    { userId: auth.userId, name: auth.name },
  );

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "account_simulation",
    recordId: employee.id,
    action: "started",
    actorUserId: auth.userId,
    remarks: `Simulating ${employee.full_name}`,
  });

  return c.json({ ok: true });
});

app.post("/stop", async (c) => {
  const auth = c.get("auth");
  const restored = await stopSimulation(c);
  if (!restored) return c.json({ error: "Not currently simulating" }, 400);

  await recordAudit(c.env.DB, {
    tenantId: auth.tenantId,
    module: "account_simulation",
    recordId: auth.employeeId ?? auth.userId,
    action: "stopped",
    actorUserId: auth.simulatedByUserId ?? auth.userId,
  });

  return c.json({ ok: true });
});

export default app;
