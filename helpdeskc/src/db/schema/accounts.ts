import { text, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { tenants } from "./tenants";

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    // Whether Contacts at this Account are further narrowed to their Team
    // when computing ticket visibility (CLAUDE.md §8).
    scopeByTeam: boolean("scope_by_team").notNull().default(false),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("accounts_tenant_id_idx").on(t.tenantId)],
);

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    accountId: text("account_id").notNull().references(() => accounts.id),
    name: text("name").notNull(),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("teams_tenant_id_idx").on(t.tenantId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    accountId: text("account_id").notNull().references(() => accounts.id),
    teamId: text("team_id").references(() => teams.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"), // null until the Contact sets one (CLAUDE.md §7)
    emailVerifiedAt: text("email_verified_at"),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    index("contacts_tenant_id_idx").on(t.tenantId),
    // Identity is per-tenant, not global (CLAUDE.md §7).
    uniqueIndex("contacts_tenant_email_idx").on(t.tenantId, t.email),
  ],
);

// Email change is an access-control change, not a profile edit (CLAUDE.md §7).
// The old email stays active/usable until the new one is confirmed.
export const contactEmailChanges = pgTable(
  "contact_email_changes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    contactId: text("contact_id").notNull().references(() => contacts.id),
    newEmail: text("new_email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    confirmedAt: text("confirmed_at"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("contact_email_changes_tenant_id_idx").on(t.tenantId)],
);
