import type { DataStore } from "../repository/store";
import type { AIProvider } from "../ai/provider";
import { DemoPlanner } from "../ai/demoPlanner";
import { ApprovalService } from "./approvalService";
import { PolicyService } from "./policyService";
import { TelemetryService } from "./telemetryService";
import { TaskService } from "./taskService";
import { ChangeService } from "./changeService";
import { PlatformService } from "./platformService";
import { DashboardService } from "./dashboardService";
import { CommandService } from "./commandService";
import { DemoLab } from "./demoLab";

export interface SuperMcp {
  store: DataStore; ai: AIProvider;
  approvals: ApprovalService; policies: PolicyService; telemetry: TelemetryService; tasks: TaskService; changes: ChangeService; platform: PlatformService; dashboard: DashboardService; command: CommandService; demoLab: DemoLab;
}

export function createSuperMcp(store: DataStore, ai: AIProvider = new DemoPlanner()): SuperMcp {
  const approvals = new ApprovalService(store);
  const policies = new PolicyService(store);
  const telemetry = new TelemetryService(store);
  const tasks = new TaskService(store, approvals, policies, telemetry);
  const changes = new ChangeService(store, tasks, telemetry, ai);
  const platform = new PlatformService(store);
  const dashboard = new DashboardService(store);
  const command = new CommandService(store, ai, changes, tasks, telemetry);
  const demoLab = new DemoLab(store, tasks, approvals, changes, telemetry);
  return { store, ai, approvals, policies, telemetry, tasks, changes, platform, dashboard, command, demoLab };
}

export { resolveActor, makeContext } from "./context";
export type { ChangeDetail, CreateChangeInput } from "./changeService";
export type { Dashboard } from "./dashboardService";
export type { CommandResult } from "./commandService";
export type { ApprovalDetail } from "./approvalService";
export type { TelemetrySummary } from "./telemetryService";
export type { CreateTaskInput, ExecutionHooks } from "./taskService";
export type { DemoScenarioStep } from "./demoLab";
