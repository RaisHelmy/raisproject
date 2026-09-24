import { and, eq } from "drizzle-orm";
import type { Db } from "../client";
import { newId, nowIso } from "../ids";
import {
  type aircondConditionValues,
  type carSegmentValues,
  type vehicleTypeValues,
  vehicles,
} from "../schema";
import { withAudit } from "./withAudit";

export type VehicleType = (typeof vehicleTypeValues)[number];
export type CarSegment = (typeof carSegmentValues)[number];
export type AircondCondition = (typeof aircondConditionValues)[number];

export interface CreateVehicleInput {
  runnerUserId: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  plateNumber: string;
  year?: number;
  engineCc?: number;
  segment?: CarSegment;
  seatCount?: number;
  leatherSeats?: boolean;
  aircondCondition?: AircondCondition;
}

function assertCarFieldsOnlyOnCars(input: CreateVehicleInput) {
  const carOnlyFieldsSet =
    input.segment !== undefined ||
    input.seatCount !== undefined ||
    input.aircondCondition !== undefined;
  if (input.vehicleType === "motorcycle" && carOnlyFieldsSet) {
    throw new Error(
      "segment, seatCount, and aircondCondition only apply to vehicleType 'car'",
    );
  }
}

export async function createVehicle(db: Db, input: CreateVehicleInput) {
  assertCarFieldsOnlyOnCars(input);
  const now = nowIso();
  const row = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    runnerUserId: input.runnerUserId,
    vehicleType: input.vehicleType,
    brand: input.brand,
    model: input.model,
    year: input.year ?? null,
    plateNumber: input.plateNumber,
    engineCc: input.engineCc ?? null,
    segment: input.segment ?? null,
    seatCount: input.seatCount ?? null,
    leatherSeats: input.leatherSeats ?? false,
    aircondCondition: input.aircondCondition ?? null,
    active: true,
  };
  return withAudit(
    db,
    { action: "vehicle.create", entityType: "vehicle", entityId: row.id },
    async () => {
      await db.insert(vehicles).values(row);
      return row;
    },
  );
}

export async function getVehicleById(db: Db, vehicleId: string) {
  const rows = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  return rows[0] ?? null;
}

export async function listVehiclesForRunner(
  db: Db,
  runnerUserId: string,
  options: { activeOnly?: boolean } = {},
) {
  const clause =
    options.activeOnly === true
      ? and(eq(vehicles.runnerUserId, runnerUserId), eq(vehicles.active, true))
      : eq(vehicles.runnerUserId, runnerUserId);
  return db.select().from(vehicles).where(clause);
}

export interface UpdateVehicleInput {
  brand?: string;
  model?: string;
  year?: number | null;
  plateNumber?: string;
  engineCc?: number | null;
  segment?: CarSegment | null;
  seatCount?: number | null;
  leatherSeats?: boolean;
  aircondCondition?: AircondCondition | null;
}

export async function updateVehicle(
  db: Db,
  vehicleId: string,
  input: UpdateVehicleInput,
) {
  return withAudit(
    db,
    { action: "vehicle.update", entityType: "vehicle", entityId: vehicleId },
    async () => {
      await db
        .update(vehicles)
        .set({ ...input, updatedAt: nowIso() })
        .where(eq(vehicles.id, vehicleId));
      return { vehicleId, ...input };
    },
  );
}

/** Deactivate rather than delete — a vehicle may be referenced by past jobs. */
export async function setVehicleActive(db: Db, vehicleId: string, active: boolean) {
  return withAudit(
    db,
    { action: "vehicle.set_active", entityType: "vehicle", entityId: vehicleId },
    async () => {
      await db
        .update(vehicles)
        .set({ active, updatedAt: nowIso() })
        .where(eq(vehicles.id, vehicleId));
      return { vehicleId, active };
    },
  );
}
