import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../core/types";
import { exec, newId, nowIso, queryAll, queryOne, recordAudit, type Db } from "../../core/db";
import { requireAuth, requirePermission } from "../../core/middleware";
import type { Asset, AssetAssignmentLog } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

async function logAssetAction(
  db: Db,
  entry: { tenantId: string; assetId: string; employeeId: string | null; action: AssetAssignmentLog["action"]; actorUserId: string; remarks?: string | null },
): Promise<void> {
  await exec(
    db,
    `INSERT INTO asset_assignment_logs (id, tenant_id, asset_id, employee_id, action, remarks, actor_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), entry.tenantId, entry.assetId, entry.employeeId, entry.action, entry.remarks ?? null, entry.actorUserId],
  );
}

app.get("/", async (c) => {
  const auth = c.get("auth");
  const q = c.req.query("q")?.trim();
  const status = c.req.query("status")?.trim();
  let sql = `SELECT * FROM assets WHERE tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (q) {
    sql += ` AND (name ILIKE ? OR asset_tag ILIKE ? OR serial_number ILIKE ?)`;
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  sql += ` ORDER BY asset_tag LIMIT 300`;
  const assets = await queryAll<Asset>(c.env.DB, sql, params);
  return c.json({ assets });
});

app.get("/me", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ assets: [] });
  const assets = await queryAll<Asset>(
    c.env.DB,
    `SELECT * FROM assets WHERE tenant_id = ? AND assigned_employee_id = ? ORDER BY asset_tag`,
    [auth.tenantId, auth.employeeId],
  );
  return c.json({ assets });
});

app.get("/:id", async (c) => {
  const auth = c.get("auth");
  const asset = await queryOne<Asset>(c.env.DB, `SELECT * FROM assets WHERE id = ? AND tenant_id = ?`, [
    c.req.param("id"),
    auth.tenantId,
  ]);
  if (!asset) return c.json({ error: "Not found" }, 404);
  return c.json({ asset });
});

app.get("/:id/logs", async (c) => {
  const auth = c.get("auth");
  const logs = await queryAll<AssetAssignmentLog & { actor_name: string | null }>(
    c.env.DB,
    `SELECT al.*, u.name as actor_name FROM asset_assignment_logs al
     LEFT JOIN users u ON u.id = al.actor_user_id
     WHERE al.asset_id = ? AND al.tenant_id = ? ORDER BY al.created_at DESC`,
    [c.req.param("id"), auth.tenantId],
  );
  return c.json({ logs });
});

const createSchema = z.object({
  assetTag: z.string().min(1).max(60),
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional().nullable(),
  serialNumber: z.string().max(120).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchaseValue: z.number().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

app.post("/", requirePermission("assets.manage"), async (c) => {
  const body = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input", details: body.error.flatten() }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const d = body.data;

  const existingTag = await queryOne(db, `SELECT id FROM assets WHERE tenant_id = ? AND asset_tag = ?`, [
    auth.tenantId,
    d.assetTag,
  ]);
  if (existingTag) return c.json({ error: "An asset with this tag already exists" }, 409);

  const id = newId();
  await exec(
    db,
    `INSERT INTO assets (id, tenant_id, asset_tag, name, category, serial_number, purchase_date, purchase_value, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, auth.tenantId, d.assetTag, d.name, d.category ?? null, d.serialNumber ?? null, d.purchaseDate ?? null, d.purchaseValue ?? null, d.notes ?? null],
  );
  await recordAudit(db, { tenantId: auth.tenantId, module: "asset", recordId: id, action: "created", actorUserId: auth.userId, remarks: `${d.assetTag} - ${d.name}` });

  const asset = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ?`, [id]);
  return c.json({ asset }, 201);
});

const updateSchema = createSchema.partial().omit({ assetTag: true });

app.put("/:id", requirePermission("assets.manage"), async (c) => {
  const body = updateSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const existing = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ? AND tenant_id = ?`, [id, auth.tenantId]);
  if (!existing) return c.json({ error: "Not found" }, 404);
  const d = body.data;

  await exec(
    db,
    `UPDATE assets SET name=?, category=?, serial_number=?, purchase_date=?, purchase_value=?, notes=?, updated_at=? WHERE id=? AND tenant_id=?`,
    [
      d.name ?? existing.name,
      d.category !== undefined ? d.category : existing.category,
      d.serialNumber !== undefined ? d.serialNumber : existing.serial_number,
      d.purchaseDate !== undefined ? d.purchaseDate : existing.purchase_date,
      d.purchaseValue !== undefined ? d.purchaseValue : existing.purchase_value,
      d.notes !== undefined ? d.notes : existing.notes,
      nowIso(),
      id,
      auth.tenantId,
    ],
  );
  const asset = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ?`, [id]);
  return c.json({ asset });
});

app.post("/:id/assign", requirePermission("assets.manage"), async (c) => {
  const body = z.object({ employeeId: z.string().min(1), remarks: z.string().max(500).optional().nullable() }).safeParse(
    await c.req.json().catch(() => null),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const asset = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ? AND tenant_id = ?`, [id, auth.tenantId]);
  if (!asset) return c.json({ error: "Not found" }, 404);
  if (asset.status === "assigned") return c.json({ error: "Asset is already assigned; return it first" }, 400);
  if (asset.status === "retired") return c.json({ error: "Asset is retired" }, 400);

  await exec(db, `UPDATE assets SET status='assigned', assigned_employee_id=?, updated_at=? WHERE id=?`, [
    body.data.employeeId,
    nowIso(),
    id,
  ]);
  await logAssetAction(db, { tenantId: auth.tenantId, assetId: id, employeeId: body.data.employeeId, action: "assigned", actorUserId: auth.userId, remarks: body.data.remarks });
  await recordAudit(db, { tenantId: auth.tenantId, module: "asset", recordId: id, action: "assigned", actorUserId: auth.userId });

  const updated = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ?`, [id]);
  return c.json({ asset: updated });
});

app.post("/:id/return", requirePermission("assets.manage"), async (c) => {
  const body = z.object({ remarks: z.string().max(500).optional().nullable() }).safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const asset = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ? AND tenant_id = ?`, [id, auth.tenantId]);
  if (!asset) return c.json({ error: "Not found" }, 404);
  if (asset.status !== "assigned") return c.json({ error: "Asset is not currently assigned" }, 400);

  const previousEmployeeId = asset.assigned_employee_id;
  await exec(db, `UPDATE assets SET status='available', assigned_employee_id=NULL, updated_at=? WHERE id=?`, [nowIso(), id]);
  await logAssetAction(db, { tenantId: auth.tenantId, assetId: id, employeeId: previousEmployeeId, action: "returned", actorUserId: auth.userId, remarks: body.data.remarks });
  await recordAudit(db, { tenantId: auth.tenantId, module: "asset", recordId: id, action: "returned", actorUserId: auth.userId });

  const updated = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ?`, [id]);
  return c.json({ asset: updated });
});

const statusSchema = z.object({ status: z.enum(["maintenance", "retired", "available"]), remarks: z.string().max(500).optional().nullable() });

app.patch("/:id/status", requirePermission("assets.manage"), async (c) => {
  const body = statusSchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid input" }, 400);
  const auth = c.get("auth");
  const db = c.env.DB;
  const id = c.req.param("id");
  const asset = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ? AND tenant_id = ?`, [id, auth.tenantId]);
  if (!asset) return c.json({ error: "Not found" }, 404);
  if (asset.status === "assigned") return c.json({ error: "Return the asset before changing its status" }, 400);

  await exec(db, `UPDATE assets SET status=?, updated_at=? WHERE id=?`, [body.data.status, nowIso(), id]);
  const action = body.data.status === "available" ? "reinstated" : body.data.status;
  await logAssetAction(db, { tenantId: auth.tenantId, assetId: id, employeeId: null, action: action as "maintenance" | "retired" | "reinstated", actorUserId: auth.userId, remarks: body.data.remarks });
  await recordAudit(db, { tenantId: auth.tenantId, module: "asset", recordId: id, action: `status_${body.data.status}`, actorUserId: auth.userId });

  const updated = await queryOne<Asset>(db, `SELECT * FROM assets WHERE id = ?`, [id]);
  return c.json({ asset: updated });
});

export default app;
