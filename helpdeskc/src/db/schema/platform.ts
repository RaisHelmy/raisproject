import { text, integer } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";

// Platform-level tables. No tenant_id by design (CLAUDE.md §5.1 exceptions).

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  priceSen: integer("price_sen").notNull(),
  currency: text("currency").notNull().default("MYR"),
  createdAt: text("created_at").notNull(),
});

export const platformAdmins = pgTable("platform_admins", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  // Nullable: platform-level actions (e.g. a platform admin acting outside
  // any tenant) have no tenant_id. Tenant-scoped actions always set it, but
  // this table is exempt from the NOT NULL rule in CLAUDE.md §5.1.
  tenantId: text("tenant_id"),
  actorType: text("actor_type", { enum: ["platform_admin", "agent", "contact", "system"] }).notNull(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: text("metadata"), // JSON, parsed in app layer
  createdAt: text("created_at").notNull(),
});

export const platformConfig = pgTable("platform_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON, parsed in app layer
  updatedAt: text("updated_at").notNull(),
});
