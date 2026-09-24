import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { createDb } from "../../db/client";
import { requireAuth } from "../middleware/auth";
import {
  createVehicle,
  listVehiclesForRunner,
  setVehicleActive,
  updateVehicle,
} from "../../db/repositories/vehicles";

const vehicles = new Hono<AppEnv>();
// Not runner-only: a vehicle profile is also how any user lists a vehicle
// for rent (CLAUDE.md "Vehicle rental (peer-to-peer)") — ownership isn't
// tied to holding the runner role.
vehicles.use("*", requireAuth);

const carSegments = ["hatchback", "sedan", "suv", "mpv", "pickup", "van"] as const;
const aircondConditions = ["excellent", "good", "fair", "poor"] as const;

const createSchema = z.object({
  vehicleType: z.enum(["motorcycle", "car"]),
  brand: z.string().min(1),
  model: z.string().min(1),
  plateNumber: z.string().min(1),
  year: z.number().int().optional(),
  engineCc: z.number().int().positive().optional(),
  segment: z.enum(carSegments).optional(),
  seatCount: z.number().int().positive().optional(),
  leatherSeats: z.boolean().optional(),
  aircondCondition: z.enum(aircondConditions).optional(),
});

vehicles.post("/", async (c) => {
  const session = c.get("session")!;
  const body = createSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  const vehicle = await createVehicle(db, { runnerUserId: session.userId, ...body });
  return c.json(vehicle, 201);
});

vehicles.get("/", async (c) => {
  const session = c.get("session")!;
  const db = await createDb(c.env);
  const activeOnly = c.req.query("activeOnly") === "true";
  const list = await listVehiclesForRunner(db, session.userId, { activeOnly });
  return c.json(list);
});

const updateSchema = z.object({
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().nullable().optional(),
  plateNumber: z.string().min(1).optional(),
  engineCc: z.number().int().positive().nullable().optional(),
  segment: z.enum(carSegments).nullable().optional(),
  seatCount: z.number().int().positive().nullable().optional(),
  leatherSeats: z.boolean().optional(),
  aircondCondition: z.enum(aircondConditions).nullable().optional(),
});

vehicles.patch("/:id", async (c) => {
  const body = updateSchema.parse(await c.req.json());
  const db = await createDb(c.env);
  await updateVehicle(db, c.req.param("id"), body);
  return c.json({ ok: true });
});

vehicles.post("/:id/deactivate", async (c) => {
  const db = await createDb(c.env);
  await setVehicleActive(db, c.req.param("id"), false);
  return c.json({ ok: true });
});

vehicles.post("/:id/reactivate", async (c) => {
  const db = await createDb(c.env);
  await setVehicleActive(db, c.req.param("id"), true);
  return c.json({ ok: true });
});

export default vehicles;
