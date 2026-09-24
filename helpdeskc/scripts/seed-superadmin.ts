#!/usr/bin/env bun
// One-off: seed the shared super-admin credential (see IMPORTANT.md) as the
// Owner agent of its own tenant, using the app's real hashPassword/roles —
// same approach as scripts/seed.ts, kept separate so it never touches the
// two demo tenants that script seeds.
import postgres from "postgres";
import { uuidv7 } from "../src/core/id/uuid7";
import { hashPassword } from "../src/core/auth/password";
import { PRESET_ROLES } from "../src/core/authz/permissions";

type Row = Record<string, string | number | boolean | null>;

function sqlValue(v: string | number | boolean | null): string {
  if (v === null) return "NULL";
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

const existingPlan = await (async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  const client = postgres(databaseUrl, { connection: { search_path: "helpdeskc" } });
  const rows = await client`select id from plans limit 1`;
  await client.end();
  return (rows[0] as { id: string } | undefined)?.id ?? null;
})();

const planId = existingPlan ?? uuidv7();
if (!existingPlan) {
  insert("plans", { id: planId, name: "Standard", price_sen: 500000, currency: "MYR", created_at: now });
}

const ADMIN_EMAIL = "raishelmy97@gmail.com";
const ADMIN_NAME = "Rais Helmy";
const ADMIN_PASSWORD = "P@ssw0rd";
const passwordHash = await hashPassword(ADMIN_PASSWORD);

const tenantId = uuidv7();
insert("tenants", {
  id: tenantId,
  slug: "rais-admin",
  name: "Rais Admin",
  plan_id: planId,
  billing_state: "active",
  primary_color: null,
  logo_r2_key: null,
  created_at: now,
  deleted_at: null,
});
insert("tenant_usage", { tenant_id: tenantId, attachment_bytes_total: 0, ticket_count_total: 0, updated_at: now });

const agentId = uuidv7();
insert("agents", {
  id: agentId,
  tenant_id: tenantId,
  email: ADMIN_EMAIL,
  name: ADMIN_NAME,
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

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

console.log(`Seeded tenant "rais-admin" — Owner agent ${ADMIN_EMAIL} / password: ${ADMIN_PASSWORD}`);
