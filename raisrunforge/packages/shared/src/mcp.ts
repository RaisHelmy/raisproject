import type { PermissionLevel } from "./auth";

/** JSON schema subset used for MCP tool input definitions. */
export interface JsonSchema {
  type: "object";
  properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  level: PermissionLevel;
  inputSchema: JsonSchema;
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  /** Set when a DANGEROUS tool needs explicit confirmation before executing. */
  requiresConfirmation?: {
    action: string;
    resource: string;
    risk: "HIGH" | "CRITICAL";
    confirmationToken: string;
  };
}
