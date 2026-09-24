import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requireAuth, requirePermission } from "../../core/middleware";
import { notifyUser } from "../notifications/service";
import type { EquityGrant } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

function vestingPercent(start: string, end: string): number {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

function withVesting<T extends EquityGrant>(grant: T) {
  return { ...grant, vestingPercent: grant.status === "accepted" ? vestingPercent(grant.vesting_start, grant.vesting_end) : 0 };
}

const createSchema = z.object({
  employeeId: z.string().min(1),
  grantDate: z.string().min(1),
  quantity: z.number().positive(),
  vestingStart: z.string().min(1),
  vestingEnd: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
});

app.post("/", requirePermission("ltip.manage"), async (c) => {
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;
  const id = newId();
  await exec(
    db,
    `INSERT INTO equity_grants (id, tenant_id, employee_id, grant_date, quantity, vesting_start, vesting_end, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.employeeId, d.grantDate, d.quantity, d.vestingStart, d.vestingEnd, d.notes ?? null],
  );
  await recordAudit(db, { tenantId: auth.tenantId, module: "equity_grant", recordId: id, action: "offered", actorUserId: auth.userId, remarks: `${d.quantity} units` });

  const employee = await queryOne<{ user_id: string | null }>(db, `SELECT user_id FROM employees WHERE id = ?`, [d.employeeId]);
  if (employee?.user_id) {
    await notifyUser(db, { tenantId: auth.tenantId, userId: employee.user_id, message: `You've been offered an equity grant of ${d.quantity} units`, link: "/ltip/mine" });
  }

  const grant = await queryOne<EquityGrant>(db, `SELECT * FROM equity_grants WHERE id = ?`, [id]);
  return c.json({ grant: grant ? withVesting(grant) : null }, 201);
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ grants: [] });
  const grants = await queryAll<EquityGrant>(
    c.env.DB,
    `SELECT * FROM equity_grants WHERE tenant_id = ? AND employee_id = ? ORDER BY grant_date DESC`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ grants: grants.map(withVesting) });
});

app.get("/", requirePermission("ltip.manage"), async (c) => {
  const auth = c.get("auth");
  const employeeId = c.req.query("employeeId");
  let sql = `SELECT eg.*, e.full_name as employee_name, e.employee_no FROM equity_grants eg
             JOIN employees e ON e.id = eg.employee_id WHERE eg.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (employeeId) {
    sql += ` AND eg.employee_id = ?`;
    params.push(employeeId);
  }
  sql += ` ORDER BY eg.grant_date DESC LIMIT 300`;
  const grants = await queryAll<EquityGrant>(c.env.DB, sql, params);
  return c.json({ grants: grants.map(withVesting) });
});

const decisionSchema = z.object({ action: z.enum(["accept", "decline"]) });

app.post("/:id/decide", async (c) => {
  const body = decisionSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const grant = await queryOne<EquityGrant>(db, `SELECT * FROM equity_grants WHERE id = ? AND tenant_id = ?`, [id, auth.tenantId]);
  if (!grant) return c.json({ error: "Not found" }, 404);
  if (grant.employee_id !== auth.employeeId) return c.json({ error: "Forbidden" }, 403);
  if (grant.status !== "offered") return c.json({ error: "This grant has already been decided" }, 400);

  const status = body.data.action === "accept" ? "accepted" : "declined";
  await exec(db, `UPDATE equity_grants SET status=?, decided_at=? WHERE id=?`, [status, nowIso(), id]);
  await recordAudit(db, { tenantId: auth.tenantId, module: "equity_grant", recordId: id, action: status, actorUserId: auth.userId });

  const updated = await queryOne<EquityGrant>(db, `SELECT * FROM equity_grants WHERE id = ?`, [id]);
  return c.json({ grant: updated ? withVesting(updated) : null });
});

export default app;
