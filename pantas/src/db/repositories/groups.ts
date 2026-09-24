import { eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { groupMembers, groups } from "../schema";
import { withAudit } from "./withAudit";

export interface CreateGroupInput {
  name: string;
  ownerUserId: string;
  allowAnonymity?: boolean;
  codPolicy?: "default" | "disabled" | "verified_only";
}

export async function createGroup(db: Db, input: CreateGroupInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    name: input.name,
    ownerUserId: input.ownerUserId,
    allowAnonymity: input.allowAnonymity ?? true,
    commissionOverrideMinor: null,
    codPolicy: input.codPolicy ?? ("default" as const),
    settingsJson: "{}",
    ownGatewayEnabled: false,
  };
  return withAudit(
    db,
    { action: "group.create", entityType: "group", entityId: row.id },
    async () => {
      await db.insert(groups).values(row);
      return row;
    },
  );
}

export async function getGroupById(db: Db, groupId: string) {
  const rows = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  return rows[0] ?? null;
}

export async function addGroupMember(
  db: Db,
  groupId: string,
  userId: string,
  roleInGroup?: string,
) {
  const row = {
    id: newId(),
    groupId,
    userId,
    roleInGroup: roleInGroup ?? null,
    createdAt: nowIso(),
  };
  return withAudit(
    db,
    { action: "group.member_added", entityType: "group_member", entityId: row.id },
    async () => {
      await db.insert(groupMembers).values(row);
      return row;
    },
  );
}

export async function listMembersForGroup(db: Db, groupId: string) {
  return db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
}
