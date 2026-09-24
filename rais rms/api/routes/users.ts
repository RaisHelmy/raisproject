import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { assignRoleSchema, inviteUserSchema } from "../../shared/schemas";
import { assignRole, getUserByEmail, createUser, listUsersWithRoles, revokeRole, setUserStatus } from "../db/users";
import { getOutlet } from "../db/outlets";
import { hashPassword } from "../lib/password";
import { generateToken } from "../lib/ids";
import { badRequest, forbidden, notFound } from "../lib/errors";
import type { InviteUserInput } from "../../shared/schemas";

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", requireRole(ROLE_GROUPS.ADMIN));

userRoutes.get("/", async (c) => {
  const users = await listUsersWithRoles(c.env.DB, c.get("tenantId"));
  return c.json({ ok: true, data: users.map(({ ...u }) => u) });
});

userRoutes.post("/invite", zValidator("json", inviteUserSchema), async (c) => {
  const tenantId = c.get("tenantId");
  const input = getValidated<InviteUserInput>(c, "json");

  const outlet = await getOutlet(c.env.DB, tenantId, input.outletId);
  if (!outlet) throw notFound("Outlet not found");

  const existing = await getUserByEmail(c.env.DB, tenantId, input.email);
  let userId: string;
  let tempPassword: string | undefined;

  if (existing) {
    userId = existing.id;
  } else {
    tempPassword = generateToken(6);
    const passwordHash = await hashPassword(tempPassword);
    const user = await createUser(c.env.DB, tenantId, {
      email: input.email,
      passwordHash,
      name: input.name,
    });
    userId = user.id;
  }

  await assignRole(c.env.DB, tenantId, { userId, outletId: input.outletId, role: input.role });

  return c.json(
    {
      ok: true,
      data: {
        userId,
        email: input.email.toLowerCase(),
        role: input.role,
        outletId: input.outletId,
        // Only present for brand-new accounts; share this with the invitee out-of-band.
        // Once a transactional email provider is configured this is sent automatically instead.
        tempPassword,
      },
    },
    201,
  );
});

userRoutes.patch("/:userId/roles", zValidator("json", assignRoleSchema), async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.req.param("userId");
  const input = getValidated<z.infer<typeof assignRoleSchema>>(c, "json");

  const outlet = await getOutlet(c.env.DB, tenantId, input.outletId);
  if (!outlet) throw notFound("Outlet not found");

  await assignRole(c.env.DB, tenantId, { userId, outletId: input.outletId, role: input.role });
  return c.json({ ok: true, data: { updated: true } });
});

userRoutes.delete("/:userId/roles/:outletId", async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.req.param("userId");
  const outletId = c.req.param("outletId");
  const auth = c.get("auth");

  if (userId === auth.userId) throw forbidden("You cannot remove your own access");

  await revokeRole(c.env.DB, tenantId, { userId, outletId });
  return c.json({ ok: true, data: { removed: true } });
});

const statusSchema = z.object({ status: z.enum(["active", "disabled"]) });

userRoutes.patch("/:userId/status", zValidator("json", statusSchema), async (c) => {
  const tenantId = c.get("tenantId");
  const userId = c.req.param("userId");
  const auth = c.get("auth");
  if (userId === auth.userId) throw badRequest("You cannot disable your own account");

  const input = getValidated<z.infer<typeof statusSchema>>(c, "json");
  const changed = await setUserStatus(c.env.DB, tenantId, userId, input.status);
  if (!changed) throw notFound();
  return c.json({ ok: true, data: { updated: true } });
});
