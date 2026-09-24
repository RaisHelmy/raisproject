import { describe, expect, test } from "bun:test";
import { PermissionService } from "../src/auth/permissions";
import type { AuthContext } from "@runforge/shared";

function ctx(role: AuthContext["role"], overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    actorType: "user",
    actorId: "usr_1",
    organizationId: "org_1",
    role,
    maxLevel: "DANGEROUS",
    correlationId: "corr_1",
    demo: true,
    ...overrides,
  };
}

describe("PermissionService", () => {
  const permissions = new PermissionService();

  test("viewer can read but not write", () => {
    const viewer = ctx("viewer");
    expect(permissions.can(viewer, "application:read")).toBe(true);
    expect(permissions.can(viewer, "application:restart")).toBe(false);
  });

  test("developer can write but not perform dangerous actions", () => {
    const dev = ctx("developer");
    expect(permissions.can(dev, "application:restart")).toBe(true);
    expect(permissions.can(dev, "application:rollback")).toBe(false);
  });

  test("owner can perform dangerous actions", () => {
    const owner = ctx("owner");
    expect(permissions.can(owner, "application:rollback")).toBe(true);
    expect(permissions.can(owner, "database:delete")).toBe(true);
  });

  test("a token's maxLevel caps the role ceiling", () => {
    // An owner-role AI token that was only issued READ access cannot exceed READ,
    // even though the owner role itself would allow DANGEROUS actions.
    const cappedOwner = ctx("owner", { maxLevel: "READ" });
    expect(permissions.can(cappedOwner, "application:restart")).toBe(false);
    expect(permissions.can(cappedOwner, "application:read")).toBe(true);
  });

  test("require() throws FORBIDDEN when the level is insufficient", () => {
    const viewer = ctx("viewer");
    expect(() => permissions.require(viewer, "application:restart")).toThrow(/FORBIDDEN|WRITE/);
  });

  test("requireTenant() throws NOT_FOUND (not FORBIDDEN) for cross-tenant resources", () => {
    const owner = ctx("owner", { organizationId: "org_a" });
    expect(() =>
      permissions.requireTenant(owner, { organizationId: "org_b" }, "application", "app_1"),
    ).toThrow(/NOT_FOUND|not found/);
  });

  test("requireTenant() passes for same-tenant resources", () => {
    const owner = ctx("owner", { organizationId: "org_a" });
    expect(() =>
      permissions.requireTenant(owner, { organizationId: "org_a" }, "application", "app_1"),
    ).not.toThrow();
  });
});
