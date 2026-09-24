import { exec, newId, nowIso, queryAll, queryOne, type Db } from "../../core/db";
import { hasPermission, type PermissionKey } from "../../core/permissions";
import type { AuthContext, Role } from "../../core/types";
import { notifyStepApprovers, notifySubmitter } from "../notifications/service";
import type { WorkflowDefinition, WorkflowInstance, WorkflowStep, WorkflowStepAction } from "./types";

function moduleLabel(module: string): string {
  return module.replace(/_/g, " ");
}

export class WorkflowError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Picks the most specific active definition for a module: an exact
 * category match beats a wildcard (null category), and an amount-range
 * match adds further specificity. A definition with a category that
 * doesn't match, or an amount outside its range, is not a candidate at all. */
export async function findMatchingDefinition(
  db: Db,
  tenantId: string,
  module: string,
  category: string | null,
  amount: number | null,
): Promise<WorkflowDefinition | null> {
  const defs = await queryAll<WorkflowDefinition>(
    db,
    `SELECT * FROM workflow_definitions WHERE tenant_id = ? AND module = ? AND is_active = 1`,
    [tenantId, module],
  );

  let best: WorkflowDefinition | null = null;
  let bestScore = -1;
  for (const d of defs) {
    if (d.category && d.category !== category) continue;
    if (amount != null) {
      if (d.min_amount != null && amount < d.min_amount) continue;
      if (d.max_amount != null && amount > d.max_amount) continue;
    }
    const score = (d.category ? 2 : 0) + (d.min_amount != null || d.max_amount != null ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

async function resolveManagerChain(
  db: Db,
  employeeId: string,
  levels: number,
): Promise<string | null> {
  let current = employeeId;
  for (let i = 0; i < levels; i++) {
    const emp = await queryOne<{ manager_id: string | null }>(
      db,
      `SELECT manager_id FROM employees WHERE id = ?`,
      [current],
    );
    if (!emp?.manager_id) return null;
    current = emp.manager_id;
  }
  return current;
}

async function resolveStepApprover(
  db: Db,
  employeeId: string,
  step: WorkflowStep,
): Promise<{ employeeId: string | null; role: Role | null }> {
  if (step.approver_type === "employee_manager") {
    const managerId = await resolveManagerChain(db, employeeId, step.manager_level || 1);
    return { employeeId: managerId, role: null };
  }
  if (step.approver_type === "role") {
    return { employeeId: null, role: step.approver_role };
  }
  // specific_user
  const emp = await queryOne<{ id: string }>(db, `SELECT id FROM employees WHERE user_id = ?`, [
    step.approver_user_id,
  ]);
  return { employeeId: emp?.id ?? null, role: null };
}

export async function startWorkflow(
  db: Db,
  opts: {
    tenantId: string;
    module: string;
    recordId: string;
    employeeId: string;
    category: string | null;
    amount?: number | null;
  },
): Promise<WorkflowInstance> {
  const definition = await findMatchingDefinition(
    db,
    opts.tenantId,
    opts.module,
    opts.category,
    opts.amount ?? null,
  );
  if (!definition) {
    throw new WorkflowError(400, "No approval workflow is configured for this request type");
  }

  const steps = await queryAll<WorkflowStep>(
    db,
    `SELECT * FROM workflow_steps WHERE workflow_definition_id = ? ORDER BY step_order`,
    [definition.id],
  );
  if (steps.length === 0) {
    throw new WorkflowError(400, "The matching approval workflow has no steps configured");
  }

  const instanceId = newId();
  await exec(
    db,
    `INSERT INTO workflow_instances (id, tenant_id, module, record_id, workflow_definition_id, current_step_order, status)
     VALUES (?, ?, ?, ?, ?, 1, 'in_progress')`,
    [instanceId, opts.tenantId, opts.module, opts.recordId, definition.id],
  );

  for (const step of steps) {
    const resolved = await resolveStepApprover(db, opts.employeeId, step);
    await exec(
      db,
      `INSERT INTO workflow_step_actions
         (id, tenant_id, workflow_instance_id, step_order, step_name, approver_type,
          resolved_approver_employee_id, resolved_approver_role, action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        newId(),
        opts.tenantId,
        instanceId,
        step.step_order,
        step.step_name,
        step.approver_type,
        resolved.employeeId,
        resolved.role,
      ],
    );
    if (step.step_order === 1) {
      await notifyStepApprovers(db, {
        tenantId: opts.tenantId,
        resolvedApproverEmployeeId: resolved.employeeId,
        resolvedApproverRole: resolved.role,
        message: `New ${moduleLabel(opts.module)} approval waiting on you: ${step.step_name}`,
        link: `/workflows/${instanceId}`,
      });
    }
  }

  return (await queryOne<WorkflowInstance>(db, `SELECT * FROM workflow_instances WHERE id = ?`, [
    instanceId,
  ]))!;
}

/** A step is actionable by: `admin` (the one fixed superuser), the specific
 * employee it's resolved to (whether via employee_manager/specific_user
 * resolution at submit time, or a later reassignment — a personal
 * assignment always works, regardless of the actor's role), or anyone
 * whose role currently holds `approvePermissionKey` (a tenant-configured
 * grant acts as a blanket override for that module, matching what used to
 * be a hardcoded admin/hr-only override before permissions existed). */
async function canActOnStep(
  db: Db,
  auth: AuthContext,
  stepAction: WorkflowStepAction,
  approvePermissionKey: PermissionKey,
): Promise<boolean> {
  if (auth.role === "admin") return true;
  if (stepAction.resolved_approver_employee_id && stepAction.resolved_approver_employee_id === auth.employeeId) {
    return true;
  }
  return hasPermission(db, auth, approvePermissionKey);
}

export async function decideCurrentStep(
  db: Db,
  opts: {
    tenantId: string;
    instanceId: string;
    auth: AuthContext;
    action: "approve" | "reject";
    remarks?: string | null;
    approvePermissionKey: PermissionKey;
  },
): Promise<WorkflowInstance> {
  const instance = await queryOne<WorkflowInstance>(
    db,
    `SELECT * FROM workflow_instances WHERE id = ? AND tenant_id = ?`,
    [opts.instanceId, opts.tenantId],
  );
  if (!instance) throw new WorkflowError(404, "Not found");
  if (instance.status !== "in_progress") throw new WorkflowError(400, "This request has already been decided");

  const stepAction = await queryOne<WorkflowStepAction>(
    db,
    `SELECT * FROM workflow_step_actions WHERE workflow_instance_id = ? AND step_order = ?`,
    [instance.id, instance.current_step_order],
  );
  if (!stepAction) throw new WorkflowError(500, "Workflow step is missing");
  if (!(await canActOnStep(db, opts.auth, stepAction, opts.approvePermissionKey))) {
    throw new WorkflowError(403, "You are not the approver for this step");
  }

  const now = nowIso();

  if (opts.action === "approve") {
    await exec(
      db,
      `UPDATE workflow_step_actions SET action = 'approved', acted_by_user_id = ?, remarks = ?, acted_at = ? WHERE id = ?`,
      [opts.auth.userId, opts.remarks ?? null, now, stepAction.id],
    );

    const nextStep = await queryOne<WorkflowStepAction>(
      db,
      `SELECT * FROM workflow_step_actions WHERE workflow_instance_id = ? AND step_order = ?`,
      [instance.id, instance.current_step_order + 1],
    );
    if (nextStep) {
      await exec(db, `UPDATE workflow_instances SET current_step_order = current_step_order + 1 WHERE id = ?`, [
        instance.id,
      ]);
      await notifyStepApprovers(db, {
        tenantId: opts.tenantId,
        resolvedApproverEmployeeId: nextStep.resolved_approver_employee_id,
        resolvedApproverRole: nextStep.resolved_approver_role,
        message: `New ${moduleLabel(instance.module)} approval waiting on you: ${nextStep.step_name}`,
        link: `/workflows/${instance.id}`,
      });
    } else {
      await exec(db, `UPDATE workflow_instances SET status = 'approved', completed_at = ? WHERE id = ?`, [
        now,
        instance.id,
      ]);
      await notifySubmitter(db, {
        tenantId: opts.tenantId,
        module: instance.module,
        recordId: instance.record_id,
        message: `Your ${moduleLabel(instance.module)} request was approved`,
        link: `/workflows/${instance.id}`,
      });
    }
  } else {
    await exec(
      db,
      `UPDATE workflow_step_actions SET action = 'rejected', acted_by_user_id = ?, remarks = ?, acted_at = ? WHERE id = ?`,
      [opts.auth.userId, opts.remarks ?? null, now, stepAction.id],
    );
    await exec(
      db,
      `UPDATE workflow_step_actions SET action = 'skipped' WHERE workflow_instance_id = ? AND step_order > ? AND action = 'pending'`,
      [instance.id, instance.current_step_order],
    );
    await exec(db, `UPDATE workflow_instances SET status = 'rejected', completed_at = ? WHERE id = ?`, [
      now,
      instance.id,
    ]);
    await notifySubmitter(db, {
      tenantId: opts.tenantId,
      module: instance.module,
      recordId: instance.record_id,
      message: `Your ${moduleLabel(instance.module)} request was rejected`,
      link: `/workflows/${instance.id}`,
    });
  }

  return (await queryOne<WorkflowInstance>(db, `SELECT * FROM workflow_instances WHERE id = ?`, [
    instance.id,
  ]))!;
}

export async function cancelWorkflow(db: Db, tenantId: string, instanceId: string): Promise<void> {
  await exec(
    db,
    `UPDATE workflow_step_actions SET action = 'skipped' WHERE workflow_instance_id = ? AND action = 'pending'`,
    [instanceId],
  );
  await exec(db, `UPDATE workflow_instances SET status = 'cancelled', completed_at = ? WHERE id = ? AND tenant_id = ?`, [
    nowIso(),
    instanceId,
    tenantId,
  ]);
}
