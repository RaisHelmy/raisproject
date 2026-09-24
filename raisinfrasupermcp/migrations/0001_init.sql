-- Super MCP — initial schema (D1 / SQLite dialect, PostgreSQL-compatible types where possible).
-- Storage model: every aggregate is stored as a row with indexed tenant/lookup columns plus a JSON `data` column.
-- Normalized projection tables exist for reporting and future PostgreSQL migration; the repository layer keeps them in sync
-- for the entities that need relational queries (approvals, tasks, changes, telemetry).

CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, plan_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS passwords (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS organization_memberships (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(organization_id, user_id));
CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_memberships (id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE, membership_id TEXT NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE, UNIQUE(group_id, membership_id));
CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, key TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS permissions (key TEXT PRIMARY KEY, description TEXT);
CREATE TABLE IF NOT EXISTS role_permissions (role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_key TEXT NOT NULL REFERENCES permissions(key), PRIMARY KEY (role_id, permission_key));
CREATE TABLE IF NOT EXISTS user_roles (membership_id TEXT NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE, PRIMARY KEY (membership_id, role_id));

CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, status TEXT NOT NULL, environment_id TEXT, last_seen_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agent_capabilities (agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE, capability TEXT NOT NULL, PRIMARY KEY (agent_id, capability));
CREATE TABLE IF NOT EXISTS environments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, kind TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS servers (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, environment_id TEXT REFERENCES environments(id) ON DELETE SET NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vms (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, server_id TEXT REFERENCES servers(id) ON DELETE CASCADE, proxmox_vm_id INTEGER, node TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, slug TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(organization_id, slug));
CREATE TABLE IF NOT EXISTS git_connections (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, provider TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS repositories (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, connection_id TEXT REFERENCES git_connections(id) ON DELETE CASCADE, full_name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS integrations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, kind TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
-- credentials holds REFERENCES ONLY (provider + ref + metadata). Secrets live in the secret provider.
CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, ref TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(organization_id, ref));

CREATE TABLE IF NOT EXISTS changes (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, key TEXT NOT NULL, status TEXT NOT NULL, current_stage TEXT NOT NULL, owner_id TEXT, risk TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS change_stages (id TEXT PRIMARY KEY, change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, key TEXT NOT NULL, state TEXT NOT NULL, started_at TEXT, completed_at TEXT, data TEXT);
CREATE TABLE IF NOT EXISTS change_tasks (change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, task_id TEXT NOT NULL, stage_key TEXT, PRIMARY KEY (change_id, task_id));
CREATE TABLE IF NOT EXISTS change_impacts (change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, component TEXT NOT NULL, status TEXT NOT NULL, note TEXT, PRIMARY KEY (change_id, component));
CREATE TABLE IF NOT EXISTS change_checklists (id TEXT PRIMARY KEY, change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, stage_key TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, state TEXT NOT NULL, required INTEGER NOT NULL, automated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS change_evidence (id TEXT PRIMARY KEY, organization_id TEXT, change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, stage_key TEXT NOT NULL, type TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS change_timeline (id TEXT PRIMARY KEY, organization_id TEXT, change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, at TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS change_dependencies (change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, depends_on_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, PRIMARY KEY (change_id, depends_on_id));
CREATE TABLE IF NOT EXISTS change_blockers (id TEXT PRIMARY KEY, change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, stage_key TEXT NOT NULL, title TEXT NOT NULL, resolved_at TEXT, created_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS change_approvals (change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, approval_request_id TEXT NOT NULL, PRIMARY KEY (change_id, approval_request_id));
CREATE TABLE IF NOT EXISTS change_tests (id TEXT PRIMARY KEY, change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, name TEXT NOT NULL, result TEXT NOT NULL, at TEXT NOT NULL, data TEXT);
CREATE TABLE IF NOT EXISTS change_uat (id TEXT PRIMARY KEY, change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, result TEXT NOT NULL, note TEXT, by_user_id TEXT, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS change_deployments (change_id TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE, deployment_id TEXT NOT NULL, PRIMARY KEY (change_id, deployment_id));

CREATE TABLE IF NOT EXISTS task_definitions (id TEXT PRIMARY KEY, version TEXT NOT NULL, type TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, key TEXT NOT NULL, change_id TEXT REFERENCES changes(id) ON DELETE SET NULL, definition_id TEXT NOT NULL, definition_version TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, risk TEXT NOT NULL, environment_id TEXT, agent_id TEXT, ai_run_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS task_executions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, attempt INTEGER NOT NULL, status TEXT NOT NULL, started_at TEXT, finished_at TEXT, execution_mode TEXT NOT NULL, data TEXT);
CREATE TABLE IF NOT EXISTS task_step_executions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, step_id TEXT NOT NULL, sequence INTEGER NOT NULL, status TEXT NOT NULL, started_at TEXT, finished_at TEXT, duration_ms INTEGER, error TEXT, recovery_action TEXT, execution_mode TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS policies (id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, scope TEXT NOT NULL, enabled INTEGER NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS policy_versions (id TEXT PRIMARY KEY, policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE, version INTEGER NOT NULL, updated_by TEXT, updated_at TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(policy_id, version));
CREATE TABLE IF NOT EXISTS approval_requests (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, key TEXT NOT NULL, status TEXT NOT NULL, kind TEXT NOT NULL, change_id TEXT, task_id TEXT, requested_by TEXT NOT NULL, risk TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS approval_analytics (approval_request_id TEXT PRIMARY KEY REFERENCES approval_requests(id) ON DELETE CASCADE, requested_at TEXT NOT NULL, decided_at TEXT, duration_ms INTEGER, result TEXT, approver_count INTEGER, rejection_reason TEXT);

CREATE TABLE IF NOT EXISTS deployments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, change_id TEXT, task_id TEXT, application_id TEXT, environment_id TEXT, status TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, key TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, change_id TEXT, task_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS issues (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, key TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS ai_runs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT, key TEXT NOT NULL, purpose TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, change_id TEXT, start_time TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_requests (id TEXT PRIMARY KEY, ai_run_id TEXT NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE, purpose TEXT NOT NULL, input_tokens INTEGER, output_tokens INTEGER, duration_ms INTEGER, status TEXT, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mcp_calls (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, ai_run_id TEXT NOT NULL, user_id TEXT, tool_name TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL, change_id TEXT, task_id TEXT, agent_id TEXT, start_time TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mcp_call_chains (call_id TEXT PRIMARY KEY REFERENCES mcp_calls(id) ON DELETE CASCADE, parent_call_id TEXT, dependency_call_id TEXT, sequence_number INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS mcp_tool_usage (organization_id TEXT NOT NULL, tool_name TEXT NOT NULL, period TEXT NOT NULL, total_calls INTEGER, successful_calls INTEGER, failed_calls INTEGER, avg_duration_ms INTEGER, p95_duration_ms INTEGER, retries INTEGER, redundant_calls INTEGER, PRIMARY KEY (organization_id, tool_name, period));
CREATE TABLE IF NOT EXISTS ai_failures (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, ai_run_id TEXT, type TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_recoveries (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, failure_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS human_interventions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS problem_patterns (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, signature TEXT NOT NULL, occurrences INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge_records (id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE, type TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS optimization_recommendations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, type TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ai_experiments (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS change_analytics (change_id TEXT PRIMARY KEY REFERENCES changes(id) ON DELETE CASCADE, organization_id TEXT NOT NULL, total_minutes INTEGER, blocked_minutes INTEGER, waiting_minutes INTEGER, ai_run_count INTEGER, mcp_call_count INTEGER, task_count INTEGER, failures INTEGER, recoveries INTEGER, rollbacks INTEGER, human_interventions INTEGER, data TEXT);
CREATE TABLE IF NOT EXISTS agent_analytics (agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE, period TEXT NOT NULL, operations INTEGER, failures INTEGER, avg_latency_ms INTEGER, uptime_pct REAL, PRIMARY KEY (agent_id, period));

CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, actor_id TEXT NOT NULL, action TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, result TEXT NOT NULL, risk TEXT NOT NULL, correlation_id TEXT NOT NULL, timestamp TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, user_id TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, name TEXT NOT NULL, price_monthly_myr INTEGER, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subscriptions (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, plan_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS usage_records (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, period TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(organization_id, period));
CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, number TEXT UNIQUE NOT NULL, status TEXT NOT NULL, amount_myr REAL NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketplace_items (id TEXT PRIMARY KEY, publisher TEXT NOT NULL, pricing TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS marketplace_purchases (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, item_id TEXT NOT NULL REFERENCES marketplace_items(id), price_myr REAL NOT NULL, publisher_share REAL NOT NULL, platform_share REAL NOT NULL, purchased_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS automations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, enabled INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS automation_versions (id TEXT PRIMARY KEY, automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE, version TEXT NOT NULL, data TEXT NOT NULL, UNIQUE(automation_id, version));

-- Tenant-aware indexes
CREATE INDEX IF NOT EXISTS idx_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_changes_org_status ON changes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_changes_org_updated ON changes(organization_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_evidence_change ON change_evidence(change_id, created_at);
CREATE INDEX IF NOT EXISTS idx_timeline_change ON change_timeline(change_id, at);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_change ON tasks(change_id);
CREATE INDEX IF NOT EXISTS idx_approvals_org_status ON approval_requests(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_change ON approval_requests(change_id);
CREATE INDEX IF NOT EXISTS idx_deployments_org ON deployments(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_runs_org_time ON ai_runs(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_mcp_calls_org_time ON mcp_calls(organization_id, start_time);
CREATE INDEX IF NOT EXISTS idx_mcp_calls_run ON mcp_calls(ai_run_id);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_logs(organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(organization_id, user_id, read);
CREATE INDEX IF NOT EXISTS idx_agents_org ON agents(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_policies_org ON policies(organization_id);
