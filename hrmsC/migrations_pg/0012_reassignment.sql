-- Task reassignment (old_project's ReAssignTask module): when a pending
-- workflow step's approver is unavailable, HR/admin can hand it to someone
-- else. Tracked directly on workflow_step_actions rather than a separate
-- log table, so the routing trail UI can show "reassigned from X" inline.
ALTER TABLE workflow_step_actions ADD COLUMN reassigned_from_employee_id TEXT REFERENCES employees(id);
ALTER TABLE workflow_step_actions ADD COLUMN reassignment_comment TEXT;
ALTER TABLE workflow_step_actions ADD COLUMN reassigned_at TEXT;
