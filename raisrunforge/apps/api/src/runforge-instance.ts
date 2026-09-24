import { RunForge } from "@runforge/domain";

/**
 * One RunForge instance per Worker isolate. In demo mode the DemoWorld lives
 * in memory for the isolate's lifetime — enough for local dev and previews.
 * Production mode would construct RunForge with a Postgres-backed store
 * instead (see createPgDataStore + createPgClient in @runforge/database,
 * fed by the HYPERDRIVE binding's connectionString) and pass env bindings in.
 * TODO: wire this up once a real (non-demo) mode is implemented — neither the
 * old D1 store nor this Postgres store is currently constructed anywhere at
 * runtime, so there is no existing call site to migrate.
 */
let instance: RunForge | undefined;

export function getRunForge(): RunForge {
  if (!instance) instance = new RunForge({ mode: "demo" });
  return instance;
}

/** Test/dev helper to force a fresh demo world. */
export function resetRunForge(): RunForge {
  instance = new RunForge({ mode: "demo" });
  return instance;
}
