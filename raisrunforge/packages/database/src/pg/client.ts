import postgres from "postgres";

/**
 * Creates a postgres.js client bound to a Hyperdrive connection string.
 * `max: 5` keeps the pool small — Workers isolates are short-lived and
 * Hyperdrive already pools connections to Postgres on the other side.
 */
export function createPgClient(connectionString: string) {
  return postgres(connectionString, {
    max: 5,
    connection: { search_path: "raisrunforge" },
  });
}
