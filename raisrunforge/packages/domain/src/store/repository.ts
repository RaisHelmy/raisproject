import type {
  Application,
  ApplicationRevision,
  AuditLog,
  Backup,
  Deployment,
  EnvironmentRecord,
  Event,
  GitConnection,
  Incident,
  Integration,
  Job,
  McpToken,
  Member,
  Organization,
  Project,
  StorageBucket,
  User,
} from "@runforge/shared";

export interface ListOptions<T> {
  where?: Partial<T>;
  limit?: number;
  offset?: number;
  orderBy?: keyof T & string;
  direction?: "asc" | "desc";
}

/** Repository for globally keyed records (users, organizations). */
export interface KeyedRepository<T extends { id: string }> {
  list(options?: ListOptions<T>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  insert(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

/**
 * Repository for tenant-owned records. Every call is scoped by organizationId,
 * which is how tenant isolation is enforced below the service layer.
 */
export interface TenantRepository<T extends { id: string; organizationId: string }> {
  list(organizationId: string, options?: ListOptions<T>): Promise<T[]>;
  get(organizationId: string, id: string): Promise<T | null>;
  insert(item: T): Promise<T>;
  update(organizationId: string, id: string, patch: Partial<T>): Promise<T>;
  delete(organizationId: string, id: string): Promise<void>;
  count(organizationId: string, where?: Partial<T>): Promise<number>;
}

/**
 * DataStore holds control-plane records. Infrastructure resources (servers,
 * containers, databases, domains...) are read through providers, but their
 * configuration and every deployment/event/job lives here.
 */
export interface DataStore {
  users: KeyedRepository<User>;
  organizations: KeyedRepository<Organization>;
  members: TenantRepository<Member>;
  projects: TenantRepository<Project>;
  environments: TenantRepository<EnvironmentRecord>;
  applications: TenantRepository<Application>;
  revisions: TenantRepository<ApplicationRevision>;
  deployments: TenantRepository<Deployment>;
  storage: TenantRepository<StorageBucket>;
  backups: TenantRepository<Backup>;
  events: TenantRepository<Event>;
  auditLogs: TenantRepository<AuditLog>;
  incidents: TenantRepository<Incident>;
  integrations: TenantRepository<Integration>;
  gitConnections: TenantRepository<GitConnection>;
  mcpTokens: TenantRepository<McpToken>;
  jobs: TenantRepository<Job>;
}
