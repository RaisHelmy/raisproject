import { text, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { tenants } from "./tenants";
import { accounts, teams } from "./accounts";

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // Null until the invited agent accepts and sets a password (CLAUDE.md
    // §7: agents are invite-only). An agent with a null hash cannot log in.
    passwordHash: text("password_hash"),
    totpSecret: text("totp_secret"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("agents_tenant_id_idx").on(t.tenantId),
    uniqueIndex("agents_tenant_email_idx").on(t.tenantId, t.email),
  ],
);

// Tenant-owned roles. Permission set + ticket scope live as JSON — checked
// only in core/authz (app layer), never queried into from SQL (CLAUDE.md §4).
export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    ticketScope: text("ticket_scope", {
      enum: ["all", "team", "assigned", "own", "none"],
    }).notNull(),
    permissions: text("permissions").notNull(), // JSON string[] of permission keys
    isPreset: boolean("is_preset").notNull().default(false),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("roles_tenant_id_idx").on(t.tenantId)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    agentId: text("agent_id").notNull().references(() => agents.id),
    roleId: text("role_id").notNull().references(() => roles.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("memberships_tenant_id_idx").on(t.tenantId),
    uniqueIndex("memberships_agent_role_idx").on(t.agentId, t.roleId),
  ],
);

// Invite-only agent onboarding (CLAUDE.md §7): a tenant admin creates the
// agent row and an invite token; the agent uses it once to set a password.
export const agentInvites = pgTable(
  "agent_invites",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    agentId: text("agent_id").notNull().references(() => agents.id),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
  },
  (t) => [index("agent_invites_tenant_id_idx").on(t.tenantId)],
);

// Which Accounts/Teams an agent is assigned to, for ticket_scope: 'team'.
export const agentTeamAssignments = pgTable(
  "agent_team_assignments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    agentId: text("agent_id").notNull().references(() => agents.id),
    accountId: text("account_id").notNull().references(() => accounts.id),
    teamId: text("team_id").references(() => teams.id),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("agent_team_assignments_tenant_id_idx").on(t.tenantId)],
);
