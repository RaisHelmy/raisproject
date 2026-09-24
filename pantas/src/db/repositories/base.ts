import { and, eq, isNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Every repository query that touches a group-scoped table must go through
 * this helper. `groupId: null` means "platform-wide" (no group) — it is an
 * explicit choice, not an accidental omission of the filter. A caller that
 * wants to bypass scoping entirely (admin cross-group views) must call a
 * function name prefixed `admin*`, so the exception is visible in a diff
 * and greppable in review. See CLAUDE.md: "A missing group filter is a
 * data-leak bug, not a style issue."
 */
export function groupScope(
  groupIdColumn: PgColumn,
  groupId: string | null,
): SQL {
  return groupId === null ? isNull(groupIdColumn) : eq(groupIdColumn, groupId);
}

export function withGroupScope(
  groupIdColumn: PgColumn,
  groupId: string | null,
  ...rest: (SQL | undefined)[]
): SQL {
  const clauses = [groupScope(groupIdColumn, groupId), ...rest].filter(
    (c): c is SQL => c !== undefined,
  );
  return and(...clauses) as SQL;
}
