import type { Id } from "./ids";
import type {
  ContainerStatus,
  Environment,
  HealthStatus,
  ServerStatus,
  ServiceStatus,
} from "./status";

export type ProviderKind =
  | "demo"
  | "self_hosted"
  | "docker"
  | "cloud_run"
  | "cloudflare"
  | "proxmox"
  | "kubernetes"
  | "hetzner"
  | "digitalocean"
  | "vultr"
  | "aws"
  | "azure";

export interface Project {
  id: Id;
  organizationId: Id;
  name: string;
  slug: string;
  description?: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentRecord {
  id: Id;
  organizationId: Id;
  projectId: Id;
  name: Environment;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Server {
  id: Id;
  organizationId: Id;
  name: string;
  status: ServerStatus;
  provider: ProviderKind;
  providerLabel: string;
  region: string;
  os: string;
  ipAddress: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  agentVersion?: string;
  lastHeartbeatAt?: string;
  uptimeSeconds: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ServerMetricsSnapshot {
  serverId: Id;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  networkMbps: number;
  loadAverage: [number, number, number];
  processes: number;
  containers: number;
  applications: number;
  collectedAt: string;
}

export type Runtime =
  | "dotnet"
  | "node"
  | "bun"
  | "python"
  | "go"
  | "java"
  | "php"
  | "rust"
  | "docker"
  | "static";

export type SourceType =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "git"
  | "docker_image"
  | "dockerfile"
  | "manual";

export interface ApplicationSource {
  type: SourceType;
  repository?: string;
  branch?: string;
  image?: string;
  dockerfile?: string;
}

export interface ApplicationResources {
  cpu: number;
  memoryMb: number;
  instances: number;
  minInstances: number;
  maxInstances: number;
}

export interface Application {
  id: Id;
  organizationId: Id;
  projectId: Id;
  environmentId: Id;
  environment: Environment;
  name: string;
  slug: string;
  status: HealthStatus;
  runtime: Runtime;
  runtimeLabel: string;
  packaging: "docker" | "process";
  source: ApplicationSource;
  serverId?: Id;
  provider: ProviderKind;
  domain?: string;
  url?: string;
  port: number;
  healthPath: string;
  databaseId?: Id;
  storageId?: Id;
  currentRevisionId?: Id;
  currentVersion?: string;
  resources: ApplicationResources;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationRevision {
  id: Id;
  organizationId: Id;
  applicationId: Id;
  version: string;
  commitSha: string;
  commitMessage: string;
  image?: string;
  trafficPercent: number;
  status: HealthStatus;
  deploymentId?: Id;
  createdAt: string;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  secret: boolean;
}

export interface Container {
  id: Id;
  organizationId: Id;
  serverId: Id;
  applicationId?: Id;
  name: string;
  image: string;
  status: ContainerStatus;
  cpuPercent: number;
  memoryMb: number;
  memoryLimitMb: number;
  ports: Array<{ container: number; host?: number; protocol: "tcp" | "udp" }>;
  network: string;
  restarts: number;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceRecord {
  id: Id;
  organizationId: Id;
  serverId: Id;
  name: string;
  unit: string;
  status: ServiceStatus;
  enabled: boolean;
  pid?: number;
  cpuPercent: number;
  memoryMb: number;
  uptimeSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export type DatabaseEngine = "postgresql" | "mysql" | "sqlserver" | "sqlite" | "redis";

export interface Database {
  id: Id;
  organizationId: Id;
  projectId: Id;
  serverId?: Id;
  name: string;
  engine: DatabaseEngine;
  version: string;
  status: HealthStatus;
  sizeBytes: number;
  connections: number;
  maxConnections: number;
  queriesPerSecond: number;
  host: string;
  port: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageBucket {
  id: Id;
  organizationId: Id;
  projectId: Id;
  name: string;
  provider: "r2" | "s3" | "local";
  region: string;
  sizeBytes: number;
  objects: number;
  status: HealthStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Backup {
  id: Id;
  organizationId: Id;
  resourceType: "database" | "application" | "server" | "configuration";
  resourceId: Id;
  resourceName: string;
  destination: "r2" | "s3" | "local";
  sizeBytes: number;
  status: "completed" | "running" | "failed" | "verified";
  createdAt: string;
  updatedAt: string;
}

export interface GitConnection {
  id: Id;
  organizationId: Id;
  provider: "github" | "gitlab" | "bitbucket" | "gitea" | "git";
  account: string;
  status: "connected" | "disconnected";
  repositories: number;
  createdAt: string;
  updatedAt: string;
}

export interface Repository {
  id: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
}

export interface Branch {
  name: string;
  commitSha: string;
}

export interface Integration {
  id: Id;
  organizationId: Id;
  kind: "cloudflare" | "github" | "gitlab" | "hetzner" | "digitalocean" | "slack" | "mcp";
  name: string;
  status: "connected" | "disconnected" | "error";
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: Id;
  kind: "application" | "infrastructure" | "database";
  name: string;
  description: string;
  runtime?: Runtime;
  tags: string[];
}
