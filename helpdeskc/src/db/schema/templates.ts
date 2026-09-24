import { text, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { tenants } from "./tenants";
import { accounts, teams } from "./accounts";

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    accountId: text("account_id").references(() => accounts.id),
    teamId: text("team_id").references(() => teams.id),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (t) => [index("templates_tenant_id_idx").on(t.tenantId)],
);

// Templates are versioned; a ticket snapshots the version it was raised
// with, so editing a template never changes existing tickets (CLAUDE.md §9).
export const templateVersions = pgTable(
  "template_versions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    templateId: text("template_id").notNull().references(() => templates.id),
    version: integer("version").notNull(),
    fields: text("fields").notNull(), // JSON TemplateField[]
    defaults: text("defaults").notNull(), // JSON: category, priority, assigneeId/queue, slaPolicyId
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("template_versions_tenant_id_idx").on(t.tenantId),
    uniqueIndex("template_versions_template_version_idx").on(t.templateId, t.version),
  ],
);
