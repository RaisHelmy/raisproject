import type { AuthContext, McpToolResult } from "@runforge/shared";
import { newId } from "@runforge/shared";
import { DomainError } from "../errors";
import { getToolDefinition } from "./tools";
import { ROLE_MAX_LEVEL, levelAtLeast, minLevel } from "../auth/permissions";
import type { ProjectService } from "../services/project-service";
import type { ApplicationService } from "../services/application-service";
import type { DeploymentService } from "../services/deployment-service";
import type { ServerService } from "../services/server-service";
import type { ContainerService } from "../services/container-service";
import type { DatabaseService } from "../services/database-service";
import type { DomainService } from "../services/domain-service";
import type { EventService } from "../services/event-service";
import type { IncidentService } from "../services/incident-service";
import type { MonitoringService } from "../services/monitoring-service";

export interface McpServiceDeps {
  projects: ProjectService;
  applications: ApplicationService;
  deployments: DeploymentService;
  servers: ServerService;
  containers: ContainerService;
  databases: DatabaseService;
  domains: DomainService;
  events: EventService;
  incidents: IncidentService;
  monitoring: MonitoringService;
}

const text = (value: unknown): McpToolResult => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const errorResult = (message: string): McpToolResult => ({ content: [{ type: "text", text: message }], isError: true });

/**
 * McpService is the single entry point MCP transports call. Every tool call
 * passes: Authentication (resolved AuthContext, upstream) → Authorization
 * (each domain service call enforces permissions) → Domain Service →
 * Provider → Audit Event (domain services record events themselves).
 * MCP never bypasses RunForge permissions (spec §44).
 */
export class McpService {
  constructor(private readonly deps: McpServiceDeps) {}

  async listTools() {
    const { MCP_TOOLS } = await import("./tools");
    return MCP_TOOLS;
  }

  async callTool(ctx: AuthContext, name: string, args: Record<string, unknown> = {}, confirmationToken?: string): Promise<McpToolResult> {
    const def = getToolDefinition(name);
    if (!def) return errorResult(`Unknown tool: ${name}`);

    try {
      // Every mutating tool needs an explicit confirmation, not just the
      // DANGEROUS ones. `deploy_application` is declared WRITE yet its own
      // description promises "Production deploys require confirmation" — with
      // a DANGEROUS-only gate that promise was never kept, so an AI client
      // could deploy or restart a production application unprompted.
      //
      // Authorization is checked first: a caller who may not perform the
      // action at all must get FORBIDDEN from the domain service, never a
      // confirmation prompt that leaks that the action would otherwise run.
      const mutating = def.level === "DANGEROUS" || def.level === "WRITE";
      const permitted = levelAtLeast(minLevel(ROLE_MAX_LEVEL[ctx.role], ctx.maxLevel), def.level);
      if (mutating && permitted && !confirmationToken) {
        return this.requestConfirmation(name, args, def.level);
      }
      return await this.dispatch(ctx, name, args);
    } catch (err) {
      if (err instanceof DomainError) return errorResult(`${err.code}: ${err.message}`);
      return errorResult(err instanceof Error ? err.message : "Unknown error");
    }
  }

  private requestConfirmation(
    name: string,
    args: Record<string, unknown>,
    level: "WRITE" | "DANGEROUS" = "DANGEROUS",
  ): McpToolResult {
    const resource = String(args.applicationId ?? args.databaseId ?? args.serverId ?? "resource");
    return {
      content: [{ type: "text", text: `${name} is a ${level} action and requires confirmation before it will execute.` }],
      requiresConfirmation: {
        action: name,
        resource,
        risk: "HIGH",
        confirmationToken: newId("confirm"),
      },
    };
  }

  private async dispatch(ctx: AuthContext, name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const { projects, applications, deployments, servers, containers, databases, domains, events, incidents, monitoring } = this.deps;
    switch (name) {
      case "list_projects":
        return text(await projects.list(ctx));
      case "get_project":
        return text(await projects.get(ctx, String(args.projectId)));
      case "list_applications":
        return text(await applications.list(ctx, { projectId: args.projectId ? String(args.projectId) : undefined }));
      case "get_application":
        return text(await applications.get(ctx, String(args.applicationId)));
      case "get_application_health":
        return text(await applications.getHealth(ctx, String(args.applicationId)));
      case "get_application_logs":
        return text(await monitoring.queryLogs(ctx, { applicationId: String(args.applicationId), limit: (args.limit as number) ?? 100 }));
      case "list_deployments":
        return text(await deployments.list(ctx, { applicationId: args.applicationId ? String(args.applicationId) : undefined }));
      case "get_deployment":
        return text(await deployments.get(ctx, String(args.deploymentId)));
      case "deploy_application":
        return text(await deployments.deploy(ctx, String(args.applicationId), { commitMessage: args.commitMessage as string, trigger: "mcp", triggeredBy: "MCP client" }));
      case "restart_application":
        return text(await applications.restart(ctx, String(args.applicationId)));
      case "rollback_application":
        return text(await applications.rollback(ctx, String(args.applicationId), String(args.revisionId)));
      case "list_servers":
        return text(await servers.list(ctx));
      case "get_server":
        return text(await servers.get(ctx, String(args.serverId)));
      case "get_server_health":
        return text(await servers.getMetrics(ctx, String(args.serverId)));
      case "list_containers":
        return text(await containers.list(ctx, args.serverId ? String(args.serverId) : undefined));
      case "restart_container":
        return text(await containers.restart(ctx, String(args.containerId)));
      case "list_databases":
        return text(await databases.list(ctx));
      case "get_database_health":
        return text(await databases.getHealth(ctx, String(args.databaseId)));
      case "list_domains":
        return text(await domains.list(ctx));
      case "get_events":
        return text(await events.list(ctx, { limit: (args.limit as number) ?? 50 }));
      case "get_incidents":
        return text(await incidents.list(ctx));
      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  }
}
