import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { exec, queryAll, queryOne } from "../../core/db";
import { requireAuth } from "../../core/middleware";
import type { Notification } from "./types";

const app = new Hono<AppEnv>();
app.use("*", requireAuth);

app.get("/", async (c) => {
  const auth = c.get("auth");
  const notifications = await queryAll<Notification>(
    c.env.DB,
    `SELECT * FROM notifications WHERE tenant_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [auth.tenantId, auth.userId],
  );
  return c.json({ notifications });
});

app.get("/unread-count", async (c) => {
  const auth = c.get("auth");
  const row = await queryOne<{ n: number }>(
    c.env.DB,
    `SELECT COUNT(*)::int as n FROM notifications WHERE tenant_id = ? AND user_id = ? AND is_read = 0`,
    [auth.tenantId, auth.userId],
  );
  return c.json({ count: row?.n ?? 0 });
});

app.post("/:id/read", async (c) => {
  const auth = c.get("auth");
  await exec(c.env.DB, `UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ? AND user_id = ?`, [
    c.req.param("id"),
    auth.tenantId,
    auth.userId,
  ]);
  return c.json({ ok: true });
});

app.post("/read-all", async (c) => {
  const auth = c.get("auth");
  await exec(c.env.DB, `UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND user_id = ? AND is_read = 0`, [
    auth.tenantId,
    auth.userId,
  ]);
  return c.json({ ok: true });
});

export default app;
