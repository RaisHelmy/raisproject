import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVariables } from "../middleware/auth";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { MembershipService } from "../services/membership-service";

export const members = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const guarded = [requireAuth(), requireCsrf()] as const;

members.get("/members", ...guarded, async (c) => {
  const auth = c.get("auth");
  const service = new MembershipService(c.env);
  const list = await service.list(auth);
  return c.json({
    items: list.map((m) => ({ userId: m.user_id, name: m.name, email: m.email, role: m.role, joinedAt: m.created_at })),
    yourRole: await service.roleOf(auth.orgId, auth.userId),
  });
});

members.post("/members", ...guarded, async (c) => {
  const auth = c.get("auth");
  const body = z.object({ email: z.string().email(), role: z.enum(["admin", "member"]).default("member") }).parse(await c.req.json());
  const member = await new MembershipService(c.env).add(auth, body.email, body.role);
  return c.json({ userId: member.user_id, name: member.name, email: member.email, role: member.role }, 201);
});

members.put("/members/:userId/role", ...guarded, async (c) => {
  const auth = c.get("auth");
  const { role } = z.object({ role: z.enum(["admin", "member"]) }).parse(await c.req.json());
  await new MembershipService(c.env).setRole(auth, c.req.param("userId"), role);
  return c.body(null, 204);
});

members.post("/members/:userId/transfer-ownership", ...guarded, async (c) => {
  const auth = c.get("auth");
  await new MembershipService(c.env).transferOwnership(auth, c.req.param("userId"));
  return c.body(null, 204);
});

members.delete("/members/:userId", ...guarded, async (c) => {
  const auth = c.get("auth");
  await new MembershipService(c.env).remove(auth, c.req.param("userId"));
  return c.body(null, 204);
});
