import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requireAuth, requirePermission, requireRole } from "../../core/middleware";
import { nextEmployeeNo } from "./service";
import type { Employee } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const auth = c.get("auth");
  const q = c.req.query("q")?.trim();
  const department = c.req.query("department")?.trim();

  let sql = `SELECT * FROM employees WHERE tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];

  if (q) {
    sql += ` AND (full_name ILIKE ? OR employee_no ILIKE ? OR email ILIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (department) {
    sql += ` AND department = ?`;
    params.push(department);
  }
  sql += ` ORDER BY full_name ASC LIMIT 200`;

  const employees = await queryAll<Employee>(c.env.DB, sql, params);
  return c.json({ employees });
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ error: "No employee profile linked" }, 404);
  const employee = await queryOne<Employee>(
    c.env.DB,
    `SELECT * FROM employees WHERE id = ? AND tenant_id = ?`,
    [auth.employeeId, auth.tenantId],
  );
  return c.json({ employee });
});

app.get("/:id", async (c) => {
  const auth = c.get("auth");
  const employee = await queryOne<Employee>(
    c.env.DB,
    `SELECT * FROM employees WHERE id = ? AND tenant_id = ?`,
    [c.req.param("id"), auth.tenantId],
  );
  if (!employee) return c.json({ error: "Not found" }, 404);
  return c.json({ employee });
});

const createSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  department: z.string().max(120).optional().nullable(),
  division: z.string().max(120).optional().nullable(),
  positionTitle: z.string().max(120).optional().nullable(),
  grade: z.string().max(40).optional().nullable(),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  joinDate: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  emergencyContactName: z.string().max(200).optional().nullable(),
  emergencyContactPhone: z.string().max(40).optional().nullable(),
});

app.post("/", requirePermission("employees.manage"), async (c) => {
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;
  const id = newId();
  const employeeNo = await nextEmployeeNo(db, auth.tenantId);

  await exec(
    db,
    `INSERT INTO employees
       (id, tenant_id, employee_no, full_name, email, phone, department, division,
        position_title, grade, employment_type, join_date, manager_id, address,
        emergency_contact_name, emergency_contact_phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      auth.tenantId,
      employeeNo,
      d.fullName,
      d.email ?? null,
      d.phone ?? null,
      d.department ?? null,
      d.division ?? null,
      d.positionTitle ?? null,
      d.grade ?? null,
      d.employmentType,
      d.joinDate ?? null,
      d.managerId ?? null,
      d.address ?? null,
      d.emergencyContactName ?? null,
      d.emergencyContactPhone ?? null,
    ],
  );

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "employee",
    recordId: id,
    action: "created",
    actorUserId: auth.userId,
    remarks: `Employee "${d.fullName}" (${employeeNo}) created`,
  });

  const employee = await queryOne<Employee>(db, `SELECT * FROM employees WHERE id = ?`, [id]);
  return c.json({ employee }, 201);
});

const updateSchema = createSchema.partial();

app.put("/:id", requirePermission("employees.manage"), async (c) => {
  const body = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const existing = await queryOne<Employee>(
    db,
    `SELECT * FROM employees WHERE id = ? AND tenant_id = ?`,
    [id, auth.tenantId],
  );
  if (!existing) return c.json({ error: "Not found" }, 404);

  const d = body.data;
  const merged = {
    full_name: d.fullName ?? existing.full_name,
    email: d.email !== undefined ? d.email : existing.email,
    phone: d.phone !== undefined ? d.phone : existing.phone,
    department: d.department !== undefined ? d.department : existing.department,
    division: d.division !== undefined ? d.division : existing.division,
    position_title: d.positionTitle !== undefined ? d.positionTitle : existing.position_title,
    grade: d.grade !== undefined ? d.grade : existing.grade,
    employment_type: d.employmentType ?? existing.employment_type,
    join_date: d.joinDate !== undefined ? d.joinDate : existing.join_date,
    manager_id: d.managerId !== undefined ? d.managerId : existing.manager_id,
    address: d.address !== undefined ? d.address : existing.address,
    emergency_contact_name:
      d.emergencyContactName !== undefined ? d.emergencyContactName : existing.emergency_contact_name,
    emergency_contact_phone:
      d.emergencyContactPhone !== undefined ? d.emergencyContactPhone : existing.emergency_contact_phone,
  };

  await exec(
    db,
    `UPDATE employees SET full_name=?, email=?, phone=?, department=?, division=?,
       position_title=?, grade=?, employment_type=?, join_date=?, manager_id=?,
       address=?, emergency_contact_name=?, emergency_contact_phone=?, updated_at=?
     WHERE id = ? AND tenant_id = ?`,
    [
      merged.full_name,
      merged.email,
      merged.phone,
      merged.department,
      merged.division,
      merged.position_title,
      merged.grade,
      merged.employment_type,
      merged.join_date,
      merged.manager_id,
      merged.address,
      merged.emergency_contact_name,
      merged.emergency_contact_phone,
      nowIso(),
      id,
      auth.tenantId,
    ],
  );

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "employee",
    recordId: id,
    action: "updated",
    actorUserId: auth.userId,
  });

  const employee = await queryOne<Employee>(db, `SELECT * FROM employees WHERE id = ?`, [id]);
  return c.json({ employee });
});

const statusSchema = z.object({
  status: z.enum(["active", "on_leave", "resigned", "terminated"]),
});

app.patch("/:id/status", requirePermission("employees.manage"), async (c) => {
  const body = statusSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await exec(
    db,
    `UPDATE employees SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
    [body.data.status, nowIso(), id, auth.tenantId],
  );
  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "employee",
    recordId: id,
    action: "status_changed",
    actorUserId: auth.userId,
    remarks: `Status set to ${body.data.status}`,
  });

  const employee = await queryOne<Employee>(db, `SELECT * FROM employees WHERE id = ?`, [id]);
  return c.json({ employee });
});

app.delete("/:id", requireRole("admin"), async (c) => {
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await exec(db, `DELETE FROM employees WHERE id = ? AND tenant_id = ?`, [
    id,
    auth.tenantId,
  ]);
  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);

  await recordAudit(db, {
    tenantId: auth.tenantId,
    module: "employee",
    recordId: id,
    action: "deleted",
    actorUserId: auth.userId,
  });

  return c.json({ ok: true });
});

export default app;
