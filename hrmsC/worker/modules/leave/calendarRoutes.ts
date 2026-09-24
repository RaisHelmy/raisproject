import { Hono } from "hono";
import type { AppEnv } from "../../core/types";
import { queryAll } from "../../core/db";

const app = new Hono<AppEnv>();

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Approved leave for the current employee plus, when they manage anyone,
 * their direct reports too — old_project's Leave Calendar My/Unit views
 * collapsed into a single response the frontend splits by employee_id. */
app.get("/", async (c) => {
  const auth = c.get("auth");
  if (!auth.employeeId) return c.json({ entries: [] });
  const month = c.req.query("month") ?? currentMonth();
  const db = c.env.DB;

  const entries = await queryAll(
    db,
    `SELECT la.id, la.employee_id, e.full_name as employee_name, la.start_date, la.end_date,
            la.days, lt.name as leave_type_name
     FROM leave_applications la
     JOIN employees e ON e.id = la.employee_id
     JOIN leave_types lt ON lt.id = la.leave_type_id
     WHERE la.tenant_id = ? AND la.status = 'approved'
       AND (la.employee_id = ? OR e.manager_id = ?)
       AND la.start_date <= ? AND la.end_date >= ?
     ORDER BY la.start_date`,
    [auth.tenantId, auth.employeeId, auth.employeeId, `${month}-31`, `${month}-01`],
  );

  return c.json({ entries });
});

export default app;
