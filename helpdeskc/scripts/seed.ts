#!/usr/bin/env bun
// Bun-only tooling (CLAUDE.md §3.2 — lives in scripts/, not src/). Builds a
// SQL file from the same core helpers app code uses (uuidv7, hashPassword,
// PRESET_ROLES) and applies it directly against Postgres (via `postgres`),
// so the seeded rows stay shaped exactly like rows the app itself would
// write. Migrated off `wrangler d1 execute --local` along with the rest of
// the D1 -> Postgres move (CLAUDE.md §4) — requires DATABASE_URL to point at
// the tunnelled Postgres (see .dev.vars / drizzle.config.postgres.ts).
import postgres from "postgres";
import { uuidv7 } from "../src/core/id/uuid7";
import { hashPassword } from "../src/core/auth/password";
import { PRESET_ROLES } from "../src/core/authz/permissions";

type Row = Record<string, string | number | boolean | null>;

function sqlValue(v: string | number | boolean | null): string {
  if (v === null) return "NULL";
  // Real Postgres booleans now (was SQLite 0/1 under D1).
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  return `'${v.replace(/'/g, "''")}'`;
}

const statements: string[] = [];
function insert(table: string, row: Row) {
  const cols = Object.keys(row);
  statements.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map((c) => sqlValue(row[c]!)).join(", ")});`);
}

const now = new Date().toISOString();

const planId = uuidv7();
insert("plans", { id: planId, name: "Standard", price_sen: 500000, currency: "MYR", created_at: now });

interface TenantSeed {
  slug: string;
  name: string;
  accountName: string;
  teamName: string;
  contactEmail: string;
  contactName: string;
  agentEmail: string;
  agentName: string;
}

const tenantSeeds: TenantSeed[] = [
  {
    slug: "acme",
    name: "Acme Support",
    accountName: "Acme Corp",
    teamName: "Finance",
    contactEmail: "requester@acme-client.test",
    contactName: "Alice Requester",
    agentEmail: "owner@acme.test",
    agentName: "Amy Owner",
  },
  {
    slug: "globex",
    name: "Globex Support",
    accountName: "Globex Inc",
    teamName: "Warehouse",
    contactEmail: "requester@globex-client.test",
    contactName: "Gil Requester",
    agentEmail: "owner@globex.test",
    agentName: "Gita Owner",
  },
];

// Fixed for reproducible local logins. Never used outside local dev.
const SEED_PASSWORD = "password123!";
const passwordHash = await hashPassword(SEED_PASSWORD);

for (const seed of tenantSeeds) {
  const tenantId = uuidv7();
  insert("tenants", {
    id: tenantId,
    slug: seed.slug,
    name: seed.name,
    plan_id: planId,
    billing_state: "active",
    primary_color: null,
    logo_r2_key: null,
    created_at: now,
    deleted_at: null,
  });
  insert("tenant_usage", { tenant_id: tenantId, attachment_bytes_total: 0, ticket_count_total: 0, updated_at: now });

  const accountId = uuidv7();
  insert("accounts", { id: accountId, tenant_id: tenantId, name: seed.accountName, scope_by_team: false, created_at: now, deleted_at: null });

  const teamId = uuidv7();
  insert("teams", { id: teamId, tenant_id: tenantId, account_id: accountId, name: seed.teamName, created_at: now, deleted_at: null });

  const contactId = uuidv7();
  insert("contacts", {
    id: contactId,
    tenant_id: tenantId,
    account_id: accountId,
    team_id: teamId,
    email: seed.contactEmail,
    name: seed.contactName,
    password_hash: passwordHash,
    email_verified_at: now,
    created_at: now,
    deleted_at: null,
  });

  const agentId = uuidv7();
  insert("agents", {
    id: agentId,
    tenant_id: tenantId,
    email: seed.agentEmail,
    name: seed.agentName,
    password_hash: passwordHash,
    totp_secret: null,
    totp_enabled: false,
    created_at: now,
    deleted_at: null,
  });

  let ownerRoleId = "";
  for (const preset of PRESET_ROLES) {
    const roleId = uuidv7();
    if (preset.name === "Owner") ownerRoleId = roleId;
    insert("roles", {
      id: roleId,
      tenant_id: tenantId,
      name: preset.name,
      ticket_scope: preset.ticketScope,
      permissions: JSON.stringify(preset.permissions),
      is_preset: true,
      created_at: now,
      deleted_at: null,
    });
  }
  insert("memberships", { id: uuidv7(), tenant_id: tenantId, agent_id: agentId, role_id: ownerRoleId, created_at: now });

  const slaPolicyId = uuidv7();
  insert("sla_policies", {
    id: slaPolicyId,
    tenant_id: tenantId,
    name: "Standard business hours",
    timezone: "Asia/Kuala_Lumpur",
    business_hours: JSON.stringify({
      mon: [{ start: "09:00", end: "18:00" }],
      tue: [{ start: "09:00", end: "18:00" }],
      wed: [{ start: "09:00", end: "18:00" }],
      thu: [{ start: "09:00", end: "18:00" }],
      fri: [{ start: "09:00", end: "18:00" }],
    }),
    holidays: JSON.stringify([]),
    targets: JSON.stringify({
      low: { firstResponseMinutes: 480, resolutionMinutes: 2880 },
      medium: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
      high: { firstResponseMinutes: 60, resolutionMinutes: 480 },
      urgent: { firstResponseMinutes: 15, resolutionMinutes: 240 },
    }),
    created_at: now,
    deleted_at: null,
  });

  const templateId = uuidv7();
  insert("templates", {
    id: templateId,
    tenant_id: tenantId,
    name: "Bug Report",
    description: "Report a defect in the product",
    is_default: true,
    account_id: null,
    team_id: null,
    created_at: now,
    deleted_at: null,
  });

  const templateVersionId = uuidv7();
  insert("template_versions", {
    id: templateVersionId,
    tenant_id: tenantId,
    template_id: templateId,
    version: 1,
    fields: JSON.stringify([
      { key: "summary", label: "Summary", type: "text", required: true, filterable: false },
      { key: "steps_to_reproduce", label: "Steps to reproduce", type: "textarea", required: true, filterable: false },
      { key: "severity", label: "Severity", type: "select", required: true, options: ["low", "medium", "high"], filterable: true },
    ]),
    defaults: JSON.stringify({ category: "bug", priority: "medium", slaPolicyId }),
    created_at: now,
  });
}

const sqlText = statements.join("\n");
const outPath = new URL("./seed.generated.sql", import.meta.url).pathname;
await Bun.write(outPath, sqlText);

console.log(`Generated ${statements.length} statements -> ${outPath}`);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set — point it at the tunnelled Postgres (see .dev.vars) before seeding.");
  process.exit(1);
}

console.log("Applying to Postgres...");
// Shared `raishelmy` database — this app's tables live in schema
// `helpdeskc`, so pin search_path explicitly rather than relying on
// DATABASE_URL carrying `?options=-c search_path=helpdeskc`.
const client = postgres(databaseUrl, { connection: { search_path: "helpdeskc" } });
try {
  for (const statement of statements) {
    await client.unsafe(statement);
  }
} catch (err) {
  console.error("Seed failed:", err);
  process.exit(1);
} finally {
  await client.end();
}

console.log("\nSeeded 2 tenants for isolation testing:");
for (const seed of tenantSeeds) {
  console.log(`  ${seed.slug}: agent ${seed.agentEmail} / contact ${seed.contactEmail} — password: ${SEED_PASSWORD}`);
}
