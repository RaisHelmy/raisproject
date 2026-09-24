import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { createProduct, listProductsForVendor, setProductActive, updateProductPrice } from "../../db/repositories/products";

const products = new Hono<AppEnv>();
products.use("*", requireAuth);

const createSchema = z.object({
  vendorId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  priceMinor: z.number().int().positive(),
});

/** Vendor catalogue — build order Step 13, brought forward as a prerequisite for corporate catering contracts. */
products.post("/", requireRole("vendor"), async (c) => {
  const session = c.get("session")!;
  const body = createSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const product = await createProduct(db, { ...body, groupId: session.groupId });
  return c.json(product, 201);
});

products.get("/for-vendor/:vendorId", async (c) => {
  const db = await createDb(c.env);
  const activeOnly = c.req.query("activeOnly") !== "false";
  return c.json(await listProductsForVendor(db, c.req.param("vendorId"), { activeOnly }));
});

const priceSchema = z.object({ priceMinor: z.number().int().positive() });

products.patch("/:id/price", requireRole("vendor"), async (c) => {
  const body = priceSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await updateProductPrice(db, c.req.param("id"), body.priceMinor);
  return c.json({ ok: true });
});

products.post("/:id/deactivate", requireRole("vendor"), async (c) => {
  const db = await createDb(c.env);
  await setProductActive(db, c.req.param("id"), false);
  return c.json({ ok: true });
});

products.post("/:id/reactivate", requireRole("vendor"), async (c) => {
  const db = await createDb(c.env);
  await setProductActive(db, c.req.param("id"), true);
  return c.json({ ok: true });
});

export default products;
