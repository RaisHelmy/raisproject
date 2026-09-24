import type { Id } from "./ids";
import type { ActorType } from "./auth";
import type { IncidentSeverity, IncidentStatus } from "./status";

export type LogSeverity = "debug" | "info" | "warn" | "error";

export type LogSource =
  | "application"
  | "container"
  | "server"
  | "nginx"
  | "caddy"
  | "database"
  | "deployment"
  | "agent"
  | "cloudflare";

export interface LogEntry {
  id: Id;
  organizationId: Id;
  timestamp: string;
  severity: LogSeverity;
  source: LogSource;
  service: string;
  serverId?: Id;
  applicationId?: Id;
  deploymentId?: Id;
  environment?: string;
  requestId?: string;
  message: string;
}

export interface LogQuery {
  search?: string;
  severity?: LogSeverity[];
  service?: string;
  serverId?: Id;
  applicationId?: Id;
  deploymentId?: Id;
  environment?: string;
  since?: string;
  until?: string;
  limit?: number;
  /** Return only entries newer than this id (used by live mode). */
  after?: Id;
}

export type MetricName =
  | "cpu"
  | "memory"
  | "disk"
  | "network"
  | "requests"
  | "latency"
  | "errors"
  | "throughput"
  | "connections"
  | "queries"
  | "deployment_frequency"
  | "deployment_duration";

export type MetricRange = "5m" | "1h" | "6h" | "24h" | "7d" | "30d";

export interface MetricPoint {
  /** Unix milliseconds. */
  t: number;
  v: number;
}

export interface MetricSeries {
  name: MetricName;
  unit: string;
  resourceType: "server" | "application" | "database" | "organization";
  resourceId: Id;
  range: MetricRange;
  points: MetricPoint[];
  /** Deployment markers overlaid on the series (spec §68). */
  markers?: Array<{ t: number; label: string; deploymentId: Id }>;
}

export interface MetricQuery {
  resourceType: MetricSeries["resourceType"];
  resourceId: Id;
  names: MetricName[];
  range: MetricRange;
}

export type EventStatus = "success" | "failed" | "pending" | "info";

/** Every important action generates an event (spec §38/§39). */
export interface Event {
  id: Id;
  organizationId: Id;
  projectId?: Id;
  actorType: ActorType;
  actorId: Id;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: Id;
  resourceName: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  status: EventStatus;
  message: string;
  correlationId: string;
  simulated: boolean;
  createdAt: string;
}

export interface AuditLog extends Event {
  ip?: string;
  userAgent?: string;
  result: "allowed" | "denied";
}

export interface Incident {
  id: Id;
  organizationId: Id;
  projectId?: Id;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  resourceType: string;
  resourceId: Id;
  resourceName: string;
  impactPercent?: number;
  likelyCause?: string;
  relatedDeploymentId?: Id;
  relatedChanges: string[];
  startedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
