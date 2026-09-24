import type {
  Application,
  ApplicationRevision,
  AuditLog,
  Backup,
  Container,
  Database,
  Deployment,
  DnsRecord,
  Domain,
  EnvironmentRecord,
  EnvironmentVariable,
  Event,
  GitConnection,
  Incident,
  Integration,
  Job,
  LogEntry,
  McpToken,
  Member,
  Organization,
  Port,
  Project,
  Route,
  Server,
  ServiceRecord,
  StorageBucket,
  Template,
  Tunnel,
  User,
} from "@runforge/shared";

/**
 * DemoWorld is the single in-memory state container used when RunForge runs
 * in demo mode. Demo providers mutate it and the in-memory data store reads it,
 * so the whole control plane behaves consistently without any external service.
 *
 * Everything in here is simulated. Nothing touches a real server.
 */
export class DemoWorld {
  users: User[] = [];
  organizations: Organization[] = [];
  members: Member[] = [];
  projects: Project[] = [];
  environments: EnvironmentRecord[] = [];
  applications: Application[] = [];
  revisions: ApplicationRevision[] = [];
  deployments: Deployment[] = [];
  servers: Server[] = [];
  containers: Container[] = [];
  services: ServiceRecord[] = [];
  databases: Database[] = [];
  storage: StorageBucket[] = [];
  backups: Backup[] = [];
  domains: Domain[] = [];
  dnsRecords: DnsRecord[] = [];
  routes: Route[] = [];
  ports: Port[] = [];
  tunnels: Tunnel[] = [];
  events: Event[] = [];
  auditLogs: AuditLog[] = [];
  incidents: Incident[] = [];
  integrations: Integration[] = [];
  gitConnections: GitConnection[] = [];
  mcpTokens: McpToken[] = [];
  jobs: Job[] = [];
  logs: LogEntry[] = [];
  templates: Template[] = [];
  environmentVariables = new Map<string, EnvironmentVariable[]>();

  /** Per-application runtime state used by the demo application provider. */
  appRuntime = new Map<
    string,
    { restarts: number; lastRestartAt?: string; stopped: boolean; instances: number; startedAt: string }
  >();

  /** In-flight simulated deployments: deploymentId -> simulation record. */
  deploymentSims = new Map<
    string,
    { startedAt: number; failAtStep?: number; cancelled: boolean; applicationId: string; version: string }
  >();

  /** Injectable clock so tests can control time. */
  now: () => number = () => Date.now();

  constructor(public readonly bootedAt: number = Date.now()) {}
}
