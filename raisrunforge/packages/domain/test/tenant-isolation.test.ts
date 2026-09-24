import { describe, expect, test } from "bun:test";
import { RunForge } from "../src/runforge";
import type { AuthContext } from "@runforge/shared";

function ownerCtx(rf: RunForge, organizationId: string): AuthContext {
  return {
    actorType: "user",
    actorId: "usr_x",
    organizationId,
    role: "owner",
    maxLevel: "DANGEROUS",
    correlationId: "corr_x",
    demo: true,
  };
}

describe("Tenant isolation", () => {
  test("a project created in one organization is invisible to another", async () => {
    const rf = new RunForge({ mode: "demo" });
    const demoOrgCtx = ownerCtx(rf, rf.world!.organizations[0].id);
    const project = await rf.projects.create(demoOrgCtx, { name: "Tenant A Project" });

    const otherOrgCtx: AuthContext = { ...demoOrgCtx, organizationId: "org_completely_different" };
    await expect(rf.projects.get(otherOrgCtx, project.id)).rejects.toThrow(/NOT_FOUND|not found/);
  });

  test("events recorded for one organization do not leak into another organization's event list", async () => {
    const rf = new RunForge({ mode: "demo" });
    const demoOrgId = rf.world!.organizations[0].id;
    const demoCtx = ownerCtx(rf, demoOrgId);
    await rf.projects.create(demoCtx, { name: "Visible Project" });

    const otherOrgId = "org_other_tenant";
    // Seed a second organization so listing doesn't just fail on FK-less memory store.
    await rf.store.organizations.insert({ id: otherOrgId, name: "Other Org", slug: "other-org", plan: "free", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await rf.store.members.insert({ id: "mem_other", organizationId: otherOrgId, userId: "usr_x", role: "owner", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

    const otherCtx = ownerCtx(rf, otherOrgId);
    const events = await rf.events.list(otherCtx);
    expect(events.every((e) => e.organizationId === otherOrgId)).toBe(true);
    expect(events.find((e) => e.message.includes("Visible Project"))).toBeUndefined();
  });
});
