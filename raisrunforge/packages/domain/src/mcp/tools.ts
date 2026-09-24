import type { McpToolDefinition } from "@runforge/shared";

/**
 * MCP tool catalogue (spec §42/§43). Tools are high-level and map 1:1 to
 * domain service methods — MCP never gets its own business logic.
 */
export const MCP_TOOLS: McpToolDefinition[] = [
  { name: "list_projects", description: "List all projects in the organization.", level: "READ", inputSchema: { type: "object" } },
  { name: "get_project", description: "Get a project by id.", level: "READ", inputSchema: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] } },
  { name: "list_applications", description: "List applications, optionally filtered by project.", level: "READ", inputSchema: { type: "object", properties: { projectId: { type: "string" } } } },
  { name: "get_application", description: "Get an application by id.", level: "READ", inputSchema: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] } },
  { name: "get_application_health", description: "Get live health/metrics for an application.", level: "READ", inputSchema: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] } },
  { name: "get_application_logs", description: "Get recent logs for an application.", level: "READ", inputSchema: { type: "object", properties: { applicationId: { type: "string" }, limit: { type: "number" } }, required: ["applicationId"] } },
  { name: "list_deployments", description: "List recent deployments, optionally filtered by application.", level: "READ", inputSchema: { type: "object", properties: { applicationId: { type: "string" } } } },
  { name: "get_deployment", description: "Get a deployment's status and step timeline.", level: "READ", inputSchema: { type: "object", properties: { deploymentId: { type: "string" } }, required: ["deploymentId"] } },
  { name: "deploy_application", description: "Deploy the latest commit of an application. Production deploys require confirmation.", level: "WRITE", inputSchema: { type: "object", properties: { applicationId: { type: "string" }, commitMessage: { type: "string" } }, required: ["applicationId"] } },
  { name: "restart_application", description: "Restart an application in place.", level: "WRITE", inputSchema: { type: "object", properties: { applicationId: { type: "string" } }, required: ["applicationId"] } },
  { name: "rollback_application", description: "Roll back an application to a previous revision. Requires confirmation.", level: "DANGEROUS", inputSchema: { type: "object", properties: { applicationId: { type: "string" }, revisionId: { type: "string" } }, required: ["applicationId", "revisionId"] } },
  { name: "list_servers", description: "List connected servers.", level: "READ", inputSchema: { type: "object" } },
  { name: "get_server", description: "Get a server by id.", level: "READ", inputSchema: { type: "object", properties: { serverId: { type: "string" } }, required: ["serverId"] } },
  { name: "get_server_health", description: "Get live CPU/memory/disk/network metrics for a server.", level: "READ", inputSchema: { type: "object", properties: { serverId: { type: "string" } }, required: ["serverId"] } },
  { name: "list_containers", description: "List containers, optionally filtered by server.", level: "READ", inputSchema: { type: "object", properties: { serverId: { type: "string" } } } },
  { name: "restart_container", description: "Restart a container.", level: "WRITE", inputSchema: { type: "object", properties: { containerId: { type: "string" } }, required: ["containerId"] } },
  { name: "list_databases", description: "List databases.", level: "READ", inputSchema: { type: "object" } },
  { name: "get_database_health", description: "Get connection/query health for a database.", level: "READ", inputSchema: { type: "object", properties: { databaseId: { type: "string" } }, required: ["databaseId"] } },
  { name: "list_domains", description: "List domains and their routing.", level: "READ", inputSchema: { type: "object" } },
  { name: "get_events", description: "Get recent infrastructure events.", level: "READ", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "get_incidents", description: "Get open and recent incidents.", level: "READ", inputSchema: { type: "object" } },
];

export function getToolDefinition(name: string): McpToolDefinition | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}
