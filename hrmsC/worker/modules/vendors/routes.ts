import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit } from "../../core/db";
import { requireAuth, requirePermission, requireRole } from "../../core/middleware";
import type { Vendor } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const auth = c.get("auth");
  const q = c.req.query("q")?.trim();
  let sql = `SELECT * FROM vendors WHERE tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (q) {
    sql += ` AND (name ILIKE ? OR category ILIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like);
  }
  sql += ` ORDER BY name LIMIT 300`;
  const vendors = await queryAll<Vendor>(c.env.DB, sql, params);
  return c.json({ vendors });
});

app.get("/:id", async (c) => {
  const auth = c.get("auth");
  const vendor = await queryOne<Vendor>(c.env.DB, `SELECT * FROM vendors WHERE id = ? AND tenant_id = ?`, [
    c.req.param("id"),
    auth.tenantId,
  ]);
  if (!vendor) return c.json({ error: "Not found" }, 404);
  return c.json({ vendor });
});

const vendorSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  contactPerson: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

app.post("/", requirePermission("vendors.manage"), async (c) => {
  const body = vendorSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;
  const id = newId();
  await exec(
    db,
    `INSERT INTO vendors (id, tenant_id, name, category, contact_person, phone, email, address, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.name, d.category ?? null, d.contactPerson ?? null, d.phone ?? null, d.email ?? null, d.address ?? null, d.notes ?? null],
  );
  await recordAudit(db, { tenantId: auth.tenantId, module: "vendor", recordId: id, action: "created", actorUserId: auth.userId, remarks: d.name });
  const vendor = await queryOne<Vendor>(db, `SELECT * FROM vendors WHERE id = ?`, [id]);
  return c.json({ vendor }, 201);
});

app.put("/:id", requirePermission("vendors.manage"), async (c) => {
  const body = vendorSchema.partial().extend({ status: z.enum(["active", "inactive"]).optional() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const existing = await queryOne<Vendor>(db, `SELECT * FROM vendors WHERE id = ? AND tenant_id = ?`, [id, auth.tenantId]);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;

  await exec(
    db,
    `UPDATE vendors SET name=?, category=?, contact_person=?, phone=?, email=?, address=?, notes=?, status=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [
      d.name ?? existing.name,
      d.category !== undefined ? d.category : existing.category,
      d.contactPerson !== undefined ? d.contactPerson : existing.contact_person,
      d.phone !== undefined ? d.phone : existing.phone,
      d.email !== undefined ? d.email : existing.email,
      d.address !== undefined ? d.address : existing.address,
      d.notes !== undefined ? d.notes : existing.notes,
      d.status ?? existing.status,
      nowIso(),
      id,
      auth.tenantId,
    ],
  );
  const vendor = await queryOne<Vendor>(db, `SELECT * FROM vendors WHERE id = ?`, [id]);
  return c.json({ vendor });
});

app.delete("/:id", requireRole("admin"), async (c) => {
  const auth = c.get("auth");
  const result = await exec(c.env.DB, `DELETE FROM vendors WHERE id = ? AND tenant_id = ?`, [
    c.req.param("id"),
    auth.tenantId,
  ]);
  if (result.meta.changes === 0) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export default app;
