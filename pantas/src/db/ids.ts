import { v7 as uuidv7 } from "uuid";

/**
 * Postgres migration note: IDs are generated here in app code (UUID v7),
 * never via SQLite AUTOINCREMENT, so the same insert path works unchanged
 * against Postgres.
 */
export function newId(): string {
  return uuidv7();
}

export function nowIso(): string {
  return new Date().toISOString();
}
