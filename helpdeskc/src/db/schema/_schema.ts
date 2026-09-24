import { pgSchema } from "drizzle-orm/pg-core";

/**
 * Hyperdrive pools connections at the transaction/statement level and does
 * not preserve session state (a `SET search_path`, or the `search_path`
 * connection option `tenantDb()`/`platformDb()` used to rely on) across
 * separate statements — every unqualified `pgTable()` reference otherwise
 * resolves against the default schema and fails with
 * "relation ... does not exist". Every schema file imports `pgTable` from
 * here instead of `drizzle-orm/pg-core` directly, so every table is
 * schema-qualified in the generated SQL with no per-query changes needed.
 */
export const pgTable = pgSchema("helpdeskc").table;
