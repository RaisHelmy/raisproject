import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireRole } from "../middleware/auth";
import { createVendor, listVendorsForGroup } from "../../db/repositories/vendors";

const vendors = new Hono<AppEnv>();
vendors.use("*", requireRole("vendor"));

const createSchema = z.object({ businessName: z.string().min(1) });

vendors.post("/", async (c) => {
  const session = c.get("session")!;
  const body = createSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const vendor = await createVendor(db, session.groupId, session.userId, body.businessName);
  return c.json(vendor, 201);
});

vendors.get("/", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await listVendorsForGroup(db, session.groupId));
});

export default vendors;
