import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { queryAll } from "../../core/db";
import type { AuditLog } from "./types";

const app = new Hono<AppEnv>();

app.get("/", async (c) => {
  const auth = c.get("auth");
  const module = c.req.query("module");
  let sql = `SELECT al.*, u.name as actor_name FROM audit_logs al
             LEFT JOIN users u ON u.id = al.actor_user_id
             WHERE al.tenant_id = ?`;
  const params: unknown[] = [auth.tenantId];
  if (module) {
    sql += ` AND al.module = ?`;
    params.push(module);
  }
  sql += ` ORDER BY al.created_at DESC LIMIT 300`;
  const logs = await queryAll<AuditLog & { actor_name: string | null }>(c.env.DB, sql, params);
  return c.json({ auditLogs: logs });
});

export default app;
