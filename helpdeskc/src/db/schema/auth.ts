import { text, index } from "drizzle-orm/pg-core";
import { pgTable } from "./_schema";
import { tenants } from "./tenants";

// Sessions are scoped to one hostname and one subject (CLAUDE.md §6, §7).
// The cookie carries an opaque token; only its hash is stored.
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    subjectType: text("subject_type", { enum: ["agent", "contact"] }).notNull(),
    subjectId: text("subject_id").notNull(),
    hostname: text("hostname").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("sessions_tenant_id_idx").on(t.tenantId)],
);

// Magic-link tokens are bound to one tenant and one hostname (CLAUDE.md §7).
export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id),
    contactId: text("contact_id"), // null until the Contact record is resolved/created on consume
    email: text("email").notNull(),
    hostname: text("hostname").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    invalidatedAt: text("invalidated_at"), // set when a newer link for the same email is sent
  },
  (t) => [index("magic_link_tokens_tenant_id_idx").on(t.tenantId)],
);
