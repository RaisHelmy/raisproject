import { describe, expect, test } from "bun:test";
import { RunForge } from "../src/runforge";
import type { AuthContext } from "@runforge/shared";

describe("EventService", () => {
  test("recording an event also writes a corresponding audit log entry", async () => {
    const rf = new RunForge({ mode: "demo" });
    const org = rf.world!.organizations[0].id;
    const ctx: AuthContext = {
      actorType: "user", actorId: "usr_1", organizationId: org, role: "owner",
      maxLevel: "DANGEROUS", correlationId: "corr_evt", demo: true,
    };
    const event = await rf.events.record(ctx, {
      action: "test.action",
      resourceType: "test",
      resourceId: "res_1",
      resourceName: "Test Resource",
      message: "Something happened",
    });

    const fetched = await rf.events.get(ctx, event.id);
    expect(fetched.message).toBe("Something happened");

    const audit = await rf.events.listAudit(ctx);
    expect(audit.some((a) => a.id.endsWith(event.id) || a.correlationId === "corr_evt")).toBe(true);
  });

  test("a denied MCP action never appears in the public event stream", async () => {
    const rf = new RunForge({ mode: "demo" });
    const org = rf.world!.organizations[0].id;
    const viewerCtx: AuthContext = {
      actorType: "user", actorId: "usr_viewer", organizationId: org, role: "viewer",
      maxLevel: "DANGEROUS", correlationId: "corr_denied", demo: true,
    };
    const app = (await rf.applications.list(viewerCtx))[0];
    await expect(rf.applications.restart(viewerCtx, app.id)).rejects.toThrow();

    const events = await rf.events.list(viewerCtx);
    expect(events.find((e) => e.correlationId === "corr_denied")).toBeUndefined();
  });
});
