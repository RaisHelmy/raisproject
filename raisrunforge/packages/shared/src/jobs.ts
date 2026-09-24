import type { Id } from "./ids";

export type JobType =
  | "deployment"
  | "backup"
  | "migration"
  | "server_provision"
  | "container"
  | "restart"
  | "rollback";

export type JobStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface Job {
  id: Id;
  organizationId: Id;
  type: JobType;
  status: JobStatus;
  resourceType: string;
  resourceId: Id;
  /** Current human readable phase (e.g. "Building"). */
  phase?: string;
  progress: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  correlationId: string;
  simulated: boolean;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
