import { exec, newId, nowIso, queryOne, recordAudit, type Db } from "../../core/db";
import { hashPassword } from "../../core/session";
import { slugify } from "../../core/slug";
import type { Tenant } from "./types";

const DEFAULT_LEAVE_TYPES: Array<{ name: string; days: number }> = [
  { name: "Annual Leave", days: 14 },
  { name: "Medical Leave", days: 14 },
  { name: "Unpaid Leave", days: 0 },
  { name: "Officer In-Lieu (OIL)", days: 0 },
  { name: "Haji / Pilgrimage", days: 0 },
  { name: "Paternity Leave", days: 0 },
  { name: "Exam Leave", days: 0 },
];

const DEFAULT_CLAIM_TYPES: Array<{ name: string; isMileage?: boolean; mileageRate?: number; isAdvance?: boolean }> = [
  { name: "Travel" },
  { name: "Meals" },
  { name: "Accommodation" },
  { name: "Medical" },
  { name: "Office Supplies" },
  { name: "Mileage", isMileage: true, mileageRate: 0.5 },
  { name: "Travel Advance", isAdvance: true },
  { name: "Other" },
];

/** Every tenant gets a single-step "employee's direct manager approves"
 * workflow per module out of the box. Admins can then edit/extend it (add
 * steps, add category- or amount-based variants) from Admin > Workflow
 * Routing — see worker/modules/workflows. */
async function seedDefaultWorkflow(db: Db, tenantId: string, module: string, name: string): Promise<void> {
  const definitionId = newId();
  await exec(
    db,
    `INSERT INTO workflow_definitions (id, tenant_id, module, name, is_default, is_active) VALUES (?, ?, ?, ?, 1, 1)`,
    [definitionId, tenantId, module, name],
  );
  await exec(
    db,
    `INSERT INTO workflow_steps (id, tenant_id, workflow_definition_id, step_order, step_name, approver_type, manager_level)
     VALUES (?, ?, ?, 1, 'Manager Approval', 'employee_manager', 1)`,
    [newId(), tenantId, definitionId],
  );
}

async function uniqueSlug(db: Db, tenantName: string): Promise<string> {
  const base = slugify(tenantName);
  let slug = base;
  let attempt = 0;
  while (await queryOne<Tenant>(db, `SELECT id FROM tenants WHERE slug = ?`, [slug])) {
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
  return slug;
}

/** Provisions a brand-new tenant: the tenant row, its first admin user +
 * linked employee record, default leave types, and default approval
 * workflows for leave/claims. Returns identifiers the caller needs to
 * issue a session. */
export async function provisionTenant(
  db: Db,
  input: { tenantName: string; adminName: string; email: string; password: string },
): Promise<{ tenantId: string; slug: string; userId: string; employeeId: string }> {
  const slug = await uniqueSlug(db, input.tenantName);
  const tenantId = newId();
  const userId = newId();
  const employeeId = newId();
  const passwordHash = await hashPassword(input.password);
  const email = input.email.toLowerCase();

  await exec(db, `INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)`, [tenantId, input.tenantName, slug]);

  await exec(
    db,
    `INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, 'admin')`,
    [userId, tenantId, email, passwordHash, input.adminName],
  );

  await exec(
    db,
    `INSERT INTO employees (id, tenant_id, user_id, employee_no, full_name, email, employment_type, join_date, status)
     VALUES (?, ?, ?, 'EMP-0001', ?, ?, 'full_time', ?, 'active')`,
    [employeeId, tenantId, userId, input.adminName, email, nowIso().slice(0, 10)],
  );

  for (const lt of DEFAULT_LEAVE_TYPES) {
    await exec(
      db,
      `INSERT INTO leave_types (id, tenant_id, name, default_entitlement_days) VALUES (?, ?, ?, ?)`,
      [newId(), tenantId, lt.name, lt.days],
    );
  }

  for (const ct of DEFAULT_CLAIM_TYPES) {
    await exec(
      db,
      `INSERT INTO claim_types (id, tenant_id, name, is_mileage, mileage_rate, is_advance) VALUES (?, ?, ?, ?, ?, ?)`,
      [newId(), tenantId, ct.name, ct.isMileage ? 1 : 0, ct.mileageRate ?? null, ct.isAdvance ? 1 : 0],
    );
  }

  await seedDefaultWorkflow(db, tenantId, "leave_application", "Standard Leave Approval");
  await seedDefaultWorkflow(db, tenantId, "claim", "Standard Claim Approval");
  await seedDefaultWorkflow(db, tenantId, "employee_request", "Standard Request Approval");
  await seedDefaultWorkflow(db, tenantId, "training_enrollment", "Standard Training Approval");
  await seedDefaultWorkflow(db, tenantId, "uniform_order", "Standard Uniform Approval");
  await seedDefaultWorkflow(db, tenantId, "overtime", "Standard Overtime Approval");
  await seedDefaultWorkflow(db, tenantId, "leave_quota", "Standard Leave Quota Approval");
  await seedDefaultWorkflow(db, tenantId, "leave_encashment", "Standard Leave Encashment Approval");

  await exec(
    db,
    `INSERT INTO work_schedules (id, tenant_id, name, start_time, end_time, work_days) VALUES (?, ?, 'Standard Shift', '09:00', '18:00', '1,2,3,4,5')`,
    [newId(), tenantId],
  );

  await recordAudit(db, {
    tenantId,
    module: "tenant",
    recordId: tenantId,
    action: "created",
    actorUserId: userId,
    remarks: `Tenant "${input.tenantName}" registered`,
  });

  return { tenantId, slug, userId, employeeId };
}
