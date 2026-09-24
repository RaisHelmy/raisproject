/** The unified status vocabulary used by every resource in RunForge (see spec §58). */
export type HealthStatus =
  | "healthy"
  | "degraded"
  | "failed"
  | "building"
  | "deploying"
  | "starting"
  | "stopped"
  | "offline"
  | "unknown";

export type ServerStatus = "online" | "offline" | "provisioning" | "degraded" | "unknown";
export type ContainerStatus = "running" | "stopped" | "paused" | "restarting" | "exited" | "unknown";
export type ServiceStatus = "active" | "inactive" | "failed" | "unknown";
export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved";
export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export type Environment = "development" | "staging" | "production" | string;
