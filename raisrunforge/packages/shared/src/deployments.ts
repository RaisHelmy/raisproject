import type { Id } from "./ids";
import type { Environment } from "./status";

/** Deployment statuses follow the spec §20 vocabulary. */
export type DeploymentStatus =
  | "queued"
  | "cloning"
  | "building"
  | "packaging"
  | "deploying"
  | "starting"
  | "health_checking"
  | "switching_traffic"
  | "completed"
  | "failed"
  | "cancelled"
  | "rolled_back";

export const DEPLOYMENT_STAGES: Array<{ status: DeploymentStatus; label: string }> = [
  { status: "cloning", label: "Repository cloned" },
  { status: "building", label: "Dependencies installed" },
  { status: "packaging", label: "Docker image built" },
  { status: "deploying", label: "New revision created" },
  { status: "starting", label: "Container started" },
  { status: "health_checking", label: "Health check passed" },
  { status: "switching_traffic", label: "Traffic switched" },
];

export type DeploymentStepState = "pending" | "running" | "success" | "failed" | "skipped";

export interface DeploymentStep {
  key: string;
  label: string;
  state: DeploymentStepState;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
}

export interface Deployment {
  id: Id;
  organizationId: Id;
  projectId: Id;
  applicationId: Id;
  applicationName: string;
  environment: Environment;
  serverId?: Id;
  serverName?: string;
  revisionId?: Id;
  version: string;
  commitSha: string;
  commitMessage: string;
  branch: string;
  trigger: "manual" | "webhook" | "rollback" | "mcp" | "ai";
  triggeredBy: string;
  status: DeploymentStatus;
  steps: DeploymentStep[];
  jobId?: Id;
  /** True when the deployment was executed by the Demo Provider and nothing real happened. */
  simulated: boolean;
  durationMs?: number;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function isTerminalDeploymentStatus(status: DeploymentStatus): boolean {
  return (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "rolled_back"
  );
}
