import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth } from "../middleware/auth";
import {
  acceptContractOffer,
  createContract,
  createContractOffer,
  listContractsForGroup,
  listOffersForContract,
} from "../../db/repositories/vendorContracts";

const vendorContracts = new Hono<AppEnv>();
vendorContracts.use("*", requireAuth);

const dayCode = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const createSchema = z.object({
  vendorId: z.string(),
  pricePerMealMinor: z.number().int().positive(),
  daysOfWeek: z.array(dayCode).min(1),
  mealTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  menuTerms: z.string().optional(),
  contractStart: z.string(),
  contractEnd: z.string().optional(),
});

/** Corporate catering contract shell — starts `negotiating` — CLAUDE.md "Vendor corporate contracts". */
vendorContracts.post("/", async (c) => {
  const session = c.get("session")!;
  if (!session.groupId) return c.json({ error: "a group (company) context is required" }, 400);
  const body = createSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const contract = await createContract(db, { groupId: session.groupId, ...body });
  return c.json(contract, 201);
});

vendorContracts.get("/", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  return c.json(await listContractsForGroup(db, session.groupId));
});

const offerSchema = z.object({
  proposedPricePerMealMinor: z.number().int().positive(),
  proposedTerms: z.string().optional(),
});

vendorContracts.post("/:id/offers", async (c) => {
  const session = c.get("session")!;
  const body = offerSchema.parse(await c.req.json());
  const proposedByRole = session.activeRole === "vendor" ? "vendor" : "group";
  const db = await createDb(c.env);
  const offer = await createContractOffer(db, {
    contractId: c.req.param("id"),
    proposedByRole,
    proposedByUserId: session.userId,
    ...body,
  });
  return c.json(offer, 201);
});

vendorContracts.get("/:id/offers", async (c) => {
  const db = await createDb(c.env);
  return c.json(await listOffersForContract(db, c.req.param("id")));
});

vendorContracts.post("/offers/:offerId/accept", async (c) => {
  const db = await createDb(c.env);
  return c.json(await acceptContractOffer(db, c.req.param("offerId")));
});

export default vendorContracts;
