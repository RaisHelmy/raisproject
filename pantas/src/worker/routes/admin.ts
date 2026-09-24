import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireRole } from "../middleware/auth";
import {
  adminListAllUsers,
  getUserById,
  setUserStatus,
  setVerificationTier,
} from "../../db/repositories/users";
import { adminListAllJobs } from "../../db/repositories/jobs";
import { appendAuditLog, listAuditLogForEntity } from "../../db/repositories/auditLog";
import { createPerkRule } from "../../db/repositories/perkRules";
import { createCommissionRule } from "../../db/repositories/commissionRules";
import { generateWeeklyPayouts } from "../../db/services/payoutGenerator";
import { getRequestContext } from "../requestContext";

const admin = new Hono<AppEnv>();
admin.use("*", requireRole("admin"));

/**
 * A password hash must never leave the database, not even to an admin —
 * serializing it turns every admin session (and any log or proxy that sees
 * the response) into an offline cracking target. Strip it at the boundary.
 */
function withoutPasswordHash<T extends { passwordHash?: unknown }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

admin.get("/users", async (c) => {
  const db = await createDb(c.env);
  const users = await adminListAllUsers(db);
  return c.json(users.map(withoutPasswordHash));
});

/**
 * Identity disclosure: requires a reason, and the lookup itself is written
 * to the audit log — CLAUDE.md "Law enforcement" / "Admin panel": "who
 * viewed which real identity and why."
 */
admin.get("/users/:id/identity", async (c) => {
  const session = c.get("session")!;
  const reason = c.req.query("reason");
  if (!reason) return c.json({ error: "reason query param is required" }, 400);

  const db = await createDb(c.env);
  const user = await getUserById(db, c.req.param("id"));
  const ctx = getRequestContext();
  await appendAuditLog(db, {
    actorUserId: session.userId,
    actorRole: session.activeRole,
    groupId: null,
    action: "admin.identity_disclosure",
    entityType: "user",
    entityId: c.req.param("id"),
    afterJson: { reason },
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
    requestId: c.get("requestId"),
    result: user ? "success" : "failure",
    resultReason: user ? undefined : "user not found",
  });

  if (!user) return c.json({ error: "not found" }, 404);
  return c.json(withoutPasswordHash(user));
});

const verificationSchema = z.object({ tier: z.enum(["unverified", "verified"]) });

admin.post("/users/:id/verification", async (c) => {
  const body = verificationSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await setVerificationTier(db, c.req.param("id"), body.tier);
  return c.json({ ok: true });
});

const statusSchema = z.object({ status: z.enum(["active", "suspended"]) });

admin.post("/users/:id/status", async (c) => {
  const body = statusSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await setUserStatus(db, c.req.param("id"), body.status);
  return c.json({ ok: true });
});

admin.get("/jobs", async (c) => {
  const db = await createDb(c.env);
  return c.json(await adminListAllJobs(db));
});

admin.get("/audit-log", async (c) => {
  const entityType = c.req.query("entityType");
  const entityId = c.req.query("entityId");
  if (!entityType || !entityId) {
    return c.json({ error: "entityType and entityId query params are required" }, 400);
  }
  const db = await createDb(c.env);
  return c.json(await listAuditLogForEntity(db, entityType, entityId));
});

const perkRuleSchema = z.object({
  name: z.string().min(1),
  verificationTier: z.enum(["unverified", "verified"]),
  perkType: z.enum(["voucher", "priority_window", "order_value_limit", "cod_eligible"]),
  configJson: z.unknown().optional(),
  groupId: z.string().nullable().optional(),
});

/** Perks (incl. FCFS priority-window eligibility) are data, not hardcoded `if`s — CLAUDE.md. */
admin.post("/perk-rules", async (c) => {
  const body = perkRuleSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const rule = await createPerkRule(db, body);
  return c.json(rule, 201);
});

const commissionRuleSchema = z.object({
  jobType: z.enum(["food_order", "item_order", "fetch", "delivery", "ride", "vehicle_rental"]),
  groupId: z.string().nullable().optional(),
  amountMinor: z.number().int().positive(),
});

admin.post("/commission-rules", async (c) => {
  const body = commissionRuleSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const rule = await createCommissionRule(db, body);
  return c.json(rule, 201);
});

const generatePayoutsSchema = z.object({
  groupId: z.string().nullable(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

admin.post("/payouts/generate", async (c) => {
  const body = generatePayoutsSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const batches = await generateWeeklyPayouts(db, body.groupId, body.periodStart, body.periodEnd);
  return c.json(batches, 201);
});

export default admin;
