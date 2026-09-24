import { describe, expect, test } from "bun:test";
import { RunForge } from "../src/runforge";
import type { AuthContext } from "@runforge/shared";

function ctx(rf: RunForge, role: AuthContext["role"]): AuthContext {
  return {
    actorType: role === "ai_agent" ? "ai" : "user",
    actorId: "actor_1",
    organizationId: rf.world!.organizations[0].id,
    role,
    maxLevel: "DANGEROUS",
    correlationId: "corr_mcp",
    demo: true,
  };
}

describe("McpService permission checking", () => {
  test("a READ tool succeeds for a viewer", async () => {
    const rf = new RunForge({ mode: "demo" });
    const result = await rf.mcp.callTool(ctx(rf, "viewer"), "list_servers", {});
    expect(result.isError).toBeFalsy();
  });

  test("a WRITE tool is rejected for a viewer (permission enforced inside the domain service)", async () => {
    const rf = new RunForge({ mode: "demo" });
    const c = ctx(rf, "viewer");
    const apps = await rf.applications.list({ ...c, role: "owner" });
    const result = await rf.mcp.callTool(c, "restart_application", { applicationId: apps[0].id });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/FORBIDDEN/);
  });

  test("a DANGEROUS tool requires confirmation before it executes", async () => {
    const rf = new RunForge({ mode: "demo" });
    const c = ctx(rf, "owner");
    const apps = await rf.applications.list(c);
    const revisions = await rf.applications.listRevisions(c, apps[0].id);
    const result = await rf.mcp.callTool(c, "rollback_application", { applicationId: apps[0].id, revisionId: revisions[revisions.length - 1].id });
    expect(result.requiresConfirmation).toBeTruthy();
    expect(result.requiresConfirmation?.risk).toBe("HIGH");
  });

  test("an unknown tool name returns an error result, not a thrown exception", async () => {
    const rf = new RunForge({ mode: "demo" });
    const result = await rf.mcp.callTool(ctx(rf, "owner"), "delete_everything", {});
    expect(result.isError).toBe(true);
  });
});
