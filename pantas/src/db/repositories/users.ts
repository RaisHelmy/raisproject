import { eq, sql } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import { userRoles, users } from "../schema";
import { withAudit } from "./withAudit";

export type Role = "purchaser" | "runner" | "vendor" | "admin";

export interface CreateUserInput {
  realName: string;
  phone: string;
  email?: string;
  passwordHash: string;
  handle: string;
  anonymousMode?: boolean;
}

export async function createUser(db: Db, input: CreateUserInput) {
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    realName: input.realName,
    phone: input.phone,
    email: input.email ?? null,
    passwordHash: input.passwordHash,
    handle: input.handle,
    anonymousMode: input.anonymousMode ?? false,
    autoRejectAnonymousCod: true,
    verificationTier: "unverified" as const,
    status: "active" as const,
  };
  return withAudit(
    db,
    { action: "user.register", entityType: "user", entityId: row.id },
    async () => {
      await db.insert(users).values(row);
      // Never let a password hash reach the audit log.
      const { passwordHash: _redacted, ...safe } = row;
      return safe;
    },
  );
}

export async function getUserById(db: Db, userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByPhone(db: Db, phone: string) {
  const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return rows[0] ?? null;
}

/** Case-insensitive email lookup (email is optional at registration, so may be null). */
export async function getUserByEmail(db: Db, email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

/** Admin-only: full user list including real identity. CLAUDE.md "Admin panel". */
export async function adminListAllUsers(db: Db) {
  return db.select().from(users);
}

export async function setVerificationTier(
  db: Db,
  userId: string,
  tier: "unverified" | "verified",
) {
  return withAudit(
    db,
    { action: "user.verification_tier_set", entityType: "user", entityId: userId },
    async () => {
      await db.update(users).set({ verificationTier: tier, updatedAt: nowIso() }).where(eq(users.id, userId));
      return { userId, tier };
    },
  );
}

export async function setUserStatus(db: Db, userId: string, status: "active" | "suspended") {
  return withAudit(
    db,
    { action: "user.status_set", entityType: "user", entityId: userId },
    async () => {
      await db.update(users).set({ status, updatedAt: nowIso() }).where(eq(users.id, userId));
      return { userId, status };
    },
  );
}

/**
 * Anonymous accounts are permanently unverified (CLAUDE.md: "can never
 * obtain the Verified badge while anonymous"). This is enforced here, at
 * the write boundary, not just left to callers to remember. Anonymity
 * toggles are explicitly called out in CLAUDE.md as must-log events.
 */
export async function setAnonymousMode(
  db: Db,
  userId: string,
  anonymousMode: boolean,
) {
  return withAudit(
    db,
    { action: "user.anonymity_toggle", entityType: "user", entityId: userId },
    async () => {
      const user = await getUserById(db, userId);
      if (!user) throw new Error(`user ${userId} not found`);
      if (anonymousMode && user.verificationTier === "verified") {
        throw new Error(
          "a verified user cannot enable anonymous mode without first being re-classified unverified by admin",
        );
      }
      await db
        .update(users)
        .set({ anonymousMode, updatedAt: nowIso() })
        .where(eq(users.id, userId));
      return { userId, anonymousMode };
    },
  );
}

/**
 * Runner/vendor opt-in toggle for anonymous COD jobs (CLAUDE.md
 * "Cash-on-delivery risk flow") — ON (auto-reject) by default. Turning it
 * off means the party is opting in to a real, unreimbursed non-payment
 * risk; the consent acknowledgement is logged the same way as any other
 * consent event (see routes/auth.ts).
 */
export async function setAutoRejectAnonymousCod(
  db: Db,
  userId: string,
  autoRejectAnonymousCod: boolean,
) {
  return withAudit(
    db,
    { action: "user.auto_reject_anonymous_cod_toggle", entityType: "user", entityId: userId },
    async () => {
      await db
        .update(users)
        .set({ autoRejectAnonymousCod, updatedAt: nowIso() })
        .where(eq(users.id, userId));
      return { userId, autoRejectAnonymousCod };
    },
  );
}

export async function addUserRole(db: Db, userId: string, role: Role) {
  const row = {
    id: newId(),
    userId,
    role,
    createdAt: nowIso(),
  };
  return withAudit(
    db,
    { action: "user.role_added", entityType: "user_role", entityId: row.id },
    async () => {
      await db.insert(userRoles).values(row);
      return row;
    },
  );
}

export async function listRolesForUser(db: Db, userId: string) {
  return db.select().from(userRoles).where(eq(userRoles.userId, userId));
}
