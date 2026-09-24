-- Lives in the `raisrunforge` schema inside the shared `raishelmy` Postgres
-- database (one instance, one schema per app — see scripts/db-migrate.ts,
-- which sets search_path to `raisrunforge` before applying this file).
--
-- RunForge control-plane schema (spec §54: multi-tenant from day one).
-- Every tenant-owned table carries organization_id (and project_id where applicable)
-- so tenant isolation can be enforced at the query layer and audited.
--
-- Postgres port of ../0001_init.sql (originally written for D1/SQLite). Dialect
-- changes, kept as conservative/dialect-faithful as possible:
--   * PRAGMA foreign_keys removed — Postgres enforces FK constraints always.
--   * SQLite INTEGER 0/1 boolean flags -> native Postgres BOOLEAN.
--   * REAL (SQLite's 8-byte float) -> DOUBLE PRECISION.
--   * *_json TEXT columns -> JSONB (Postgres-native, and the repository layer's
--     fromRow() already accepts either a JSON string or a pre-parsed object).
--   * created_at/updated_at/etc left as TEXT (ISO-8601 strings), *not* converted
--     to TIMESTAMPTZ — the application layer already produces/consumes ISO
--     strings for these, so keeping TEXT avoids a parsing/behavior change that
--     is out of scope for this migration.
--   * TEXT primary/foreign keys, CHECK constraints, UNIQUE constraints and
--     indexes are unchanged — all valid Postgres.

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','developer','operator','viewer','ai_agent')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_members_org ON members(organization_id);
CREATE INDEX idx_members_user ON members(user_id);

-- ---------------------------------------------------------------------------
-- Projects / environments
-- ---------------------------------------------------------------------------

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, slug)
);
CREATE INDEX idx_projects_org ON projects(organization_id);

CREATE TABLE environments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, slug)
);
CREATE INDEX idx_environments_org ON environments(organization_id);
CREATE INDEX idx_environments_project ON environments(project_id);

-- ---------------------------------------------------------------------------
-- Applications / deployments
-- ---------------------------------------------------------------------------

CREATE TABLE applications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment_id TEXT NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'starting',
  runtime TEXT NOT NULL,
  runtime_label TEXT NOT NULL,
  packaging TEXT NOT NULL DEFAULT 'docker',
  source_json JSONB NOT NULL,
  server_id TEXT,
  provider TEXT NOT NULL DEFAULT 'demo',
  domain TEXT,
  url TEXT,
  port INTEGER NOT NULL DEFAULT 8080,
  health_path TEXT NOT NULL DEFAULT '/health',
  database_id TEXT,
  storage_id TEXT,
  current_revision_id TEXT,
  current_version TEXT,
  resources_json JSONB NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_applications_org ON applications(organization_id);
CREATE INDEX idx_applications_project ON applications(project_id);
CREATE INDEX idx_applications_server ON applications(server_id);
CREATE INDEX idx_applications_status ON applications(status);

CREATE TABLE application_revisions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  image TEXT,
  traffic_percent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'healthy',
  deployment_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_revisions_org ON application_revisions(organization_id);
CREATE INDEX idx_revisions_application ON application_revisions(application_id);

CREATE TABLE deployments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  application_name TEXT NOT NULL,
  environment TEXT NOT NULL,
  server_id TEXT,
  server_name TEXT,
  revision_id TEXT,
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  branch TEXT NOT NULL DEFAULT 'main',
  trigger TEXT NOT NULL DEFAULT 'manual',
  triggered_by TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  steps_json JSONB NOT NULL DEFAULT '[]',
  job_id TEXT,
  simulated BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INTEGER,
  error_message TEXT,
  queued_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_deployments_org ON deployments(organization_id);
CREATE INDEX idx_deployments_application ON deployments(application_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_queued_at ON deployments(queued_at);

-- ---------------------------------------------------------------------------
-- Servers / agents / containers / services
-- ---------------------------------------------------------------------------

CREATE TABLE servers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'provisioning',
  provider TEXT NOT NULL,
  provider_label TEXT NOT NULL,
  region TEXT,
  os TEXT,
  ip_address TEXT,
  cpu_cores INTEGER NOT NULL DEFAULT 0,
  memory_mb INTEGER NOT NULL DEFAULT 0,
  disk_gb INTEGER NOT NULL DEFAULT 0,
  agent_version TEXT,
  last_heartbeat_at TEXT,
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  tags_json JSONB NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_servers_org ON servers(organization_id);
CREATE INDEX idx_servers_status ON servers(status);

CREATE TABLE server_agents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','disconnected','revoked')),
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_server_agents_org ON server_agents(organization_id);
CREATE INDEX idx_server_agents_server ON server_agents(server_id);

CREATE TABLE containers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  application_id TEXT,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  cpu_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  memory_mb INTEGER NOT NULL DEFAULT 0,
  memory_limit_mb INTEGER NOT NULL DEFAULT 0,
  ports_json JSONB NOT NULL DEFAULT '[]',
  network TEXT,
  restarts INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_containers_org ON containers(organization_id);
CREATE INDEX idx_containers_server ON containers(server_id);
CREATE INDEX idx_containers_application ON containers(application_id);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pid INTEGER,
  cpu_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  memory_mb INTEGER NOT NULL DEFAULT 0,
  uptime_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_services_org ON services(organization_id);
CREATE INDEX idx_services_server ON services(server_id);

-- ---------------------------------------------------------------------------
-- Databases / storage / backups
-- ---------------------------------------------------------------------------

CREATE TABLE databases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  server_id TEXT,
  name TEXT NOT NULL,
  engine TEXT NOT NULL CHECK (engine IN ('postgresql','mysql','sqlserver','sqlite','redis')),
  version TEXT,
  status TEXT NOT NULL DEFAULT 'healthy',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  connections INTEGER NOT NULL DEFAULT 0,
  max_connections INTEGER NOT NULL DEFAULT 100,
  queries_per_second DOUBLE PRECISION NOT NULL DEFAULT 0,
  host TEXT,
  port INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_databases_org ON databases(organization_id);
CREATE INDEX idx_databases_project ON databases(project_id);

CREATE TABLE database_connections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  application_id TEXT,
  connection_string_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_db_connections_org ON database_connections(organization_id);
CREATE INDEX idx_db_connections_database ON database_connections(database_id);

CREATE TABLE database_migrations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  source_engine TEXT NOT NULL,
  target_engine TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  compatibility_json JSONB,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_db_migrations_org ON database_migrations(organization_id);

CREATE TABLE storage (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'r2',
  region TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  objects INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'healthy',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_storage_org ON storage(organization_id);
CREATE INDEX idx_storage_project ON storage(project_id);

CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('database','application','server','configuration')),
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT 'r2',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_backups_org ON backups(organization_id);
CREATE INDEX idx_backups_resource ON backups(resource_type, resource_id);

-- ---------------------------------------------------------------------------
-- Networking
-- ---------------------------------------------------------------------------

CREATE TABLE domains (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  name TEXT NOT NULL,
  application_id TEXT,
  provider TEXT NOT NULL DEFAULT 'cloudflare',
  ssl TEXT NOT NULL DEFAULT 'none',
  ssl_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, name)
);
CREATE INDEX idx_domains_org ON domains(organization_id);
CREATE INDEX idx_domains_application ON domains(application_id);

CREATE TABLE dns_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('A','AAAA','CNAME','TXT','MX','SRV')),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  ttl INTEGER NOT NULL DEFAULT 300,
  proxied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_dns_records_org ON dns_records(organization_id);
CREATE INDEX idx_dns_records_domain ON dns_records(domain_id);

CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain_id TEXT,
  domain TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '/',
  application_id TEXT NOT NULL,
  application_name TEXT NOT NULL,
  server_id TEXT,
  internal_port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'https',
  websocket BOOLEAN NOT NULL DEFAULT FALSE,
  health_path TEXT,
  proxy TEXT NOT NULL DEFAULT 'nginx',
  via_tunnel BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_routes_org ON routes(organization_id);
CREATE INDEX idx_routes_application ON routes(application_id);

CREATE TABLE ports (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  port INTEGER NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'tcp',
  service TEXT,
  container_id TEXT,
  exposure TEXT NOT NULL DEFAULT 'internal' CHECK (exposure IN ('internal','public','restricted')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (server_id, port, protocol)
);
CREATE INDEX idx_ports_org ON ports(organization_id);
CREATE INDEX idx_ports_server ON ports(server_id);

-- ---------------------------------------------------------------------------
-- Observability
-- ---------------------------------------------------------------------------

CREATE TABLE logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  timestamp TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('debug','info','warn','error')),
  source TEXT NOT NULL,
  service TEXT NOT NULL,
  server_id TEXT,
  application_id TEXT,
  deployment_id TEXT,
  environment TEXT,
  request_id TEXT,
  message TEXT NOT NULL
);
CREATE INDEX idx_logs_org_time ON logs(organization_id, timestamp);
CREATE INDEX idx_logs_application ON logs(application_id);
CREATE INDEX idx_logs_deployment ON logs(deployment_id);

CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL
);
CREATE INDEX idx_metrics_org_resource ON metrics(organization_id, resource_type, resource_id, name, timestamp);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','ai','system','agent')),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  message TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_events_org_time ON events(organization_id, created_at);
CREATE INDEX idx_events_resource ON events(resource_type, resource_id);
CREATE INDEX idx_events_correlation ON events(correlation_id);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT FALSE,
  result TEXT NOT NULL CHECK (result IN ('allowed','denied')),
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_logs_org_time ON audit_logs(organization_id, created_at);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','mitigated','resolved')),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  impact_percent DOUBLE PRECISION,
  likely_cause TEXT,
  related_deployment_id TEXT,
  related_changes_json JSONB NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_incidents_org ON incidents(organization_id);
CREATE INDEX idx_incidents_status ON incidents(status);

-- ---------------------------------------------------------------------------
-- Integrations / git / secrets / MCP / templates / jobs
-- ---------------------------------------------------------------------------

CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected',
  config_json JSONB,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_integrations_org ON integrations(organization_id);

CREATE TABLE git_connections (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github','gitlab','bitbucket','gitea','git')),
  account TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  access_token_encrypted TEXT,
  repositories INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_git_connections_org ON git_connections(organization_id);

CREATE TABLE secrets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_id TEXT,
  key TEXT NOT NULL,
  value_encrypted TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_secrets_org ON secrets(organization_id);
CREATE INDEX idx_secrets_application ON secrets(application_id);

CREATE TABLE mcp_tokens (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('READ','WRITE','DANGEROUS')),
  role TEXT NOT NULL,
  last_used_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_mcp_tokens_org ON mcp_tokens(organization_id);
CREATE UNIQUE INDEX idx_mcp_tokens_hash ON mcp_tokens(token_hash);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('application','infrastructure','database')),
  name TEXT NOT NULL,
  description TEXT,
  runtime TEXT,
  definition_json JSONB,
  tags_json JSONB NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','SUCCESS','FAILED','CANCELLED')),
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  phase TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}',
  result_json JSONB,
  error TEXT,
  correlation_id TEXT NOT NULL,
  simulated BOOLEAN NOT NULL DEFAULT FALSE,
  queued_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_jobs_org ON jobs(organization_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_resource ON jobs(resource_type, resource_id);
