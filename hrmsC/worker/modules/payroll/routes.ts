import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, queryAll, queryOne, recordAudit } from "../../core/db";
import { requireAuth, requirePermission, requireRole } from "../../core/middleware";
import type { Payslip } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ payslips: [] });
  const year = c.req.query("year");
  let sql = `SELECT * FROM payslips WHERE tenant_id = ? AND employee_id = ?`;
  const params: unknown[] = [auth.tenantId, auth.employeeId];
  if (year) {
    sql += ` AND pay_period ILIKE ?`;
    params.push(`${year}%`);
  }
  sql += ` ORDER BY pay_period DESC`;
  const payslips = await queryAll<Payslip>(c.env.DB, sql, params);
  return c.json({ payslips });
});

app.get("/", requirePermission("payroll.manage"), async (c) => {
  const auth = c.get("auth");
  const employeeId = c.req.query("employeeId");
  if (!employeeId) return c.json({ error: "employeeId is required" }, 400);
  const payslips = await queryAll<Payslip>(
    c.env.DB,
    `SELECT * FROM payslips WHERE tenant_id = ? AND employee_id = ? ORDER BY pay_period DESC`,
    [auth.tenantId, employeeId],
  );
  return c.json({ payslips });
});

app.get("/:id", async (c) => {
  const auth = c.get("auth");
  const payslip = await queryOne<Payslip>(c.env.DB, `SELECT * FROM payslips WHERE id = ? AND tenant_id = ?`, [
    c.req.param("id"),
    auth.tenantId,
  ]);
  if (!payslip) return c.json({ error: "Not found" }, 404);
  const isOwner = payslip.employee_id === auth.employeeId;
  const isAdmin = auth.role === "admin" || auth.role === "hr";
  if (!isOwner && !isAdmin) return c.json({ error: "Forbidden" }, 403);
  return c.json({ payslip });
});

const createSchema = z.object({
  employeeId: z.string().min(1),
  payPeriod: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
  grossAmount: z.number().positive(),
  deductions: z.number().min(0).default(0),
  currency: z.string().min(1).max(10).default("USD"),
  notes: z.string().max(1000).optional().nullable(),
});

app.post("/", requirePermission("payroll.manage"), async (c) => {
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;

  const existing = await queryOne(db, `SELECT id FROM payslips WHERE employee_id = ? AND pay_period = ?`, [
    d.employeeId,
    d.payPeriod,
  ]);
  if (existing) return c.json({ error: "A payslip for this employee and period already exists" }, 409);

  const id = newId();
  const netAmount = d.grossAmount - d.deductions;
  await exec(
    db,
    `INSERT INTO payslips (id, tenant_id, employee_id, pay_period, gross_amount, deductions, net_amount, currency, notes, generated_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.employeeId, d.payPeriod, d.grossAmount, d.deductions, netAmount, d.currency, d.notes ?? null, auth.userId],
  );
  await recordAudit(db, { tenantId: auth.tenantId, module: "payslip", recordId: id, action: "generated", actorUserId: auth.userId, remarks: `${d.payPeriod}: ${d.currency} ${netAmount.toFixed(2)} net` });

  const payslip = await queryOne<Payslip>(db, `SELECT * FROM payslips WHERE id = ?`, [id]);
  return c.json({ payslip }, 201);
});

app.delete("/:id", requireRole("admin"), async (c) => {
  const auth = c.get("auth");
  const result = await exec(c.env.DB, `DELETE FROM payslips WHERE id = ? AND tenant_id = ?`, [
    c.req.param("id"),
    auth.tenantId,
  ]);
  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
