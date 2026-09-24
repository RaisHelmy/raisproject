import { describe, expect, test } from "bun:test";
import { can, requirePermission, widestScope, AuthzError, type AuthContext } from "../../src/core/authz";
import { validateRoleDef } from "../../src/core/authz/permissions";
import { canAgentViewTicket, canContactViewTicket } from "../../src/core/authz/ticket-visibility";

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    tenantId: "t1",
    subjectType: "agent",
    subjectId: "a1",
    permissions: new Set(["ticket.read"]),
    ticketScope: "all",
    ...overrides,
  };
}

describe("can / requirePermission", () => {
  test("deny by default when the permission is missing", () => {
    expect(can(ctx(), "ticket.delete")).toBe(false);
    expect(() => requirePermission(ctx(), "ticket.delete")).toThrow(AuthzError);
  });

  test("allows when the permission is present", () => {
    expect(can(ctx(), "ticket.read")).toBe(true);
    expect(() => requirePermission(ctx(), "ticket.read")).not.toThrow();
  });
});

describe("widestScope", () => {
  test("none for no roles", () => {
    expect(widestScope([])).toBe("none");
  });
  test("picks the broadest scope across roles", () => {
    expect(widestScope(["own", "team", "assigned"])).toBe("team");
    expect(widestScope(["none", "all"])).toBe("all");
  });
});

describe("canAgentViewTicket", () => {
  test("scope all sees everything", () => {
    expect(canAgentViewTicket({ scope: "all", agentId: "a1", assigneeAgentId: null, ticketAccountId: "acc1", visibleAccountIds: [] })).toBe(true);
  });
  test("scope assigned only sees own assignments", () => {
    expect(canAgentViewTicket({ scope: "assigned", agentId: "a1", assigneeAgentId: "a1", ticketAccountId: "acc1", visibleAccountIds: [] })).toBe(true);
    expect(canAgentViewTicket({ scope: "assigned", agentId: "a1", assigneeAgentId: "a2", ticketAccountId: "acc1", visibleAccountIds: [] })).toBe(false);
  });
  test("scope team checks the visible account list", () => {
    expect(canAgentViewTicket({ scope: "team", agentId: "a1", assigneeAgentId: null, ticketAccountId: "acc1", visibleAccountIds: ["acc1"] })).toBe(true);
    expect(canAgentViewTicket({ scope: "team", agentId: "a1", assigneeAgentId: null, ticketAccountId: "acc2", visibleAccountIds: ["acc1"] })).toBe(false);
  });
  test("scope none always denies", () => {
    expect(canAgentViewTicket({ scope: "none", agentId: "a1", assigneeAgentId: "a1", ticketAccountId: "acc1", visibleAccountIds: ["acc1"] })).toBe(false);
  });
});

describe("validateRoleDef", () => {
  test("passes for a well-formed role", () => {
    expect(validateRoleDef("Support", "all", ["ticket.read"])).toEqual([]);
  });
  test("flags an empty name", () => {
    expect(validateRoleDef("  ", "all", [])).toContain("name is required");
  });
  test("flags an invalid ticket scope", () => {
    expect(validateRoleDef("Support", "everything", [])).toEqual(["ticketScope must be one of: all, team, assigned, own, none"]);
  });
  test("flags unknown permission strings", () => {
    expect(validateRoleDef("Support", "all", ["ticket.read", "ticket.nuke"])).toEqual(["unknown permissions: ticket.nuke"]);
  });
});

describe("canContactViewTicket", () => {
  test("denies a different account", () => {
    expect(canContactViewTicket({ contactAccountId: "acc1", contactTeamId: null, accountScopedByTeam: false, ticketAccountId: "acc2", ticketTeamId: null })).toBe(false);
  });
  test("allows same account when not team-scoped, regardless of team", () => {
    expect(canContactViewTicket({ contactAccountId: "acc1", contactTeamId: "teamA", accountScopedByTeam: false, ticketAccountId: "acc1", ticketTeamId: "teamB" })).toBe(true);
  });
  test("denies a different team when the account is team-scoped", () => {
    expect(canContactViewTicket({ contactAccountId: "acc1", contactTeamId: "teamA", accountScopedByTeam: true, ticketAccountId: "acc1", ticketTeamId: "teamB" })).toBe(false);
  });
  test("allows the same team when team-scoped", () => {
    expect(canContactViewTicket({ contactAccountId: "acc1", contactTeamId: "teamA", accountScopedByTeam: true, ticketAccountId: "acc1", ticketTeamId: "teamA" })).toBe(true);
  });
});
