import type {
  Application,
  ApplicationRevision,
  DeploymentStatus,
  DeploymentStep,
  EnvironmentVariable,
  ProviderKind,
} from "@runforge/shared";

export interface DeployInput {
  organizationId: string;
  application: Application;
  deploymentId: string;
  version: string;
  commitSha: string;
  branch: string;
  /** Force the simulated deployment to fail (Demo Provider only). */
  simulateFailure?: boolean;
}

/** What the provider knows about a running deployment. */
export interface DeploymentProgress {
  status: DeploymentStatus;
  steps: DeploymentStep[];
  progress: number;
  startedAt?: string;
  finishedAt?: string;
  errorMessage?: string;
}

/**
 * ApplicationProvider executes application lifecycle operations on a target
 * (Docker host via agent, Cloud Run, Cloudflare, ...).
 */
export interface ApplicationProvider {
  readonly kind: ProviderKind;
  /** Start a deployment. Must return quickly — long work is tracked through getDeploymentProgress. */
  deploy(input: DeployInput): Promise<DeploymentProgress>;
  getDeploymentProgress(organizationId: string, deploymentId: string): Promise<DeploymentProgress | null>;
  cancelDeployment(organizationId: string, deploymentId: string): Promise<void>;
  restart(organizationId: string, applicationId: string): Promise<void>;
  stop(organizationId: string, applicationId: string): Promise<void>;
  start(organizationId: string, applicationId: string): Promise<void>;
  rollback(organizationId: string, applicationId: string, revision: ApplicationRevision): Promise<void>;
  scale(organizationId: string, applicationId: string, instances: number): Promise<void>;
  getEnvironment(organizationId: string, applicationId: string): Promise<EnvironmentVariable[]>;
  setEnvironment(organizationId: string, applicationId: string, vars: EnvironmentVariable[]): Promise<void>;
  getHealth(organizationId: string, applicationId: string): Promise<ApplicationHealth>;
}

export interface ApplicationHealth {
  status: Application["status"];
  cpuPercent: number;
  memoryMb: number;
  requestsPerMinute: number;
  requestsLastHour: number;
  latencyMs: number;
  errorRatePercent: number;
  instances: number;
  uptimeSeconds: number;
  lastCheckAt: string;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}
