import { beforeEach, describe, expect, it } from "vitest";
import { createPgTestDb } from "./support/pgTestDb";
import type { Db } from "../src/db/client";
import { createUser } from "../src/db/repositories/users";
import {
  createVehicle,
  listVehiclesForRunner,
  setVehicleActive,
  updateVehicle,
} from "../src/db/repositories/vehicles";

let db: Db;

beforeEach(async () => {
  db = await createPgTestDb();
});

async function seedRunner(db: Db) {
  return createUser(db, {
    realName: "Runner",
    phone: "+60199999999",
    passwordHash: "x",
    handle: "Runner #Z01",
  });
}

describe("vehicles repository", () => {
  it("registers a car with full detail", async () => {
    const runner = await seedRunner(db);
    const vehicle = await createVehicle(db, {
      runnerUserId: runner.id,
      vehicleType: "car",
      brand: "Honda",
      model: "City",
      plateNumber: "WXY 1234",
      year: 2022,
      engineCc: 1500,
      segment: "sedan",
      seatCount: 5,
      leatherSeats: true,
      aircondCondition: "excellent",
    });
    expect(vehicle.active).toBe(true);
    expect(vehicle.segment).toBe("sedan");
  });

  it("registers a motorcycle without car-only fields", async () => {
    const runner = await seedRunner(db);
    const vehicle = await createVehicle(db, {
      runnerUserId: runner.id,
      vehicleType: "motorcycle",
      brand: "Yamaha",
      model: "Y15ZR",
      plateNumber: "PQR 9988",
      engineCc: 150,
    });
    expect(vehicle.segment).toBeNull();
    expect(vehicle.seatCount).toBeNull();
  });

  it("rejects car-only fields on a motorcycle", async () => {
    const runner = await seedRunner(db);
    await expect(
      createVehicle(db, {
        runnerUserId: runner.id,
        vehicleType: "motorcycle",
        brand: "Yamaha",
        model: "Y15ZR",
        plateNumber: "PQR 9988",
        seatCount: 2,
      }),
    ).rejects.toThrow(/only apply to vehicleType 'car'/);
  });

  it("lets a runner register multiple vehicles and lists only active ones on request", async () => {
    const runner = await seedRunner(db);
    const car = await createVehicle(db, {
      runnerUserId: runner.id,
      vehicleType: "car",
      brand: "Perodua",
      model: "Myvi",
      plateNumber: "ABC 1111",
    });
    const bike = await createVehicle(db, {
      runnerUserId: runner.id,
      vehicleType: "motorcycle",
      brand: "Honda",
      model: "EX5",
      plateNumber: "ABC 2222",
    });

    expect(await listVehiclesForRunner(db, runner.id)).toHaveLength(2);

    await setVehicleActive(db, bike.id, false);
    const activeOnly = await listVehiclesForRunner(db, runner.id, { activeOnly: true });
    expect(activeOnly.map((v) => v.id)).toEqual([car.id]);
  });

  it("updates vehicle detail fields", async () => {
    const runner = await seedRunner(db);
    const vehicle = await createVehicle(db, {
      runnerUserId: runner.id,
      vehicleType: "car",
      brand: "Toyota",
      model: "Vios",
      plateNumber: "DEF 3333",
    });
    await updateVehicle(db, vehicle.id, { leatherSeats: true, aircondCondition: "good" });
    const [updated] = await listVehiclesForRunner(db, runner.id);
    expect(updated?.leatherSeats).toBe(true);
    expect(updated?.aircondCondition).toBe("good");
  });
});
