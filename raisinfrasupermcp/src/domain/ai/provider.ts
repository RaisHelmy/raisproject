import type { AIProviderKind, ChangeImpact, ImpactComponent, JiraLink, TaskType } from "../types";

/** Result of AI reasoning about an intent (section 10). The user may edit every field before execution. */
export interface ChangePlan {
  title: string;
  description: string;
  requirements: string[];
  impacts: ChangeImpact[];
  jira: JiraLink[];
  developmentTasks: string[];
  testTasks: string[];
  deploymentRequirements: string[];
  approvalRequirements: string[];
  rollbackPlan: string[];
  suggestedApplicationSlug?: string;
  suggestedVersion?: string;
  targetEnvironmentKind: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
  confidence: number;
}

export type CommandIntent =
  | { kind: "CREATE_CHANGE"; intent: string }
  | { kind: "DEPLOY"; applicationSlug?: string; version?: string; environmentKind: "DEVELOPMENT" | "STAGING" | "PRODUCTION"; targetVm?: string }
  | { kind: "CREATE_PROJECT"; name: string; architecture: string }
  | { kind: "HEALTH_CHECK" }
  | { kind: "DIAGNOSE"; subject: string }
  | { kind: "SHOW"; target: "APPROVALS" | "BLOCKERS" | "CHANGES" | "AGENTS" | "INCIDENTS" | "OPTIMIZATION" | "REPORT" | "DEPLOYMENTS" | "TASKS" }
  | { kind: "UNKNOWN"; text: string };

export interface AIProvider {
  readonly kind: AIProviderKind;
  readonly model: string;
  planChange(intent: string, context: { applications: { slug: string; name: string; runtime: string }[] }): Promise<ChangePlan>;
  interpretCommand(text: string): Promise<CommandIntent>;
  diagnose(input: { error: string; taskType: TaskType; context: string[] }): Promise<{ diagnosis: string; recoveryPlan: string[] }>;
}

export const IMPACT_ORDER: ImpactComponent[] = ["Frontend", "Backend", "Database", "File Storage", "Infrastructure", "External API", "Mobile"];
